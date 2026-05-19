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
  type DetectionResult,
  type LanguageDetectorApi,
  type LanguageDetectorAvailability,
  type LanguageDetectorAvailabilityOptions,
  type LanguageDetectorCreateOptions,
  type LanguageDetectorInstance,
  checkAvailability,
  getLanguageDetectorApi,
  getOrCreateLanguageDetector,
  isDetectorAvailable,
} from "./api.js";
import {
  type DetectionCache,
  createSessionStorageCache,
  defaultCacheKey,
} from "./cache.js";

export {
  isDetectorAvailable,
  checkAvailability,
  getLanguageDetectorApi,
  getOrCreateLanguageDetector,
  createSessionStorageCache,
  defaultCacheKey,
};

export type {
  DetectionResult,
  LanguageDetectorApi,
  LanguageDetectorAvailability,
  LanguageDetectorAvailabilityOptions,
  LanguageDetectorCreateOptions,
  LanguageDetectorInstance,
  DetectionCache,
};

export interface DetectOptions {
  /** Text to detect. Empty / whitespace-only input resolves to `null`. */
  text: string;
  /** BCP-47 languages the detector should bias toward. */
  expectedInputLanguages?: readonly string[];
  /**
   * Minimum confidence (0..1) for the top result to be returned. Below
   * this, `language` is `null` (we treat it as inconclusive). Default: `0`.
   */
  minConfidence?: number;
  /** Override `LanguageDetector.create()` options entirely. Merged on top of defaults. */
  createOptions?: Partial<LanguageDetectorCreateOptions>;
  /** Cache backend. When omitted, no caching happens. */
  cache?: DetectionCache;
  /** Cache key. Default: hash of `{ text, expectedInputLanguages }`. */
  cacheKey?: string;
  /** Abort signal. */
  signal?: AbortSignal;
}

export interface DetectResult {
  /** Top language (BCP-47), or `null` when input is empty / below `minConfidence`. */
  language: string | null;
  /** Confidence of the top result. `0` when `language` is `null`. */
  confidence: number;
  /** Full sorted list of candidates from the underlying model. */
  all: DetectionResult[];
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
 * Returns `{ language: null, ... }` for empty input or when the top
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

  const text = options.text.trim();
  if (!text) {
    return { language: null, confidence: 0, all: [], cached: false };
  }

  const minConfidence = options.minConfidence ?? 0;
  const expectedInputLanguages = options.expectedInputLanguages
    ? [...options.expectedInputLanguages]
    : undefined;

  // Caching is opt-in. Pass a `cache` (any `{ get, set }`-shaped object)
  // to enable result caching; omit it for a fresh model call every time.
  const cache = options.cache;
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
            language: top.detectedLanguage,
            confidence: top.confidence,
            all: parsed,
            cached: true,
          };
        }
        return { language: null, confidence: 0, all: parsed, cached: true };
      } catch {
        // bad cache entry; fall through to fresh call.
      }
    }
  }

  const baseCreateOptions: LanguageDetectorCreateOptions = {
    ...(expectedInputLanguages ? { expectedInputLanguages } : {}),
    ...options.createOptions,
  };

  // Kick off session and availability in parallel; first call pays the
  // cold start, later calls reuse the cached session. We pass the same
  // shape to availability() as we do to create() so engines that warn on
  // mismatch (Edge) stay quiet.
  const sessionPromise = getOrCreateLanguageDetector(api, baseCreateOptions);
  const availability = await api
    .availability(
      expectedInputLanguages ? { expectedInputLanguages } : undefined,
    )
    .catch(() => "unavailable" as const);
  if (availability === "unavailable") {
    throw new DetectorUnavailableError("LanguageDetector reports unavailable.");
  }
  if (options.signal?.aborted) throw new DetectorAbortError();

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
    return { language: null, confidence: 0, all: sorted, cached: false };
  }
  return {
    language: top.detectedLanguage,
    confidence: top.confidence,
    all: sorted,
    cached: false,
  };
};
