/**
 * `sessionStorage`-backed cache so an identical prompt renders instantly on
 * revisit, skipping the model entirely. The cache is best-effort: storage
 * disabled / quota exceeded falls through silently; the response still
 * renders.
 *
 * Prompt cache keys hash the inputs that affect the model output
 * (prompt + systemPrompt + samplingMode / temperature / topK). Pass an
 * explicit `cacheKey` to `ask()` if you want a more stable key (e.g.
 * per-feature shorthand).
 */

export interface ResponseCache {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

/**
 * Public-facing `cache` option. Pass `"session"` / `"local"` for storage
 * shortcuts, or any `{ get, set }`-shaped object for a custom backend.
 */
export type CacheOption = "session" | "local" | ResponseCache;

interface DefaultCacheOptions {
  storage?: Storage;
  prefix?: string;
}

const createStorageCache = (options: DefaultCacheOptions): ResponseCache => {
  const prefix = options.prefix ?? "prompt:";
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
): ResponseCache | undefined => {
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

export interface DefaultCacheKeyInput {
  prompt: string;
  systemPrompt?: string;
  samplingMode?: string;
  temperature?: number;
  topK?: number;
}

/**
 * Build a default cache key from the inputs that affect the response. JSON
 * stringification keeps it collision-free without pulling in a hashing
 * dependency. Pass a custom `cacheKey` to `ask()` for shorter / sticky keys.
 */
export const defaultCacheKey = (input: DefaultCacheKeyInput): string => {
  const parts: unknown[] = [
    input.prompt,
    input.systemPrompt ?? "",
    input.temperature ?? null,
    input.topK ?? null,
  ];
  if (input.samplingMode !== undefined) parts.push(input.samplingMode);
  return JSON.stringify(parts);
};
