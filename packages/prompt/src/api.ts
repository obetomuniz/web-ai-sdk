/**
 * Adapter over the global `LanguageModel` API. Feature-detected; on browsers
 * without it, every entry point returns `null` so callers can stay declarative.
 *
 * Spec: https://github.com/webmachinelearning/prompt-api
 */

export type LanguageModelRole = "system" | "user" | "assistant";

/**
 * Browser-native image value accepted by multimodal prompt content. Mirrors
 * the spec's `LanguageModelMessageValue` image shapes (`ImageBitmapSource`
 * covers `Blob`, `ImageData`, canvas/image/video elements, `ImageBitmap`,
 * `OffscreenCanvas`, and `VideoFrame`).
 */
export type LanguageModelImageValue = ImageBitmapSource | BufferSource;

/**
 * Browser-native audio value accepted by multimodal prompt content.
 */
export type LanguageModelAudioValue = AudioBuffer | Blob | BufferSource;

/**
 * One content part of a multimodal message. Discriminated on `type` so each
 * modality keeps its native value type. The SDK forwards `value` losslessly to
 * the browser; it never serializes, clones, transcodes, or inspects media.
 */
export type LanguageModelMessageContent =
  | { type: "text"; value: string }
  | { type: "image"; value: LanguageModelImageValue }
  | { type: "audio"; value: LanguageModelAudioValue };

export interface LanguageModelMessage {
  role: LanguageModelRole;
  /**
   * A plain text turn, or an ordered array of text / image / audio content
   * parts. Non-text parts require a session created with matching
   * `expectedInputs`; the browser throws a `"NotSupportedError"`
   * `DOMException` for undeclared or unsupported modalities.
   */
  content: string | LanguageModelMessageContent[];
  /**
   * When `true` on the trailing `assistant` message, the model treats
   * `content` as a prefix to complete rather than a turn to respond to.
   * Spec: only valid on the final `assistant`-role message; the browser
   * throws a `"SyntaxError"` `DOMException` if used elsewhere. Use it to
   * bias structured output (e.g. prefill `{"thought":"` for JSON) without
   * inlining a full `responseConstraint` schema into context every turn.
   */
  prefix?: boolean;
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
  /** Observe model-download progress when creation requires one. */
  monitor?: (m: CreateMonitor) => void;
  /**
   * @experimental Forwards `tools` to the browser's Prompt API (function
   * calling). Support remains browser-defined. Pass-through only: the SDK does
   * not execute tools or parse text that resembles a tool call.
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
  append?(
    messages: LanguageModelMessage[],
    options?: { signal?: AbortSignal },
  ): Promise<void>;
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

interface SessionEntry {
  key: string;
  session: Promise<LanguageModelInstance>;
  /** Active prepare leases. Leased entries never evict. */
  leaseCount: number;
  /** `ask()` calls currently using this base session. */
  inFlightCount: number;
  /** Still reachable through `sessionCache`. */
  inMap: boolean;
  /** Destruction already scheduled; guards double-destroy. */
  destroyed: boolean;
}

// Map iteration order is insertion order, which lets us use it as an LRU:
// on hit we re-insert to bump recency, and on overflow we evict the
// oldest (first) entry.
const sessionCache = new Map<string, SessionEntry>();
const cloneUnavailableCacheKeys = new Map<string, true>();

const isPinned = (entry: SessionEntry): boolean =>
  entry.leaseCount > 0 || entry.inFlightCount > 0;

const normalizeCacheMax = (max: number): number =>
  Number.isFinite(max) ? Math.max(0, Math.floor(max)) : 0;

export interface ConfigureLanguageModelCacheOptions {
  /** Soft cap on cached base sessions. Default: `8`. */
  max?: number;
}

/**
 * Bound the internal base-session cache used by `ask()` and
 * `prepareLanguageModel()`. Excess entries are evicted in LRU order (their
 * `destroy?()` is invoked when present). Lowering `max` immediately evicts
 * down to the new ceiling. `createSession()` sessions are caller-owned and
 * unaffected.
 */
export const configureLanguageModelCache = (
  options: ConfigureLanguageModelCacheOptions = {},
): void => {
  if (options.max !== undefined) {
    cacheConfig.max = normalizeCacheMax(options.max);
  }
  trim();
};

const destroySession = (session: Promise<LanguageModelInstance>): void => {
  session
    .then((instance) => {
      try {
        instance.destroy?.();
      } catch {
        // best-effort; the spec doesn't require destroy to be infallible.
      }
    })
    .catch(() => {
      // session never resolved (e.g. create() rejected); nothing to destroy.
    });
};

const detachEntry = (entry: SessionEntry): void => {
  if (!entry.inMap) return;
  entry.inMap = false;
  sessionCache.delete(entry.key);
};

/**
 * Destroy a detached entry once nothing pins it. Pinned entries are settled
 * again when their last lease releases or their last in-flight call ends.
 */
const settleEntry = (entry: SessionEntry): void => {
  if (entry.inMap || entry.destroyed || isPinned(entry)) return;
  entry.destroyed = true;
  destroySession(entry.session);
};

const trim = (): void => {
  if (sessionCache.size > cacheConfig.max) {
    for (const entry of [...sessionCache.values()]) {
      if (sessionCache.size <= cacheConfig.max) break;
      // Leased or in-flight entries never evict, so the cache may temporarily
      // exceed `max` while they stay pinned.
      if (isPinned(entry)) continue;
      detachEntry(entry);
      settleEntry(entry);
    }
  }
  while (cloneUnavailableCacheKeys.size > cacheConfig.max) {
    const oldestKey = cloneUnavailableCacheKeys.keys().next().value;
    if (oldestKey === undefined) return;
    cloneUnavailableCacheKeys.delete(oldestKey);
  }
};

/**
 * Drop every cached base session. Sessions live for the tab lifetime by
 * default; call this to free them eagerly when navigating away from a feature
 * that won't be revisited. Sessions pinned by a lease or an in-flight call
 * leave the cache now and are destroyed once the last pin drops.
 * `createSession()` sessions are caller-owned and unaffected.
 */
export const clearLanguageModelSessions = (): void => {
  for (const entry of [...sessionCache.values()]) {
    detachEntry(entry);
    settleEntry(entry);
  }
};

/**
 * Drop the cached base session whose create-options match `options`.
 */
export const clearLanguageModelSession = (
  options: LanguageModelCreateOptions,
): void => {
  const entry = sessionCache.get(JSON.stringify(options));
  if (!entry) return;
  detachEntry(entry);
  settleEntry(entry);
};

/**
 * Get or create the cache entry for the given options. Sessions live for the
 * tab lifetime so consecutive calls with the same shape skip the ~1-3s cold
 * start. On `create()` failure the cache slot is purged so the next call
 * retries instead of returning a poisoned promise.
 *
 * The cache is shared across `ask()` and `prepareLanguageModel()` only.
 * `createSession()` bypasses this cache so chat-shaped apps get independent
 * sessions per call.
 */
const getOrCreateEntry = (
  api: LanguageModelApi,
  options: LanguageModelCreateOptions,
): SessionEntry => {
  const key = JSON.stringify(options);
  const existing = sessionCache.get(key);
  if (existing) {
    // Bump recency: delete + reinsert so this entry moves to the end of the
    // LRU order.
    sessionCache.delete(key);
    sessionCache.set(key, existing);
    return existing;
  }
  const entry: SessionEntry = {
    key,
    session: api.create(options).catch((err) => {
      detachEntry(entry);
      throw err;
    }),
    leaseCount: 0,
    inFlightCount: 0,
    inMap: true,
    destroyed: false,
  };
  // A prepare-only caller may never observe the session promise; keep the
  // stored branch handled so failed creation cannot surface as an unhandled
  // rejection.
  entry.session.catch(() => {});
  sessionCache.set(key, entry);
  return entry;
};

export interface AcquiredLanguageModel {
  session: Promise<LanguageModelInstance>;
  /** Release the in-flight pin. Idempotent. */
  done(): void;
}

/**
 * Get or create a base `LanguageModel` session and pin it for one `ask()`
 * call. The pin defers destruction (final lease release, clear, eviction)
 * until `done()` runs, so in-flight use can never lose its session.
 */
export const acquireLanguageModel = (
  api: LanguageModelApi,
  options: LanguageModelCreateOptions,
): AcquiredLanguageModel => {
  const entry = getOrCreateEntry(api, options);
  // Pin before trimming so a fresh entry can never evict itself when every
  // other entry is pinned.
  entry.inFlightCount += 1;
  trim();
  let released = false;
  return {
    session: entry.session,
    done: () => {
      if (released) return;
      released = true;
      entry.inFlightCount -= 1;
      settleEntry(entry);
      // The dropped pin may leave the cache over its cap; re-trim now
      // instead of waiting for the next create or configure call.
      trim();
    },
  };
};

export interface LanguageModelSessionLease {
  /** Settles with the underlying `create()` outcome. */
  ready: Promise<void>;
  /** Idempotent. The final release detaches and destroys once safe. */
  release(): void;
}

/**
 * Start (or join) base-session creation for the given options and hold a
 * lease on the entry. Leases pin the entry against LRU eviction. The final
 * release removes the entry from the cache and destroys the session as soon
 * as no in-flight call uses it; released-before-ready sessions are destroyed
 * when creation later succeeds.
 */
export const leaseLanguageModel = (
  api: LanguageModelApi,
  options: LanguageModelCreateOptions,
): LanguageModelSessionLease => {
  const entry = getOrCreateEntry(api, options);
  // Pin before trimming so a fresh entry can never evict itself when every
  // other entry is pinned.
  entry.leaseCount += 1;
  trim();
  let released = false;
  const ready = entry.session.then(() => undefined);
  // Keep unobserved leases from surfacing unhandled rejections.
  ready.catch(() => {});
  return {
    ready,
    release: () => {
      if (released) return;
      released = true;
      entry.leaseCount -= 1;
      if (entry.leaseCount > 0) return;
      detachEntry(entry);
      settleEntry(entry);
    },
  };
};

/**
 * Internal: remove one create-options entry from the warm-session cache
 * without destroying it. `ask()` uses this when the base turns out not to
 * support `clone()`; the entry's own pin drain then destroys the instance.
 */
export const dropCachedLanguageModel = (
  options: LanguageModelCreateOptions,
): void => {
  const entry = sessionCache.get(JSON.stringify(options));
  if (!entry) return;
  detachEntry(entry);
};

export const markLanguageModelCloneUnavailable = (
  options: LanguageModelCreateOptions,
): void => {
  const key = JSON.stringify(options);
  cloneUnavailableCacheKeys.delete(key);
  cloneUnavailableCacheKeys.set(key, true);
  trim();
};

export const isLanguageModelCloneUnavailable = (
  options: LanguageModelCreateOptions,
): boolean => {
  const key = JSON.stringify(options);
  if (!cloneUnavailableCacheKeys.has(key)) return false;
  cloneUnavailableCacheKeys.delete(key);
  cloneUnavailableCacheKeys.set(key, true);
  return true;
};

/** Test-only escape hatch; drop every cached session. */
export const __clearSessionCacheForTests = (): void => {
  sessionCache.clear();
  cloneUnavailableCacheKeys.clear();
  cacheConfig.max = DEFAULT_MAX_CACHED_SESSIONS;
};
