/**
 * Adapter over the global `Rewriter` API exposed by Chrome. The Rewriter
 * shares the Writer's joint origin trial and is enabled via the same
 * `chrome://flags/#writer-api-for-gemini-nano` flag (there is no separate
 * Rewriter flag). Feature-detected; on browsers without it, every entry
 * point returns `null` so callers can stay declarative.
 *
 * Spec: https://developer.chrome.com/docs/ai/rewriter-api
 */

export interface DownloadProgressEvent extends Event {
  readonly loaded: number;
}

export interface CreateMonitor {
  addEventListener(
    type: "downloadprogress",
    listener: (event: DownloadProgressEvent) => void,
  ): void;
}

export interface RewriterTaskOptions {
  /** Optional per-call background information for the model. */
  context?: string;
  /** Standard `AbortSignal` plumbed through to the underlying call. */
  signal?: AbortSignal;
}

export interface RewriterInstance {
  rewrite(input: string, options?: RewriterTaskOptions): Promise<string>;
  rewriteStreaming?(
    input: string,
    options?: RewriterTaskOptions,
  ): AsyncIterable<string>;
  destroy?(): void;
}

export interface RewriterCreateOptions {
  /** Tone adjustment. Default (native): `"as-is"`. */
  tone?: "as-is" | "more-formal" | "more-casual";
  /** Output format. Default (native): `"as-is"`. */
  format?: "as-is" | "markdown" | "plain-text";
  /** Length adjustment. Default (native): `"as-is"`. */
  length?: "as-is" | "shorter" | "longer";
  /** A hint shared across multiple rewrite tasks from the same instance. */
  sharedContext?: string;
  expectedInputLanguages?: string[];
  expectedContextLanguages?: string[];
  outputLanguage?: string;
  /** Standard `AbortSignal` plumbed through to `create()`. */
  signal?: AbortSignal;
  /** Observe the first-call model download. */
  monitor?: (m: CreateMonitor) => void;
}

export type RewriterAvailability =
  | "unavailable"
  | "downloadable"
  | "downloading"
  | "available";

/**
 * Subset of `RewriterCreateOptions` accepted when probing availability. Pass
 * the same shape you'd pass to `create()` for accurate, warning-free results
 * across engines.
 */
export interface RewriterAvailabilityOptions {
  tone?: RewriterCreateOptions["tone"];
  format?: RewriterCreateOptions["format"];
  length?: RewriterCreateOptions["length"];
  expectedInputLanguages?: string[];
  expectedContextLanguages?: string[];
  outputLanguage?: string;
}

export interface RewriterApi {
  availability(
    options?: RewriterAvailabilityOptions,
  ): Promise<RewriterAvailability>;
  create(options?: RewriterCreateOptions): Promise<RewriterInstance>;
}

/** Internal: read the native global. Not exported from the package. */
export const getRewriterApi = (): RewriterApi | null => {
  if (typeof globalThis === "undefined") return null;
  return (globalThis as unknown as { Rewriter?: RewriterApi }).Rewriter ?? null;
};

/** Whether the current environment exposes the Rewriter API. */
export const isAvailable = (): boolean => getRewriterApi() !== null;

/**
 * Probe the native `availability()` for the given shape. Returns `null` on
 * browsers without the API.
 */
export const checkAvailability = async (
  options?: RewriterAvailabilityOptions,
): Promise<RewriterAvailability | null> => {
  const api = getRewriterApi();
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
const sessionCache = new Map<string, Promise<RewriterInstance>>();

const normalizeCacheMax = (max: number): number =>
  Number.isFinite(max) ? Math.max(0, Math.floor(max)) : 0;

export interface ConfigureRewriterCacheOptions {
  /** Soft cap on cached rewriter sessions. Default: `8`. */
  max?: number;
}

/**
 * Bound the internal rewriter session cache. Excess entries are evicted in
 * LRU order (their `destroy?()` is invoked when present). Lowering `max`
 * immediately evicts down to the new ceiling.
 */
export const configureRewriterCache = (
  options: ConfigureRewriterCacheOptions = {},
): void => {
  if (options.max !== undefined) {
    cacheConfig.max = normalizeCacheMax(options.max);
  }
  trim();
};

const destroySession = (entry: Promise<RewriterInstance>): void => {
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
 * Drop every cached rewriter session. Sessions live for the tab lifetime by
 * default; call this to free them eagerly when navigating away from a feature
 * that won't be revisited.
 */
export const clearRewriterSessions = (): void => {
  for (const entry of sessionCache.values()) {
    destroySession(entry);
  }
  sessionCache.clear();
};

// `signal` and `monitor` are per-call ephemera; drop them from the key so
// they don't fragment session reuse.
const cacheKeyFor = (options: RewriterCreateOptions): string =>
  JSON.stringify({
    tone: options.tone,
    format: options.format,
    length: options.length,
    sharedContext: options.sharedContext,
    expectedInputLanguages: options.expectedInputLanguages,
    expectedContextLanguages: options.expectedContextLanguages,
    outputLanguage: options.outputLanguage,
  });

/**
 * Drop the cached rewriter whose create-options match `options`.
 */
export const clearRewriterSession = (options: RewriterCreateOptions): void => {
  const key = cacheKeyFor(options);
  const entry = sessionCache.get(key);
  if (!entry) return;
  sessionCache.delete(key);
  destroySession(entry);
};

/**
 * Get or create a `Rewriter` session for the given options. Sessions live for
 * the tab lifetime so consecutive same-config calls skip the cold start. On
 * `create()` failure the cache slot is purged so the next call retries
 * instead of returning a poisoned promise.
 */
export const getOrCreateRewriter = (
  api: RewriterApi,
  options: RewriterCreateOptions,
): Promise<RewriterInstance> => {
  const key = cacheKeyFor(options);
  let session = sessionCache.get(key);
  if (session) {
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
