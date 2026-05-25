/**
 * `sessionStorage`-backed cache so a successful translation renders instantly
 * on revisit, skipping the model entirely. Off by default; opt in via
 * `cache: "session" | "local" | { get, set }`.
 */

export interface TranslationCache {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

/**
 * Public-facing `cache` option. Pass `"session"` / `"local"` for storage
 * shortcuts, or any `{ get, set }`-shaped object for a custom backend.
 */
export type CacheOption = "session" | "local" | TranslationCache;

interface DefaultCacheOptions {
  storage?: Storage;
  prefix?: string;
}

const createStorageCache = (options: DefaultCacheOptions): TranslationCache => {
  const prefix = options.prefix ?? "translator:";
  const storage = options.storage;

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
 * Resolve the public `cache` option into a concrete `{ get, set }` backend.
 * `undefined` → no caching. `"session"` / `"local"` → wrap the matching
 * web-storage backend (no-op fallback if unavailable). Object → passthrough.
 */
export const resolveCache = (
  value: CacheOption | undefined,
): TranslationCache | undefined => {
  if (value === undefined) return undefined;
  if (value === "session") {
    const storage =
      typeof globalThis !== "undefined"
        ? (globalThis as { sessionStorage?: Storage }).sessionStorage
        : undefined;
    return createStorageCache({ storage });
  }
  if (value === "local") {
    const storage =
      typeof globalThis !== "undefined"
        ? (globalThis as { localStorage?: Storage }).localStorage
        : undefined;
    return createStorageCache({ storage });
  }
  return value;
};

/**
 * Build a default cache key from `sourceLanguage`, `targetLanguage`, and the
 * trimmed input. Pass an explicit `cacheKey` to `translate()` if you want a
 * more stable key (e.g. a per-feature shorthand).
 */
export const defaultCacheKey = (input: {
  sourceLanguage: string;
  targetLanguage: string;
  text: string;
}): string =>
  JSON.stringify([
    input.sourceLanguage.toLowerCase(),
    input.targetLanguage.toLowerCase(),
    input.text.trim(),
  ]);
