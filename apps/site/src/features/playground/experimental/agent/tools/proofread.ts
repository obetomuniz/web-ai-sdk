import {
  checkAvailability,
  prepareProofreader,
  proofread,
} from "@web-ai-sdk/proofreader";
import { z } from "zod";
import type { AgentTool } from "../types.js";
import { requireTextResult, runPrepared } from "./lifecycle.js";
import {
  asToolArgs,
  coerceLanguageList,
  languageInput,
  parseToolInput,
  textInput,
  toolSchema,
} from "./textSchemas.js";

const inputSchema = z.strictObject({
  text: textInput,
  expectedInputLanguages: z.array(languageInput).min(1).optional(),
});

export const proofreadTool: AgentTool = {
  name: "proofread_text",
  description:
    'Check spelling and grammar with the Proofreader API. Required: text copied exactly from the user. Optional: expectedInputLanguages as a BCP-47 list such as ["en"]. Returns correctedInput and corrections. Never apply edits automatically.',
  capability: "Proofreader",
  readOnly: true,
  returnDirect: true,
  inputSchema: toolSchema(inputSchema),
  async execute(input, ctx) {
    const raw = asToolArgs(input);
    const { text, ...config } = parseToolInput(inputSchema, {
      ...raw,
      expectedInputLanguages: coerceLanguageList(raw.expectedInputLanguages),
    });
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
