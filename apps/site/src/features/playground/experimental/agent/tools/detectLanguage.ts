import {
  checkAvailability,
  detect,
  prepareLanguageDetector,
} from "@web-ai-sdk/detector";
import { z } from "zod";
import type { AgentTool } from "../types.js";
import { runPrepared } from "./lifecycle.js";
import {
  asToolArgs,
  coerceInteger,
  parseToolInput,
  textInput,
  toolSchema,
} from "./textSchemas.js";

const inputSchema = z.strictObject({
  text: textInput,
  topK: z.number().int().min(1).max(20).default(3),
});
export const detectLanguageTool: AgentTool = {
  name: "detect_language",
  description:
    "Detect a text's language with Language Detector. Supply text and optional topK (1 to 20, default 3). Returns ranked language candidates and confidence scores.",
  capability: "Language Detector",
  readOnly: true,
  inputSchema: toolSchema(inputSchema),
  async execute(input, ctx) {
    const raw = asToolArgs(input);
    const { text, topK } = parseToolInput(inputSchema, {
      ...raw,
      topK: coerceInteger(raw.topK),
    });
    return runPrepared(
      ctx,
      () => checkAvailability(),
      (monitor) => prepareLanguageDetector({ monitor }),
      async () => {
        const result = await detect({ input: text, signal: ctx.signal });
        if (!result.output?.all.length)
          throw new Error("Language Detector returned no language candidates.");
        return {
          candidates:
            result.output?.all.slice(0, topK).map((candidate) => ({
              language: candidate.detectedLanguage,
              confidence: candidate.confidence,
            })) ?? [],
          cached: result.cached,
        };
      },
    );
  },
};
