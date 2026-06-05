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
  type CreateMonitor,
  checkAvailability,
  getLanguageModelApi,
  getOrCreateLanguageModel,
  isAvailable,
  type LanguageModelApi,
  type LanguageModelAvailability,
  type LanguageModelCreateOptions,
  type LanguageModelExpectedInput,
  type LanguageModelExpectedOutput,
  type LanguageModelInstance,
  type LanguageModelMessage,
  type LanguageModelParams,
  type LanguageModelPromptOptions,
  type LanguageModelTool,
} from "./api.js";
import {
  type CacheOption,
  type DefaultCacheKeyInput,
  defaultCacheKey,
  type ResponseCache,
  resolveCache,
} from "./cache.js";
import {
  buildLangHints,
  type CreateSessionOptions,
  createSession,
  mergeStreamChunk,
  PromptAbortError,
  PromptUnavailableError,
  type Session,
  SessionDestroyedError,
  type SessionSendOptions,
  sanitizeResponse,
} from "./session.js";

export type {
  CacheOption,
  CreateMonitor,
  CreateSessionOptions,
  DefaultCacheKeyInput,
  LanguageModelApi,
  LanguageModelAvailability,
  LanguageModelCreateOptions,
  LanguageModelExpectedInput,
  LanguageModelExpectedOutput,
  LanguageModelInstance,
  LanguageModelMessage,
  LanguageModelParams,
  LanguageModelTool,
  ResponseCache,
  Session,
  SessionSendOptions,
};
export {
  checkAvailability,
  createSession,
  isAvailable,
  PromptAbortError,
  PromptUnavailableError,
  SessionDestroyedError,
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
   * @experimental Forwards `tools` to the browser's Prompt API
   * (function calling). Whether the model actually INVOKES them depends
   * on the browser: native execution is NOT wired on current stable
   * Chrome — the option is accepted but a no-op, and the model may
   * surface its tool call as TEXT (`tool_code`) that the caller must
   * parse. Pass-through only: the SDK does not execute the tools. Will
   * begin working automatically on browsers that ship native execution.
   */
  tools?: LanguageModelTool[];
  /** Observe the first-call model download. */
  monitor?: (m: CreateMonitor) => void;
  /** Optional JSON Schema for structured output. */
  responseConstraint?: object;
  /**
   * When `responseConstraint` is set, omit the inlined JSON Schema from the
   * model's prompt context to save tokens. The constraint still shapes the
   * output. Ignored unless `responseConstraint` is also set (the native API
   * would otherwise throw). When omitting, include format guidance in the
   * prompt text itself.
   */
  omitResponseConstraintInput?: boolean;
  /**
   * Result cache. Off by default; every call hits the model. Pass
   * `"session"` / `"local"` for the matching web-storage shortcut, or any
   * `{ get, set }`-shaped object for a custom backend.
   */
  cache?: CacheOption;
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
  /** Final response text, or `null` if the input was empty or safety-blocked. */
  output: string | null;
  /** Whether the result came from the cache (no model call). */
  cached: boolean;
}

/**
 * Run a one-shot prompt. Uses streaming when the underlying instance supports
 * it, falling back to one-shot otherwise. Returns `{ output: null }` when the
 * input is empty. Throws `PromptUnavailableError` when the API isn't present.
 *
 * For chat-shaped apps where turns need to remember each other, prefer
 * `createSession()` (or `useSession()` in React); `ask()` shares warm sessions
 * across same-shape callers, so two chats with the same persona would share
 * one instance — with cross-bleeding history and `abort()` killing both.
 */
export const ask = async (options: AskOptions): Promise<AskResult> => {
  const api = getLanguageModelApi();
  if (!api?.create) {
    throw new PromptUnavailableError(
      "Prompt API (LanguageModel) is not available in this environment.",
    );
  }

  if (!options.input.trim()) {
    return { output: null, cached: false };
  }

  const cache = resolveCache(options.cache);
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
    if (cached) return { output: cached, cached: true };
  }

  const langHints = buildLangHints(
    options.language,
    options.supportedLanguages,
  );
  const initialPrompts: LanguageModelMessage[] = options.systemPrompt
    ? [{ role: "system", content: options.systemPrompt }]
    : [];

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
    ...(options.tools ? { tools: options.tools } : {}),
    ...(options.monitor ? { monitor: options.monitor } : {}),
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

  const promptOpts: LanguageModelPromptOptions = {};
  if (options.signal) promptOpts.signal = options.signal;
  if (options.responseConstraint) {
    promptOpts.responseConstraint = options.responseConstraint;
    // The native call throws a TypeError when omitResponseConstraintInput is
    // set without a responseConstraint, so only forward it alongside one.
    if (options.omitResponseConstraintInput)
      promptOpts.omitResponseConstraintInput = true;
  }

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
  return { output: cleaned || null, cached: false };
};
