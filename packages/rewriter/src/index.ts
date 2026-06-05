/**
 * @web-ai-sdk/rewriter; building block for the Web's Built-in Rewriter API.
 *
 * Vanilla TypeScript / DOM core. The React adapter at
 * `@web-ai-sdk/rewriter/react` is a thin hook around this module.
 *
 * Spec: https://developer.chrome.com/docs/ai/rewriter-api
 */

import {
  type CreateMonitor,
  getOrCreateRewriter,
  getRewriterApi,
  type RewriterApi,
  type RewriterAvailability,
  type RewriterAvailabilityOptions,
  type RewriterCreateOptions,
  type RewriterInstance,
} from "./api.js";
import {
  type CacheOption,
  defaultCacheKey,
  type RewriteCache,
  resolveCache,
} from "./cache.js";

export {
  checkAvailability,
  clearRewriterSession,
  clearRewriterSessions,
  configureRewriterCache,
  getOrCreateRewriter,
  getRewriterApi,
  isAvailable,
} from "./api.js";

export { defaultCacheKey, resolveCache } from "./cache.js";

export type {
  CacheOption,
  CreateMonitor,
  RewriteCache,
  RewriterApi,
  RewriterAvailability,
  RewriterAvailabilityOptions,
  RewriterCreateOptions,
  RewriterInstance,
};

export interface RewriteOptions {
  /** Text to rewrite. Empty / whitespace input resolves to `{ output: null }`. */
  input: string;
  /** Optional per-call background information for the model. */
  context?: string;
  /** BCP-47 language for input + output hints. Falls back to omitting hints if unsupported. */
  language?: string;
  /** Languages the model supports for input/output hints. Default: `["en", "es", "ja"]`. */
  supportedLanguages?: readonly string[];
  /** Tone adjustment. Default: `"as-is"`. */
  tone?: "as-is" | "more-formal" | "more-casual";
  /** Output format. Default: `"as-is"`. */
  format?: "as-is" | "markdown" | "plain-text";
  /** Length adjustment. Default: `"as-is"`. */
  length?: "as-is" | "shorter" | "longer";
  /** A hint shared across multiple rewrite tasks. */
  sharedContext?: string;
  /** Observe the first-call model download. */
  monitor?: (m: CreateMonitor) => void;
  /**
   * Result cache. Off by default; every call hits the model. Pass
   * `"session"` / `"local"` for the matching web-storage shortcut, or any
   * `{ get, set }`-shaped object for a custom backend.
   */
  cache?: CacheOption;
  /** Cache key. Default: hash of `{ input, context, tone, format, length, language }`. */
  cacheKey?: string;
  /**
   * Streaming update callback (cumulative buffer, monotonically growing).
   * Receives the **cumulative** text, not deltas.
   */
  onUpdate?: (text: string) => void;
  /** Abort signal. */
  signal?: AbortSignal;
}

export interface RewriteResult {
  /** Final rewritten text (trimmed), or `null` if the input was empty. */
  output: string | null;
  /** Whether the result came from the cache (no model call). */
  cached: boolean;
}

const NORMALIZE_LANG = (lang: string): string =>
  lang.split("-")[0]?.toLowerCase() ?? lang.toLowerCase();

const DEFAULT_SUPPORTED_LANGUAGES = ["en", "es", "ja"] as const;

export class RewriterUnavailableError extends Error {
  override readonly name = "RewriterUnavailableError";
}

class RewriterAbortError extends Error {
  override readonly name = "AbortError";
  constructor() {
    super("Rewriting aborted");
  }
}

/**
 * Rewrite existing text under tone / format / length adjustments. Uses
 * streaming when the underlying instance supports it, one-shot otherwise.
 * Returns `{ output: null }` for empty input. Throws
 * `RewriterUnavailableError` when the API isn't present in the environment.
 *
 * Output is trimmed (leading/trailing whitespace only) so markdown / line
 * breaks the model produces stay intact.
 */
export const rewrite = async (
  options: RewriteOptions,
): Promise<RewriteResult> => {
  const api = getRewriterApi();
  if (!api?.create) {
    throw new RewriterUnavailableError(
      "Rewriter API is not available in this environment.",
    );
  }

  const text = options.input.trim();
  if (!text) return { output: null, cached: false };

  const lang = options.language ? NORMALIZE_LANG(options.language) : undefined;
  const cache = resolveCache(options.cache);
  const cacheKey =
    options.cacheKey ??
    defaultCacheKey({
      text,
      context: options.context,
      tone: options.tone,
      format: options.format,
      length: options.length,
      language: lang,
    });
  if (cache) {
    const cached = cache.get(cacheKey);
    if (cached) return { output: cached, cached: true };
  }

  const supported = new Set(
    options.supportedLanguages ?? DEFAULT_SUPPORTED_LANGUAGES,
  );
  const langOptions: Pick<
    RewriterCreateOptions,
    "expectedInputLanguages" | "expectedContextLanguages" | "outputLanguage"
  > =
    lang && supported.has(lang)
      ? {
          expectedInputLanguages: [lang],
          expectedContextLanguages: [lang],
          outputLanguage: lang,
        }
      : {};

  const baseCreateOptions: RewriterCreateOptions = {
    tone: options.tone ?? "as-is",
    format: options.format ?? "as-is",
    length: options.length ?? "as-is",
    sharedContext: options.sharedContext ?? "",
    ...langOptions,
    ...(options.monitor ? { monitor: options.monitor } : {}),
  };

  // Kick off session and availability in parallel; first call pays the cold
  // start, later calls reuse the cached session. We pass the same shape to
  // availability() as we do to create() so engines that warn on mismatch
  // stay quiet.
  const sessionPromise = getOrCreateRewriter(api, baseCreateOptions);
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
    throw new RewriterUnavailableError("Rewriter reports unavailable.");
  }
  if (options.signal?.aborted) throw new RewriterAbortError();

  // Wrap session-create failures with context so consumers can branch on a
  // single typed error instead of parsing browser-specific messages.
  let rewriter: RewriterInstance;
  try {
    rewriter = await sessionPromise;
  } catch (err) {
    if (err instanceof RewriterAbortError) throw err;
    const message = (err as Error)?.message ?? String(err);
    throw new RewriterUnavailableError(`Rewriter.create() failed: ${message}`);
  }
  if (options.signal?.aborted) throw new RewriterAbortError();

  const taskOptions = {
    ...(options.context !== undefined ? { context: options.context } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  };

  // The W3C Web AI streaming contract is ambiguous between "delta" (each
  // chunk is new content) and "cumulative" (each chunk is the full text so
  // far). Chrome ships delta; some backends ship cumulative. Detect
  // per-chunk and merge accordingly.
  const mergeChunk = (buffer: string, chunk: string): string =>
    chunk.startsWith(buffer) ? chunk : buffer + chunk;

  let finalText: string;
  if (typeof rewriter.rewriteStreaming === "function") {
    let buffer = "";
    for await (const chunk of rewriter.rewriteStreaming(text, taskOptions)) {
      if (options.signal?.aborted) throw new RewriterAbortError();
      buffer = mergeChunk(buffer, chunk);
      options.onUpdate?.(buffer);
    }
    finalText = buffer.trim();
  } else {
    const raw = await rewriter.rewrite(text, taskOptions);
    if (options.signal?.aborted) throw new RewriterAbortError();
    finalText = raw.trim();
  }

  if (finalText && cache) cache.set(cacheKey, finalText);
  return { output: finalText || null, cached: false };
};
