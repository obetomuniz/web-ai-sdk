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
  checkAvailability,
  detect,
  prepareLanguageDetector,
} from "@web-ai-sdk/detector";
import { z } from "zod";
import type { AgentTool } from "../types.js";
import { parseToolInput } from "./input.js";
import {
  downloadModel,
  runTextOperation,
  type TextOperation,
} from "./lifecycle.js";

const schema = z.object({
  text: z
    .string()
    .min(1)
    .refine((value) => Boolean(value.trim())),
  topK: z.number().int().min(1).max(10).default(3).catch(3),
});

export const detectLanguageTool: AgentTool<
  z.input<typeof schema>,
  {
    candidates: Array<{ language: string; confidence: number }>;
    cached: boolean;
  }
> = {
  name: "detect_language",
  description:
    "Detect the language(s) of a snippet of text using the browser's built-in Language Detector. Required input field: `text` (string). Optional: `topK` (number, default 3). Returns up to `topK` BCP-47 candidates with confidence scores. Pair with `translate_text` when the user's text isn't in the target language.",
  readOnly: true,
  inputSchema: z.toJSONSchema(schema, {
    io: "input",
  }) as AgentTool["inputSchema"],
  async execute(input, ctx) {
    const { topK } = parseToolInput("detect_language", schema, input);
    const result = await runTextOperation(ctx, operation(input, ctx.signal));
    return {
      candidates: (result.output?.all ?? [])
        .slice(0, topK)
        .map((candidate) => ({
          language: candidate.detectedLanguage,
          confidence: candidate.confidence,
        })),
      cached: result.cached,
    };
  },
  async download(input, onProgress) {
    return downloadModel(operation(input).prepare, onProgress);
  },
  async availability(input) {
    return operation(input).availability();
  },
};

function operation(
  input: unknown,
  signal?: AbortSignal,
): TextOperation<Awaited<ReturnType<typeof detect>>> {
  const { text } = parseToolInput("detect_language", schema, input);
  return {
    key: "detect_language",
    options: {},
    availability: () => checkAvailability(),
    prepare: (monitor) => prepareLanguageDetector({ monitor }),
    execute: (_onUpdate, monitor) => detect({ input: text, monitor, signal }),
  };
}
