/**
 * Building block for the W3C WebMCP API exposed at `document.modelContext`.
 * For backward compatibility with the previous shape of the API, this
 * package also reads from `navigator.modelContext`.
 *
 * Adapts the native browser API into a shape that's pleasant to call from
 * app code, with AbortSignal-based cleanup and a feature-detected no-op
 * fallback for non-supporting browsers.
 *
 * Spec: https://webmachinelearning.github.io/webmcp/
 */

import {
  normalizeToolDefinition,
  type RegistrableTool,
  type StandardSchemaV1,
  type ToolDefinition,
} from "./definition.js";
import {
  type RegisteredToolMetadata,
  type Tool,
  type ToolExecuteCallbackOptions,
  toRegisteredToolMetadata,
} from "./tool.js";

export type {
  DefineToolOptions,
  StandardSchemaV1,
  ToolDefinition,
} from "./definition.js";
export {
  defineTool,
  ToolOutputValidationError,
  ToolValidationError,
} from "./definition.js";
export type {
  Tool,
  ToolAnnotations,
  ToolExecuteCallbackOptions,
} from "./tool.js";

interface NativeToolDefinition extends RegisteredToolMetadata {
  execute: (
    input: unknown,
    options?: ToolExecuteCallbackOptions,
  ) => Promise<unknown> | unknown;
}

/** Options forwarded to the native WebMCP registration. */
export interface RegisterToolOptions {
  /**
   * Origins of descendant documents that may discover this tool. The browser
   * validates these values; the SDK forwards the array unchanged.
   */
  exposedTo?: readonly string[];
}

interface NativeRegisterToolOptions extends RegisterToolOptions {
  signal?: AbortSignal;
}

/** Origins whose descendant documents should be queried for exposed tools. */
export interface GetToolsOptions {
  fromOrigins?: readonly string[];
}

/** Metadata returned by the native WebMCP discovery surface. */
export interface RegisteredTool {
  name: string;
  title?: string;
  description: string;
  /** The browser returns the registered JSON Schema as a serialized string. */
  inputSchema?: string;
  /** Window belonging to the document that registered the tool. */
  window: Window;
  /** Serialized origin of the document that registered the tool. */
  origin: string;
  annotations?: import("./tool.js").ToolAnnotations;
}

/** Options forwarded to native tool execution. */
export interface ExecuteToolOptions {
  signal?: AbortSignal;
}

interface ModelContext {
  registerTool: (
    def: NativeToolDefinition,
    options?: NativeRegisterToolOptions,
  ) => Promise<void> | void;
  getTools?: (options?: GetToolsOptions) => Promise<RegisteredTool[]>;
  executeTool?: (
    tool: RegisteredTool,
    inputArguments: string,
    options?: ExecuteToolOptions,
  ) => Promise<string | null>;
  addEventListener?: EventTarget["addEventListener"];
  removeEventListener?: EventTarget["removeEventListener"];
}

interface HostWithModelContext {
  modelContext?: ModelContext;
}

// Read from `document.modelContext` (the spec entry point). Fall back to
// `navigator.modelContext` for backward compatibility with the previous
// shape of the API.
const getModelContext = (): ModelContext | undefined => {
  if (typeof document !== "undefined") {
    const fromDocument = (document as unknown as HostWithModelContext)
      .modelContext;
    if (fromDocument) return fromDocument;
  }
  if (typeof navigator !== "undefined") {
    return (navigator as unknown as HostWithModelContext).modelContext;
  }
  return undefined;
};

/** Whether the current environment exposes the WebMCP API. */
export const isAvailable = (): boolean => getModelContext() !== undefined;

const toRegistered = (tool: Tool): NativeToolDefinition => {
  return {
    ...toRegisteredToolMetadata(tool),
    execute: tool.execute as NativeToolDefinition["execute"],
  };
};

/**
 * Discover the tools exposed to the current document.
 *
 * Returns an empty array when WebMCP discovery is unavailable. Native
 * permission, origin-validation, and document-state failures are preserved.
 */
export const getTools = async (
  options?: GetToolsOptions,
): Promise<RegisteredTool[]> => {
  const mc = getModelContext();
  if (!mc?.getTools) return [];
  return mc.getTools(options);
};

/** Raised when the current host cannot execute discovered WebMCP tools. */
export class WebMCPUnavailableError extends Error {
  override readonly name = "WebMCPUnavailableError";
}

/**
 * Execute a tool returned by `getTools()`.
 *
 * The SDK accepts the JavaScript input value and serializes it to the JSON
 * string required by the native API. The native serialized result is returned
 * unchanged; `null` means execution triggered a navigation.
 *
 * @experimental Chrome publicly documents tool execution at
 * https://developer.chrome.com/docs/ai/webmcp, but it is not yet present in
 * the published WebMCP community draft.
 */
export const executeTool = async (
  tool: RegisteredTool,
  input: unknown = {},
  options?: ExecuteToolOptions,
): Promise<string | null> => {
  const mc = getModelContext();
  if (!mc?.executeTool) {
    throw new WebMCPUnavailableError(
      "WebMCP tool execution is unavailable in this browser.",
    );
  }

  const inputArguments = JSON.stringify(input);
  if (inputArguments === undefined) {
    throw new TypeError("WebMCP tool input must be JSON-serializable.");
  }
  return mc.executeTool(tool, inputArguments, options);
};

/**
 * Subscribe to changes in the tools exposed to the current document.
 * Returns an idempotent no-op cleanup when the event surface is unavailable.
 */
export const subscribeToToolChanges = (
  listener: (event: Event) => void,
): (() => void) => {
  const mc = getModelContext();
  if (!mc?.addEventListener || !mc.removeEventListener) return () => {};

  mc.addEventListener("toolchange", listener);
  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    mc.removeEventListener?.("toolchange", listener);
  };
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

/**
 * Outcome of one async native registration, shared between the registration
 * pipeline and the synchronous cleanup returned by `registerTool`.
 *
 * Affected browser builds attach the signal's unregister algorithm before
 * validating registration options (see WebMCP PR #240), so a rejected
 * registration can leave a stale unregister algorithm on our signal. Cleanup
 * must therefore never abort once the outcome is `"failed"`: nothing of ours
 * is registered, and the stale algorithm could remove a later valid tool
 * with the same name.
 */
interface RegistrationState {
  outcome: "pending" | "registered" | "failed";
}

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
 * Normalize the native `registerTool` call into a `Promise<void>`, supporting
 * both the legacy synchronous shape (returns `undefined`, throws on duplicate)
 * and the spec-current asynchronous shape (returns `Promise<void>`, rejects on
 * duplicate). Cross-origin iframe tool sharing made registration inherently
 * asynchronous — see WebMCP spec issue #175 / PR #228.
 */
const callRegister = (
  mc: ModelContext,
  registered: NativeToolDefinition,
  controller: AbortController,
  options?: RegisterToolOptions,
): Promise<void> => {
  const nativeOptions: NativeRegisterToolOptions = {
    signal: controller.signal,
  };
  if (options?.exposedTo !== undefined) {
    nativeOptions.exposedTo = options.exposedTo;
  }

  try {
    return Promise.resolve(mc.registerTool(registered, nativeOptions));
  } catch (err) {
    return Promise.reject(err);
  }
};

/**
 * Register a single tool against the host modelContext, async-safe.
 *
 * Must be **total**: it never rejects. Every failure path logs and resolves
 * `false`. That invariant is what lets `registerTool` fire-and-forget the
 * returned promise without an unhandled-rejection guard.
 *
 * Returns `true` if registration succeeded (ownership tracked), `false`
 * otherwise. The return value is unused by the caller today; kept for symmetry.
 *
 * Error posture follows the package's "feature detect, never throw" contract:
 * a first-call non-duplicate failure used to `throw` to the caller (catchable
 * only while registration was synchronous); the spec's async registration
 * update makes that throw uncatchable, so it is now logged — matching the
 * retry path.
 */
const registerOne = async (
  mc: ModelContext,
  registered: NativeToolDefinition,
  controller: AbortController,
  state: RegistrationState,
  options?: RegisterToolOptions,
): Promise<boolean> => {
  // If we still hold a live controller for this name, evict it before the
  // native register call so the browser doesn't reject with InvalidStateError.
  const prior = ownedControllers.get(registered.name);
  if (prior && prior !== controller && !prior.signal.aborted) {
    prior.abort();
  }

  try {
    await callRegister(mc, registered, controller, options);
  } catch (err) {
    // If our own controller was aborted (a later caller evicted us, or our
    // cleanup fired, while registration was still pending), treat it as a
    // clean cancellation — no log, no retry.
    if (controller.signal.aborted) return false;

    if (!isDuplicateNameError(err)) {
      // Unrecoverable first-call failure: log and give up (no throw).
      state.outcome = "failed";
      if (typeof console !== "undefined") {
        console.error(
          `[@web-ai-sdk/webmcp] tool "${registered.name}" could not be registered: ${(err as Error)?.message ?? String(err)}`,
        );
      }
      return false;
    }

    // Duplicate: AbortSignal-driven unregistration isn't guaranteed
    // to have drained by the time our (now async) rejection landed. A fresh
    // re-register fired right after an abort can still race the queued
    // removal. Yield once and retry. If the retry also fails, log and give up.
    await Promise.resolve();
    if (controller.signal.aborted) return false;
    try {
      await callRegister(mc, registered, controller, options);
    } catch (retryErr) {
      if (controller.signal.aborted) return false;
      state.outcome = "failed";
      if (isDuplicateNameError(retryErr)) {
        if (typeof console !== "undefined") {
          console.warn(
            `[@web-ai-sdk/webmcp] tool "${registered.name}" is already registered by another caller; skipping. This is usually a transient race. If you see it in production, ensure only one caller registers each name.`,
          );
        }
        return false;
      }
      if (typeof console !== "undefined") {
        console.error(
          `[@web-ai-sdk/webmcp] tool "${registered.name}" could not be registered after retry: ${(retryErr as Error)?.message ?? String(retryErr)}`,
        );
      }
      return false;
    }
  }

  state.outcome = "registered";
  trackOwnership(controller, registered.name);
  return true;
};

/** Register a schema-aware definition with optional native options. */
export function registerTool<
  InputSchema extends StandardSchemaV1 | undefined = undefined,
  TOutput = unknown,
  OutputSchema extends StandardSchemaV1 | undefined = undefined,
>(
  tool: ToolDefinition<InputSchema, TOutput, OutputSchema>,
  options?: RegisterToolOptions,
): () => void;
/** Register a plain tool with optional native registration options. */
export function registerTool<TInput, TOutput>(
  tool: Tool<TInput, TOutput>,
  options?: RegisterToolOptions,
): () => void;
/** Preserve the documented `tools.map(registerTool)` callback shape. */
export function registerTool(
  tool: RegistrableTool,
  index: number,
  tools: readonly RegistrableTool[],
): () => void;
/**
 * Register a single tool. Returns a cleanup function that unregisters it.
 *
 * Cleanup is wired through an `AbortSignal` passed to the native
 * `registerTool`, matching the W3C convention used by the native API. Calling
 * the returned cleanup twice is a no-op.
 *
 * If WebMCP is unavailable, the call is a no-op and the cleanup is a no-op.
 */
export function registerTool(
  tool: RegistrableTool,
  optionsOrIndex?: RegisterToolOptions | number,
  _tools?: readonly RegistrableTool[],
): () => void {
  const options =
    typeof optionsOrIndex === "number" ? undefined : optionsOrIndex;
  const mc = getModelContext();
  if (!mc) return () => {};

  const registered = toRegistered(normalizeToolDefinition(tool));
  const controller = new AbortController();
  const state: RegistrationState = { outcome: "pending" };
  // Fire-and-forget: registerOne is total (never rejects — see its contract),
  // so there is no unhandled-rejection risk. The sync cleanup below aborts the
  // controller; if registration is still pending, the abort propagates to the
  // host and registerOne treats it as a clean cancellation.
  void registerOne(mc, registered, controller, state, options);

  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    // Once the native registration has rejected there is nothing of ours to
    // unregister, and aborting would fire any stale unregister algorithm the
    // failed attempt left on our signal (see RegistrationState) — which could
    // remove a later valid tool registered under the same name.
    if (state.outcome === "failed") return;
    controller.abort();
  };
}
