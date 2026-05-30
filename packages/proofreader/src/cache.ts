/**
 * `sessionStorage`-backed cache so an identical proofread renders instantly
 * on revisit, skipping the model entirely. The cache stores the serialized
 * `ProofreadOutput`. The cache is best-effort: storage disabled / quota
 * exceeded falls through silently; the result still resolves.
 */

export interface ProofreadCache {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

/**
 * Public-facing `cache` option. Pass `"session"` / `"local"` for storage
 * shortcuts, or any `{ get, set }`-shaped object for a custom backend.
 */
export type CacheOption = "session" | "local" | ProofreadCache;

interface DefaultCacheOptions {
  storage?: Storage;
  prefix?: string;
}

const createStorageCache = (options: DefaultCacheOptions): ProofreadCache => {
  const prefix = options.prefix ?? "proofreader:";
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
): ProofreadCache | undefined => {
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
 * Build a default cache key from the inputs that affect the result: the
 * trimmed input text and the expected-languages hint. JSON stringification
 * keeps it collision-free without pulling in a hashing dep.
 */
export const defaultCacheKey = (input: {
  text: string;
  expectedInputLanguages?: readonly string[];
}): string =>
  JSON.stringify([
    input.text.trim(),
    [...(input.expectedInputLanguages ?? [])].sort(),
  ]);
