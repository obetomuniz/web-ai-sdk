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

export {
  isPromptAvailable,
  checkAvailability,
  getLanguageModelApi,
  getOrCreateLanguageModel,
  createSessionStorageCache,
  defaultCacheKey,
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
};

export interface PromptOptions {
  /** The user-facing prompt / question. */
  prompt: string;
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
  /** Override `LanguageModel.create()` options entirely. Merged on top of defaults. */
  createOptions?: Partial<LanguageModelCreateOptions>;
  /** Optional JSON Schema for structured output. */
  responseConstraint?: object;
  /** Optional result cache. Off by default; every call hits the model. Pass `createSessionStorageCache()` or any `{ get, set }`-shaped object to enable. */
  cache?: ResponseCache;
  /** Cache key. Default: hash of `{ prompt, systemPrompt, temperature, topK }`. */
  cacheKey?: string;
  /** Streaming chunk callback. */
  onChunk?: (text: string) => void;
  /** Abort signal. */
  signal?: AbortSignal;
}

export interface PromptResult {
  /** Final response text, or `null` if the input was empty. */
  response: string | null;
  /** Whether the result came from the cache (no model call). */
  cached: boolean;
}

const NORMALIZE_LANG = (lang: string): string =>
  lang.split("-")[0]?.toLowerCase() ?? lang.toLowerCase();

const DEFAULT_SUPPORTED_LANGUAGES = ["en"] as const;

export class PromptUnavailableError extends Error {
  override readonly name = "PromptUnavailableError";
}

class PromptAbortError extends Error {
  override readonly name = "AbortError";
  constructor() {
    super("Prompt aborted");
  }
}

const buildLangHints = (
  language: string | undefined,
  supported: readonly string[] | undefined,
): {
  expectedInputs?: LanguageModelExpectedInput[];
  expectedOutputs?: LanguageModelExpectedOutput[];
} => {
  if (!language) return {};
  const lang = NORMALIZE_LANG(language);
  const set = new Set(supported ?? DEFAULT_SUPPORTED_LANGUAGES);
  if (!set.has(lang)) return {};
  return {
    expectedInputs: [{ type: "text", languages: [lang] }],
    expectedOutputs: [{ type: "text", languages: [lang] }],
  };
};

/**
 * Run a one-shot prompt. Uses streaming when the underlying instance supports
 * it, falling back to one-shot otherwise. Returns `null` when the input is
 * empty. Throws `PromptUnavailableError` when the API isn't present.
 */
export const prompt = async (options: PromptOptions): Promise<PromptResult> => {
  const api = getLanguageModelApi();
  if (!api?.create) {
    throw new PromptUnavailableError(
      "Prompt API (LanguageModel) is not available in this environment.",
    );
  }

  if (!options.prompt.trim()) {
    return { response: null, cached: false };
  }

  // Caching is opt-in. Pass a `cache` (any `{ get, set }`-shaped object,
  // e.g. `createSessionStorageCache()`) to enable response caching; omit
  // it for a fresh model call every time.
  const cache = options.cache;
  const cacheKey =
    options.cacheKey ??
    defaultCacheKey({
      prompt: options.prompt,
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
      options.prompt,
      promptOpts,
    )) {
      if (options.signal?.aborted) throw new PromptAbortError();
      // The W3C Web AI streaming contract is ambiguous between "delta"
      // (each chunk is new content) and "cumulative" (each chunk is the
      // full text so far). Chrome ships delta; some Edge backends (notably
      // Phi-Silica on Copilot+ PCs) ship cumulative. Detect per-chunk:
      // if the chunk starts with the prior buffer, treat as cumulative
      // (replace); otherwise treat as delta (append).
      buffer = chunk.startsWith(buffer) ? chunk : buffer + chunk;
      options.onChunk?.(buffer);
    }
    finalText = buffer;
  } else {
    const raw = await session.prompt(options.prompt, promptOpts);
    if (options.signal?.aborted) throw new PromptAbortError();
    finalText = raw;
    options.onChunk?.(finalText);
  }

  // Normalize the final response so consumers can rely on a clean signal:
  //
  //   1. Strip non-printing characters:
  //        - C0 control codes (U+0000\u2013U+001F) except TAB/LF/CR
  //        - DEL + C1 controls (U+007F\u2013U+009F)
  //        - Soft hyphen (U+00AD)
  //        - Zero-width / joiner / direction marks (U+200B\u2013U+200F,
  //          U+202A\u2013U+202E, U+2060\u2013U+206F)
  //        - BOM (U+FEFF)
  //      Edge's safety pipeline has been observed returning runs of
  //      `` (CANCEL) as a "soft block" placeholder instead of
  //      throwing or returning empty \u2014 these strip away here.
  //   2. Trim leading/trailing whitespace.
  //   3. If nothing meaningful remains, return `response: null` so callers
  //      can branch on "model returned nothing" without parsing strings.
  // Built via RegExp constructor to avoid lint flags for literal control
  // codes. The strip is intentional and covers Edge's CANCEL-character
  // soft-block placeholders (observed runs of U+0018 when the safety
  // pipeline suppresses output).
  const NON_PRINTING = new RegExp(
    "[" +
      "\\u0000-\\u0008" + // C0 except TAB/LF/CR
      "\\u000B\\u000C" + // VT, FF
      "\\u000E-\\u001F" + // rest of C0
      "\\u007F-\\u009F" + // DEL + C1
      "\\u00AD" + // soft hyphen
      "\\u200B-\\u200F" + // zero-width + LTR/RTL marks
      "\\u202A-\\u202E" + // bidi
      "\\u2060-\\u206F" + // word joiner + reserved
      "\\uFEFF" + // BOM
      "]",
    "g",
  );

  const cleaned = finalText.replace(NON_PRINTING, "").trim();
  if (cleaned && cache) cache.set(cacheKey, cleaned);
  return { response: cleaned || null, cached: false };
};
