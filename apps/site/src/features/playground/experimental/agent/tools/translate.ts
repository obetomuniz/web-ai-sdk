/**
 * `translate_text` tool: wraps `@web-ai-sdk/translator`. Demonstrates
 * how a single agent run composes Prompt + Translator (both Built-in
 * Web AI APIs) through the SDK rather than reaching for
 * `window.Translator` directly.
 *
 * History: this file previously bound `window.Translator` inline
 * because the SDK package wasn't on the dependency list. That direct
 * binding is gone - the SDK ships the same feature-detect, typed-error,
 * abort-aware shape every other tool in this folder relies on.
 */

import {
  isAvailable as isTranslatorAvailable,
  translate as sdkTranslate,
  TranslatorUnavailableError,
} from "@web-ai-sdk/translator";
import type { AgentTool } from "../types.js";

interface TranslateInput {
  text: string;
  /** BCP-47, e.g. "en", "pt", "ja". */
  sourceLanguage: string;
  /** BCP-47, e.g. "en", "pt", "ja". */
  targetLanguage: string;
}

interface TranslateOutput {
  translation: string;
  cached?: boolean;
  unavailable?: boolean;
  error?: string;
}

export const translateTool: AgentTool<TranslateInput, TranslateOutput> = {
  name: "translate_text",
  description:
    "Translate text using the browser's built-in Translator. Required input fields: `text` (string), `sourceLanguage` and `targetLanguage` (BCP-47 codes like `en`, `pt`, `ja`). Do NOT use `from`/`to` - those names don't exist on this tool. Returns `{ translation }`, or `{ unavailable: true }` when the API or language pair isn't installed, or `{ error }` when arguments are malformed.",
  readOnly: true,
  inputSchema: {
    type: "object",
    properties: {
      text: { type: "string" },
      sourceLanguage: { type: "string" },
      targetLanguage: { type: "string" },
    },
    required: ["text", "sourceLanguage", "targetLanguage"],
    additionalProperties: false,
  },
  async execute({ text, sourceLanguage, targetLanguage }, { signal }) {
    // Defensive validation: the model occasionally invents field names
    // (e.g. `to`/`from`) from its translation-API priors. We surface a
    // typed error rather than passing `undefined` into the SDK, which
    // would crash inside `lang.split(...)` and look like a tool bug.
    if (typeof text !== "string" || !text.trim()) {
      return {
        translation: "",
        error: "Missing required `text` (non-empty string).",
      };
    }
    if (typeof sourceLanguage !== "string" || !sourceLanguage.trim()) {
      return {
        translation: "",
        error:
          "Missing required `sourceLanguage` (BCP-47 code like `en`, `pt`, `ja`). Do NOT use `from` - the field is `sourceLanguage`.",
      };
    }
    if (typeof targetLanguage !== "string" || !targetLanguage.trim()) {
      return {
        translation: "",
        error:
          "Missing required `targetLanguage` (BCP-47 code like `en`, `pt`, `ja`). Do NOT use `to` - the field is `targetLanguage`.",
      };
    }

    if (!isTranslatorAvailable()) {
      return { translation: "", unavailable: true };
    }
    try {
      const result = await sdkTranslate({
        input: text,
        sourceLanguage,
        targetLanguage,
        signal,
      });
      return {
        translation: result.output ?? "",
        cached: result.cached,
      };
    } catch (err) {
      if (err instanceof TranslatorUnavailableError) {
        return { translation: "", unavailable: true };
      }
      throw err;
    }
  },
};
