import {
  checkAvailability,
  prepareTranslator,
  translate,
} from "@web-ai-sdk/translator";
import { z } from "zod";
import type { AgentTool } from "../types.js";
import { requireTextResult, runPrepared } from "./lifecycle.js";
import {
  languageInput,
  parseToolInput,
  textInput,
  toolSchema,
} from "./textSchemas.js";

const inputSchema = z.strictObject({
  text: textInput,
  sourceLanguage: languageInput,
  targetLanguage: languageInput,
});
export const translateTool: AgentTool = {
  name: "translate_text",
  description:
    "Translate text with the Translator API. Required fields: text, sourceLanguage, targetLanguage (BCP-47 codes). Do not use from/to. Checks the actual language pair and reports failures explicitly.",
  capability: "Translator",
  readOnly: true,
  inputSchema: toolSchema(inputSchema),
  async execute(input, ctx) {
    const parsed = parseToolInput(inputSchema, input);
    const { text } = parsed;
    // Match the SDK's primary-subtag normalization for both probing and creation.
    const config = {
      sourceLanguage:
        parsed.sourceLanguage.split("-")[0]?.toLowerCase() ??
        parsed.sourceLanguage.toLowerCase(),
      targetLanguage:
        parsed.targetLanguage.split("-")[0]?.toLowerCase() ??
        parsed.targetLanguage.toLowerCase(),
    };
    if (config.sourceLanguage === config.targetLanguage) {
      await translate({ ...config, input: text, signal: ctx.signal });
      return { translation: text, cached: false, unchanged: true };
    }
    return runPrepared(
      ctx,
      () => checkAvailability(config),
      (monitor) => prepareTranslator({ ...config, monitor }),
      async () => {
        const result = await translate({
          ...config,
          input: text,
          signal: ctx.signal,
        });
        return {
          translation: requireTextResult(result.output, "Translator"),
          cached: result.cached,
        };
      },
    );
  },
};
