/**
 * Adapter over the global `LanguageDetector` API exposed by Chrome (behind
 * `chrome://flags/#language-detection-api`). Feature-detected; on browsers
 * without it, every entry point returns `null` so callers can stay
 * declarative.
 *
 * Spec: https://developer.chrome.com/docs/ai/language-detection
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

export interface LanguageDetectorCreateOptions {
  /** BCP-47 languages the detector should bias toward. */
  expectedInputLanguages?: string[];
  /** Standard `AbortSignal` plumbed through to the underlying call. */
  signal?: AbortSignal;
  /** Observe the first-call model download. */
  monitor?: (m: CreateMonitor) => void;
}

export interface LanguageDetectorAvailabilityOptions {
  expectedInputLanguages?: string[];
}

export interface DetectionResult {
  /** BCP-47 language code. May be `"und"` (undetermined) for ambiguous input. */
  detectedLanguage: string;
  /** 0..1 confidence score. */
  confidence: number;
}

export interface LanguageDetectorInstance {
  detect(text: string): Promise<DetectionResult[]>;
  destroy?(): void;
}

export type LanguageDetectorAvailability =
  | "unavailable"
  | "downloadable"
  | "downloading"
  | "available";

export interface LanguageDetectorApi {
  availability(
    options?: LanguageDetectorAvailabilityOptions,
  ): Promise<LanguageDetectorAvailability>;
  create(
    options?: LanguageDetectorCreateOptions,
  ): Promise<LanguageDetectorInstance>;
}

/** Internal: read the native global. Not exported. */
export const getLanguageDetectorApi = (): LanguageDetectorApi | null => {
  if (typeof globalThis === "undefined") return null;
  return (
    (globalThis as unknown as { LanguageDetector?: LanguageDetectorApi })
      .LanguageDetector ?? null
  );
};

/** Whether the current environment exposes the LanguageDetector API. */
export const isAvailable = (): boolean => getLanguageDetectorApi() !== null;

/**
 * Probe the native `availability()` for the given shape. Returns `null` on
 * browsers without the API.
 */
export const checkAvailability = async (
  options?: LanguageDetectorAvailabilityOptions,
): Promise<LanguageDetectorAvailability | null> => {
  const api = getLanguageDetectorApi();
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
const sessionCache = new Map<string, Promise<LanguageDetectorInstance>>();

const normalizeCacheMax = (max: number): number =>
  Number.isFinite(max) ? Math.max(0, Math.floor(max)) : 0;

export interface ConfigureLanguageDetectorCacheOptions {
  /** Soft cap on cached language detector sessions. Default: `8`. */
  max?: number;
}

/**
 * Bound the internal language detector session cache. Excess entries are
 * evicted in LRU order (their `destroy?()` is invoked when present).
 * Lowering `max` immediately evicts down to the new ceiling.
 */
export const configureLanguageDetectorCache = (
  options: ConfigureLanguageDetectorCacheOptions = {},
): void => {
  if (options.max !== undefined) {
    cacheConfig.max = normalizeCacheMax(options.max);
  }
  trim();
};

const destroySession = (entry: Promise<LanguageDetectorInstance>): void => {
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

/** Drop every cached language detector session. */
export const clearLanguageDetectorSessions = (): void => {
  for (const entry of sessionCache.values()) {
    destroySession(entry);
  }
  sessionCache.clear();
};

const canonicalExpectedInputLanguages = (
  languages: string[] | undefined,
): string[] | undefined => (languages ? [...languages].sort() : undefined);

const cacheKeyFor = (options: LanguageDetectorAvailabilityOptions): string =>
  JSON.stringify({
    expectedInputLanguages: canonicalExpectedInputLanguages(
      options.expectedInputLanguages,
    ),
  });

/** Drop the cached detector session whose create-options match `options`. */
export const clearLanguageDetectorSession = (
  options: LanguageDetectorAvailabilityOptions,
): void => {
  const key = cacheKeyFor(options);
  const entry = sessionCache.get(key);
  if (!entry) return;
  sessionCache.delete(key);
  destroySession(entry);
};

/**
 * Get or create a `LanguageDetector` session for the given options.
 * Sessions live for the tab lifetime so consecutive calls with the same
 * shape skip the cold start. On `create()` failure the cache slot is
 * purged so the next call retries instead of returning a poisoned promise.
 */
export const getOrCreateLanguageDetector = (
  api: LanguageDetectorApi,
  options: LanguageDetectorCreateOptions,
): Promise<LanguageDetectorInstance> => {
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

/** Test-only escape hatch; drop every cached session. */
export const __clearSessionCacheForTests = (): void => {
  sessionCache.clear();
  cacheConfig.max = DEFAULT_MAX_CACHED_SESSIONS;
};
