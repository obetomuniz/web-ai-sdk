/**
 * `sessionStorage`-backed cache so a successful summary renders instantly on
 * revisit, skipping the model entirely. The cache is best-effort: storage
 * disabled / quota exceeded falls through silently; the summary still
 * renders.
 */

export interface SummaryCache {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export interface DefaultCacheOptions {
  /** Storage backend. Default: `globalThis.sessionStorage`. */
  storage?: Storage;
  /** Prefix for cache keys. Default: `"summarizer:"`. */
  prefix?: string;
}

export const createSessionStorageCache = (
  options: DefaultCacheOptions = {},
): SummaryCache => {
  const prefix = options.prefix ?? "summarizer:";
  const storage =
    options.storage ??
    (typeof globalThis !== "undefined"
      ? (globalThis as { sessionStorage?: Storage }).sessionStorage
      : undefined);

  return {
    get(key) {
      if (!storage) return null;
      try {
        return storage.getItem(prefix + key);
      } catch {
        return null;
      }
    },
    set(key, value) {
      if (!storage) return;
      try {
        storage.setItem(prefix + key, value);
      } catch {
        // quota / disabled storage; best-effort only.
      }
    },
  };
};

/**
 * Build a default cache key from `pathname:lang`. Pass a custom function to
 * `summarize()`'s `cacheKey` option for finer-grained invalidation.
 */
export const defaultCacheKey = (lang: string): string => {
  if (typeof globalThis === "undefined") return lang;
  const loc = (globalThis as { location?: Location }).location;
  if (!loc) return lang;
  return `${loc.pathname}:${lang}`;
};
