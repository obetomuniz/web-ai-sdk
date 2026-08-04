/**
 * @web-ai-sdk/writer; building block for the Web's Built-in Writer API.
 *
 * Vanilla TypeScript / DOM core. The React adapter at
 * `@web-ai-sdk/writer/react` is a thin hook around this module.
 *
 * Spec: https://developer.chrome.com/docs/ai/writer-api
 */

import {
  type CreateMonitor,
  getOrCreateWriter,
  getWriterApi,
  type WriterApi,
  type WriterAvailability,
  type WriterAvailabilityOptions,
  type WriterCreateOptions,
  type WriterInstance,
} from "./api.js";
import {
  type CacheOption,
  defaultCacheKey,
  resolveCache,
  type WriteCache,
} from "./cache.js";

export {
  checkAvailability,
  clearWriterSession,
  clearWriterSessions,
  configureWriterCache,
  getOrCreateWriter,
  getWriterApi,
  isAvailable,
} from "./api.js";

export { defaultCacheKey, resolveCache } from "./cache.js";

export type {
  CacheOption,
  CreateMonitor,
  WriteCache,
  WriterApi,
  WriterAvailability,
  WriterAvailabilityOptions,
  WriterCreateOptions,
  WriterInstance,
};

export interface WriteOptions {
  /** The writing task / prompt. Empty / whitespace input resolves to `{ output: null }`. */
  input: string;
  /** Optional per-call background information for the model. */
  context?: string;
  /** BCP-47 language for input + output hints. Falls back to omitting hints if unsupported. */
  language?: string;
  /** Languages the model supports for input/output hints. Default: `["en", "es", "ja"]`. */
  supportedLanguages?: readonly string[];
  /** Writing tone. Default: `"neutral"`. */
  tone?: "formal" | "neutral" | "casual";
  /** Output format. Default: `"markdown"`. */
  format?: "markdown" | "plain-text";
  /** Output length. Default: `"short"`. */
  length?: "short" | "medium" | "long";
  /** A hint shared across multiple write tasks. */
  sharedContext?: string;
  /** Observe the first-call model download. */
  monitor?: (m: CreateMonitor) => void;
  /**
   * Result cache. Off by default; every call hits the model. Pass
   * `"session"` / `"local"` for the matching web-storage shortcut, or any
   * `{ get, set }`-shaped object for a custom backend.
   */
  cache?: CacheOption;
  /** Cache key. Default: JSON string of input, context, language hints, shared context, and output shape. */
  cacheKey?: string;
  /**
   * Streaming update callback (cumulative buffer, monotonically growing).
   * Receives the **cumulative** text, not deltas.
   */
  onUpdate?: (text: string) => void;
  /** Abort signal. */
  signal?: AbortSignal;
}

export interface WriteResult {
  /** Final generated text (trimmed), or `null` if the input was empty. */
  output: string | null;
  /** Whether the result came from the cache (no model call). */
  cached: boolean;
}

const NORMALIZE_LANG = (lang: string): string =>
  lang.split("-")[0]?.toLowerCase() ?? lang.toLowerCase();

const DEFAULT_SUPPORTED_LANGUAGES = ["en", "es", "ja"] as const;

export class WriterUnavailableError extends Error {
  override readonly name = "WriterUnavailableError";
}

class WriterAbortError extends Error {
  override readonly name = "AbortError";
  constructor() {
    super("Writing aborted");
  }
}

/**
 * Generate new content for a writing task. Uses streaming when the underlying
 * instance supports it, one-shot otherwise. Returns `{ output: null }` for
 * empty input. Throws `WriterUnavailableError` when the API isn't present in
 * the environment.
 *
 * Output is trimmed (leading/trailing whitespace only) so markdown / line
 * breaks the model produces stay intact.
 */
export const write = async (options: WriteOptions): Promise<WriteResult> => {
  const api = getWriterApi();
  if (!api?.create) {
    throw new WriterUnavailableError(
      "Writer API is not available in this environment.",
    );
  }

  const text = options.input.trim();
  if (!text) return { output: null, cached: false };

  const lang = options.language ? NORMALIZE_LANG(options.language) : undefined;
  const supportedLanguages = (
    options.supportedLanguages ?? DEFAULT_SUPPORTED_LANGUAGES
  ).map(NORMALIZE_LANG);
  const supported = new Set(supportedLanguages);
  const languageHints = lang ? supported.has(lang) : false;
  const cache = resolveCache(options.cache);
  const cacheKey =
    options.cacheKey ??
    defaultCacheKey({
      text,
      context: options.context,
      sharedContext: options.sharedContext,
      tone: options.tone,
      format: options.format,
      length: options.length,
      language: lang,
      languageHints,
    });
  if (cache) {
    const cached = cache.get(cacheKey);
    if (cached) return { output: cached, cached: true };
  }

  const langOptions: Pick<
    WriterCreateOptions,
    "expectedInputLanguages" | "expectedContextLanguages" | "outputLanguage"
  > =
    lang && languageHints
      ? {
          expectedInputLanguages: [lang],
          expectedContextLanguages: [lang],
          outputLanguage: lang,
        }
      : {};

  const baseCreateOptions: WriterCreateOptions = {
    tone: options.tone ?? "neutral",
    format: options.format ?? "markdown",
    length: options.length ?? "short",
    sharedContext: options.sharedContext ?? "",
    ...langOptions,
    ...(options.monitor ? { monitor: options.monitor } : {}),
  };

  // Pass the same shape to availability() as we do to create() so engines
  // that warn on mismatch stay quiet.
  const availability = await api
    .availability({
      ...(baseCreateOptions.tone ? { tone: baseCreateOptions.tone } : {}),
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
    throw new WriterUnavailableError("Writer reports unavailable.");
  }
  if (options.signal?.aborted) throw new WriterAbortError();

  const sessionPromise = getOrCreateWriter(api, baseCreateOptions);

  // Wrap session-create failures with context so consumers can branch on a
  // single typed error instead of parsing browser-specific messages.
  let writer: WriterInstance;
  try {
    writer = await sessionPromise;
  } catch (err) {
    if (err instanceof WriterAbortError) throw err;
    const message = (err as Error)?.message ?? String(err);
    throw new WriterUnavailableError(`Writer.create() failed: ${message}`);
  }
  if (options.signal?.aborted) throw new WriterAbortError();

  const taskOptions = {
    ...(options.context !== undefined ? { context: options.context } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  };

  // Browser implementations may emit delta or cumulative chunks. Detect the
  // shape per chunk and merge accordingly.
  const mergeChunk = (buffer: string, chunk: string): string =>
    chunk.startsWith(buffer) ? chunk : buffer + chunk;

  let finalText: string;
  if (typeof writer.writeStreaming === "function") {
    let buffer = "";
    for await (const chunk of writer.writeStreaming(text, taskOptions)) {
      if (options.signal?.aborted) throw new WriterAbortError();
      buffer = mergeChunk(buffer, chunk);
      options.onUpdate?.(buffer);
    }
    finalText = buffer.trim();
  } else {
    const raw = await writer.write(text, taskOptions);
    if (options.signal?.aborted) throw new WriterAbortError();
    finalText = raw.trim();
  }

  if (finalText && cache) cache.set(cacheKey, finalText);
  return { output: finalText || null, cached: false };
};
