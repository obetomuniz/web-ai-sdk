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

/**
 * Public-facing `cache` option. Pass `"session"` / `"local"` for storage
 * shortcuts, or any `{ get, set }`-shaped object for a custom backend.
 */
export type CacheOption = "session" | "local" | SummaryCache;

interface DefaultCacheOptions {
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
 * Resolve the public `cache` option into a concrete `{ get, set }` backend.
 * `undefined` → no caching. `"session"` / `"local"` → wrap the matching
 * web-storage backend (no-op fallback if unavailable). Object → passthrough.
 */
export const resolveCache = (
  value: CacheOption | undefined,
): SummaryCache | undefined => {
  if (value === undefined) return undefined;
  if (value === "session") {
    return createSessionStorageCache();
  }
  if (value === "local") {
    const storage =
      typeof globalThis !== "undefined"
        ? (globalThis as { localStorage?: Storage }).localStorage
        : undefined;
    return createSessionStorageCache({ storage });
  }
  return value;
};

/**
 * Build a default cache key from the route, input, and summary options that
 * affect the output. Pass a custom string to `summarize()`'s `cacheKey` option
 * for finer-grained invalidation.
 */
interface DefaultCacheKeyInput {
  text: string;
  language: string;
  supportedLanguages?: readonly string[];
  type?: string;
  length?: string;
  format?: string;
  preference?: string;
  sharedContext?: string;
}

const currentPathname = (): string => {
  let pathname = "";
  if (typeof globalThis === "undefined") {
    pathname = "";
  } else {
    const loc = (globalThis as { location?: Location }).location;
    pathname = loc?.pathname ?? "";
  }
  return pathname;
};

export const defaultCacheKey = (
  input: string | DefaultCacheKeyInput,
): string => {
  const pathname = currentPathname();
  if (typeof input === "string")
    return pathname ? `${pathname}:${input}` : input;
  return JSON.stringify([
    pathname,
    input.text.trim(),
    input.language,
    input.supportedLanguages ?? null,
    input.type ?? "",
    input.length ?? "",
    input.format ?? "",
    input.preference ?? "",
    input.sharedContext ?? "",
  ]);
};
