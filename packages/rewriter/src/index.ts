/**
 * @web-ai-sdk/rewriter; building block for the Web's Built-in Rewriter API.
 *
 * Vanilla TypeScript / DOM core. The React adapter at
 * `@web-ai-sdk/rewriter/react` is a thin hook around this module.
 *
 * Spec: https://developer.chrome.com/docs/ai/rewriter-api
 */

import {
  acquireRewriter,
  type ConfigureRewriterCacheOptions,
  type CreateMonitor,
  getRewriterApi,
  leaseRewriter,
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
  isAvailable,
} from "./api.js";

export { DEFAULT_CACHE_TTL_MS } from "./cache.js";

export type {
  CacheOption,
  ConfigureRewriterCacheOptions,
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
  /** Cache key. Default: JSON string of input, context, language hints, shared context, and output shape. */
  cacheKey?: string;
  /**
   * Time-to-live in milliseconds for entries written by the built-in
   * `"session"` / `"local"` storage shortcuts. Default: one hour
   * (`DEFAULT_CACHE_TTL_MS`). Ignored for custom `{ get, set }` caches, which
   * own their expiry policy.
   */
  cacheTtl?: number;
  /**
   * Force a fresh rewrite. Skips the cache read, runs the model, and
   * replaces the cached value after a successful run. Applies to built-in
   * and custom caches.
   */
  cacheRefresh?: boolean;
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
 * Session-affecting subset of `RewriteOptions`. `prepareRewriter` and
 * `rewrite` derive the same native create options from these fields, so a
 * prepared session is reused by the matching call.
 */
export type PrepareRewriterOptions = Pick<
  RewriteOptions,
  | "language"
  | "supportedLanguages"
  | "tone"
  | "format"
  | "length"
  | "sharedContext"
  | "monitor"
>;

interface SessionConfig {
  lang: string | undefined;
  languageHints: boolean;
  createOptions: RewriterCreateOptions;
}

/**
 * Single source of the option-to-session mapping. The session cache keys by
 * `createOptions`, so `rewrite` and `prepareRewriter` must both go through
 * this derivation.
 */
const resolveSessionConfig = (
  options: PrepareRewriterOptions,
): SessionConfig => {
  const lang = options.language ? NORMALIZE_LANG(options.language) : undefined;
  const supported = new Set(
    (options.supportedLanguages ?? DEFAULT_SUPPORTED_LANGUAGES).map(
      NORMALIZE_LANG,
    ),
  );
  const languageHints = lang ? supported.has(lang) : false;

  const langOptions: Pick<
    RewriterCreateOptions,
    "expectedInputLanguages" | "expectedContextLanguages" | "outputLanguage"
  > =
    lang && languageHints
      ? {
          expectedInputLanguages: [lang],
          expectedContextLanguages: [lang],
          outputLanguage: lang,
        }
      : {};

  const createOptions: RewriterCreateOptions = {
    tone: options.tone ?? "as-is",
    format: options.format ?? "as-is",
    length: options.length ?? "as-is",
    sharedContext: options.sharedContext ?? "",
    ...langOptions,
    ...(options.monitor ? { monitor: options.monitor } : {}),
  };

  return { lang, languageHints, createOptions };
};

export interface RewriterLease {
  /**
   * Resolves when the native session is created. Rejects with
   * `RewriterUnavailableError` when the API is missing or creation fails.
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
 * input exists. The matching `rewrite` call reuses the prepared session
 * without a second create. Never throws synchronously; unavailability and
 * creation failures reject `ready`. Failed preparations leave the cache so a
 * later call can retry.
 */
export const prepareRewriter = (
  options: PrepareRewriterOptions = {},
): RewriterLease => {
  const api = getRewriterApi();
  if (!api?.create) {
    const ready = Promise.reject(
      new RewriterUnavailableError(
        "Rewriter API is not available in this environment.",
      ),
    );
    // Keep unobserved leases from surfacing unhandled rejections.
    ready.catch(() => {});
    return { ready, release: () => {} };
  }
  const { createOptions } = resolveSessionConfig(options);
  const lease = leaseRewriter(api, createOptions);
  const ready = lease.ready.catch((err) => {
    const message = (err as Error)?.message ?? String(err);
    throw new RewriterUnavailableError(`Rewriter.create() failed: ${message}`);
  });
  ready.catch(() => {});
  return { ready, release: lease.release };
};

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

  const { lang, languageHints, createOptions } = resolveSessionConfig(options);
  const cache = resolveCache(options.cache, options.cacheTtl);
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
  if (cache && !options.cacheRefresh) {
    const cached = cache.get(cacheKey);
    if (cached) return { output: cached, cached: true };
  }

  // Pass the same shape to availability() as we do to create() so engines
  // that warn on mismatch stay quiet.
  const availability = await api
    .availability({
      ...(createOptions.tone ? { tone: createOptions.tone } : {}),
      ...(createOptions.format ? { format: createOptions.format } : {}),
      ...(createOptions.length ? { length: createOptions.length } : {}),
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
    throw new RewriterUnavailableError("Rewriter reports unavailable.");
  }
  if (options.signal?.aborted) throw new RewriterAbortError();

  // The pin defers destruction (lease release, clear, eviction) until this
  // call finishes.
  const acquired = acquireRewriter(api, createOptions);
  try {
    // Wrap session-create failures with context so consumers can branch on a
    // single typed error instead of parsing browser-specific messages.
    let rewriter: RewriterInstance;
    try {
      rewriter = await acquired.session;
    } catch (err) {
      if (err instanceof RewriterAbortError) throw err;
      const message = (err as Error)?.message ?? String(err);
      throw new RewriterUnavailableError(
        `Rewriter.create() failed: ${message}`,
      );
    }
    if (options.signal?.aborted) throw new RewriterAbortError();

    const taskOptions = {
      ...(options.context !== undefined ? { context: options.context } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
    };

    // Browser implementations may emit delta or cumulative chunks. Detect the
    // shape per chunk and merge accordingly.
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
  } finally {
    acquired.done();
  }
};
