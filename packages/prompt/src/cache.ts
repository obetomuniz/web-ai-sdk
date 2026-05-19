/**
 * `sessionStorage`-backed cache so an identical prompt renders instantly on
 * revisit, skipping the model entirely. The cache is best-effort: storage
 * disabled / quota exceeded falls through silently; the response still
 * renders.
 *
 * Prompt cache keys hash the inputs that affect the model output
 * (prompt + systemPrompt + temperature + topK). Pass an explicit `cacheKey`
 * to `prompt()` if you want a more stable key (e.g. per-feature shorthand).
 */

export interface ResponseCache {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export interface DefaultCacheOptions {
  /** Storage backend. Default: `globalThis.sessionStorage`. */
  storage?: Storage;
  /** Prefix for cache keys. Default: `"prompt:"`. */
  prefix?: string;
}

export const createSessionStorageCache = (
  options: DefaultCacheOptions = {},
): ResponseCache => {
  const prefix = options.prefix ?? "prompt:";
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

export interface DefaultCacheKeyInput {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  topK?: number;
}

/**
 * Build a default cache key from the inputs that affect the response. JSON
 * stringification keeps it collision-free without pulling in a hashing
 * dependency. Pass a custom `cacheKey` to `prompt()` for shorter / sticky keys.
 */
export const defaultCacheKey = (input: DefaultCacheKeyInput): string =>
  JSON.stringify([
    input.prompt,
    input.systemPrompt ?? "",
    input.temperature ?? null,
    input.topK ?? null,
  ]);
