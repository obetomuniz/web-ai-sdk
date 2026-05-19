/**
 * `sessionStorage`-backed cache so identical detection inputs render
 * instantly on revisit, skipping the model entirely. The cache is
 * best-effort: storage disabled / quota exceeded falls through silently;
 * the response still resolves.
 *
 * Detection cache keys hash the trimmed input text. Pass an explicit
 * `cacheKey` to `detect()` if you want a more stable key (e.g. a
 * per-feature shorthand).
 */

export interface DetectionCache {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export interface DefaultCacheOptions {
  /** Storage backend. Default: `globalThis.sessionStorage`. */
  storage?: Storage;
  /** Prefix for cache keys. Default: `"detector:"`. */
  prefix?: string;
}

export const createSessionStorageCache = (
  options: DefaultCacheOptions = {},
): DetectionCache => {
  const prefix = options.prefix ?? "detector:";
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
 * Build a default cache key from the inputs that affect the response.
 * Just the trimmed text + the expected-languages hint (since that biases
 * the result). JSON stringification keeps it collision-free without
 * pulling in a hashing dep.
 */
export const defaultCacheKey = (input: {
  text: string;
  expectedInputLanguages?: readonly string[];
}): string =>
  JSON.stringify([
    input.text.trim(),
    [...(input.expectedInputLanguages ?? [])].sort(),
  ]);
