/**
 * @web-ai-sdk/translator; building block for the Web's Built-in Translator API.
 *
 * Vanilla TypeScript / DOM core. The React adapter at `@web-ai-sdk/translator/react` is a
 * thin hook around this module.
 *
 * Spec: https://developer.chrome.com/docs/ai/translator-api
 */

import {
  acquireTranslator,
  type ConfigureTranslatorCacheOptions,
  checkAvailability,
  clearTranslatorSession,
  clearTranslatorSessions,
  configureTranslatorCache,
  getTranslatorApi,
  isAvailable,
  leaseTranslator,
  type TranslatorApi,
  type TranslatorAvailability,
  type TranslatorAvailabilityOptions,
  type TranslatorCreateOptions,
  type TranslatorInstance,
  type TranslatorMonitor,
  type TranslatorTranslateOptions,
} from "./api.js";
import {
  type CacheOption,
  DEFAULT_CACHE_TTL_MS,
  defaultCacheKey,
  resolveCache,
  type TranslationCache,
} from "./cache.js";

export type {
  CacheOption,
  ConfigureTranslatorCacheOptions,
  TranslationCache,
  TranslatorApi,
  TranslatorAvailability,
  TranslatorAvailabilityOptions,
  TranslatorCreateOptions,
  TranslatorInstance,
  TranslatorMonitor,
  TranslatorTranslateOptions,
};
export {
  checkAvailability,
  clearTranslatorSession,
  clearTranslatorSessions,
  configureTranslatorCache,
  DEFAULT_CACHE_TTL_MS,
  isAvailable,
};

const NORMALIZE_LANG = (lang: string): string =>
  lang.split("-")[0]?.toLowerCase() ?? lang.toLowerCase();

export interface TranslateOptions {
  /** Text to translate. Empty / whitespace input resolves to `{ output: null }`. */
  input: string;
  /** BCP-47 source language (e.g. `pt`, `pt-BR`). */
  sourceLanguage: string;
  /** BCP-47 target language. Default: `"en"`. */
  targetLanguage?: string;
  /** Observe the first-call model download. */
  monitor?: (m: TranslatorMonitor) => void;
  /**
   * Result cache. Off by default; every call hits the model. Pass
   * `"session"` / `"local"` for the matching web-storage shortcut, or any
   * `{ get, set }`-shaped object for a custom backend.
   */
  cache?: CacheOption;
  /** Cache key. Default: JSON array string of `[sourceLanguage, targetLanguage, input]`. */
  cacheKey?: string;
  /**
   * Time-to-live in milliseconds for entries written by the built-in
   * `"session"` / `"local"` storage shortcuts. Default: one hour
   * (`DEFAULT_CACHE_TTL_MS`). Ignored for custom `{ get, set }` caches, which
   * own their expiry policy.
   */
  cacheTtl?: number;
  /**
   * Force a fresh translation. Skips the cache read, runs the model, and
   * replaces the cached value after a successful run. Applies to built-in
   * and custom caches.
   */
  cacheRefresh?: boolean;
  /**
   * Streaming update callback (cumulative buffer, monotonically growing).
   * Receives the **cumulative** translation so far, not raw deltas. On
   * implementations without `translateStreaming()`, the one-shot result is
   * delivered as a single final update.
   */
  onUpdate?: (text: string) => void;
  /** Abort signal. Forwarded to the native translation operation. */
  signal?: AbortSignal;
}

export interface TranslateResult {
  /**
   * Translated text, or `null` when the input was empty / when source and
   * target languages match (no-op pass-through is not emitted as text).
   */
  output: string | null;
  /** Whether the result came from the cache (no model call). */
  cached: boolean;
}

export class TranslatorUnavailableError extends Error {
  override readonly name = "TranslatorUnavailableError";
}

/**
 * Session-affecting subset of `TranslateOptions`. `prepareTranslator` and
 * `translate` derive the same native create options from these fields, so a
 * prepared session is reused by the matching call.
 */
export type PrepareTranslatorOptions = Pick<
  TranslateOptions,
  "sourceLanguage" | "targetLanguage" | "monitor"
>;

interface SessionConfig {
  sourceLanguage: string;
  targetLanguage: string;
  createOptions: TranslatorCreateOptions;
}

/**
 * Single source of the option-to-session mapping. The session cache keys by
 * the normalized language pair, so `translate` and `prepareTranslator` must
 * both go through this derivation.
 */
const resolveSessionConfig = (
  options: PrepareTranslatorOptions,
): SessionConfig => {
  const sourceLanguage = NORMALIZE_LANG(options.sourceLanguage);
  const targetLanguage = NORMALIZE_LANG(options.targetLanguage ?? "en");
  const createOptions: TranslatorCreateOptions = {
    sourceLanguage,
    targetLanguage,
    ...(options.monitor ? { monitor: options.monitor } : {}),
  };
  return { sourceLanguage, targetLanguage, createOptions };
};

export interface TranslatorLease {
  /**
   * Resolves when the native session is created. Rejects with
   * `TranslatorUnavailableError` when the API is missing or creation fails.
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
 * input exists. The matching `translate` call reuses the prepared session
 * without a second create. Never throws synchronously; unavailability and
 * creation failures reject `ready`. Failed preparations leave the cache so a
 * later call can retry.
 */
export const prepareTranslator = (
  options: PrepareTranslatorOptions,
): TranslatorLease => {
  const api = getTranslatorApi();
  if (!api?.create) {
    const ready = Promise.reject(
      new TranslatorUnavailableError(
        "Translator API is not available in this environment.",
      ),
    );
    // Keep unobserved leases from surfacing unhandled rejections.
    ready.catch(() => {});
    return { ready, release: () => {} };
  }
  const { createOptions } = resolveSessionConfig(options);
  const lease = leaseTranslator(api, createOptions);
  const ready = lease.ready.catch((err) => {
    const message = (err as Error)?.message ?? String(err);
    throw new TranslatorUnavailableError(
      `Translator.create() failed: ${message}`,
    );
  });
  ready.catch(() => {});
  return { ready, release: lease.release };
};

class TranslateAbortError extends Error {
  override readonly name = "AbortError";
  constructor() {
    super("Translation aborted");
  }
}

/**
 * Await `promise`, but reject with an `AbortError` as soon as `signal`
 * aborts. Used around shared-session waits and stream reads so one caller's
 * abort rejects promptly without destroying work another caller may reuse.
 */
const raceAbort = <T>(
  promise: Promise<T>,
  signal: AbortSignal | undefined,
): Promise<T> => {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(new TranslateAbortError());
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new TranslateAbortError());
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (err: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(err);
      },
    );
  });
};

/**
 * Translate a string from `sourceLanguage` to `targetLanguage`. Returns
 * `{ output: null }` when the input is empty or when source and target
 * match. Throws `TranslatorUnavailableError` when the API isn't present in
 * the environment or reports `availability: "unavailable"`.
 *
 * With `onUpdate`, consumes `translateStreaming()` when the implementation
 * provides it and reports the cumulative translation after each chunk. The
 * caller's `signal` is forwarded to the native operation on both paths.
 */
export const translate = async (
  options: TranslateOptions,
): Promise<TranslateResult> => {
  const api = getTranslatorApi();
  if (!api?.create) {
    throw new TranslatorUnavailableError(
      "Translator API is not available in this environment.",
    );
  }
  if (options.signal?.aborted) throw new TranslateAbortError();

  const text = options.input.trim();
  if (!text) return { output: null, cached: false };

  const { sourceLanguage, targetLanguage, createOptions } =
    resolveSessionConfig(options);
  if (sourceLanguage === targetLanguage) {
    return { output: null, cached: false };
  }

  const cache = resolveCache(options.cache, options.cacheTtl);
  const cacheKey =
    options.cacheKey ??
    defaultCacheKey({ sourceLanguage, targetLanguage, text });
  if (cache && !options.cacheRefresh) {
    const cached = cache.get(cacheKey);
    if (cached) return { output: cached, cached: true };
  }

  const availability = await api
    .availability({ sourceLanguage, targetLanguage })
    .catch(() => "unavailable" as const);
  if (availability === "unavailable") {
    throw new TranslatorUnavailableError("Translator reports unavailable.");
  }
  if (options.signal?.aborted) throw new TranslateAbortError();

  // The pin defers destruction (lease release, clear, eviction) until this
  // call finishes, including the streaming and abort paths below.
  const acquired = acquireTranslator(api, createOptions);
  try {
    let session: TranslatorInstance;
    try {
      // raceAbort rejects only this caller; the cached session promise stays
      // untouched so other callers can still reuse it.
      session = await raceAbort(acquired.session, options.signal);
    } catch (err) {
      if (err instanceof TranslateAbortError) throw err;
      const message = (err as Error)?.message ?? String(err);
      throw new TranslatorUnavailableError(
        `Translator.create() failed: ${message}`,
      );
    }

    const taskOptions: TranslatorTranslateOptions = {
      ...(options.signal ? { signal: options.signal } : {}),
    };

    // Browser implementations may emit delta or cumulative chunks. Detect the
    // shape per chunk and merge accordingly.
    const mergeChunk = (buffer: string, chunk: string): string =>
      chunk.startsWith(buffer) ? chunk : buffer + chunk;

    let output: string;
    if (options.onUpdate && typeof session.translateStreaming === "function") {
      const reader = session.translateStreaming(text, taskOptions).getReader();
      let buffer = "";
      try {
        for (;;) {
          const { done, value } = await raceAbort(
            reader.read(),
            options.signal,
          );
          if (done) break;
          buffer = mergeChunk(buffer, value);
          options.onUpdate(buffer);
        }
      } catch (err) {
        // Stop native work; the reader may already be errored, so best-effort.
        reader.cancel().catch(() => {});
        throw err;
      }
      output = buffer;
    } else {
      output = await raceAbort(
        session.translate(text, taskOptions),
        options.signal,
      );
      // No native streaming: deliver the one-shot result as one final update.
      if (output) options.onUpdate?.(output);
    }
    if (options.signal?.aborted) throw new TranslateAbortError();

    if (output && cache) cache.set(cacheKey, output);
    return { output: output || null, cached: false };
  } finally {
    acquired.done();
  }
};
