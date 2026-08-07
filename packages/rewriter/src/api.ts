/**
 * Adapter over the global `Rewriter` API. Feature-detected; on browsers
 * without it, every entry point returns `null` so callers can stay declarative.
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

interface SessionEntry {
  key: string;
  session: Promise<RewriterInstance>;
  /** Active prepare leases. Leased entries never evict. */
  leaseCount: number;
  /** Operations currently running inference on this session. */
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

const isPinned = (entry: SessionEntry): boolean =>
  entry.leaseCount > 0 || entry.inFlightCount > 0;

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

const destroySession = (session: Promise<RewriterInstance>): void => {
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
  if (sessionCache.size <= cacheConfig.max) return;
  for (const entry of [...sessionCache.values()]) {
    if (sessionCache.size <= cacheConfig.max) return;
    // Leased or in-flight entries never evict, so the cache may temporarily
    // exceed `max` while they stay pinned.
    if (isPinned(entry)) continue;
    detachEntry(entry);
    settleEntry(entry);
  }
};

/**
 * Drop every cached rewriter session. Sessions live for the tab lifetime by
 * default; call this to free them eagerly when navigating away from a feature
 * that won't be revisited. Sessions pinned by a lease or an in-flight call
 * leave the cache now and are destroyed once the last pin drops.
 */
export const clearRewriterSessions = (): void => {
  for (const entry of [...sessionCache.values()]) {
    detachEntry(entry);
    settleEntry(entry);
  }
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
  const entry = sessionCache.get(cacheKeyFor(options));
  if (!entry) return;
  detachEntry(entry);
  settleEntry(entry);
};

/**
 * Get or create the cache entry for the given options. Sessions live for the
 * tab lifetime so consecutive same-config calls skip the cold start. On
 * `create()` failure the cache slot is purged so the next call retries
 * instead of returning a poisoned promise.
 */
const getOrCreateEntry = (
  api: RewriterApi,
  options: RewriterCreateOptions,
): SessionEntry => {
  const key = cacheKeyFor(options);
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

export interface AcquiredRewriter {
  session: Promise<RewriterInstance>;
  /** Release the in-flight pin. Idempotent. */
  done(): void;
}

/**
 * Get or create a `Rewriter` session and pin it for one operation. The pin
 * defers destruction (final lease release, clear, eviction) until `done()`
 * runs, so in-flight inference can never lose its session.
 */
export const acquireRewriter = (
  api: RewriterApi,
  options: RewriterCreateOptions,
): AcquiredRewriter => {
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

export interface RewriterSessionLease {
  /** Settles with the underlying `create()` outcome. */
  ready: Promise<void>;
  /** Idempotent. The final release detaches and destroys once safe. */
  release(): void;
}

/**
 * Start (or join) session creation for the given options and hold a lease on
 * the entry. Leases pin the entry against LRU eviction. The final release
 * removes the entry from the cache and destroys the session as soon as no
 * in-flight call uses it; released-before-ready sessions are destroyed when
 * creation later succeeds.
 */
export const leaseRewriter = (
  api: RewriterApi,
  options: RewriterCreateOptions,
): RewriterSessionLease => {
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

/** Test-only escape hatch; drop every cached session. */
export const __clearSessionCacheForTests = (): void => {
  sessionCache.clear();
  cacheConfig.max = DEFAULT_MAX_CACHED_SESSIONS;
};
