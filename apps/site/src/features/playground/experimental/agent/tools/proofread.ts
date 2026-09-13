import {
  checkAvailability,
  prepareProofreader,
  proofread,
} from "@web-ai-sdk/proofreader";
import { z } from "zod";
import type { AgentTool } from "../types.js";
import { requireTextResult, runPrepared } from "./lifecycle.js";
import { languageInput, textInput, toolSchema } from "./textSchemas.js";

const inputSchema = z.strictObject({
  text: textInput,
  expectedInputLanguages: z.array(languageInput).min(1).optional(),
});

export const proofreadTool: AgentTool = {
  name: "proofread_text",
  description:
    "Check spelling and grammar with the Proofreader API. Supply exact original text and optional expectedInputLanguages. Returns correctedInput and corrections with original-text offsets and optional metadata. Never applies edits automatically.",
  capability: "Proofreader",
  readOnly: true,
  returnDirect: true,
  inputSchema: toolSchema(inputSchema),
  async execute(input, ctx) {
    const { text, ...config } = inputSchema.parse(input);
    return runPrepared(
      ctx,
      () => checkAvailability(config),
      (monitor) => prepareProofreader({ ...config, monitor }),
      async () => {
        const result = await proofread({
          ...config,
          input: text,
          signal: ctx.signal,
        });
        return {
          original: text,
          checkedText: text.trim(),
          ...result.output,
          correctedInput: requireTextResult(
            result.output?.correctedInput,
            "Proofreader",
          ),
          cached: result.cached,
        };
      },
    );
  },
};
