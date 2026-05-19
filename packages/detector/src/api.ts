/**
 * Adapter over the global `LanguageDetector` API exposed by Chrome (behind
 * `chrome://flags/#language-detection-api`). Feature-detected; on browsers
 * without it, every entry point returns `null` so callers can stay
 * declarative.
 *
 * Spec: https://developer.chrome.com/docs/ai/language-detection
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

export interface LanguageDetectorCreateOptions {
  /** BCP-47 languages the detector should bias toward. */
  expectedInputLanguages?: string[];
  /** Standard `AbortSignal` plumbed through to the underlying call. */
  signal?: AbortSignal;
  /** Observe the first-call model download. */
  monitor?: (m: CreateMonitor) => void;
}

export interface LanguageDetectorAvailabilityOptions {
  expectedInputLanguages?: string[];
}

export interface DetectionResult {
  /** BCP-47 language code. May be `"und"` (undetermined) for ambiguous input. */
  detectedLanguage: string;
  /** 0..1 confidence score. */
  confidence: number;
}

export interface LanguageDetectorInstance {
  detect(text: string): Promise<DetectionResult[]>;
  destroy?(): void;
}

export type LanguageDetectorAvailability =
  | "unavailable"
  | "downloadable"
  | "downloading"
  | "available";

export interface LanguageDetectorApi {
  availability(
    options?: LanguageDetectorAvailabilityOptions,
  ): Promise<LanguageDetectorAvailability>;
  create(
    options?: LanguageDetectorCreateOptions,
  ): Promise<LanguageDetectorInstance>;
}

export const getLanguageDetectorApi = (): LanguageDetectorApi | null => {
  if (typeof globalThis === "undefined") return null;
  return (
    (globalThis as unknown as { LanguageDetector?: LanguageDetectorApi })
      .LanguageDetector ?? null
  );
};

export const isDetectorAvailable = (): boolean =>
  getLanguageDetectorApi() !== null;

export const checkAvailability = async (
  options?: LanguageDetectorAvailabilityOptions,
): Promise<LanguageDetectorAvailability | null> => {
  const api = getLanguageDetectorApi();
  if (!api?.availability) return null;
  try {
    return await api.availability(options);
  } catch {
    return null;
  }
};

const sessionCache = new Map<string, Promise<LanguageDetectorInstance>>();

/**
 * Get or create a `LanguageDetector` session for the given options.
 * Sessions live for the tab lifetime so consecutive calls with the same
 * shape skip the cold start. On `create()` failure the cache slot is
 * purged so the next call retries instead of returning a poisoned promise.
 */
export const getOrCreateLanguageDetector = (
  api: LanguageDetectorApi,
  options: LanguageDetectorCreateOptions,
): Promise<LanguageDetectorInstance> => {
  // Drop `signal` and `monitor` from the cache key; they're per-call
  // ephemera that shouldn't fragment session reuse.
  const keyOptions = {
    expectedInputLanguages: options.expectedInputLanguages,
  };
  const key = JSON.stringify(keyOptions);
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

/** Test-only escape hatch; drop every cached session. */
export const __clearSessionCacheForTests = (): void => {
  sessionCache.clear();
};
