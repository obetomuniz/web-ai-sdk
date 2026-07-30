/**
 * Independent, never-shared `LanguageModel` sessions for chat-shaped apps.
 *
 * `ask()` may share a warm base session through `getOrCreateLanguageModel`,
 * but every one-shot prompt runs on a clone or fresh instance. `createSession()`
 * bypasses that cache entirely so every caller owns its own chat-shaped
 * instance with its own history, system prompt, sampling, and lifecycle.
 *
 * The wrapper is intentionally thin. It handles cross-browser smoothing that
 * every consumer would otherwise reimplement (delta-vs-cumulative chunk
 * detection, control-character cleanup, abort composition, typed unavailability)
 * and forwards everything else to the native instance. It does NOT track
 * conversation history or queue concurrent sends; those are the consumer's
 * data model and UI concerns. It does surface `clone()`, since forking a warm
 * base session is the spec's recommended way to start a fresh task without
 * re-parsing the system prompt or paying another `create()`.
 */

import {
  type CreateMonitor,
  getLanguageModelApi,
  type LanguageModelApi,
  type LanguageModelCreateOptions,
  type LanguageModelExpectedInput,
  type LanguageModelExpectedOutput,
  type LanguageModelInstance,
  type LanguageModelMessage,
  type LanguageModelPromptOptions,
  type LanguageModelSamplingMode,
  type LanguageModelTool,
} from "./api.js";

const NORMALIZE_LANG = (lang: string): string =>
  lang.split("-")[0]?.toLowerCase() ?? lang.toLowerCase();

const DEFAULT_SUPPORTED_LANGUAGES = ["en"] as const;

export class PromptUnavailableError extends Error {
  override readonly name = "PromptUnavailableError";
}

export class SessionDestroyedError extends Error {
  override readonly name = "SessionDestroyedError";
  constructor() {
    super("Session has been destroyed");
  }
}

export class PromptAbortError extends Error {
  override readonly name = "AbortError";
  constructor() {
    super("Prompt aborted");
  }
}

export const buildLangHints = (
  language: string | undefined,
  supported: readonly string[] | undefined,
): {
  expectedInputs?: LanguageModelExpectedInput[];
  expectedOutputs?: LanguageModelExpectedOutput[];
} => {
  if (!language) return {};
  const lang = NORMALIZE_LANG(language);
  const set = new Set(supported ?? DEFAULT_SUPPORTED_LANGUAGES);
  if (!set.has(lang)) return {};
  return {
    expectedInputs: [{ type: "text", languages: [lang] }],
    expectedOutputs: [{ type: "text", languages: [lang] }],
  };
};

/**
 * Strip non-printing characters from a model response:
 *   - C0 control codes (U+0000..U+001F) except TAB/LF/CR
 *   - DEL + C1 controls (U+007F..U+009F)
 *   - Soft hyphen (U+00AD)
 *   - Zero-width / joiner / direction marks (U+200B..U+200F, U+202A..U+202E,
 *     U+2060..U+206F)
 *   - BOM (U+FEFF)
 *
 * Edge's safety pipeline has been observed returning runs of `` (CANCEL)
 * as a "soft block" placeholder instead of throwing or returning empty;
 * these strip away here so callers can treat empty-after-clean as "model
 * returned nothing meaningful."
 */
const NON_PRINTING = new RegExp(
  "[" +
    "\\u0000-\\u0008" + // C0 except TAB/LF/CR
    "\\u000B\\u000C" + // VT, FF
    "\\u000E-\\u001F" + // rest of C0
    "\\u007F-\\u009F" + // DEL + C1
    "\\u00AD" + // soft hyphen
    "\\u200B-\\u200F" + // zero-width + LTR/RTL marks
    "\\u202A-\\u202E" + // bidi
    "\\u2060-\\u206F" + // word joiner + reserved
    "\\uFEFF" + // BOM
    "]",
  "g",
);

/**
 * Strip non-printing characters without trimming surrounding whitespace.
 * Safe to apply per streamed delta — inter-token spaces are preserved.
 */
export const stripNonPrinting = (raw: string): string =>
  raw.replace(NON_PRINTING, "");

/**
 * Final response cleanup: strip non-printing characters and trim
 * leading/trailing whitespace. Apply at the end of a turn, not per delta.
 */
export const cleanResponse = (raw: string): string =>
  stripNonPrinting(raw).trim();

/**
 * The W3C Web AI streaming contract is ambiguous between "delta" (each chunk
 * is new content) and "cumulative" (each chunk is the full text so far).
 * Chrome ships delta; some Edge backends (notably Phi-Silica on Copilot+
 * PCs) ship cumulative. Detect per-chunk: if the chunk starts with the prior
 * buffer, treat as cumulative (replace); otherwise treat as delta (append).
 *
 * Returns `{ buffer, delta }` so streaming surfaces can decide whether to
 * hand callers cumulative text (`buffer`) or the new piece (`delta`).
 */
export const mergeStreamChunk = (
  buffer: string,
  chunk: string,
): { buffer: string; delta: string } => {
  if (chunk.startsWith(buffer)) {
    return { buffer: chunk, delta: chunk.slice(buffer.length) };
  }
  return { buffer: buffer + chunk, delta: chunk };
};

export const assertValidSamplingOptions = (options: {
  samplingMode?: LanguageModelSamplingMode;
  temperature?: number;
  topK?: number;
  createOptions?: Partial<LanguageModelCreateOptions>;
}): void => {
  const samplingMode =
    options.samplingMode ?? options.createOptions?.samplingMode;
  const hasTemperature =
    options.temperature !== undefined ||
    options.createOptions?.temperature !== undefined;
  const hasTopK =
    options.topK !== undefined || options.createOptions?.topK !== undefined;

  if (samplingMode !== undefined && (hasTemperature || hasTopK)) {
    throw new TypeError(
      "`samplingMode` is mutually exclusive with `temperature` and `topK`.",
    );
  }
};

export interface CreateSessionOptions {
  /** Optional system prompt (folded into `initialPrompts` as a `system` role). */
  systemPrompt?: string;
  /** Semantic sampling preset. Defaults to the model's default. */
  samplingMode?: LanguageModelSamplingMode;
  /** @deprecated Web page contexts are moving to `samplingMode`. */
  temperature?: number;
  /** @deprecated Web page contexts are moving to `samplingMode`. */
  topK?: number;
  /** BCP-47 language hint. Folded into `expectedInputs` / `expectedOutputs` when supported. */
  language?: string;
  /** Languages the model supports for the language hint. Default: `["en"]`. */
  supportedLanguages?: readonly string[];
  /** Advanced: full `expectedInputs` passthrough. Overrides the `language` hint. */
  expectedInputs?: LanguageModelExpectedInput[];
  /** Advanced: full `expectedOutputs` passthrough. Overrides the `language` hint. */
  expectedOutputs?: LanguageModelExpectedOutput[];
  /**
   * @experimental Forwards `tools` to the browser's Prompt API
   * (function calling). Whether the model actually INVOKES them depends
   * on the browser: native execution is NOT wired on current stable
   * Chrome — the option is accepted but a no-op, and the model may
   * surface its tool call as TEXT (`tool_code`) that the caller must
   * parse. Pass-through only: the SDK does not execute the tools. Will
   * begin working automatically on browsers that ship native execution.
   */
  tools?: LanguageModelTool[];
  /**
   * Observe the first-call model download (~1.7 GB on a fresh profile).
   * Forwarded to `LanguageModel.create()`. When both this and
   * `createOptions.monitor` are set, the top-level `monitor` wins.
   */
  monitor?: (m: CreateMonitor) => void;
  /**
   * Override `LanguageModel.create()` options entirely. Merged on top of
   * defaults. Pass `initialPrompts` here to seed multi-turn context (e.g.
   * restoring a conversation from storage).
   */
  createOptions?: Partial<LanguageModelCreateOptions>;
}

export interface SessionSendOptions {
  signal?: AbortSignal;
  responseConstraint?: object;
  /**
   * When `responseConstraint` is set, omit the inlined JSON Schema from the
   * model's prompt context. Saves tokens on every turn when the schema is
   * large; the constraint still shapes the output. Ignored unless
   * `responseConstraint` is also set (the native API would otherwise throw).
   * When omitting, include format guidance in the prompt text itself.
   */
  omitResponseConstraintInput?: boolean;
}

export interface Session {
  /** Whether `destroy()` has been called. After destroy, sends throw `SessionDestroyedError`. */
  readonly destroyed: boolean;
  /**
   * Run a turn. Accepts a single string turn or a `LanguageModelMessage[]`
   * (multi-message context, role-per-turn control, assistant prefill via
   * `prefix: true`). Returns the cleaned final text, or `null` if nothing
   * meaningful remains.
   */
  send(
    input: string | LanguageModelMessage[],
    options?: SessionSendOptions,
  ): Promise<string | null>;
  /**
   * Run a turn and yield **delta** chunks (each chunk is the *new* text since
   * the last yield, never cumulative). Accepts the same `string |
   * LanguageModelMessage[]` input as {@link send}.
   */
  sendStreaming(
    input: string | LanguageModelMessage[],
    options?: SessionSendOptions,
  ): AsyncIterable<string>;
  /** Abort the most recent in-flight `send` / `sendStreaming`. No-op when idle. */
  abort(): void;
  /**
   * Fork this session. The clone inherits the parent's system prompt and
   * conversation history up to this point, but gets independent history,
   * abort, and lifecycle from here on. Cloning a base session (system prompt
   * only) is the recommended way to start a fresh task without re-parsing
   * instructions or paying another `create()`.
   *
   * Throws `SessionDestroyedError` if the parent is destroyed, and
   * `PromptUnavailableError` if the underlying browser instance doesn't
   * support `clone()`. Destroying the clone never affects the parent, and
   * vice versa.
   */
  clone(options?: { signal?: AbortSignal }): Promise<Session>;
  /**
   * Push messages into the session's conversation history **without** running a
   * model turn. Use it to inject tool results or other context between turns
   * — the next `send` / `sendStreaming` sees the appended messages as prior
   * history, with no wasted tokens or latency on an empty intermediate turn.
   *
   * Throws `SessionDestroyedError` if the session is destroyed, and
   * `PromptUnavailableError` if the underlying browser instance doesn't
   * support `append()`. Aborts reject with `PromptAbortError`.
   */
  append(
    messages: LanguageModelMessage[],
    options?: { signal?: AbortSignal },
  ): Promise<void>;
  /**
   * Max input tokens for this session (the context window), as reported by
   * the underlying instance — mirrors the native `contextWindow`. `undefined`
   * until the instance is created — the instance is created lazily on the
   * first `send` / `sendStreaming`, so read it after a `send` or (preferably)
   * on a session from `clone()`, whose instance is live the moment `clone()`
   * resolves.
   */
  readonly contextWindow?: number;
  /**
   * Input tokens used so far, as reported by the underlying instance —
   * mirrors the native `contextUsage`. `undefined` until the instance is
   * created (see `contextWindow`). On a fresh base-clone this reflects the
   * inherited history (≈ the system prompt), the right baseline to budget a
   * turn's content against.
   */
  readonly contextUsage?: number;
  /**
   * Subscribe to the native `contextoverflow` event, which fires when a turn
   * pushes usage past the context window and the oldest history is dropped.
   * Use it to compact or fork a fresh `clone()` before hitting
   * `QuotaExceededError`. Returns an idempotent cleanup function that detaches
   * the listener; calling it more than once is safe. A no-op (returns a no-op
   * cleanup) when the underlying instance doesn't expose the event.
   */
  onContextOverflow(listener: () => void): () => void;
  /** Tear down the underlying instance and refuse further sends. Idempotent. */
  destroy(): void;
}

export interface SessionWithReady {
  session: Session;
  /** Resolves when the underlying native session is created. */
  ready: Promise<void>;
}

const buildCreateOptions = (
  options: CreateSessionOptions,
): LanguageModelCreateOptions => {
  assertValidSamplingOptions(options);
  const initialPrompts = options.systemPrompt
    ? [{ role: "system" as const, content: options.systemPrompt }]
    : [];
  const langHints = buildLangHints(
    options.language,
    options.supportedLanguages,
  );
  return {
    ...(initialPrompts.length > 0 ? { initialPrompts } : {}),
    ...(options.samplingMode !== undefined
      ? { samplingMode: options.samplingMode }
      : {}),
    ...(options.temperature !== undefined
      ? { temperature: options.temperature }
      : {}),
    ...(options.topK !== undefined ? { topK: options.topK } : {}),
    ...(options.expectedInputs
      ? { expectedInputs: options.expectedInputs }
      : langHints.expectedInputs
        ? { expectedInputs: langHints.expectedInputs }
        : {}),
    ...(options.expectedOutputs
      ? { expectedOutputs: options.expectedOutputs }
      : langHints.expectedOutputs
        ? { expectedOutputs: langHints.expectedOutputs }
        : {}),
    ...(options.tools ? { tools: options.tools } : {}),
    ...options.createOptions,
    ...(options.monitor ? { monitor: options.monitor } : {}),
  };
};

interface SessionInternal {
  instance: LanguageModelInstance;
  api: LanguageModelApi;
}

const wrapInstance = (
  internal: Promise<SessionInternal>,
  resolvedInstance?: LanguageModelInstance,
): Session => {
  let destroyed = false;
  let currentController: AbortController | null = null;
  // Synchronous handle on the live instance so the `inputQuota` / `inputUsage`
  // getters can read it without awaiting. Seeded eagerly for clones (whose
  // instance already exists when `clone()` resolves) and otherwise populated
  // once the lazy `create()` settles.
  let liveInstance: LanguageModelInstance | null = resolvedInstance ?? null;

  // Wrap the create-failure promise once so awaiters get the typed error.
  const ready: Promise<SessionInternal> = internal.catch((err) => {
    if (err instanceof PromptAbortError) throw err;
    const message = (err as Error)?.message ?? String(err);
    throw new PromptUnavailableError(
      `LanguageModel.create() failed: ${message}`,
    );
  });
  // Swallow the rejection on the internal promise so unhandled-rejection
  // warnings don't fire when callers never touch `ready`.
  ready.catch(() => {});
  ready
    .then(({ instance }) => {
      liveInstance = instance;
    })
    .catch(() => {});

  const ensureLive = (): void => {
    if (destroyed) throw new SessionDestroyedError();
  };

  const setupController = (
    externalSignal: AbortSignal | undefined,
  ): { controller: AbortController; cleanup: () => void } => {
    const controller = new AbortController();
    currentController = controller;
    if (!externalSignal) {
      return {
        controller,
        cleanup: () => {
          if (currentController === controller) currentController = null;
        },
      };
    }
    if (externalSignal.aborted) controller.abort();
    const onExternalAbort = () => controller.abort();
    externalSignal.addEventListener("abort", onExternalAbort);
    return {
      controller,
      cleanup: () => {
        externalSignal.removeEventListener("abort", onExternalAbort);
        if (currentController === controller) currentController = null;
      },
    };
  };

  const send = async (
    input: string | LanguageModelMessage[],
    options?: SessionSendOptions,
  ): Promise<string | null> => {
    ensureLive();
    const isEmpty =
      typeof input === "string"
        ? !input.trim()
        : input.length === 0 || input.every((m) => !m.content?.trim());
    if (isEmpty) return null;
    const { instance } = await ready;
    ensureLive();

    const { controller, cleanup } = setupController(options?.signal);
    const promptOpts: LanguageModelPromptOptions = {
      signal: controller.signal,
    };
    if (options?.responseConstraint) {
      promptOpts.responseConstraint = options.responseConstraint;
      // The native call throws a TypeError when omitResponseConstraintInput
      // is set without a responseConstraint, so only forward it alongside one.
      if (options.omitResponseConstraintInput)
        promptOpts.omitResponseConstraintInput = true;
    }

    try {
      const raw = await instance.prompt(input, promptOpts);
      if (controller.signal.aborted) throw new PromptAbortError();
      const cleaned = cleanResponse(raw);
      return cleaned || null;
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") {
        throw new PromptAbortError();
      }
      throw err;
    } finally {
      cleanup();
    }
  };

  const sendStreaming = (
    input: string | LanguageModelMessage[],
    options?: SessionSendOptions,
  ): AsyncIterable<string> => ({
    [Symbol.asyncIterator]: async function* () {
      ensureLive();
      const isEmpty =
        typeof input === "string"
          ? !input.trim()
          : input.length === 0 || input.every((m) => !m.content?.trim());
      if (isEmpty) return;
      const { instance } = await ready;
      ensureLive();

      const { controller, cleanup } = setupController(options?.signal);
      const promptOpts: LanguageModelPromptOptions = {
        signal: controller.signal,
      };
      if (options?.responseConstraint) {
        promptOpts.responseConstraint = options.responseConstraint;
        // The native call throws a TypeError when omitResponseConstraintInput
        // is set without a responseConstraint, so only forward it with one.
        if (options.omitResponseConstraintInput)
          promptOpts.omitResponseConstraintInput = true;
      }

      try {
        if (typeof instance.promptStreaming === "function") {
          let buffer = "";
          for await (const chunk of instance.promptStreaming(
            input,
            promptOpts,
          )) {
            if (controller.signal.aborted) throw new PromptAbortError();
            const merged = mergeStreamChunk(buffer, chunk);
            // Strip non-printing chars (control codes, BOM, zero-width)
            // but preserve inter-token whitespace — trimming would eat
            // spaces that legitimately split deltas like "lo, " | "world".
            const cleanedDelta = stripNonPrinting(merged.delta);
            buffer = merged.buffer;
            if (cleanedDelta) yield cleanedDelta;
          }
        } else {
          const raw = await instance.prompt(input, promptOpts);
          if (controller.signal.aborted) throw new PromptAbortError();
          const cleaned = cleanResponse(raw);
          if (cleaned) yield cleaned;
        }
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") {
          throw new PromptAbortError();
        }
        throw err;
      } finally {
        cleanup();
      }
    },
  });

  const abort = (): void => {
    currentController?.abort();
  };

  const onContextOverflow = (listener: () => void): (() => void) => {
    let cancelled = false;
    let detach: (() => void) | null = null;
    // The instance may not exist yet (lazy create), so wait for `ready` and
    // attach then — unless cleanup ran first.
    ready
      .then(({ instance }) => {
        if (cancelled) return;
        if (typeof instance.addEventListener !== "function") return;
        const handler = () => listener();
        instance.addEventListener("contextoverflow", handler);
        detach = () =>
          instance.removeEventListener?.("contextoverflow", handler);
      })
      .catch(() => {
        // never created; nothing to detach.
      });
    return () => {
      cancelled = true;
      detach?.();
      detach = null;
    };
  };

  const clone = async (cloneOptions?: {
    signal?: AbortSignal;
  }): Promise<Session> => {
    ensureLive();
    const { instance, api } = await ready;
    ensureLive();
    if (typeof instance.clone !== "function") {
      throw new PromptUnavailableError(
        "This LanguageModel instance does not support clone() in this browser.",
      );
    }
    try {
      const cloned = await instance.clone(
        cloneOptions?.signal ? { signal: cloneOptions.signal } : undefined,
      );
      // Wrap the clone with the same smoothing / abort / typed-error behavior.
      // It owns an independent native instance, so its history, abort, and
      // destroy lifecycle are fully decoupled from this (parent) session.
      // Pass the instance synchronously so `inputQuota` / `inputUsage` are
      // readable the moment `clone()` resolves, without awaiting a microtask.
      return wrapInstance(Promise.resolve({ instance: cloned, api }), cloned);
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") {
        throw new PromptAbortError();
      }
      throw err;
    }
  };

  const append = async (
    messages: LanguageModelMessage[],
    options?: { signal?: AbortSignal },
  ): Promise<void> => {
    ensureLive();
    const { instance } = await ready;
    ensureLive();
    if (typeof instance.append !== "function") {
      throw new PromptUnavailableError(
        "This LanguageModel instance does not support append() in this browser.",
      );
    }

    const { controller, cleanup } = setupController(options?.signal);

    try {
      await instance.append(messages, { signal: controller.signal });
      if (controller.signal.aborted) throw new PromptAbortError();
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") {
        throw new PromptAbortError();
      }
      throw err;
    } finally {
      cleanup();
    }
  };

  const destroy = (): void => {
    if (destroyed) return;
    destroyed = true;
    currentController?.abort();
    currentController = null;
    ready
      .then(({ instance }) => {
        try {
          instance.destroy?.();
        } catch {
          // best-effort.
        }
      })
      .catch(() => {
        // never created; nothing to destroy.
      });
  };

  return {
    get destroyed() {
      return destroyed;
    },
    get contextWindow() {
      // Prefer the current canonical name; fall back to the deprecated
      // `inputQuota` so older Chrome builds still report a budget.
      return liveInstance?.contextWindow ?? liveInstance?.inputQuota;
    },
    get contextUsage() {
      return liveInstance?.contextUsage ?? liveInstance?.inputUsage;
    },
    send,
    sendStreaming,
    abort,
    clone,
    append,
    onContextOverflow,
    destroy,
  };
};

/**
 * Create a fresh `LanguageModel` session. Unlike `ask()`, sessions returned
 * here are **never shared**: every call returns an independent instance with
 * its own history, system prompt, sampling, and lifecycle. `abort()` /
 * `destroy()` on one session never affect another.
 *
 * Token-level interleaving across sessions is implementation-defined and
 * currently bottlenecked by the browser's FIFO scheduler — the underlying
 * on-device model is single-instance, so Chrome 148 / Edge 138 drain one
 * `sendStreaming` call fully before starting the next, even across
 * independent sessions. The API is forward-compatible: code written against
 * `createSession()` becomes faster automatically if a future release
 * exposes parallel inference.
 *
 * Concurrent `send` / `sendStreaming` calls on the same session are NOT
 * queued; the native `LanguageModel` is sequential per instance and will
 * reject the second call with an `InvalidStateError`. Either `await` the
 * previous call or `session.abort()` before issuing a new turn.
 *
 * The returned `Session` is usable synchronously; the first `send` /
 * `sendStreaming` awaits the underlying `LanguageModel.create()` internally
 * and surfaces creation errors as `PromptUnavailableError`.
 */
export const createSession = (options: CreateSessionOptions = {}): Session => {
  return createSessionWithReady(options).session;
};

/**
 * Internal React adapter helper: create the public synchronous Session wrapper
 * and separately expose native create readiness without adding public Session
 * API surface.
 */
export const createSessionWithReady = (
  options: CreateSessionOptions = {},
): SessionWithReady => {
  const api = getLanguageModelApi();
  if (!api?.create) {
    throw new PromptUnavailableError(
      "Prompt API (LanguageModel) is not available in this environment.",
    );
  }
  const createOpts = buildCreateOptions(options);
  const internal: Promise<SessionInternal> = api
    .create(createOpts)
    .then((instance) => ({ instance, api }));
  const ready = internal
    .then(() => {})
    .catch((err) => {
      if (err instanceof PromptAbortError) throw err;
      const message = (err as Error)?.message ?? String(err);
      throw new PromptUnavailableError(
        `LanguageModel.create() failed: ${message}`,
      );
    });
  ready.catch(() => {});
  return { session: wrapInstance(internal), ready };
};
