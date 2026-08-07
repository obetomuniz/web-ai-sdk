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
  acquireProofreader,
  type ConfigureProofreaderCacheOptions,
  type CreateMonitor,
  getProofreaderApi,
  leaseProofreader,
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
  isAvailable,
} from "./api.js";

export { DEFAULT_CACHE_TTL_MS } from "./cache.js";

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
  /** Cache key. Default: JSON array string of `[input, sortedExpectedInputLanguages]`. */
  cacheKey?: string;
  /**
   * Time-to-live in milliseconds for entries written by the built-in
   * `"session"` / `"local"` storage shortcuts. Default: one hour
   * (`DEFAULT_CACHE_TTL_MS`). Ignored for custom `{ get, set }` caches, which
   * own their expiry policy.
   */
  cacheTtl?: number;
  /**
   * Force a fresh proofread. Skips the cache read, runs the model, and
   * replaces the cached value after a successful run. Applies to built-in
   * and custom caches.
   */
  cacheRefresh?: boolean;
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
 * Session-affecting subset of `ProofreadOptions`. `prepareProofreader` and
 * `proofread` derive the same native create options from these fields, so a
 * prepared session is reused by the matching call.
 * `monitor` observes creation only; it never affects the cache key.
 */
export type PrepareProofreaderOptions = Pick<
  ProofreadOptions,
  "expectedInputLanguages" | "monitor"
>;

interface SessionConfig {
  expectedInputLanguages: string[] | undefined;
  createOptions: ProofreaderCreateOptions;
}

/**
 * Single source of the option-to-session mapping. The session cache key derives from
 * the stable fields of `createOptions` (`monitor` never fragments reuse),
 * so `proofread` and `prepareProofreader` must both go
 * through this derivation.
 */
const resolveSessionConfig = (
  options: PrepareProofreaderOptions,
): SessionConfig => {
  const expectedInputLanguages = options.expectedInputLanguages
    ? [...options.expectedInputLanguages]
    : undefined;
  const createOptions: ProofreaderCreateOptions = {
    ...(expectedInputLanguages ? { expectedInputLanguages } : {}),
    ...(options.monitor ? { monitor: options.monitor } : {}),
  };
  return { expectedInputLanguages, createOptions };
};

export interface ProofreaderLease {
  /**
   * Resolves when the native session is created. Rejects with
   * `ProofreaderUnavailableError` when the API is missing or creation fails.
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
 * input exists. The matching `proofread` call reuses the prepared session
 * without a second create. Never throws synchronously; unavailability and
 * creation failures reject `ready`. Failed preparations leave the cache so a
 * later call can retry.
 */
export const prepareProofreader = (
  options: PrepareProofreaderOptions = {},
): ProofreaderLease => {
  const api = getProofreaderApi();
  if (!api?.create) {
    const ready = Promise.reject(
      new ProofreaderUnavailableError(
        "Proofreader API is not available in this environment.",
      ),
    );
    // Keep unobserved leases from surfacing unhandled rejections.
    ready.catch(() => {});
    return { ready, release: () => {} };
  }
  const { createOptions } = resolveSessionConfig(options);
  const lease = leaseProofreader(api, createOptions);
  const ready = lease.ready.catch((err) => {
    const message = (err as Error)?.message ?? String(err);
    throw new ProofreaderUnavailableError(
      `Proofreader.create() failed: ${message}`,
    );
  });
  ready.catch(() => {});
  return { ready, release: lease.release };
};

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

  const { expectedInputLanguages, createOptions } =
    resolveSessionConfig(options);

  const cache = resolveCache(options.cache, options.cacheTtl);
  const cacheKey =
    options.cacheKey ?? defaultCacheKey({ text, expectedInputLanguages });
  if (cache && !options.cacheRefresh) {
    const cached = cache.get(cacheKey);
    if (cached) {
      try {
        return { output: JSON.parse(cached) as ProofreadOutput, cached: true };
      } catch {
        // bad cache entry; fall through to a fresh call.
      }
    }
  }

  const availability = await api
    .availability(
      expectedInputLanguages ? { expectedInputLanguages } : undefined,
    )
    .catch(() => "unavailable" as const);
  if (availability === "unavailable") {
    throw new ProofreaderUnavailableError("Proofreader reports unavailable.");
  }
  if (options.signal?.aborted) throw new ProofreaderAbortError();

  // The pin defers destruction (lease release, clear, eviction) until this
  // call finishes.
  const acquired = acquireProofreader(api, createOptions);
  try {
    // Wrap session-create failures with context so consumers can branch on a
    // single typed error instead of parsing browser-specific messages.
    let proofreader: ProofreaderInstance;
    try {
      proofreader = await acquired.session;
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
  } finally {
    acquired.done();
  }
};
