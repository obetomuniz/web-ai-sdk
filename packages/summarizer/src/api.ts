/**
 * Adapter over the global `Summarizer` API exposed by Chrome 138+. Feature-
 * detected; on browsers without it, every entry point returns `null` so
 * callers can stay declarative.
 *
 * Spec: https://developer.chrome.com/docs/ai/summarizer-api
 */

export interface SummarizerInstance {
  summarize(text: string): Promise<string>;
  summarizeStreaming?(text: string): AsyncIterable<string>;
  destroy?(): void;
}

export interface DownloadProgressEvent extends Event {
  readonly loaded: number;
}

export interface CreateMonitor {
  addEventListener(
    type: "downloadprogress",
    listener: (event: DownloadProgressEvent) => void,
  ): void;
}

export interface SummarizerCreateOptions {
  type?: "tldr" | "key-points" | "teaser" | "headline";
  format?: "markdown" | "plain-text";
  length?: "short" | "medium" | "long";
  preference?: "auto" | "speed" | "capability";
  sharedContext?: string;
  expectedInputLanguages?: string[];
  expectedContextLanguages?: string[];
  outputLanguage?: string;
  /** Observe the first-call model download (~1.7 GB on a fresh profile). */
  monitor?: (m: CreateMonitor) => void;
}

export type SummarizerAvailability =
  | "unavailable"
  | "downloadable"
  | "downloading"
  | "available";

/**
 * Subset of `SummarizerCreateOptions` that the spec accepts when probing
 * availability. Edge enforces these strictly (e.g. fires a warning when
 * `outputLanguage` is missing); Chrome is more lenient. Pass the same
 * shape you'd pass to `create()` to get accurate, warning-free results
 * across browsers.
 */
export interface SummarizerAvailabilityOptions {
  type?: SummarizerCreateOptions["type"];
  format?: SummarizerCreateOptions["format"];
  length?: SummarizerCreateOptions["length"];
  expectedInputLanguages?: string[];
  expectedContextLanguages?: string[];
  outputLanguage?: string;
}

export interface SummarizerApi {
  availability(
    options?: SummarizerAvailabilityOptions,
  ): Promise<SummarizerAvailability>;
  create(options?: SummarizerCreateOptions): Promise<SummarizerInstance>;
}

export const getSummarizerApi = (): SummarizerApi | null => {
  if (typeof globalThis === "undefined") return null;
  return (
    (globalThis as unknown as { Summarizer?: SummarizerApi }).Summarizer ?? null
  );
};

export const isSummarizerAvailable = (): boolean => getSummarizerApi() !== null;

export const checkAvailability = async (
  options?: SummarizerAvailabilityOptions,
): Promise<SummarizerAvailability | null> => {
  const api = getSummarizerApi();
  if (!api?.availability) return null;
  try {
    return await api.availability(options);
  } catch {
    return null;
  }
};

const sessionCache = new Map<string, Promise<SummarizerInstance>>();

/**
 * Get or create a `Summarizer` session for the given options. Sessions live
 * for the tab lifetime so navigating between same-config pages skips the
 * ~1-3s cold start. On `create()` failure the cache slot is purged so the
 * next call retries instead of returning a poisoned promise.
 */
export const getOrCreateSummarizer = (
  api: SummarizerApi,
  options: SummarizerCreateOptions,
): Promise<SummarizerInstance> => {
  const key = JSON.stringify(options);
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
