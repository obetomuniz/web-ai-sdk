/**
 * `sessionStorage`-backed cache so identical detection inputs render
 * instantly on revisit, skipping the model entirely. The cache is
 * best-effort: storage disabled / quota exceeded falls through silently;
 * the response still resolves.
 *
 * Detection cache keys are JSON strings of the trimmed input text and language
 * hints. Pass an explicit `cacheKey` to `detect()` if you want a more stable
 * key (e.g. a per-feature shorthand).
 */

export interface DetectionCache {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

/**
 * Public-facing `cache` option. Pass `"session"` / `"local"` for storage
 * shortcuts, or any `{ get, set }`-shaped object for a custom backend.
 */
export type CacheOption = "session" | "local" | DetectionCache;

/**
 * Default time-to-live for entries written by the built-in `"session"` /
 * `"local"` storage shortcuts: one hour. On-device model output changes as
 * the browser updates the model, so built-in entries expire instead of
 * persisting indefinitely. Override per call with `cacheTtl`. Custom
 * `{ get, set }` caches own their expiry policy.
 */
export const DEFAULT_CACHE_TTL_MS = 60 * 60 * 1000;

/** Version tag for the storage envelope written by the built-in shortcuts. */
const ENVELOPE_VERSION = 1;

interface CacheEnvelope {
  v: number;
  value: string;
  expiresAt: number;
}

/**
 * Parse a stored entry into a versioned envelope. Legacy raw strings,
 * malformed JSON, unsupported versions, and invalid timestamps all return
 * `null` so the caller treats them as misses.
 */
const parseEnvelope = (raw: string): CacheEnvelope | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const envelope = parsed as Partial<CacheEnvelope>;
  if (envelope.v !== ENVELOPE_VERSION) return null;
  if (typeof envelope.value !== "string") return null;
  if (
    typeof envelope.expiresAt !== "number" ||
    !Number.isFinite(envelope.expiresAt)
  )
    return null;
  return envelope as CacheEnvelope;
};

const normalizeTtl = (ttlMs: number | undefined): number =>
  typeof ttlMs === "number" && Number.isFinite(ttlMs) && ttlMs > 0
    ? ttlMs
    : DEFAULT_CACHE_TTL_MS;

interface DefaultCacheOptions {
  storage?: Storage;
  prefix?: string;
  ttlMs?: number;
}

const createStorageCache = (options: DefaultCacheOptions): DetectionCache => {
  const prefix = options.prefix ?? "detector:";
  const storage = options.storage;
  const ttlMs = normalizeTtl(options.ttlMs);

  return {
    get(key) {
      if (!storage) return null;
      let raw: string | null;
      try {
        raw = storage.getItem(prefix + key);
      } catch {
        return null;
      }
      if (raw === null) return null;
      const envelope = parseEnvelope(raw);
      if (envelope && Date.now() < envelope.expiresAt) return envelope.value;
      // Legacy raw strings, malformed envelopes, and expired entries are
      // misses; drop them so the next successful run replaces the slot.
      try {
        storage.removeItem(prefix + key);
      } catch {
        // best-effort cleanup only.
      }
      return null;
    },
    set(key, value) {
      if (!storage) return;
      try {
        storage.setItem(
          prefix + key,
          JSON.stringify({
            v: ENVELOPE_VERSION,
            value,
            expiresAt: Date.now() + ttlMs,
          }),
        );
      } catch {
        // quota / disabled storage; best-effort only.
      }
    },
  };
};

/**
 * Resolve the public `cache` option into a concrete `{ get, set }` backend.
 * `undefined` → no caching. `"session"` / `"local"` → wrap the matching
 * web-storage backend (no-op fallback if unavailable) with a TTL envelope.
 * Object → passthrough; `ttlMs` does not apply to custom backends.
 */
export const resolveCache = (
  value: CacheOption | undefined,
  ttlMs?: number,
): DetectionCache | undefined => {
  if (value === undefined) return undefined;
  if (value === "session") {
    const storage =
      typeof globalThis !== "undefined"
        ? (globalThis as { sessionStorage?: Storage }).sessionStorage
        : undefined;
    return createStorageCache({ storage, ttlMs });
  }
  if (value === "local") {
    const storage =
      typeof globalThis !== "undefined"
        ? (globalThis as { localStorage?: Storage }).localStorage
        : undefined;
    return createStorageCache({ storage, ttlMs });
  }
  return value;
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
