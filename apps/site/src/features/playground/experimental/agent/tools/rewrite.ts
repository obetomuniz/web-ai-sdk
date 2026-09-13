import {
  checkAvailability,
  prepareRewriter,
  rewrite,
} from "@web-ai-sdk/rewriter";
import { z } from "zod";
import type { AgentTool } from "../types.js";
import { requireTextResult, runPrepared } from "./lifecycle.js";
import { textInput, toolSchema } from "./textSchemas.js";

const inputSchema = z.strictObject({
  text: textInput,
  context: z.string().optional(),
  tone: z.enum(["as-is", "more-formal", "more-casual"]).default("as-is"),
  format: z.enum(["as-is", "markdown", "plain-text"]).default("as-is"),
  length: z.enum(["as-is", "shorter", "longer"]).default("as-is"),
});

export const rewriteTool: AgentTool = {
  name: "rewrite_text",
  description:
    "Revise supplied text with the Rewriter API. Preserve the original text in the text argument. Options: context, tone (as-is, more-formal, more-casual), format, length (as-is, shorter, longer).",
  capability: "Rewriter",
  readOnly: true,
  returnDirect: true,
  inputSchema: toolSchema(inputSchema),
  async execute(input, ctx) {
    const { text, context, ...config } = inputSchema.parse(input);
    return runPrepared(
      ctx,
      () => checkAvailability(config),
      (monitor) => prepareRewriter({ ...config, monitor }),
      async () => {
        const result = await rewrite({
          ...config,
          input: text,
          context,
          signal: ctx.signal,
          onUpdate: (output) => ctx.emit({ phase: "output", text: output }),
        });
        return {
          original: text,
          text: requireTextResult(result.output, "Rewriter"),
          cached: result.cached,
        };
      },
    );
  },
};
