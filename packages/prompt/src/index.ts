/**
 * @web-ai-sdk/prompt; building block for the Web's Built-in Prompt API
 * (`LanguageModel`).
 *
 * Vanilla TypeScript / DOM core. The React adapter at `@web-ai-sdk/prompt/react` is a
 * thin hook around this module.
 *
 * Spec: https://github.com/webmachinelearning/prompt-api
 */

import {
  type LanguageModelApi,
  type LanguageModelAvailability,
  type LanguageModelCreateOptions,
  type LanguageModelExpectedInput,
  type LanguageModelExpectedOutput,
  type LanguageModelInstance,
  type LanguageModelMessage,
  type LanguageModelParams,
  checkAvailability,
  clearSession,
  clearSessions,
  configurePromptCache,
  getLanguageModelApi,
  getOrCreateLanguageModel,
  isPromptAvailable,
} from "./api.js";
import {
  type DefaultCacheKeyInput,
  type ResponseCache,
  createSessionStorageCache,
  defaultCacheKey,
} from "./cache.js";
import {
  type CreateSessionOptions,
  PromptUnavailableError,
  type Session,
  SessionDestroyedError,
  type SessionSendOptions,
  buildLangHints,
  createSession,
  mergeStreamChunk,
  sanitizeResponse,
} from "./session.js";

export {
  isPromptAvailable,
  checkAvailability,
  getLanguageModelApi,
  getOrCreateLanguageModel,
  createSessionStorageCache,
  defaultCacheKey,
  createSession,
  clearSessions,
  clearSession,
  configurePromptCache,
  PromptUnavailableError,
  SessionDestroyedError,
};

export type {
  LanguageModelApi,
  LanguageModelAvailability,
  LanguageModelCreateOptions,
  LanguageModelExpectedInput,
  LanguageModelExpectedOutput,
  LanguageModelInstance,
  LanguageModelMessage,
  LanguageModelParams,
  ResponseCache,
  DefaultCacheKeyInput,
  Session,
  SessionSendOptions,
  CreateSessionOptions,
};

export interface AskOptions {
  /** The user-facing prompt / question. */
  input: string;
  /** Optional system prompt (folded into `initialPrompts` as a `system` role). */
  systemPrompt?: string;
  /** Sampling temperature (0..1). Defaults to the model's default. */
  temperature?: number;
  /** Sampling top-k. Defaults to the model's default. */
  topK?: number;
  /** BCP-47 language hint. Folded into `expectedInputs` / `expectedOutputs` when supported. */
  language?: string;
  /** Languages the model supports for the language hint. Default: `["en"]`. */
  supportedLanguages?: readonly string[];
  /** Advanced: full `expectedInputs` passthrough. Overrides the `language` hint. */
  expectedInputs?: LanguageModelExpectedInput[];
  /** Advanced: full `expectedOutputs` passthrough. Overrides the `language` hint. */
  expectedOutputs?: LanguageModelExpectedOutput[];
  /**
   * Override `LanguageModel.create()` options entirely. Merged on top of
   * defaults. Passing `initialPrompts` here while also passing `systemPrompt`
   * silently disables the persona; the SDK emits a one-shot `console.warn`
   * when this happens.
   */
  createOptions?: Partial<LanguageModelCreateOptions>;
  /** Optional JSON Schema for structured output. */
  responseConstraint?: object;
  /** Optional result cache. Off by default; every call hits the model. Pass `createSessionStorageCache()` or any `{ get, set }`-shaped object to enable. */
  cache?: ResponseCache;
  /** Cache key. Default: hash of `{ input, systemPrompt, temperature, topK }`. */
  cacheKey?: string;
  /**
   * Streaming update callback. Receives the **cumulative** buffer (full text so
   * far), not deltas. For delta-shaped streaming, use `createSession()` and
   * iterate `session.sendStreaming()` instead.
   */
  onUpdate?: (text: string) => void;
  /** Abort signal. */
  signal?: AbortSignal;
}

export interface AskResult {
  /** Final response text, or `null` if the input was empty. */
  response: string | null;
  /** Whether the result came from the cache (no model call). */
  cached: boolean;
}

class PromptAbortError extends Error {
  override readonly name = "AbortError";
  constructor() {
    super("Prompt aborted");
  }
}

// Track which `(systemPrompt, createOptions.initialPrompts)` collisions we've
// already warned about, so a chat loop doesn't drown the console.
const warnedClobberKeys = new Set<string>();
const warnClobberOnce = (key: string): void => {
  if (warnedClobberKeys.has(key)) return;
  warnedClobberKeys.add(key);
  if (typeof console !== "undefined") {
    console.warn(
      "[@web-ai-sdk/prompt] `createOptions.initialPrompts` was passed alongside `systemPrompt`. " +
        "`initialPrompts` overrides the synthesized system prompt, so the persona was lost. " +
        "Pass only one. To silence this warning intentionally, omit `systemPrompt`.",
    );
  }
};

/**
 * Run a one-shot prompt. Uses streaming when the underlying instance supports
 * it, falling back to one-shot otherwise. Returns `null` when the input is
 * empty. Throws `PromptUnavailableError` when the API isn't present.
 *
 * For chat-shaped apps where turns need to remember each other, prefer
 * `createSession()` (or `useSession()` in React); `ask()` shares warm sessions
 * across same-shape callers, so two chats with the same persona will queue
 * instead of streaming concurrently.
 */
export const ask = async (options: AskOptions): Promise<AskResult> => {
  const api = getLanguageModelApi();
  if (!api?.create) {
    throw new PromptUnavailableError(
      "Prompt API (LanguageModel) is not available in this environment.",
    );
  }

  if (!options.input.trim()) {
    return { response: null, cached: false };
  }

  // Caching is opt-in. Pass a `cache` (any `{ get, set }`-shaped object,
  // e.g. `createSessionStorageCache()`) to enable response caching; omit
  // it for a fresh model call every time.
  const cache = options.cache;
  const cacheKey =
    options.cacheKey ??
    defaultCacheKey({
      prompt: options.input,
      systemPrompt: options.systemPrompt,
      temperature: options.temperature,
      topK: options.topK,
    });
  if (cache) {
    const cached = cache.get(cacheKey);
    if (cached) return { response: cached, cached: true };
  }

  const langHints = buildLangHints(
    options.language,
    options.supportedLanguages,
  );
  const initialPrompts: LanguageModelMessage[] = options.systemPrompt
    ? [{ role: "system", content: options.systemPrompt }]
    : [];

  if (
    options.systemPrompt &&
    options.createOptions?.initialPrompts !== undefined
  ) {
    warnClobberOnce(options.systemPrompt);
  }

  const baseCreateOptions: LanguageModelCreateOptions = {
    ...(initialPrompts.length > 0 ? { initialPrompts } : {}),
    ...(options.temperature !== undefined
      ? { temperature: options.temperature }
      : {}),
    ...(options.topK !== undefined ? { topK: options.topK } : {}),
    ...(options.expectedInputs
      ? { expectedInputs: options.expectedInputs }
      : langHints.expectedInputs
        ? { expectedInputs: langHints.expectedInputs }
        : {}),
    ...(options.expectedOutputs
      ? { expectedOutputs: options.expectedOutputs }
      : langHints.expectedOutputs
        ? { expectedOutputs: langHints.expectedOutputs }
        : {}),
    ...options.createOptions,
  };

  const sessionPromise = getOrCreateLanguageModel(api, baseCreateOptions);
  const availability = await api
    .availability({
      ...(baseCreateOptions.expectedInputs
        ? { expectedInputs: baseCreateOptions.expectedInputs }
        : {}),
      ...(baseCreateOptions.expectedOutputs
        ? { expectedOutputs: baseCreateOptions.expectedOutputs }
        : {}),
    })
    .catch(() => "unavailable" as const);
  if (availability === "unavailable") {
    throw new PromptUnavailableError("LanguageModel reports unavailable.");
  }
  if (options.signal?.aborted) throw new PromptAbortError();

  // Wrap session-create failures with context so consumers can branch on
  // a single typed error instead of parsing browser-specific messages.
  let session: LanguageModelInstance;
  try {
    session = await sessionPromise;
  } catch (err) {
    if (err instanceof PromptAbortError) throw err;
    const message = (err as Error)?.message ?? String(err);
    throw new PromptUnavailableError(
      `LanguageModel.create() failed: ${message}`,
    );
  }
  if (options.signal?.aborted) throw new PromptAbortError();

  const promptOpts: { signal?: AbortSignal; responseConstraint?: object } = {};
  if (options.signal) promptOpts.signal = options.signal;
  if (options.responseConstraint)
    promptOpts.responseConstraint = options.responseConstraint;

  let finalText: string;
  if (typeof session.promptStreaming === "function") {
    let buffer = "";
    for await (const chunk of session.promptStreaming(
      options.input,
      promptOpts,
    )) {
      if (options.signal?.aborted) throw new PromptAbortError();
      const merged = mergeStreamChunk(buffer, chunk);
      buffer = merged.buffer;
      options.onUpdate?.(buffer);
    }
    finalText = buffer;
  } else {
    const raw = await session.prompt(options.input, promptOpts);
    if (options.signal?.aborted) throw new PromptAbortError();
    finalText = raw;
    options.onUpdate?.(finalText);
  }

  const cleaned = sanitizeResponse(finalText);
  if (cleaned && cache) cache.set(cacheKey, cleaned);
  return { response: cleaned || null, cached: false };
};
