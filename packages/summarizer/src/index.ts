/**
 * @web-ai-sdk/summarizer; building block for the Web's Built-in Summarizer API.
 *
 * Vanilla TypeScript / DOM core. The React adapter at `@web-ai-sdk/summarizer/react` is a
 * thin hook around this module.
 *
 * Spec: https://developer.chrome.com/docs/ai/summarizer-api
 */

import {
  type SummarizerApi,
  type SummarizerAvailability,
  type SummarizerAvailabilityOptions,
  type SummarizerCreateOptions,
  type SummarizerInstance,
  checkAvailability,
  getOrCreateSummarizer,
  getSummarizerApi,
  isSummarizerAvailable,
} from "./api.js";
import {
  type SummaryCache,
  createSessionStorageCache,
  defaultCacheKey,
} from "./cache.js";
import {
  type BuildSkeletonOptions,
  buildSkeleton,
  cleanSummary,
  trimToSentenceBoundary,
} from "./skeleton.js";

export {
  isSummarizerAvailable,
  checkAvailability,
  getSummarizerApi,
  getOrCreateSummarizer,
  buildSkeleton,
  cleanSummary,
  trimToSentenceBoundary,
  createSessionStorageCache,
  defaultCacheKey,
};

export type {
  SummarizerApi,
  SummarizerAvailability,
  SummarizerAvailabilityOptions,
  SummarizerCreateOptions,
  SummarizerInstance,
  SummaryCache,
  BuildSkeletonOptions,
};

export const DEFAULT_MAX_INPUT_CHARS = 3000;
export const DEFAULT_MIN_SKELETON_CHARS = 200;

export interface SummarizeOptions {
  /** BCP-47 language for input + output hints. Falls back to omitting hints if unsupported. */
  language: string;
  /** Article element to skim. Required when `text` isn't passed. */
  article?: Element;
  /** Pre-built input text. When present, skeleton extraction is skipped. */
  text?: string;
  /** Optional title; folded into the skeleton. */
  title?: string;
  /** Optional description; folded into the skeleton. */
  description?: string;
  /** Languages the model supports for input/output hints. Default: `["en", "es", "ja"]`. */
  supportedLanguages?: readonly string[];
  /** `sharedContext` per language. Falls back to `sharedContext.en` if missing. */
  sharedContext?: Record<string, string>;
  /** Override `Summarizer.create()` options entirely. Merged on top of defaults. */
  createOptions?: Partial<SummarizerCreateOptions>;
  /** Hard cap on input chars. Default: `3000`. */
  maxInputChars?: number;
  /**
   * Below this skeleton length we fall back to `article.innerText`. Default: `200`.
   * Set to `0` to always use the skeleton.
   */
  minSkeletonChars?: number;
  /** Optional result cache. Off by default; every call hits the model. Pass `createSessionStorageCache()` or any `{ get, set }`-shaped object to enable. */
  cache?: SummaryCache;
  /** Cache key. Default: `defaultCacheKey(lang)` (pathname:lang). */
  cacheKey?: string;
  /** Streaming chunk callback (cleaned text, monotonically growing). */
  onChunk?: (text: string) => void;
  /** Abort signal. */
  signal?: AbortSignal;
}

export interface SummarizeResult {
  /** Final summary text (cleaned), or `null` if the input was empty. */
  summary: string | null;
  /** Whether the result came from the cache (no model call). */
  cached: boolean;
}

const NORMALIZE_LANG = (lang: string): string =>
  lang.split("-")[0]?.toLowerCase() ?? lang.toLowerCase();

const DEFAULT_SUPPORTED_LANGUAGES = ["en", "es", "ja"] as const;

export class SummarizerUnavailableError extends Error {
  override readonly name = "SummarizerUnavailableError";
}

/**
 * Generate a TL;DR. Uses streaming when the underlying instance supports it,
 * one-shot otherwise. Returns `null` when no input is available (empty
 * article, no text passed). Throws `SummarizerUnavailableError` when the API
 * isn't present in the environment.
 */
export const summarize = async (
  options: SummarizeOptions,
): Promise<SummarizeResult> => {
  const api = getSummarizerApi();
  if (!api?.create) {
    throw new SummarizerUnavailableError(
      "Summarizer API is not available in this environment.",
    );
  }

  const lang = NORMALIZE_LANG(options.language);
  // Caching is opt-in. Pass a `cache` (any `{ get, set }`-shaped object,
  // e.g. `createSessionStorageCache()`) to enable response caching; omit
  // it for a fresh model call every time.
  const cache = options.cache;
  const cacheKey = options.cacheKey ?? defaultCacheKey(lang);
  if (cache) {
    const cached = cache.get(cacheKey);
    if (cached) return { summary: cached, cached: true };
  }

  const supported = new Set(
    options.supportedLanguages ?? DEFAULT_SUPPORTED_LANGUAGES,
  );
  const langOptions: Pick<
    SummarizerCreateOptions,
    "expectedInputLanguages" | "expectedContextLanguages" | "outputLanguage"
  > = supported.has(lang)
    ? {
        expectedInputLanguages: [lang],
        expectedContextLanguages: [lang],
        outputLanguage: lang,
      }
    : {};

  const sharedContext =
    options.sharedContext?.[lang] ??
    options.sharedContext?.en ??
    options.createOptions?.sharedContext ??
    "";

  const maxInputChars = options.maxInputChars ?? DEFAULT_MAX_INPUT_CHARS;
  const minSkeletonChars =
    options.minSkeletonChars ?? DEFAULT_MIN_SKELETON_CHARS;

  let text: string;
  if (options.text !== undefined) {
    text = trimToSentenceBoundary(options.text, maxInputChars);
  } else if (options.article) {
    const skeleton = buildSkeleton({
      article: options.article,
      title: options.title,
      description: options.description,
    });
    if (skeleton.length >= minSkeletonChars) {
      text = trimToSentenceBoundary(skeleton, maxInputChars);
    } else {
      const body =
        "innerText" in options.article
          ? (options.article as HTMLElement).innerText
          : (options.article.textContent ?? "");
      if (!body.trim()) return { summary: null, cached: false };
      text = trimToSentenceBoundary(body, maxInputChars);
    }
  } else {
    return { summary: null, cached: false };
  }

  if (!text.trim()) return { summary: null, cached: false };

  const baseCreateOptions: SummarizerCreateOptions = {
    type: "tldr",
    format: "plain-text",
    length: "medium",
    preference: "speed",
    sharedContext,
    ...langOptions,
    ...options.createOptions,
  };

  // Kick off session and availability in parallel; first call pays the cold
  // start, later calls reuse the cached session.
  //
  // We pass the same options shape to availability() as we do to create().
  // Edge requires this for accurate results and warns when fields like
  // outputLanguage are missing; Chrome is more lenient but accepts the same
  // input. The narrower SummarizerAvailabilityOptions shape filters out
  // create-only fields like `sharedContext` and `preference`.
  const sessionPromise = getOrCreateSummarizer(api, baseCreateOptions);
  const availability = await api
    .availability({
      ...(baseCreateOptions.type ? { type: baseCreateOptions.type } : {}),
      ...(baseCreateOptions.format ? { format: baseCreateOptions.format } : {}),
      ...(baseCreateOptions.length ? { length: baseCreateOptions.length } : {}),
      ...(baseCreateOptions.expectedInputLanguages
        ? { expectedInputLanguages: baseCreateOptions.expectedInputLanguages }
        : {}),
      ...(baseCreateOptions.expectedContextLanguages
        ? {
            expectedContextLanguages:
              baseCreateOptions.expectedContextLanguages,
          }
        : {}),
      ...(baseCreateOptions.outputLanguage
        ? { outputLanguage: baseCreateOptions.outputLanguage }
        : {}),
    })
    .catch(() => "unavailable" as const);
  if (availability === "unavailable") {
    throw new SummarizerUnavailableError("Summarizer reports unavailable.");
  }
  if (options.signal?.aborted) throw new AbortError();

  // Wrap session-create failures with context so consumers can branch on
  // a single typed error instead of parsing browser-specific messages.
  let summarizer: SummarizerInstance;
  try {
    summarizer = await sessionPromise;
  } catch (err) {
    if (err instanceof AbortError) throw err;
    const message = (err as Error)?.message ?? String(err);
    throw new SummarizerUnavailableError(
      `Summarizer.create() failed: ${message}`,
    );
  }
  if (options.signal?.aborted) throw new AbortError();

  // The W3C Web AI streaming contract is ambiguous between "delta" (each
  // chunk is new content) and "cumulative" (each chunk is the full text
  // so far). Chrome ships delta; some Edge backends ship cumulative.
  // Detect per-chunk and merge accordingly.
  const mergeChunk = (buffer: string, chunk: string): string =>
    chunk.startsWith(buffer) ? chunk : buffer + chunk;

  let finalText: string;
  if (typeof summarizer.summarizeStreaming === "function" && options.onChunk) {
    let buffer = "";
    for await (const chunk of summarizer.summarizeStreaming(text)) {
      if (options.signal?.aborted) throw new AbortError();
      buffer = mergeChunk(buffer, chunk);
      const cleaned = cleanSummary(buffer);
      options.onChunk(cleaned);
    }
    finalText = cleanSummary(buffer);
  } else if (typeof summarizer.summarizeStreaming === "function") {
    let buffer = "";
    for await (const chunk of summarizer.summarizeStreaming(text)) {
      if (options.signal?.aborted) throw new AbortError();
      buffer = mergeChunk(buffer, chunk);
    }
    finalText = cleanSummary(buffer);
  } else {
    const raw = await summarizer.summarize(text);
    if (options.signal?.aborted) throw new AbortError();
    finalText = cleanSummary(raw);
  }

  if (finalText && cache) cache.set(cacheKey, finalText);
  return { summary: finalText || null, cached: false };
};

class AbortError extends Error {
  override readonly name = "AbortError";
  constructor() {
    super("Summarization aborted");
  }
}
