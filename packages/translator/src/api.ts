/**
 * Adapter over the global `Translator` API exposed by Chrome 138+. The native
 * surface is feature-detected; on browsers without it, every entry point in
 * this module returns `null` / `undefined` so callers can stay declarative.
 *
 * Spec: https://developer.chrome.com/docs/ai/translator-api
 */

export interface TranslatorInstance {
  translate(text: string): Promise<string>;
  destroy?(): void;
}

export interface DownloadProgressEvent extends Event {
  readonly loaded: number;
}

export interface TranslatorMonitor {
  addEventListener(
    type: "downloadprogress",
    listener: (event: DownloadProgressEvent) => void,
  ): void;
}

export interface TranslatorCreateOptions {
  sourceLanguage: string;
  targetLanguage: string;
  monitor?(m: TranslatorMonitor): void;
}

export interface TranslatorAvailabilityOptions {
  sourceLanguage: string;
  targetLanguage: string;
}

export type TranslatorAvailability =
  | "unavailable"
  | "downloadable"
  | "downloading"
  | "available";

export interface TranslatorApi {
  availability(
    options: TranslatorAvailabilityOptions,
  ): Promise<TranslatorAvailability>;
  create(options: TranslatorCreateOptions): Promise<TranslatorInstance>;
}

/** Internal: read the native global. Not exported from the package. */
export const getTranslatorApi = (): TranslatorApi | null => {
  if (typeof globalThis === "undefined") return null;
  return (
    (globalThis as unknown as { Translator?: TranslatorApi }).Translator ?? null
  );
};

/** Whether the current environment exposes the Translator API. */
export const isAvailable = (): boolean => getTranslatorApi() !== null;

export const checkAvailability = async (
  options: TranslatorAvailabilityOptions,
): Promise<TranslatorAvailability | null> => {
  const api = getTranslatorApi();
  if (!api?.availability) return null;
  try {
    return await api.availability(options);
  } catch {
    return null;
  }
};

const sessionCache = new Map<string, Promise<TranslatorInstance>>();

/**
 * Get or create a `Translator` session for the given language pair. Sessions
 * live for the tab lifetime so navigating between same-language documents
 * skips the ~1-3s cold start. On `create()` failure the cache slot is purged
 * so the next call retries instead of returning a poisoned promise.
 */
export const getOrCreateTranslator = (
  api: TranslatorApi,
  options: TranslatorCreateOptions,
): Promise<TranslatorInstance> => {
  const key = `${options.sourceLanguage}->${options.targetLanguage}`;
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
