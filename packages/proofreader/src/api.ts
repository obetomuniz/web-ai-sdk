/**
 * Adapter over the global `Proofreader` API exposed by Chrome (behind
 * `chrome://flags/#proofreader-api-for-gemini-nano`). Feature-detected; on
 * browsers without it, every entry point returns `null` so callers can stay
 * declarative.
 *
 * Spec: https://developer.chrome.com/docs/ai/proofreader-api
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

export interface ProofreadCorrection {
  /** Inclusive start offset into the original input. */
  startIndex: number;
  /** Exclusive end offset into the original input. */
  endIndex: number;
  /** The suggested replacement for `input.slice(startIndex, endIndex)`. */
  correction: string;
  /** Error label (e.g. `"spelling"`). Not emitted by Chrome's current build. */
  type?: string;
  /** Plain-language explanation. Not emitted by Chrome's current build. */
  explanation?: string;
}

export interface ProofreadOutput {
  /** The fully corrected text. */
  correctedInput: string;
  /** Per-issue corrections with offsets into the original input. */
  corrections: ProofreadCorrection[];
}

export interface ProofreaderInstance {
  proofread(input: string): Promise<ProofreadOutput>;
  destroy?(): void;
}

export interface ProofreaderCreateOptions {
  /** BCP-47 languages the proofreader should expect as input. */
  expectedInputLanguages?: string[];
  /** Standard `AbortSignal` plumbed through to `create()`. */
  signal?: AbortSignal;
  /** Observe the first-call model download. */
  monitor?: (m: CreateMonitor) => void;
}

export interface ProofreaderAvailabilityOptions {
  expectedInputLanguages?: string[];
}

export type ProofreaderAvailability =
  | "unavailable"
  | "downloadable"
  | "downloading"
  | "available";

export interface ProofreaderApi {
  availability(
    options?: ProofreaderAvailabilityOptions,
  ): Promise<ProofreaderAvailability>;
  create(options?: ProofreaderCreateOptions): Promise<ProofreaderInstance>;
}

/** Internal: read the native global. Not exported from the package. */
export const getProofreaderApi = (): ProofreaderApi | null => {
  if (typeof globalThis === "undefined") return null;
  return (
    (globalThis as unknown as { Proofreader?: ProofreaderApi }).Proofreader ??
    null
  );
};

/** Whether the current environment exposes the Proofreader API. */
export const isAvailable = (): boolean => getProofreaderApi() !== null;

/**
 * Probe the native `availability()` for the given shape. Returns `null` on
 * browsers without the API.
 */
export const checkAvailability = async (
  options?: ProofreaderAvailabilityOptions,
): Promise<ProofreaderAvailability | null> => {
  const api = getProofreaderApi();
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
const sessionCache = new Map<string, Promise<ProofreaderInstance>>();

const normalizeCacheMax = (max: number): number =>
  Number.isFinite(max) ? Math.max(0, Math.floor(max)) : 0;

export interface ConfigureProofreaderCacheOptions {
  /** Soft cap on cached proofreader sessions. Default: `8`. */
  max?: number;
}

/**
 * Bound the internal proofreader session cache. Excess entries are evicted in
 * LRU order (their `destroy?()` is invoked when present). Lowering `max`
 * immediately evicts down to the new ceiling.
 */
export const configureProofreaderCache = (
  options: ConfigureProofreaderCacheOptions = {},
): void => {
  if (options.max !== undefined) {
    cacheConfig.max = normalizeCacheMax(options.max);
  }
  trim();
};

const destroySession = (entry: Promise<ProofreaderInstance>): void => {
  entry
    .then((session) => {
      try {
        session.destroy?.();
      } catch {
        // best-effort; the spec doesn't require destroy to be infallible.
      }
    })
    .catch(() => {
      // session never resolved; nothing to destroy.
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

const canonicalExpectedInputLanguages = (
  languages: string[] | undefined,
): string[] | undefined => (languages ? [...languages].sort() : undefined);

const cacheKeyFor = (options: ProofreaderAvailabilityOptions): string =>
  JSON.stringify({
    expectedInputLanguages: canonicalExpectedInputLanguages(
      options.expectedInputLanguages,
    ),
  });

/**
 * Get or create a `Proofreader` session for the given options. Sessions live
 * for the tab lifetime so consecutive same-config calls skip the cold start.
 * On `create()` failure the cache slot is purged so the next call retries
 * instead of returning a poisoned promise.
 */
export const getOrCreateProofreader = (
  api: ProofreaderApi,
  options: ProofreaderCreateOptions,
): Promise<ProofreaderInstance> => {
  // Drop `signal` and `monitor` from the cache key; they're per-call
  // ephemera that shouldn't fragment session reuse.
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

/** Drop every cached proofreader session. */
export const clearProofreaderSessions = (): void => {
  for (const entry of sessionCache.values()) {
    destroySession(entry);
  }
  sessionCache.clear();
};

/** Drop the cached proofreader session whose create-options match `options`. */
export const clearProofreaderSession = (
  options: ProofreaderAvailabilityOptions,
): void => {
  const key = cacheKeyFor(options);
  const entry = sessionCache.get(key);
  if (!entry) return;
  sessionCache.delete(key);
  destroySession(entry);
};

/** Test-only escape hatch; drop every cached session. */
export const __clearSessionCacheForTests = (): void => {
  sessionCache.clear();
  cacheConfig.max = DEFAULT_MAX_CACHED_SESSIONS;
};
