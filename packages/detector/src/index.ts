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
  type CreateMonitor,
  checkAvailability,
  type DetectionResult,
  getLanguageDetectorApi,
  getOrCreateLanguageDetector,
  isAvailable,
  type LanguageDetectorApi,
  type LanguageDetectorAvailability,
  type LanguageDetectorAvailabilityOptions,
  type LanguageDetectorCreateOptions,
  type LanguageDetectorInstance,
} from "./api.js";
import {
  type CacheOption,
  type DetectionCache,
  defaultCacheKey,
  resolveCache,
} from "./cache.js";

export type {
  CacheOption,
  CreateMonitor,
  DetectionCache,
  DetectionResult,
  LanguageDetectorApi,
  LanguageDetectorAvailability,
  LanguageDetectorAvailabilityOptions,
  LanguageDetectorCreateOptions,
  LanguageDetectorInstance,
};
export { checkAvailability, isAvailable };

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
  /** Cache key. Default: hash of `{ input, expectedInputLanguages }`. */
  cacheKey?: string;
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
  const expectedInputLanguages = options.expectedInputLanguages
    ? [...options.expectedInputLanguages]
    : undefined;

  const cache = resolveCache(options.cache);
  const cacheKey =
    options.cacheKey ?? defaultCacheKey({ text, expectedInputLanguages });
  if (cache) {
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

  const baseCreateOptions: LanguageDetectorCreateOptions = {
    ...(expectedInputLanguages ? { expectedInputLanguages } : {}),
    ...(options.monitor ? { monitor: options.monitor } : {}),
  };

  // Pass the same shape to availability() as we do to create() so engines
  // that warn on mismatch (Edge) stay quiet.
  const availability = await api
    .availability(
      expectedInputLanguages ? { expectedInputLanguages } : undefined,
    )
    .catch(() => "unavailable" as const);
  if (availability === "unavailable") {
    throw new DetectorUnavailableError("LanguageDetector reports unavailable.");
  }
  if (options.signal?.aborted) throw new DetectorAbortError();

  const sessionPromise = getOrCreateLanguageDetector(api, baseCreateOptions);

  // Wrap session-create failures with context so consumers can branch on
  // a single typed error instead of parsing browser-specific messages.
  let session: LanguageDetectorInstance;
  try {
    session = await sessionPromise;
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
};
