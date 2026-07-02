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

/**
 * Minimal Standard Schema V1 surface — see https://standardschema.dev. Any
 * validation library that implements the spec (Zod 3.24+, Valibot, ArkType,
 * Effect, etc.) satisfies this interface without an adapter or dep. We declare
 * the types locally so this package stays dependency-free.
 */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (
      value: unknown,
    ) =>
      | StandardSchemaV1.Result<Output>
      | Promise<StandardSchemaV1.Result<Output>>;
    readonly types?: {
      readonly input: Input;
      readonly output: Output;
    };
  };
}

export namespace StandardSchemaV1 {
  export type Result<Output> =
    | { readonly value: Output; readonly issues?: undefined }
    | { readonly issues: ReadonlyArray<Issue> };

  export interface Issue {
    readonly message: string;
    readonly path?: ReadonlyArray<PropertyKey | PathSegment>;
  }

  export interface PathSegment {
    readonly key: PropertyKey;
  }

  export type InferInput<S> =
    S extends StandardSchemaV1<infer In, unknown> ? In : unknown;
}

export class ToolValidationError extends Error {
  override readonly name = "ToolValidationError";
  readonly issues: ReadonlyArray<StandardSchemaV1.Issue>;
  constructor(toolName: string, issues: ReadonlyArray<StandardSchemaV1.Issue>) {
    const summary = issues
      .slice(0, 3)
      .map((i) => i.message)
      .join("; ");
    super(`Tool "${toolName}" input validation failed: ${summary}`);
    this.issues = issues;
  }
}

export interface DefineToolOptions<
  Schema extends StandardSchemaV1 | undefined = undefined,
  TOutput = unknown,
> {
  name: string;
  description: string;
  /**
   * Optional Standard Schema (Zod / Valibot / ArkType / etc.) used purely to
   * narrow `execute`'s input type. Runtime validation is opt-in via
   * `validate: true`. Standard Schema doesn't emit JSON Schema, so pass
   * `inputSchema` explicitly when the host needs it for tool dispatch.
   */
  input?: Schema;
  /** Raw JSON Schema for the host. Stays explicit; the SDK does not derive it from `input`. */
  inputSchema?: object;
  readOnly?: boolean;
  destructive?: boolean;
  annotations?: ToolAnnotations;
  /**
   * When `true`, run `input.~standard.validate` before `execute` and throw
   * `ToolValidationError` on failure. Default `false` — most WebMCP hosts
   * validate against `inputSchema` themselves, so the SDK doesn't double up.
   */
  validate?: boolean;
  execute: (
    input: Schema extends StandardSchemaV1
      ? StandardSchemaV1.InferInput<Schema>
      : unknown,
  ) => Promise<TOutput> | TOutput;
}

const validateInput = async <Output>(
  schema: StandardSchemaV1<unknown, Output>,
  value: unknown,
  toolName: string,
): Promise<Output> => {
  const result = await schema["~standard"].validate(value);
  if ("issues" in result && result.issues) {
    throw new ToolValidationError(toolName, result.issues);
  }
  return (result as { value: Output }).value;
};

/**
 * Build a `Tool` whose `execute` is typed against an optional Standard Schema
 * (Zod / Valibot / ArkType / etc.) without forcing the SDK to take a dep on
 * any specific library. Pass `validate: true` to also run the schema at
 * runtime; otherwise the schema is type-only and `execute` runs verbatim.
 *
 * The returned object is a plain `Tool` and can be passed to `registerTool`
 * or the React `useWebMCP` hook unchanged.
 */
export const defineTool = <
  Schema extends StandardSchemaV1 | undefined = undefined,
  TOutput = unknown,
>(
  options: DefineToolOptions<Schema, TOutput>,
): Tool<
  Schema extends StandardSchemaV1
    ? StandardSchemaV1.InferInput<Schema>
    : unknown,
  TOutput
> => {
  type Input = Schema extends StandardSchemaV1
    ? StandardSchemaV1.InferInput<Schema>
    : unknown;

  const baseExecute = options.execute as (
    input: Input,
  ) => Promise<TOutput> | TOutput;
  const execute: (input: Input) => Promise<TOutput> | TOutput =
    options.validate && options.input
      ? async (input: Input) => {
          const validated = (await validateInput(
            options.input as StandardSchemaV1<unknown, Input>,
            input,
            options.name,
          )) as Input;
          return baseExecute(validated);
        }
      : baseExecute;

  const tool: Tool<Input, TOutput> = {
    name: options.name,
    description: options.description,
    execute,
  };
  if (options.inputSchema !== undefined) tool.inputSchema = options.inputSchema;
  if (options.readOnly) tool.readOnly = true;
  if (options.destructive) tool.destructive = true;
  if (options.annotations) tool.annotations = options.annotations;
  return tool;
};

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
  registerTool: (
    def: RegisteredTool,
    options?: RegisterToolOptions,
  ) => Promise<void> | void;
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
 * Normalize the native `registerTool` call into a `Promise<void>`, supporting
 * both the legacy synchronous shape (returns `undefined`, throws on duplicate)
 * and the spec-current asynchronous shape (returns `Promise<void>`, rejects on
 * duplicate). Cross-origin iframe tool sharing made registration inherently
 * asynchronous — see WebMCP spec issue #175 / PR #228.
 */
const callRegister = (
  mc: ModelContext,
  registered: RegisteredTool,
  controller: AbortController,
): Promise<void> => {
  try {
    return Promise.resolve(
      mc.registerTool(registered, { signal: controller.signal }),
    );
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
  registered: RegisteredTool,
  controller: AbortController,
): Promise<boolean> => {
  // If we still hold a live controller for this name, evict it before the
  // native register call so Chrome doesn't reject with InvalidStateError.
  const prior = ownedControllers.get(registered.name);
  if (prior && prior !== controller && !prior.signal.aborted) {
    prior.abort();
  }

  try {
    await callRegister(mc, registered, controller);
  } catch (err) {
    // If our own controller was aborted (a later caller evicted us, or our
    // cleanup fired, while registration was still pending), treat it as a
    // clean cancellation — no log, no retry.
    if (controller.signal.aborted) return false;

    if (!isDuplicateNameError(err)) {
      // Unrecoverable first-call failure: log and give up (no throw).
      if (typeof console !== "undefined") {
        console.error(
          `[@web-ai-sdk/webmcp] tool "${registered.name}" could not be registered: ${(err as Error)?.message ?? String(err)}`,
        );
      }
      return false;
    }

    // Duplicate: Chrome's AbortSignal-driven unregistration isn't guaranteed
    // to have drained by the time our (now async) rejection landed. A fresh
    // re-register fired right after an abort can still race the queued
    // removal. Yield once and retry. If the retry also fails, log and give up.
    await Promise.resolve();
    if (controller.signal.aborted) return false;
    try {
      await callRegister(mc, registered, controller);
    } catch (retryErr) {
      if (controller.signal.aborted) return false;
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
  // Fire-and-forget: registerOne is total (never rejects — see its contract),
  // so there is no unhandled-rejection risk. The sync cleanup below aborts the
  // controller; if registration is still pending, the abort propagates to the
  // host and registerOne treats it as a clean cancellation.
  void registerOne(mc, registered, controller);

  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    controller.abort();
  };
};
