/**
 * Adapter over the global `LanguageModel` API exposed by Chrome (behind
 * `chrome://flags/#prompt-api-for-gemini-nano`). Feature-detected; on browsers
 * without it, every entry point returns `null` so callers can stay declarative.
 *
 * Spec: https://github.com/webmachinelearning/prompt-api
 */

export type LanguageModelRole = "system" | "user" | "assistant";

export interface LanguageModelMessage {
  role: LanguageModelRole;
  content: string;
}

export interface LanguageModelExpectedInput {
  type: "text" | "image" | "audio" | "tool-response";
  languages?: string[];
}

export interface LanguageModelExpectedOutput {
  type: "text" | "tool-call";
  languages?: string[];
}

/**
 * @experimental A native Prompt API tool (function calling), mirroring the
 * W3C `LanguageModelTool` shape. `execute` is "the function to be invoked by
 * the user agent on behalf of the language model"; it must resolve to a
 * string the runtime feeds back into the conversation.
 *
 * The SDK only forwards this shape to the native `create()`; it does not call
 * `execute` itself. See {@link LanguageModelCreateOptions.tools}.
 */
export interface LanguageModelTool {
  name: string;
  description: string;
  /** JSON Schema for the arguments. */
  inputSchema: object;
  execute(args: unknown): Promise<string> | string;
}

export interface DownloadProgressEvent extends Event {
  readonly loaded: number;
}

export interface CreateMonitor {
  addEventListener(
    type: "downloadprogress",
    listener: (event: DownloadProgressEvent) => void,
  ): void;
}

export type LanguageModelSamplingMode =
  | "most-predictable"
  | "predictable"
  | "balanced"
  | "creative"
  | "most-creative";

export interface LanguageModelCreateOptions {
  initialPrompts?: LanguageModelMessage[];
  /**
   * Semantic sampling preset. Mutually exclusive with `temperature` / `topK`
   * where browsers still expose those legacy raw parameters.
   */
  samplingMode?: LanguageModelSamplingMode;
  /** @deprecated Web page contexts are moving to `samplingMode`. */
  temperature?: number;
  /** @deprecated Web page contexts are moving to `samplingMode`. */
  topK?: number;
  expectedInputs?: LanguageModelExpectedInput[];
  expectedOutputs?: LanguageModelExpectedOutput[];
  signal?: AbortSignal;
  /** Observe the first-call model download (~1.7 GB on a fresh profile). */
  monitor?: (m: CreateMonitor) => void;
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
}

export interface LanguageModelPromptOptions {
  signal?: AbortSignal;
  responseConstraint?: object;
  /**
   * When `responseConstraint` is set, omit the inlined JSON Schema from the
   * model's prompt context. Saves tokens on every call when the schema is
   * large; the constraint still shapes the output. The native API throws a
   * `TypeError` if this is set without a `responseConstraint`.
   */
  omitResponseConstraintInput?: boolean;
}

export interface LanguageModelInstance {
  prompt(
    input: string | LanguageModelMessage[],
    options?: LanguageModelPromptOptions,
  ): Promise<string>;
  promptStreaming?(
    input: string | LanguageModelMessage[],
    options?: LanguageModelPromptOptions,
  ): AsyncIterable<string>;
  clone?(options?: { signal?: AbortSignal }): Promise<LanguageModelInstance>;
  destroy?(): void;
  /**
   * Input tokens used so far (≈ the system prompt on a fresh clone). This is
   * the current canonical name; the Prompt API renamed `inputUsage` →
   * `contextUsage` (`inputUsage` is now extension-only / deprecated).
   */
  readonly contextUsage?: number;
  /**
   * Max input tokens for the instance, i.e. the context window. Current
   * canonical name; the Prompt API renamed `inputQuota` → `contextWindow`.
   */
  readonly contextWindow?: number;
  /** @deprecated Renamed to `contextUsage`; extension contexts only now. */
  readonly inputUsage?: number;
  /** @deprecated Renamed to `contextWindow`; extension contexts only now. */
  readonly inputQuota?: number;
  readonly topK?: number;
  readonly temperature?: number;
  /**
   * The native instance is an `EventTarget`. The `contextoverflow` event
   * fires when a turn pushes `contextUsage` past `contextWindow` and the
   * oldest history is dropped, letting consumers compact before hitting
   * `QuotaExceededError`. Optional: older instances may not implement it.
   */
  addEventListener?(
    type: "contextoverflow",
    listener: (event: Event) => void,
  ): void;
  removeEventListener?(
    type: "contextoverflow",
    listener: (event: Event) => void,
  ): void;
}

export type LanguageModelAvailability =
  | "unavailable"
  | "downloadable"
  | "downloading"
  | "available";

export interface LanguageModelParams {
  /** @deprecated Web page contexts are moving to `samplingMode`. */
  defaultTemperature: number;
  /** @deprecated Web page contexts are moving to `samplingMode`. */
  maxTemperature: number;
  /** @deprecated Web page contexts are moving to `samplingMode`. */
  defaultTopK: number;
  /** @deprecated Web page contexts are moving to `samplingMode`. */
  maxTopK: number;
}

export interface LanguageModelApi {
  availability(options?: {
    expectedInputs?: LanguageModelExpectedInput[];
    expectedOutputs?: LanguageModelExpectedOutput[];
  }): Promise<LanguageModelAvailability>;
  create(options?: LanguageModelCreateOptions): Promise<LanguageModelInstance>;
  params?(): Promise<LanguageModelParams | null>;
}

/** Internal: read the native global. Not exported from the package. */
export const getLanguageModelApi = (): LanguageModelApi | null => {
  if (typeof globalThis === "undefined") return null;
  return (
    (globalThis as unknown as { LanguageModel?: LanguageModelApi })
      .LanguageModel ?? null
  );
};

/** Whether the current environment exposes the Prompt API. */
export const isAvailable = (): boolean => getLanguageModelApi() !== null;

export const checkAvailability = async (options?: {
  expectedInputs?: LanguageModelExpectedInput[];
  expectedOutputs?: LanguageModelExpectedOutput[];
}): Promise<LanguageModelAvailability | null> => {
  const api = getLanguageModelApi();
  if (!api?.availability) return null;
  try {
    return await api.availability(options);
  } catch {
    return null;
  }
};

const DEFAULT_MAX_CACHED_SESSIONS = 8;

interface CacheConfig {
  max: number;
}

const cacheConfig: CacheConfig = { max: DEFAULT_MAX_CACHED_SESSIONS };

// Map iteration order is insertion order, which lets us use it as an LRU:
// on hit we re-insert to bump recency, and on overflow we evict the
// oldest (first) entry.
const sessionCache = new Map<string, Promise<LanguageModelInstance>>();

/**
 * Test-only escape hatch; reconfigure the session LRU cap. Not part of the
 * public API.
 */
export const __configureCacheForTests = (max: number): void => {
  cacheConfig.max = Math.max(0, Math.floor(max));
  trim();
};

const destroySession = (entry: Promise<LanguageModelInstance>): void => {
  entry
    .then((session) => {
      try {
        session.destroy?.();
      } catch {
        // best-effort; the spec doesn't require destroy to be infallible.
      }
    })
    .catch(() => {
      // session never resolved (e.g. create() rejected); nothing to destroy.
    });
};

const trim = (): void => {
  while (sessionCache.size > cacheConfig.max) {
    const oldestKey = sessionCache.keys().next().value;
    if (oldestKey === undefined) return;
    const evicted = sessionCache.get(oldestKey);
    sessionCache.delete(oldestKey);
    if (evicted) destroySession(evicted);
  }
};

/**
 * Get or create a `LanguageModel` session for the given options. Sessions live
 * for the tab lifetime so consecutive calls with the same shape skip the
 * ~1-3s cold start. On `create()` failure the cache slot is purged so the
 * next call retries instead of returning a poisoned promise.
 *
 * The cache is shared across `ask()` calls only. `createSession()` bypasses
 * this cache so chat-shaped apps get independent sessions per call.
 */
export const getOrCreateLanguageModel = (
  api: LanguageModelApi,
  options: LanguageModelCreateOptions,
): Promise<LanguageModelInstance> => {
  const key = JSON.stringify(options);
  let session = sessionCache.get(key);
  if (session) {
    // Bump recency: delete + reinsert so this entry moves to the end of the
    // LRU order.
    sessionCache.delete(key);
    sessionCache.set(key, session);
    return session;
  }
  session = api.create(options).catch((err) => {
    sessionCache.delete(key);
    throw err;
  });
  sessionCache.set(key, session);
  trim();
  return session;
};

/** Test-only escape hatch; drop every cached session. */
export const __clearSessionCacheForTests = (): void => {
  sessionCache.clear();
  cacheConfig.max = DEFAULT_MAX_CACHED_SESSIONS;
};
