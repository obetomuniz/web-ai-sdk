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
  dropCachedLanguageModel,
  getLanguageModelApi,
  getOrCreateLanguageModel,
  isAvailable,
  isLanguageModelCloneUnavailable,
  type LanguageModelApi,
  type LanguageModelAudioValue,
  type LanguageModelAvailability,
  type LanguageModelCreateOptions,
  type LanguageModelExpectedInput,
  type LanguageModelExpectedOutput,
  type LanguageModelImageValue,
  type LanguageModelInstance,
  type LanguageModelMessage,
  type LanguageModelMessageContent,
  type LanguageModelParams,
  type LanguageModelPromptOptions,
  type LanguageModelSamplingMode,
  type LanguageModelTool,
  markLanguageModelCloneUnavailable,
} from "./api.js";
import {
  type CacheOption,
  type DefaultCacheKeyInput,
  defaultCacheKey,
  type ResponseCache,
  resolveCache,
} from "./cache.js";
import {
  assertValidSamplingOptions,
  buildLangHints,
  type CreateSessionOptions,
  cleanResponse,
  createSession,
  mergeStreamChunk,
  PromptAbortError,
  PromptUnavailableError,
  type Session,
  SessionDestroyedError,
  type SessionSendOptions,
} from "./session.js";

export type {
  CacheOption,
  CreateMonitor,
  CreateSessionOptions,
  DefaultCacheKeyInput,
  LanguageModelApi,
  LanguageModelAudioValue,
  LanguageModelAvailability,
  LanguageModelCreateOptions,
  LanguageModelExpectedInput,
  LanguageModelExpectedOutput,
  LanguageModelImageValue,
  LanguageModelInstance,
  LanguageModelMessage,
  LanguageModelMessageContent,
  LanguageModelParams,
  LanguageModelSamplingMode,
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
  /** Semantic sampling preset. Defaults to the model's default. */
  samplingMode?: LanguageModelSamplingMode;
  /** @deprecated Web page contexts are moving to `samplingMode`. */
  temperature?: number;
  /** @deprecated Web page contexts are moving to `samplingMode`. */
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
   * @experimental Forwards `tools` to the browser's Prompt API (function
   * calling). Support remains browser-defined. Pass-through only: the SDK does
   * not execute tools or parse text that resembles a tool call.
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
  /** Cache key. Default: JSON string of the prompt and output-shaping options. */
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

const destroyedFallbackBases = new WeakSet<LanguageModelInstance>();

const wrapCreateError = (err: unknown): PromptUnavailableError => {
  const message = (err as Error)?.message ?? String(err);
  return new PromptUnavailableError(
    `LanguageModel.create() failed: ${message}`,
  );
};

const createOneShotLanguageModel = async (
  api: LanguageModelApi,
  options: LanguageModelCreateOptions,
): Promise<LanguageModelInstance> => {
  try {
    return await api.create(options);
  } catch (err) {
    if (err instanceof PromptAbortError) throw err;
    throw wrapCreateError(err);
  }
};

const destroyFallbackBaseOnce = (session: LanguageModelInstance): void => {
  if (destroyedFallbackBases.has(session)) return;
  destroyedFallbackBases.add(session);
  try {
    session.destroy?.();
  } catch {
    // best-effort; unused no-clone probes should never mask prompt results.
  }
};

/**
 * Run a one-shot prompt. Uses streaming when the underlying instance supports
 * it, falling back to one-shot otherwise. Returns `{ output: null }` when the
 * input is empty. Throws `PromptUnavailableError` when the API isn't present.
 *
 * For chat-shaped apps where turns need to remember each other, prefer
 * `createSession()` (or `useSession()` in React). `ask()` may keep a warm
 * base session for same-shape calls, but each prompt runs on a fresh clone
 * when the browser supports `clone()`, or on a fresh one-shot instance
 * otherwise.
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

  assertValidSamplingOptions(options);

  const langHints = buildLangHints(
    options.language,
    options.supportedLanguages,
  );
  const [languageHintedInput] = options.expectedInputs
    ? []
    : (langHints.expectedInputs?.[0]?.languages ?? []);
  const [languageHintedOutput] = options.expectedOutputs
    ? []
    : (langHints.expectedOutputs?.[0]?.languages ?? []);
  // Mirror buildLangHints() exactly: supportedLanguages are intentionally not
  // normalized in the cache key unless they produce runtime language hints.
  const effectiveLanguageHint = languageHintedInput ?? languageHintedOutput;
  const cache = resolveCache(options.cache);
  const cacheKey =
    options.cacheKey ??
    defaultCacheKey({
      prompt: options.input,
      systemPrompt: options.systemPrompt,
      samplingMode: options.samplingMode,
      temperature: options.temperature,
      topK: options.topK,
      language: effectiveLanguageHint,
      languageHints: effectiveLanguageHint ? true : undefined,
      expectedInputs: options.expectedInputs,
      expectedOutputs: options.expectedOutputs,
      tools: options.tools,
      responseConstraint: options.responseConstraint,
      omitResponseConstraintInput: options.omitResponseConstraintInput,
    });
  if (cache) {
    const cached = cache.get(cacheKey);
    if (cached) return { output: cached, cached: true };
  }

  const initialPrompts: LanguageModelMessage[] = options.systemPrompt
    ? [{ role: "system", content: options.systemPrompt }]
    : [];

  const baseCreateOptions: LanguageModelCreateOptions = {
    ...(initialPrompts.length > 0 ? { initialPrompts } : {}),
    ...(options.samplingMode !== undefined
      ? { samplingMode: options.samplingMode }
      : {}),
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

  const promptOpts: LanguageModelPromptOptions = {};
  if (options.signal) promptOpts.signal = options.signal;
  if (options.responseConstraint) {
    promptOpts.responseConstraint = options.responseConstraint;
    // The native call throws a TypeError when omitResponseConstraintInput is
    // set without a responseConstraint, so only forward it alongside one.
    if (options.omitResponseConstraintInput)
      promptOpts.omitResponseConstraintInput = true;
  }

  let session: LanguageModelInstance | null = null;
  try {
    if (isLanguageModelCloneUnavailable(baseCreateOptions)) {
      session = await createOneShotLanguageModel(api, baseCreateOptions);
    } else {
      const baseSessionPromise = getOrCreateLanguageModel(
        api,
        baseCreateOptions,
      );

      // Wrap session-create failures with context so consumers can branch on
      // a single typed error instead of parsing browser-specific messages.
      let baseSession: LanguageModelInstance;
      try {
        baseSession = await baseSessionPromise;
      } catch (err) {
        if (err instanceof PromptAbortError) throw err;
        throw wrapCreateError(err);
      }
      if (options.signal?.aborted) throw new PromptAbortError();

      if (typeof baseSession.clone !== "function") {
        markLanguageModelCloneUnavailable(baseCreateOptions);
        dropCachedLanguageModel(baseCreateOptions);
        destroyFallbackBaseOnce(baseSession);
        session = await createOneShotLanguageModel(api, baseCreateOptions);
      } else {
        session = await baseSession.clone(
          options.signal ? { signal: options.signal } : undefined,
        );
      }
    }
    if (options.signal?.aborted) throw new PromptAbortError();

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

    const cleaned = cleanResponse(finalText);
    if (cleaned && cache) cache.set(cacheKey, cleaned);
    return { output: cleaned || null, cached: false };
  } catch (err) {
    if ((err as { name?: string })?.name === "AbortError") {
      throw new PromptAbortError();
    }
    throw err;
  } finally {
    try {
      session?.destroy?.();
    } catch {
      // best-effort; native destroy is optional and should not mask prompt result.
    }
  }
};
