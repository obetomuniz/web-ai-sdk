/**
 * @web-ai-sdk/summarizer; building block for the Web's Built-in Summarizer API.
 *
 * Vanilla TypeScript / DOM core. The React adapter at `@web-ai-sdk/summarizer/react` is a
 * thin hook around this module.
 *
 * Spec: https://developer.chrome.com/docs/ai/summarizer-api
 */

import {
  type CreateMonitor,
  checkAvailability,
  getOrCreateSummarizer,
  getSummarizerApi,
  isAvailable,
  type SummarizerApi,
  type SummarizerAvailability,
  type SummarizerAvailabilityOptions,
  type SummarizerCreateOptions,
  type SummarizerInstance,
} from "./api.js";
import {
  type CacheOption,
  defaultCacheKey,
  resolveCache,
  type SummaryCache,
} from "./cache.js";
import { cleanSummary } from "./skeleton.js";

export type {
  CacheOption,
  CreateMonitor,
  SummarizerApi,
  SummarizerAvailability,
  SummarizerAvailabilityOptions,
  SummarizerCreateOptions,
  SummarizerInstance,
  SummaryCache,
};
export { checkAvailability, isAvailable };

export interface SummarizeOptions {
  /** Text to summarize. Empty / whitespace input resolves to `{ output: null }`. */
  input: string;
  /** BCP-47 language for input + output hints. Falls back to omitting hints if unsupported. */
  language: string;
  /** Languages the model supports for input/output hints. Default: `["en", "es", "ja"]`. */
  supportedLanguages?: readonly string[];
  /** Summary shape. Default: `"tldr"`. */
  type?: "tldr" | "key-points" | "teaser" | "headline";
  /** Length preset. Default: `"medium"`. */
  length?: "short" | "medium" | "long";
  /** Output format. Default: `"plain-text"`. */
  format?: "plain-text" | "markdown";
  /** Performance preference. Default: `"speed"`. */
  preference?: "auto" | "speed" | "capability";
  /** Native `sharedContext` string (a hint about who/what the summary is for). */
  sharedContext?: string;
  /** Observe the first-call model download (~1.7 GB on a fresh profile). */
  monitor?: (m: CreateMonitor) => void;
  /**
   * Result cache. Off by default; every call hits the model. Pass
   * `"session"` / `"local"` for the matching web-storage shortcut, or any
   * `{ get, set }`-shaped object for a custom backend.
   */
  cache?: CacheOption;
  /** Cache key. Default: `pathname:lang`. */
  cacheKey?: string;
  /**
   * Streaming update callback (cleaned text, monotonically growing).
   * Receives the **cumulative** buffer, not deltas.
   */
  onUpdate?: (text: string) => void;
  /** Abort signal. */
  signal?: AbortSignal;
}

export interface SummarizeResult {
  /** Final summary text (cleaned), or `null` if the input was empty. */
  output: string | null;
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
 * Generate a summary. Uses streaming when the underlying instance supports
 * it, one-shot otherwise. Returns `{ output: null }` for empty input.
 * Throws `SummarizerUnavailableError` when the API isn't present in the
 * environment.
 *
 * Output is normalized via an internal cleaner (wrapping quotes/whitespace
 * stripped, internal whitespace collapsed). Anything beyond that — e.g.
 * trimming terminal punctuation for headline-style use cases — is the
 * consumer's concern.
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

  const text = options.input.trim();
  if (!text) return { output: null, cached: false };

  const lang = NORMALIZE_LANG(options.language);
  const cache = resolveCache(options.cache);
  const cacheKey = options.cacheKey ?? defaultCacheKey(lang);
  if (cache) {
    const cached = cache.get(cacheKey);
    if (cached) return { output: cached, cached: true };
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

  const baseCreateOptions: SummarizerCreateOptions = {
    type: options.type ?? "tldr",
    format: options.format ?? "plain-text",
    length: options.length ?? "medium",
    preference: options.preference ?? "speed",
    sharedContext: options.sharedContext ?? "",
    ...langOptions,
    ...(options.monitor ? { monitor: options.monitor } : {}),
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
  if (typeof summarizer.summarizeStreaming === "function" && options.onUpdate) {
    let buffer = "";
    for await (const chunk of summarizer.summarizeStreaming(text)) {
      if (options.signal?.aborted) throw new AbortError();
      buffer = mergeChunk(buffer, chunk);
      options.onUpdate(cleanSummary(buffer));
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
  return { output: finalText || null, cached: false };
};

class AbortError extends Error {
  override readonly name = "AbortError";
  constructor() {
    super("Summarization aborted");
  }
}
