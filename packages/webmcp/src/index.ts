/**
 * Building block for the W3C WebMCP API exposed at `navigator.modelContext`.
 *
 * Adapts the native browser API into a shape that's pleasant to call from
 * app code, with AbortSignal-based cleanup and a feature-detected no-op
 * fallback for non-supporting browsers.
 *
 * Spec: https://webmachinelearning.github.io/webmcp/
 */

export interface ToolAnnotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

export interface Tool<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema?: object;
  /** Shorthand for `annotations.readOnlyHint = true`. */
  readOnly?: boolean;
  /** Shorthand for `annotations.destructiveHint = true`. */
  destructive?: boolean;
  /** Raw passthrough; merged on top of the shorthand flags. */
  annotations?: ToolAnnotations;
  execute: (input: TInput) => Promise<TOutput> | TOutput;
}

interface RegisteredTool {
  name: string;
  description: string;
  inputSchema?: object;
  annotations?: ToolAnnotations;
  execute: (input: unknown) => Promise<unknown> | unknown;
}

interface RegisterToolOptions {
  signal?: AbortSignal;
}

interface ModelContext {
  registerTool: (def: RegisteredTool, options?: RegisterToolOptions) => void;
}

interface NavigatorWithModelContext {
  modelContext?: ModelContext;
}

/** Returns the native `navigator.modelContext` if present, else `undefined`. */
export const getModelContext = (): ModelContext | undefined => {
  if (typeof navigator === "undefined") return undefined;
  return (navigator as NavigatorWithModelContext).modelContext;
};

/** Whether the current environment exposes the WebMCP API. */
export const isWebMCPAvailable = (): boolean => getModelContext() !== undefined;

const toRegistered = (tool: Tool): RegisteredTool => {
  const annotations: ToolAnnotations = {
    ...(tool.readOnly ? { readOnlyHint: true } : {}),
    ...(tool.destructive ? { destructiveHint: true } : {}),
    ...tool.annotations,
  };

  const registered: RegisteredTool = {
    name: tool.name,
    description: tool.description,
    execute: tool.execute as RegisteredTool["execute"],
  };
  if (tool.inputSchema !== undefined) registered.inputSchema = tool.inputSchema;
  if (Object.keys(annotations).length > 0) registered.annotations = annotations;
  return registered;
};

/**
 * Module-level ownership map. Tracks which AbortController this library is
 * currently using for each tool name. Lets us evict a stale registration
 * when a fresh call comes in for the same name (e.g. two React components
 * registering the same tool during an HMR transition, or a route
 * change where the prior instance's cleanup hasn't fired yet). Last writer
 * wins; the stale caller's cleanup becomes a no-op.
 */
const ownedControllers = new Map<string, AbortController>();

const isDuplicateNameError = (err: unknown): boolean =>
  /duplicate/i.test((err as Error)?.message ?? "");

const trackOwnership = (controller: AbortController, name: string): void => {
  ownedControllers.set(name, controller);
  controller.signal.addEventListener("abort", () => {
    // Only clear the map slot if we're still the owner; a later writer may
    // have taken over.
    if (ownedControllers.get(name) === controller) {
      ownedControllers.delete(name);
    }
  });
};

/**
 * Returns `true` if registration succeeded synchronously with `controller`,
 * `false` if a transient duplicate was hit and we scheduled a microtask
 * retry (the registration will land asynchronously), or if another caller
 * permanently owns the name.
 */
const registerOne = (
  mc: ModelContext,
  registered: RegisteredTool,
  controller: AbortController,
): boolean => {
  // If we still hold a live controller for this name, evict it before the
  // native register call so Chrome doesn't throw InvalidStateError.
  const prior = ownedControllers.get(registered.name);
  if (prior && prior !== controller && !prior.signal.aborted) {
    prior.abort();
  }
  try {
    mc.registerTool(registered, { signal: controller.signal });
  } catch (err) {
    if (!isDuplicateNameError(err)) throw err;
    // Chrome's AbortSignal-driven unregistration isn't guaranteed to
    // propagate to the registry in the same tick as `.abort()`. A fresh
    // re-register fired immediately after an abort (e.g. React effect
    // cleanup → mount cycle, or a hook re-running on dep change) can land
    // before Chrome processes the queued removal. Yield to a microtask and
    // retry once. If the retry also fails, log and give up.
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      try {
        mc.registerTool(registered, { signal: controller.signal });
        trackOwnership(controller, registered.name);
      } catch (retryErr) {
        if (isDuplicateNameError(retryErr)) {
          if (typeof console !== "undefined") {
            console.warn(
              `[@web-ai-sdk/webmcp] tool "${registered.name}" is already registered by another caller; skipping. This is usually a transient race. If you see it in production, ensure only one caller registers each name.`,
            );
          }
          return;
        }
        throw retryErr;
      }
    });
    return false;
  }
  trackOwnership(controller, registered.name);
  return true;
};

/**
 * Register a single tool. Returns a cleanup function that unregisters it.
 *
 * Cleanup is wired through an `AbortSignal` passed to the native
 * `registerTool`, matching the W3C convention used by the Chrome
 * implementation. Calling the returned cleanup twice is a no-op.
 *
 * If WebMCP is unavailable, the call is a no-op and the cleanup is a no-op.
 */
export const registerTool = <TInput, TOutput>(
  tool: Tool<TInput, TOutput>,
): (() => void) => {
  const mc = getModelContext();
  if (!mc) return () => {};

  const registered = toRegistered(tool as Tool);
  const controller = new AbortController();
  registerOne(mc, registered, controller);

  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    controller.abort();
  };
};

/**
 * Register multiple tools in one call. Returns a single cleanup that
 * unregisters every tool that was registered.
 *
 * All tools share one AbortController, so the cleanup tears them down
 * atomically.
 */
export const registerTools = (tools: readonly Tool[]): (() => void) => {
  const mc = getModelContext();
  if (!mc) return () => {};

  const controller = new AbortController();
  try {
    for (const tool of tools) {
      registerOne(mc, toRegistered(tool), controller);
    }
  } catch (err) {
    // A non-duplicate error from the native call shouldn't leave us in a
    // partial state. Roll back what we registered before re-throwing.
    controller.abort();
    throw err;
  }

  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    controller.abort();
  };
};
