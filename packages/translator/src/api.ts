/**
 * Adapter over the global `Translator` API exposed by Chrome 138+. The native
 * surface is feature-detected; on browsers without it, every entry point in
 * this module returns `null` / `undefined` so callers can stay declarative.
 *
 * Spec: https://developer.chrome.com/docs/ai/translator-api
 */

export interface TranslatorInstance {
  translate(text: string): Promise<string>;
  destroy?(): void;
}

export interface DownloadProgressEvent extends Event {
  readonly loaded: number;
}

export interface TranslatorMonitor {
  addEventListener(
    type: "downloadprogress",
    listener: (event: DownloadProgressEvent) => void,
  ): void;
}

export interface TranslatorCreateOptions {
  sourceLanguage: string;
  targetLanguage: string;
  monitor?(m: TranslatorMonitor): void;
}

export interface TranslatorAvailabilityOptions {
  sourceLanguage: string;
  targetLanguage: string;
}

export type TranslatorAvailability =
  | "unavailable"
  | "downloadable"
  | "downloading"
  | "available";

export interface TranslatorApi {
  availability(
    options: TranslatorAvailabilityOptions,
  ): Promise<TranslatorAvailability>;
  create(options: TranslatorCreateOptions): Promise<TranslatorInstance>;
}

/** Internal: read the native global. Not exported from the package. */
export const getTranslatorApi = (): TranslatorApi | null => {
  if (typeof globalThis === "undefined") return null;
  return (
    (globalThis as unknown as { Translator?: TranslatorApi }).Translator ?? null
  );
};

/** Whether the current environment exposes the Translator API. */
export const isAvailable = (): boolean => getTranslatorApi() !== null;

export const checkAvailability = async (
  options: TranslatorAvailabilityOptions,
): Promise<TranslatorAvailability | null> => {
  const api = getTranslatorApi();
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
const sessionCache = new Map<string, Promise<TranslatorInstance>>();

const normalizeCacheMax = (max: number): number =>
  Number.isFinite(max) ? Math.max(0, Math.floor(max)) : 0;

export interface ConfigureTranslatorCacheOptions {
  /** Soft cap on cached translator sessions. Default: `8`. */
  max?: number;
}

/**
 * Bound the internal translator session cache. Excess entries are evicted in
 * LRU order (their `destroy?()` is invoked when present). Lowering `max`
 * immediately evicts down to the new ceiling.
 */
export const configureTranslatorCache = (
  options: ConfigureTranslatorCacheOptions = {},
): void => {
  if (options.max !== undefined) {
    cacheConfig.max = normalizeCacheMax(options.max);
  }
  trim();
};

const destroySession = (entry: Promise<TranslatorInstance>): void => {
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

/** Drop every cached translator session. */
export const clearTranslatorSessions = (): void => {
  for (const entry of sessionCache.values()) {
    destroySession(entry);
  }
  sessionCache.clear();
};

const cacheKeyFor = (options: TranslatorAvailabilityOptions): string =>
  `${options.sourceLanguage}->${options.targetLanguage}`;

/** Drop the cached translator session whose language pair matches `options`. */
export const clearTranslatorSession = (
  options: TranslatorAvailabilityOptions,
): void => {
  const key = cacheKeyFor(options);
  const entry = sessionCache.get(key);
  if (!entry) return;
  sessionCache.delete(key);
  destroySession(entry);
};

/**
 * Get or create a `Translator` session for the given language pair. Sessions
 * live for the tab lifetime so navigating between same-language documents
 * skips the ~1-3s cold start. On `create()` failure the cache slot is purged
 * so the next call retries instead of returning a poisoned promise.
 */
export const getOrCreateTranslator = (
  api: TranslatorApi,
  options: TranslatorCreateOptions,
): Promise<TranslatorInstance> => {
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
