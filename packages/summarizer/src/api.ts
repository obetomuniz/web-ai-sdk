/**
 * Adapter over the global `Summarizer` API. Feature-detected; on browsers
 * without it, every entry point returns `null` so callers can stay declarative.
 *
 * Spec: https://developer.chrome.com/docs/ai/summarizer-api
 */

export interface SummarizerInstance {
  summarize(text: string): Promise<string>;
  summarizeStreaming?(text: string): AsyncIterable<string>;
  destroy?(): void;
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

export interface SummarizerCreateOptions {
  type?: "tldr" | "key-points" | "teaser" | "headline";
  format?: "markdown" | "plain-text";
  length?: "short" | "medium" | "long";
  preference?: "auto" | "speed" | "capability";
  sharedContext?: string;
  expectedInputLanguages?: string[];
  expectedContextLanguages?: string[];
  outputLanguage?: string;
  /** Observe model-download progress when creation requires one. */
  monitor?: (m: CreateMonitor) => void;
}

export type SummarizerAvailability =
  | "unavailable"
  | "downloadable"
  | "downloading"
  | "available";

/**
 * Subset of `SummarizerCreateOptions` that the spec accepts when probing
 * availability. Pass the relevant creation shape so the result applies to the
 * configuration you intend to create.
 */
export interface SummarizerAvailabilityOptions {
  type?: SummarizerCreateOptions["type"];
  format?: SummarizerCreateOptions["format"];
  length?: SummarizerCreateOptions["length"];
  preference?: SummarizerCreateOptions["preference"];
  expectedInputLanguages?: string[];
  expectedContextLanguages?: string[];
  outputLanguage?: string;
}

export interface SummarizerApi {
  availability(
    options?: SummarizerAvailabilityOptions,
  ): Promise<SummarizerAvailability>;
  create(options?: SummarizerCreateOptions): Promise<SummarizerInstance>;
}

/** Internal: read the native global. Not exported from the package. */
export const getSummarizerApi = (): SummarizerApi | null => {
  if (typeof globalThis === "undefined") return null;
  return (
    (globalThis as unknown as { Summarizer?: SummarizerApi }).Summarizer ?? null
  );
};

/** Whether the current environment exposes the Summarizer API. */
export const isAvailable = (): boolean => getSummarizerApi() !== null;

export const checkAvailability = async (
  options?: SummarizerAvailabilityOptions,
): Promise<SummarizerAvailability | null> => {
  const api = getSummarizerApi();
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
  session: Promise<SummarizerInstance>;
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

export interface ConfigureSummarizerCacheOptions {
  /** Soft cap on cached summarizer sessions. Default: `8`. */
  max?: number;
}

/**
 * Bound the internal summarizer session cache. Excess entries are evicted in
 * LRU order (their `destroy?()` is invoked when present). Lowering `max`
 * immediately evicts down to the new ceiling.
 */
export const configureSummarizerCache = (
  options: ConfigureSummarizerCacheOptions = {},
): void => {
  if (options.max !== undefined) {
    cacheConfig.max = normalizeCacheMax(options.max);
  }
  trim();
};

const destroySession = (session: Promise<SummarizerInstance>): void => {
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
 * Drop every cached summarizer session. Sessions live for the tab lifetime by
 * default; call this to free them eagerly when navigating away from a feature
 * that won't be revisited. Sessions pinned by a lease or an in-flight call
 * leave the cache now and are destroyed once the last pin drops.
 */
export const clearSummarizerSessions = (): void => {
  for (const entry of [...sessionCache.values()]) {
    detachEntry(entry);
    settleEntry(entry);
  }
};

/**
 * Drop the cached summarizer whose create-options match `options`.
 */
export const clearSummarizerSession = (
  options: SummarizerCreateOptions,
): void => {
  const entry = sessionCache.get(JSON.stringify(options));
  if (!entry) return;
  detachEntry(entry);
  settleEntry(entry);
};

/**
 * Get or create the cache entry for the given options. Sessions live for the
 * tab lifetime so navigating between same-config pages skips the ~1-3s cold
 * start. On `create()` failure the cache slot is purged so the next call
 * retries instead of returning a poisoned promise.
 */
const getOrCreateEntry = (
  api: SummarizerApi,
  options: SummarizerCreateOptions,
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

export interface AcquiredSummarizer {
  session: Promise<SummarizerInstance>;
  /** Release the in-flight pin. Idempotent. */
  done(): void;
}

/**
 * Get or create a `Summarizer` session and pin it for one operation. The pin
 * defers destruction (final lease release, clear, eviction) until `done()`
 * runs, so in-flight inference can never lose its session.
 */
export const acquireSummarizer = (
  api: SummarizerApi,
  options: SummarizerCreateOptions,
): AcquiredSummarizer => {
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
    },
  };
};

export interface SummarizerSessionLease {
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
export const leaseSummarizer = (
  api: SummarizerApi,
  options: SummarizerCreateOptions,
): SummarizerSessionLease => {
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
