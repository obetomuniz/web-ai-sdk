/**
 * Adapter over the global `LanguageModel` API exposed by Chrome (behind
 * `chrome://flags/#prompt-api-for-gemini-nano`). Feature-detected; on browsers
 * without it, every entry point returns `null` so callers can stay declarative.
 *
 * Spec: https://github.com/webmachinelearning/prompt-api
 */

export type LanguageModelRole = "system" | "user" | "assistant";

export interface LanguageModelMessage {
  role: LanguageModelRole;
  content: string;
}

export interface LanguageModelExpectedInput {
  type: "text" | "image" | "audio";
  languages?: string[];
}

export interface LanguageModelExpectedOutput {
  type: "text";
  languages?: string[];
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

export interface LanguageModelCreateOptions {
  initialPrompts?: LanguageModelMessage[];
  temperature?: number;
  topK?: number;
  expectedInputs?: LanguageModelExpectedInput[];
  expectedOutputs?: LanguageModelExpectedOutput[];
  signal?: AbortSignal;
  /** Observe the first-call model download (~1.7 GB on a fresh profile). */
  monitor?: (m: CreateMonitor) => void;
}

export interface LanguageModelPromptOptions {
  signal?: AbortSignal;
  responseConstraint?: object;
}

export interface LanguageModelInstance {
  prompt(
    input: string | LanguageModelMessage[],
    options?: LanguageModelPromptOptions,
  ): Promise<string>;
  promptStreaming?(
    input: string | LanguageModelMessage[],
    options?: LanguageModelPromptOptions,
  ): AsyncIterable<string>;
  clone?(options?: { signal?: AbortSignal }): Promise<LanguageModelInstance>;
  destroy?(): void;
  readonly inputUsage?: number;
  readonly inputQuota?: number;
  readonly topK?: number;
  readonly temperature?: number;
}

export type LanguageModelAvailability =
  | "unavailable"
  | "downloadable"
  | "downloading"
  | "available";

export interface LanguageModelParams {
  defaultTemperature: number;
  maxTemperature: number;
  defaultTopK: number;
  maxTopK: number;
}

export interface LanguageModelApi {
  availability(options?: {
    expectedInputs?: LanguageModelExpectedInput[];
    expectedOutputs?: LanguageModelExpectedOutput[];
  }): Promise<LanguageModelAvailability>;
  create(options?: LanguageModelCreateOptions): Promise<LanguageModelInstance>;
  params?(): Promise<LanguageModelParams | null>;
}

export const getLanguageModelApi = (): LanguageModelApi | null => {
  if (typeof globalThis === "undefined") return null;
  return (
    (globalThis as unknown as { LanguageModel?: LanguageModelApi })
      .LanguageModel ?? null
  );
};

export const isPromptAvailable = (): boolean => getLanguageModelApi() !== null;

export const checkAvailability = async (options?: {
  expectedInputs?: LanguageModelExpectedInput[];
  expectedOutputs?: LanguageModelExpectedOutput[];
}): Promise<LanguageModelAvailability | null> => {
  const api = getLanguageModelApi();
  if (!api?.availability) return null;
  try {
    return await api.availability(options);
  } catch {
    return null;
  }
};

const sessionCache = new Map<string, Promise<LanguageModelInstance>>();

/**
 * Get or create a `LanguageModel` session for the given options. Sessions live
 * for the tab lifetime so consecutive calls with the same shape skip the
 * ~1-3s cold start. On `create()` failure the cache slot is purged so the
 * next call retries instead of returning a poisoned promise.
 */
export const getOrCreateLanguageModel = (
  api: LanguageModelApi,
  options: LanguageModelCreateOptions,
): Promise<LanguageModelInstance> => {
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
