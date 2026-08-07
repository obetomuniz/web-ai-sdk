/**
 * @web-ai-sdk/summarizer; building block for the Web's Built-in Summarizer API.
 *
 * Vanilla TypeScript / DOM core. The React adapter at `@web-ai-sdk/summarizer/react` is a
 * thin hook around this module.
 *
 * Spec: https://developer.chrome.com/docs/ai/summarizer-api
 */

import {
  acquireSummarizer,
  type ConfigureSummarizerCacheOptions,
  type CreateMonitor,
  checkAvailability,
  clearSummarizerSession,
  clearSummarizerSessions,
  configureSummarizerCache,
  getSummarizerApi,
  isAvailable,
  leaseSummarizer,
  type SummarizerApi,
  type SummarizerAvailability,
  type SummarizerAvailabilityOptions,
  type SummarizerCreateOptions,
  type SummarizerInstance,
} from "./api.js";
import {
  type CacheOption,
  DEFAULT_CACHE_TTL_MS,
  defaultCacheKey,
  resolveCache,
  type SummaryCache,
} from "./cache.js";
import { cleanSummary } from "./skeleton.js";

export type {
  CacheOption,
  ConfigureSummarizerCacheOptions,
  CreateMonitor,
  SummarizerApi,
  SummarizerAvailability,
  SummarizerAvailabilityOptions,
  SummarizerCreateOptions,
  SummarizerInstance,
  SummaryCache,
};
export {
  checkAvailability,
  clearSummarizerSession,
  clearSummarizerSessions,
  configureSummarizerCache,
  DEFAULT_CACHE_TTL_MS,
  isAvailable,
};

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
   * Time-to-live in milliseconds for entries written by the built-in
   * `"session"` / `"local"` storage shortcuts. Default: one hour
   * (`DEFAULT_CACHE_TTL_MS`). Ignored for custom `{ get, set }` caches, which
   * own their expiry policy.
   */
  cacheTtl?: number;
  /**
   * Force a fresh summary. Skips the cache read, runs the model, and
   * replaces the cached value after a successful run. Applies to built-in
   * and custom caches.
   */
  cacheRefresh?: boolean;
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
 * Session-affecting subset of `SummarizeOptions`. `prepareSummarizer` and
 * `summarize` derive the same native create options from these fields, so a
 * prepared session is reused by the matching call.
 */
export type PrepareSummarizerOptions = Pick<
  SummarizeOptions,
  | "language"
  | "supportedLanguages"
  | "type"
  | "length"
  | "format"
  | "preference"
  | "sharedContext"
  | "monitor"
>;

interface SessionConfig {
  lang: string;
  languageHints: boolean;
  createOptions: SummarizerCreateOptions;
}

/**
 * Single source of the option-to-session mapping. The session cache keys by
 * `createOptions`, so `summarize` and `prepareSummarizer` must both go
 * through this derivation.
 */
const resolveSessionConfig = (
  options: PrepareSummarizerOptions,
): SessionConfig => {
  const lang = NORMALIZE_LANG(options.language);
  const supported = new Set(
    (options.supportedLanguages ?? DEFAULT_SUPPORTED_LANGUAGES).map(
      NORMALIZE_LANG,
    ),
  );
  const languageHints = supported.has(lang);

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

  const createOptions: SummarizerCreateOptions = {
    type: options.type ?? "tldr",
    format: options.format ?? "plain-text",
    length: options.length ?? "medium",
    preference: options.preference ?? "auto",
    sharedContext: options.sharedContext ?? "",
    ...langOptions,
    ...(options.monitor ? { monitor: options.monitor } : {}),
  };

  return { lang, languageHints, createOptions };
};

export interface SummarizerLease {
  /**
   * Resolves when the native session is created. Rejects with
   * `SummarizerUnavailableError` when the API is missing or creation fails.
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
 * input exists. The matching `summarize` call reuses the prepared session
 * without a second create. Never throws synchronously; unavailability and
 * creation failures reject `ready`. Failed preparations leave the cache so a
 * later call can retry.
 */
export const prepareSummarizer = (
  options: PrepareSummarizerOptions,
): SummarizerLease => {
  const api = getSummarizerApi();
  if (!api?.create) {
    const ready = Promise.reject(
      new SummarizerUnavailableError(
        "Summarizer API is not available in this environment.",
      ),
    );
    // Keep unobserved leases from surfacing unhandled rejections.
    ready.catch(() => {});
    return { ready, release: () => {} };
  }
  const { createOptions } = resolveSessionConfig(options);
  const lease = leaseSummarizer(api, createOptions);
  const ready = lease.ready.catch((err) => {
    const message = (err as Error)?.message ?? String(err);
    throw new SummarizerUnavailableError(
      `Summarizer.create() failed: ${message}`,
    );
  });
  ready.catch(() => {});
  return { ready, release: lease.release };
};

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

  const { lang, languageHints, createOptions } = resolveSessionConfig(options);
  const cache = resolveCache(options.cache, options.cacheTtl);
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
  if (cache && !options.cacheRefresh) {
    const cached = cache.get(cacheKey);
    if (cached) return { output: cached, cached: true };
  }

  // Pass the relevant create options to availability() so the probe describes
  // the configuration we are about to create. The narrower
  // SummarizerAvailabilityOptions shape filters out create-only fields such as
  // `sharedContext`.
  const availability = await api
    .availability({
      ...(createOptions.type ? { type: createOptions.type } : {}),
      ...(createOptions.format ? { format: createOptions.format } : {}),
      ...(createOptions.length ? { length: createOptions.length } : {}),
      ...(createOptions.preference
        ? { preference: createOptions.preference }
        : {}),
      ...(createOptions.expectedInputLanguages
        ? { expectedInputLanguages: createOptions.expectedInputLanguages }
        : {}),
      ...(createOptions.expectedContextLanguages
        ? {
            expectedContextLanguages: createOptions.expectedContextLanguages,
          }
        : {}),
      ...(createOptions.outputLanguage
        ? { outputLanguage: createOptions.outputLanguage }
        : {}),
    })
    .catch(() => "unavailable" as const);
  if (availability === "unavailable") {
    throw new SummarizerUnavailableError("Summarizer reports unavailable.");
  }
  if (options.signal?.aborted) throw new AbortError();

  // The pin defers destruction (lease release, clear, eviction) until this
  // call finishes.
  const acquired = acquireSummarizer(api, createOptions);
  try {
    // Wrap session-create failures with context so consumers can branch on
    // a single typed error instead of parsing browser-specific messages.
    let summarizer: SummarizerInstance;
    try {
      summarizer = await acquired.session;
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
    if (
      typeof summarizer.summarizeStreaming === "function" &&
      options.onUpdate
    ) {
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
  } finally {
    acquired.done();
  }
};

class AbortError extends Error {
  override readonly name = "AbortError";
  constructor() {
    super("Summarization aborted");
  }
}
