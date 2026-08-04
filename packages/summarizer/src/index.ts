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
  /**
   * Performance preference hint. `"speed"` biases toward a faster, lighter
   * model; `"capability"` toward a more comprehensive one; `"auto"` lets the
   * browser balance the two. The browser may override the hint when a
   * functional requirement (e.g. the requested language) needs a more capable
   * model. Default: `"auto"` (matches the platform default).
   */
  preference?: "auto" | "speed" | "capability";
  /** Native `sharedContext` string (a hint about who/what the summary is for). */
  sharedContext?: string;
  /** Observe model-download progress when creation requires one. */
  monitor?: (m: CreateMonitor) => void;
  /**
   * Result cache. Off by default; every call hits the model. Pass
   * `"session"` / `"local"` for the matching web-storage shortcut, or any
   * `{ get, set }`-shaped object for a custom backend.
   */
  cache?: CacheOption;
  /** Cache key. Default: JSON string of route, input, and summary options. */
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
  const supportedLanguages = (
    options.supportedLanguages ?? DEFAULT_SUPPORTED_LANGUAGES
  ).map(NORMALIZE_LANG);
  const supported = new Set(supportedLanguages);
  const languageHints = supported.has(lang);
  const cache = resolveCache(options.cache);
  const cacheKey =
    options.cacheKey ??
    defaultCacheKey({
      text,
      language: lang,
      languageHints,
      type: options.type,
      length: options.length,
      format: options.format,
      preference: options.preference,
      sharedContext: options.sharedContext,
    });
  if (cache) {
    const cached = cache.get(cacheKey);
    if (cached) return { output: cached, cached: true };
  }

  const langOptions: Pick<
    SummarizerCreateOptions,
    "expectedInputLanguages" | "expectedContextLanguages" | "outputLanguage"
  > = languageHints
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
    preference: options.preference ?? "auto",
    sharedContext: options.sharedContext ?? "",
    ...langOptions,
    ...(options.monitor ? { monitor: options.monitor } : {}),
  };

  // Pass the relevant create options to availability() so the probe describes
  // the configuration we are about to create. The narrower
  // SummarizerAvailabilityOptions shape filters out create-only fields such as
  // `sharedContext`.
  const availability = await api
    .availability({
      ...(baseCreateOptions.type ? { type: baseCreateOptions.type } : {}),
      ...(baseCreateOptions.format ? { format: baseCreateOptions.format } : {}),
      ...(baseCreateOptions.length ? { length: baseCreateOptions.length } : {}),
      ...(baseCreateOptions.preference
        ? { preference: baseCreateOptions.preference }
        : {}),
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

  const sessionPromise = getOrCreateSummarizer(api, baseCreateOptions);

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

  // Browser implementations may emit delta or cumulative chunks. Detect the
  // shape per chunk and merge accordingly.
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
