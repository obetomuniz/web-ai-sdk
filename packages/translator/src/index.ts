/**
 * @web-ai-sdk/translator; building block for the Web's Built-in Translator API.
 *
 * Vanilla TypeScript / DOM core. The React adapter at `@web-ai-sdk/translator/react` is a
 * thin hook around this module.
 *
 * Spec: https://developer.chrome.com/docs/ai/translator-api
 */

import {
  checkAvailability,
  getOrCreateTranslator,
  getTranslatorApi,
  isAvailable,
  type TranslatorApi,
  type TranslatorAvailability,
  type TranslatorAvailabilityOptions,
  type TranslatorCreateOptions,
  type TranslatorInstance,
  type TranslatorMonitor,
} from "./api.js";
import {
  type CacheOption,
  defaultCacheKey,
  resolveCache,
  type TranslationCache,
} from "./cache.js";

export type {
  CacheOption,
  TranslationCache,
  TranslatorApi,
  TranslatorAvailability,
  TranslatorAvailabilityOptions,
  TranslatorCreateOptions,
  TranslatorInstance,
  TranslatorMonitor,
};
export { checkAvailability, isAvailable };

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
  /** Cache key. Default: hash of `{ sourceLanguage, targetLanguage, input }`. */
  cacheKey?: string;
  /** Abort signal. */
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

class TranslateAbortError extends Error {
  override readonly name = "AbortError";
  constructor() {
    super("Translation aborted");
  }
}

/**
 * Translate a string from `sourceLanguage` to `targetLanguage`. Returns
 * `{ output: null }` when the input is empty or when source and target
 * match. Throws `TranslatorUnavailableError` when the API isn't present in
 * the environment or reports `availability: "unavailable"`.
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

  const text = options.input.trim();
  if (!text) return { output: null, cached: false };

  const sourceLanguage = NORMALIZE_LANG(options.sourceLanguage);
  const targetLanguage = NORMALIZE_LANG(options.targetLanguage ?? "en");
  if (sourceLanguage === targetLanguage) {
    return { output: null, cached: false };
  }

  const cache = resolveCache(options.cache);
  const cacheKey =
    options.cacheKey ??
    defaultCacheKey({ sourceLanguage, targetLanguage, text });
  if (cache) {
    const cached = cache.get(cacheKey);
    if (cached) return { output: cached, cached: true };
  }

  const createOptions: TranslatorCreateOptions = {
    sourceLanguage,
    targetLanguage,
    ...(options.monitor ? { monitor: options.monitor } : {}),
  };

  // Kick off session and availability in parallel; first call pays the cold
  // start, later calls reuse the cached session.
  const sessionPromise = getOrCreateTranslator(api, createOptions);
  const availability = await api
    .availability({ sourceLanguage, targetLanguage })
    .catch(() => "unavailable" as const);
  if (availability === "unavailable") {
    throw new TranslatorUnavailableError("Translator reports unavailable.");
  }
  if (options.signal?.aborted) throw new TranslateAbortError();

  let session: TranslatorInstance;
  try {
    session = await sessionPromise;
  } catch (err) {
    if (err instanceof TranslateAbortError) throw err;
    const message = (err as Error)?.message ?? String(err);
    throw new TranslatorUnavailableError(
      `Translator.create() failed: ${message}`,
    );
  }
  if (options.signal?.aborted) throw new TranslateAbortError();

  const output = await session.translate(text);
  if (options.signal?.aborted) throw new TranslateAbortError();

  if (output && cache) cache.set(cacheKey, output);
  return { output: output || null, cached: false };
};
