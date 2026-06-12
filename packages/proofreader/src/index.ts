/**
 * @web-ai-sdk/proofreader; building block for the Web's Built-in Proofreader
 * API.
 *
 * Vanilla TypeScript / DOM core. The React adapter at
 * `@web-ai-sdk/proofreader/react` is a thin hook around this module.
 *
 * Spec: https://developer.chrome.com/docs/ai/proofreader-api
 */

import {
  type ConfigureProofreaderCacheOptions,
  type CreateMonitor,
  getOrCreateProofreader,
  getProofreaderApi,
  type ProofreadCorrection,
  type ProofreaderApi,
  type ProofreaderAvailability,
  type ProofreaderAvailabilityOptions,
  type ProofreaderCreateOptions,
  type ProofreaderInstance,
  type ProofreadOutput,
} from "./api.js";
import {
  type CacheOption,
  defaultCacheKey,
  type ProofreadCache,
  resolveCache,
} from "./cache.js";

export {
  checkAvailability,
  clearProofreaderSession,
  clearProofreaderSessions,
  configureProofreaderCache,
  getOrCreateProofreader,
  getProofreaderApi,
  isAvailable,
} from "./api.js";

export { defaultCacheKey, resolveCache } from "./cache.js";

export type {
  CacheOption,
  ConfigureProofreaderCacheOptions,
  CreateMonitor,
  ProofreadCache,
  ProofreadCorrection,
  ProofreaderApi,
  ProofreaderAvailability,
  ProofreaderAvailabilityOptions,
  ProofreaderCreateOptions,
  ProofreaderInstance,
  ProofreadOutput,
};

export interface ProofreadOptions {
  /** Text to proofread. Empty / whitespace input resolves to `{ output: null }`. */
  input: string;
  /** BCP-47 languages the proofreader should expect as input. */
  expectedInputLanguages?: readonly string[];
  /** Observe the first-call model download. */
  monitor?: (m: CreateMonitor) => void;
  /**
   * Result cache. Off by default; every call hits the model. Pass
   * `"session"` / `"local"` for the matching web-storage shortcut, or any
   * `{ get, set }`-shaped object for a custom backend.
   */
  cache?: CacheOption;
  /** Cache key. Default: JSON string of `{ input, expectedInputLanguages }`. */
  cacheKey?: string;
  /** Abort signal. */
  signal?: AbortSignal;
}

export interface ProofreadResult {
  /**
   * The proofread output, or `null` when the input is empty. `correctedInput`
   * is the fully corrected text; `corrections` is the list of per-issue
   * edits with offsets into the original input (empty when nothing changed).
   */
  output: ProofreadOutput | null;
  /** Whether the result came from the cache (no model call). */
  cached: boolean;
}

export class ProofreaderUnavailableError extends Error {
  override readonly name = "ProofreaderUnavailableError";
}

class ProofreaderAbortError extends Error {
  override readonly name = "AbortError";
  constructor() {
    super("Proofreading aborted");
  }
}

/**
 * Proofread a string for grammar, spelling, and punctuation. Returns the
 * corrected text plus the list of per-issue corrections. Returns
 * `{ output: null, ... }` for empty input. Throws
 * `ProofreaderUnavailableError` when the API isn't present in the
 * environment.
 */
export const proofread = async (
  options: ProofreadOptions,
): Promise<ProofreadResult> => {
  const api = getProofreaderApi();
  if (!api?.create) {
    throw new ProofreaderUnavailableError(
      "Proofreader API is not available in this environment.",
    );
  }

  const text = options.input.trim();
  if (!text) return { output: null, cached: false };

  const expectedInputLanguages = options.expectedInputLanguages
    ? [...options.expectedInputLanguages]
    : undefined;

  const cache = resolveCache(options.cache);
  const cacheKey =
    options.cacheKey ?? defaultCacheKey({ text, expectedInputLanguages });
  if (cache) {
    const cached = cache.get(cacheKey);
    if (cached) {
      try {
        return { output: JSON.parse(cached) as ProofreadOutput, cached: true };
      } catch {
        // bad cache entry; fall through to a fresh call.
      }
    }
  }

  const baseCreateOptions: ProofreaderCreateOptions = {
    ...(expectedInputLanguages ? { expectedInputLanguages } : {}),
    ...(options.monitor ? { monitor: options.monitor } : {}),
  };

  const availability = await api
    .availability(
      expectedInputLanguages ? { expectedInputLanguages } : undefined,
    )
    .catch(() => "unavailable" as const);
  if (availability === "unavailable") {
    throw new ProofreaderUnavailableError("Proofreader reports unavailable.");
  }
  if (options.signal?.aborted) throw new ProofreaderAbortError();

  const sessionPromise = getOrCreateProofreader(api, baseCreateOptions);

  // Wrap session-create failures with context so consumers can branch on a
  // single typed error instead of parsing browser-specific messages.
  let proofreader: ProofreaderInstance;
  try {
    proofreader = await sessionPromise;
  } catch (err) {
    if (err instanceof ProofreaderAbortError) throw err;
    const message = (err as Error)?.message ?? String(err);
    throw new ProofreaderUnavailableError(
      `Proofreader.create() failed: ${message}`,
    );
  }
  if (options.signal?.aborted) throw new ProofreaderAbortError();

  const raw = await proofreader.proofread(text);
  if (options.signal?.aborted) throw new ProofreaderAbortError();

  const output: ProofreadOutput = {
    correctedInput: raw.correctedInput ?? text,
    corrections: Array.isArray(raw.corrections) ? raw.corrections : [],
  };

  if (cache) cache.set(cacheKey, JSON.stringify(output));
  return { output, cached: false };
};
