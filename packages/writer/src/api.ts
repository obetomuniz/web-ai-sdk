/**
 * Adapter over the global `Writer` API. Feature-detected; on browsers without
 * it, every entry point returns `null` so callers can stay declarative.
 *
 * Spec: https://developer.chrome.com/docs/ai/writer-api
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

export interface WriterTaskOptions {
  /** Optional per-call background information for the model. */
  context?: string;
  /** Standard `AbortSignal` plumbed through to the underlying call. */
  signal?: AbortSignal;
}

export interface WriterInstance {
  write(input: string, options?: WriterTaskOptions): Promise<string>;
  writeStreaming?(
    input: string,
    options?: WriterTaskOptions,
  ): AsyncIterable<string>;
  destroy?(): void;
}

export interface WriterCreateOptions {
  /** Writing tone. Default (native): `"neutral"`. */
  tone?: "formal" | "neutral" | "casual";
  /** Output format. Default (native): `"markdown"`. */
  format?: "markdown" | "plain-text";
  /** Output length. Default (native): `"short"`. */
  length?: "short" | "medium" | "long";
  /** A hint shared across multiple write tasks from the same instance. */
  sharedContext?: string;
  expectedInputLanguages?: string[];
  expectedContextLanguages?: string[];
  outputLanguage?: string;
  /** Standard `AbortSignal` plumbed through to `create()`. */
  signal?: AbortSignal;
  /** Observe the first-call model download. */
  monitor?: (m: CreateMonitor) => void;
}

export type WriterAvailability =
  | "unavailable"
  | "downloadable"
  | "downloading"
  | "available";

/**
 * Subset of `WriterCreateOptions` accepted when probing availability. Pass
 * the same shape you'd pass to `create()` for accurate, warning-free
 * results across engines.
 */
export interface WriterAvailabilityOptions {
  tone?: WriterCreateOptions["tone"];
  format?: WriterCreateOptions["format"];
  length?: WriterCreateOptions["length"];
  expectedInputLanguages?: string[];
  expectedContextLanguages?: string[];
  outputLanguage?: string;
}

export interface WriterApi {
  availability(
    options?: WriterAvailabilityOptions,
  ): Promise<WriterAvailability>;
  create(options?: WriterCreateOptions): Promise<WriterInstance>;
}

/** Internal: read the native global. Not exported from the package. */
export const getWriterApi = (): WriterApi | null => {
  if (typeof globalThis === "undefined") return null;
  return (globalThis as unknown as { Writer?: WriterApi }).Writer ?? null;
};

/** Whether the current environment exposes the Writer API. */
export const isAvailable = (): boolean => getWriterApi() !== null;

/**
 * Probe the native `availability()` for the given shape. Returns `null` on
 * browsers without the API.
 */
export const checkAvailability = async (
  options?: WriterAvailabilityOptions,
): Promise<WriterAvailability | null> => {
  const api = getWriterApi();
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
  session: Promise<WriterInstance>;
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

export interface ConfigureWriterCacheOptions {
  /** Soft cap on cached writer sessions. Default: `8`. */
  max?: number;
}

/**
 * Bound the internal writer session cache. Excess entries are evicted in LRU
 * order (their `destroy?()` is invoked when present). Lowering `max`
 * immediately evicts down to the new ceiling.
 */
export const configureWriterCache = (
  options: ConfigureWriterCacheOptions = {},
): void => {
  if (options.max !== undefined) {
    cacheConfig.max = normalizeCacheMax(options.max);
  }
  trim();
};

const destroySession = (session: Promise<WriterInstance>): void => {
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
 * Drop every cached writer session. Sessions live for the tab lifetime by
 * default; call this to free them eagerly when navigating away from a feature
 * that won't be revisited. Sessions pinned by a lease or an in-flight call
 * leave the cache now and are destroyed once the last pin drops.
 */
export const clearWriterSessions = (): void => {
  for (const entry of [...sessionCache.values()]) {
    detachEntry(entry);
    settleEntry(entry);
  }
};

// `signal` and `monitor` are per-call ephemera; drop them from the key so
// they don't fragment session reuse.
const cacheKeyFor = (options: WriterCreateOptions): string =>
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
 * Drop the cached writer whose create-options match `options`.
 */
export const clearWriterSession = (options: WriterCreateOptions): void => {
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
  api: WriterApi,
  options: WriterCreateOptions,
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

export interface AcquiredWriter {
  session: Promise<WriterInstance>;
  /** Release the in-flight pin. Idempotent. */
  done(): void;
}

/**
 * Get or create a `Writer` session and pin it for one operation. The pin
 * defers destruction (final lease release, clear, eviction) until `done()`
 * runs, so in-flight inference can never lose its session.
 */
export const acquireWriter = (
  api: WriterApi,
  options: WriterCreateOptions,
): AcquiredWriter => {
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

export interface WriterSessionLease {
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
export const leaseWriter = (
  api: WriterApi,
  options: WriterCreateOptions,
): WriterSessionLease => {
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
