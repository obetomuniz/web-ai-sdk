/**
 * `detect_language` tool: wraps `@web-ai-sdk/detector`. Returns the
 * top-N BCP-47 candidates with confidence scores so the planner can
 * pair it with the Translator tool in a single agent run.
 *
 * History: previously bound `window.LanguageDetector` inline because
 * the SDK package wasn't on the dependency list. That direct binding
 * is gone - the SDK ships the same feature-detect, typed-error,
 * abort-aware shape every other tool in this folder uses.
 */

import {
  DetectorUnavailableError,
  isAvailable as isDetectorAvailable,
  detect as sdkDetect,
} from "@web-ai-sdk/detector";
import type { AgentTool } from "../types.js";

interface DetectInput {
  text: string;
  /** Maximum number of candidates to return. Default 3. */
  topK?: number;
}

interface DetectOutput {
  candidates: Array<{ language: string; confidence: number }>;
  cached?: boolean;
  unavailable?: boolean;
  error?: string;
}

export const detectLanguageTool: AgentTool<DetectInput, DetectOutput> = {
  name: "detect_language",
  description:
    "Detect the language(s) of a snippet of text using the browser's built-in Language Detector. Required input field: `text` (string). Optional: `topK` (number, default 3). Returns up to `topK` BCP-47 candidates with confidence scores. Pair with `translate_text` when the user's text isn't in the target language.",
  readOnly: true,
  inputSchema: {
    type: "object",
    properties: {
      text: { type: "string" },
      topK: { type: "number" },
    },
    required: ["text"],
    additionalProperties: false,
  },
  async execute({ text, topK = 3 }, { signal }) {
    if (typeof text !== "string" || !text.trim()) {
      return {
        candidates: [],
        error: "Missing required `text` (non-empty string).",
      };
    }
    if (!isDetectorAvailable()) {
      return { candidates: [], unavailable: true };
    }
    try {
      const result = await sdkDetect({ input: text, signal });
      if (!result.output) {
        return { candidates: [], cached: result.cached };
      }
      const top = result.output.all.slice(0, Math.max(1, topK)).map((c) => ({
        language: c.detectedLanguage,
        confidence: c.confidence,
      }));
      return { candidates: top, cached: result.cached };
    } catch (err) {
      if (err instanceof DetectorUnavailableError) {
        return { candidates: [], unavailable: true };
      }
      throw err;
    }
  },
};
