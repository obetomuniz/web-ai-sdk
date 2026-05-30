/**
 * Adapter over the global `Proofreader` API exposed by Chrome (behind
 * `chrome://flags/#proofreader-api-for-gemini-nano`). Feature-detected; on
 * browsers without it, every entry point returns `null` so callers can stay
 * declarative.
 *
 * Spec: https://developer.chrome.com/docs/ai/proofreader-api
 */

export interface DownloadProgressEvent extends Event {
  readonly loaded: number;
}

export interface CreateMonitor {
  addEventListener(
    type: "downloadprogress",
    listener: (event: DownloadProgressEvent) => void,
  ): void;
}

export interface ProofreadCorrection {
  /** Inclusive start offset into the original input. */
  startIndex: number;
  /** Exclusive end offset into the original input. */
  endIndex: number;
  /** The suggested replacement for `input.slice(startIndex, endIndex)`. */
  correction: string;
  /** Error label (e.g. `"spelling"`). Not emitted by Chrome's current build. */
  type?: string;
  /** Plain-language explanation. Not emitted by Chrome's current build. */
  explanation?: string;
}

export interface ProofreadOutput {
  /** The fully corrected text. */
  correctedInput: string;
  /** Per-issue corrections with offsets into the original input. */
  corrections: ProofreadCorrection[];
}

export interface ProofreaderInstance {
  proofread(input: string): Promise<ProofreadOutput>;
  destroy?(): void;
}

export interface ProofreaderCreateOptions {
  /** BCP-47 languages the proofreader should expect as input. */
  expectedInputLanguages?: string[];
  /** Standard `AbortSignal` plumbed through to `create()`. */
  signal?: AbortSignal;
  /** Observe the first-call model download. */
  monitor?: (m: CreateMonitor) => void;
}

export interface ProofreaderAvailabilityOptions {
  expectedInputLanguages?: string[];
}

export type ProofreaderAvailability =
  | "unavailable"
  | "downloadable"
  | "downloading"
  | "available";

export interface ProofreaderApi {
  availability(
    options?: ProofreaderAvailabilityOptions,
  ): Promise<ProofreaderAvailability>;
  create(options?: ProofreaderCreateOptions): Promise<ProofreaderInstance>;
}

/** Internal: read the native global. Not exported from the package. */
export const getProofreaderApi = (): ProofreaderApi | null => {
  if (typeof globalThis === "undefined") return null;
  return (
    (globalThis as unknown as { Proofreader?: ProofreaderApi }).Proofreader ??
    null
  );
};

/** Whether the current environment exposes the Proofreader API. */
export const isAvailable = (): boolean => getProofreaderApi() !== null;

/**
 * Probe the native `availability()` for the given shape. Returns `null` on
 * browsers without the API.
 */
export const checkAvailability = async (
  options?: ProofreaderAvailabilityOptions,
): Promise<ProofreaderAvailability | null> => {
  const api = getProofreaderApi();
  if (!api?.availability) return null;
  try {
    return await api.availability(options);
  } catch {
    return null;
  }
};

const sessionCache = new Map<string, Promise<ProofreaderInstance>>();

/**
 * Get or create a `Proofreader` session for the given options. Sessions live
 * for the tab lifetime so consecutive same-config calls skip the cold start.
 * On `create()` failure the cache slot is purged so the next call retries
 * instead of returning a poisoned promise.
 */
export const getOrCreateProofreader = (
  api: ProofreaderApi,
  options: ProofreaderCreateOptions,
): Promise<ProofreaderInstance> => {
  // Drop `signal` and `monitor` from the cache key; they're per-call
  // ephemera that shouldn't fragment session reuse.
  const key = JSON.stringify({
    expectedInputLanguages: options.expectedInputLanguages,
  });
  let session = sessionCache.get(key);
  if (!session) {
    session = api.create(options).catch((err) => {
      sessionCache.delete(key);
      throw err;
    });
    sessionCache.set(key, session);
  }
  return session;
};

/** Drop every cached proofreader session. */
export const clearProofreaderSessions = (): void => {
  for (const entry of sessionCache.values()) {
    entry
      .then((session) => {
        try {
          session.destroy?.();
        } catch {
          // best-effort; the spec doesn't require destroy to be infallible.
        }
      })
      .catch(() => {
        // session never resolved; nothing to destroy.
      });
  }
  sessionCache.clear();
};

/** Test-only escape hatch; drop every cached session. */
export const __clearSessionCacheForTests = (): void => {
  sessionCache.clear();
};
