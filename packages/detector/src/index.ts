/**
 * @web-ai-sdk/detector; building block for the Web's Built-in Language
 * Detector API.
 *
 * Vanilla TypeScript / DOM core. The React adapter at
 * `@web-ai-sdk/detector/react` is a thin hook around this module.
 *
 * Spec: https://developer.chrome.com/docs/ai/language-detection
 */

import {
  acquireLanguageDetector,
  type ConfigureLanguageDetectorCacheOptions,
  type CreateMonitor,
  checkAvailability,
  clearLanguageDetectorSession,
  clearLanguageDetectorSessions,
  configureLanguageDetectorCache,
  type DetectionResult,
  getLanguageDetectorApi,
  isAvailable,
  type LanguageDetectorApi,
  type LanguageDetectorAvailability,
  type LanguageDetectorAvailabilityOptions,
  type LanguageDetectorCreateOptions,
  type LanguageDetectorInstance,
  leaseLanguageDetector,
} from "./api.js";
import {
  type CacheOption,
  DEFAULT_CACHE_TTL_MS,
  type DetectionCache,
  defaultCacheKey,
  resolveCache,
} from "./cache.js";

export type {
  CacheOption,
  ConfigureLanguageDetectorCacheOptions,
  CreateMonitor,
  DetectionCache,
  DetectionResult,
  LanguageDetectorApi,
  LanguageDetectorAvailability,
  LanguageDetectorAvailabilityOptions,
  LanguageDetectorCreateOptions,
  LanguageDetectorInstance,
};
export {
  checkAvailability,
  clearLanguageDetectorSession,
  clearLanguageDetectorSessions,
  configureLanguageDetectorCache,
  DEFAULT_CACHE_TTL_MS,
  isAvailable,
};

export interface DetectOptions {
  /** Text to detect. Empty / whitespace-only input resolves to `{ output: null }`. */
  input: string;
  /** BCP-47 languages the detector should bias toward. */
  expectedInputLanguages?: readonly string[];
  /**
   * Minimum confidence (0..1) for a result to be returned. Below this,
   * `output` is `null` (we treat it as inconclusive). Default: `0`.
   */
  minConfidence?: number;
  /** Observe the first-call model download. */
  monitor?: (m: CreateMonitor) => void;
  /**
   * Result cache. Off by default; every call hits the model. Pass
   * `"session"` / `"local"` for the matching web-storage shortcut, or any
   * `{ get, set }`-shaped object for a custom backend.
   */
  cache?: CacheOption;
  /** Cache key. Default: JSON array string of `[input, sortedExpectedInputLanguages]`. */
  cacheKey?: string;
  /**
   * Time-to-live in milliseconds for entries written by the built-in
   * `"session"` / `"local"` storage shortcuts. Default: one hour
   * (`DEFAULT_CACHE_TTL_MS`). Ignored for custom `{ get, set }` caches, which
   * own their expiry policy.
   */
  cacheTtl?: number;
  /**
   * Force a fresh detection. Skips the cache read, runs the model, and
   * replaces the cached value after a successful run. Applies to built-in
   * and custom caches.
   */
  cacheRefresh?: boolean;
  /** Abort signal. */
  signal?: AbortSignal;
}

export interface DetectResult {
  /**
   * The detection result, or `null` when input is empty / no candidate
   * meets `minConfidence`. When non-null, `language` is BCP-47, `confidence`
   * is the top match's score, and `all` is the full sorted list of
   * candidates for callers that want to inspect alternates.
   */
  output: {
    language: string;
    confidence: number;
    all: DetectionResult[];
  } | null;
  /** Whether the result came from the cache (no model call). */
  cached: boolean;
}

export class DetectorUnavailableError extends Error {
  override readonly name = "DetectorUnavailableError";
}

class DetectorAbortError extends Error {
  override readonly name = "AbortError";
  constructor() {
    super("Detection aborted");
  }
}

/**
 * Session-affecting subset of `DetectOptions`. `prepareLanguageDetector` and
 * `detect` derive the same native create options from these fields, so a
 * prepared session is reused by the matching call.
 */
export type PrepareLanguageDetectorOptions = Pick<
  DetectOptions,
  "expectedInputLanguages" | "monitor"
>;

interface SessionConfig {
  expectedInputLanguages: string[] | undefined;
  createOptions: LanguageDetectorCreateOptions;
}

/**
 * Single source of the option-to-session mapping. The session cache keys by
 * `createOptions`, so `detect` and `prepareLanguageDetector` must both go
 * through this derivation.
 */
const resolveSessionConfig = (
  options: PrepareLanguageDetectorOptions,
): SessionConfig => {
  const expectedInputLanguages = options.expectedInputLanguages
    ? [...options.expectedInputLanguages]
    : undefined;

  const createOptions: LanguageDetectorCreateOptions = {
    ...(expectedInputLanguages ? { expectedInputLanguages } : {}),
    ...(options.monitor ? { monitor: options.monitor } : {}),
  };

  return { expectedInputLanguages, createOptions };
};

export interface LanguageDetectorLease {
  /**
   * Resolves when the native session is created. Rejects with
   * `DetectorUnavailableError` when the API is missing or creation fails.
   */
  ready: Promise<void>;
  /**
   * Idempotent. The final release destroys the session once no other lease
   * or in-flight call uses it.
   */
  release(): void;
}

/**
 * Start native session creation as soon as user intent is clear, before the
 * input exists. The matching `detect` call reuses the prepared session
 * without a second create. Never throws synchronously; unavailability and
 * creation failures reject `ready`. Failed preparations leave the cache so a
 * later call can retry.
 */
export const prepareLanguageDetector = (
  options: PrepareLanguageDetectorOptions = {},
): LanguageDetectorLease => {
  const api = getLanguageDetectorApi();
  if (!api?.create) {
    const ready = Promise.reject(
      new DetectorUnavailableError(
        "LanguageDetector API is not available in this environment.",
      ),
    );
    // Keep unobserved leases from surfacing unhandled rejections.
    ready.catch(() => {});
    return { ready, release: () => {} };
  }
  const { createOptions } = resolveSessionConfig(options);
  const lease = leaseLanguageDetector(api, createOptions);
  const ready = lease.ready.catch((err) => {
    const message = (err as Error)?.message ?? String(err);
    throw new DetectorUnavailableError(
      `LanguageDetector.create() failed: ${message}`,
    );
  });
  ready.catch(() => {});
  return { ready, release: lease.release };
};

/**
 * Detect the language of a string. Returns the top match with confidence,
 * plus the full sorted list for callers that want to inspect alternates.
 * Returns `{ output: null, ... }` for empty input or when the top
 * confidence is below `minConfidence`. Throws `DetectorUnavailableError`
 * when the API isn't present in the environment.
 */
export const detect = async (options: DetectOptions): Promise<DetectResult> => {
  const api = getLanguageDetectorApi();
  if (!api?.create) {
    throw new DetectorUnavailableError(
      "LanguageDetector API is not available in this environment.",
    );
  }

  const text = options.input.trim();
  if (!text) {
    return { output: null, cached: false };
  }

  const minConfidence = options.minConfidence ?? 0;
  const { expectedInputLanguages, createOptions } =
    resolveSessionConfig(options);

  const cache = resolveCache(options.cache, options.cacheTtl);
  const cacheKey =
    options.cacheKey ?? defaultCacheKey({ text, expectedInputLanguages });
  if (cache && !options.cacheRefresh) {
    const cached = cache.get(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as DetectionResult[];
        const top = parsed[0];
        if (top && top.confidence >= minConfidence) {
          return {
            output: {
              language: top.detectedLanguage,
              confidence: top.confidence,
              all: parsed,
            },
            cached: true,
          };
        }
        return { output: null, cached: true };
      } catch {
        // bad cache entry; fall through to fresh call.
      }
    }
  }

  // Pass the same shape to availability() as we do to create() so the probe
  // applies to the requested configuration.
  const availability = await api
    .availability(
      expectedInputLanguages ? { expectedInputLanguages } : undefined,
    )
    .catch(() => "unavailable" as const);
  if (availability === "unavailable") {
    throw new DetectorUnavailableError("LanguageDetector reports unavailable.");
  }
  if (options.signal?.aborted) throw new DetectorAbortError();

  // The pin defers destruction (lease release, clear, eviction) until this
  // call finishes.
  const acquired = acquireLanguageDetector(api, createOptions);
  try {
    // Wrap session-create failures with context so consumers can branch on
    // a single typed error instead of parsing browser-specific messages.
    let session: LanguageDetectorInstance;
    try {
      session = await acquired.session;
    } catch (err) {
      if (err instanceof DetectorAbortError) throw err;
      const message = (err as Error)?.message ?? String(err);
      throw new DetectorUnavailableError(
        `LanguageDetector.create() failed: ${message}`,
      );
    }
    if (options.signal?.aborted) throw new DetectorAbortError();

    const results = await session.detect(text);
    if (options.signal?.aborted) throw new DetectorAbortError();

    // The spec says results are sorted by confidence descending; sort again
    // defensively in case an implementation drifts.
    const sorted = [...results].sort((a, b) => b.confidence - a.confidence);
    if (cache && sorted.length > 0) {
      cache.set(cacheKey, JSON.stringify(sorted));
    }

    const top = sorted[0];
    if (!top || top.confidence < minConfidence) {
      return { output: null, cached: false };
    }
    return {
      output: {
        language: top.detectedLanguage,
        confidence: top.confidence,
        all: sorted,
      },
      cached: false,
    };
  } finally {
    acquired.done();
  }
};
