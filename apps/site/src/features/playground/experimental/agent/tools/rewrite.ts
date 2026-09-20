import {
  checkAvailability,
  prepareRewriter,
  rewrite,
} from "@web-ai-sdk/rewriter";
import { z } from "zod";
import type { AgentTool } from "../types.js";
import { requireTextResult, runPrepared } from "./lifecycle.js";
import {
  asToolArgs,
  coerceOption,
  parseToolInput,
  textInput,
  toolSchema,
} from "./textSchemas.js";

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
    "Revise supplied text with the Rewriter API. Required: text copied exactly from the user. Optional: context; tone (as-is, more-formal, more-casual); format (as-is, markdown, plain-text); length (as-is, shorter, longer). Omit optional fields unless the user asks for them.",
  capability: "Rewriter",
  readOnly: true,
  returnDirect: true,
  inputSchema: toolSchema(inputSchema),
  async execute(input, ctx) {
    const raw = asToolArgs(input);
    const { text, context, ...config } = parseToolInput(inputSchema, {
      ...raw,
      tone: coerceOption(
        raw.tone,
        ["as-is", "more-formal", "more-casual"],
        { formal: "more-formal", casual: "more-casual", unchanged: "as-is" },
        "as-is",
      ),
      format: coerceOption(
        raw.format,
        ["as-is", "markdown", "plain-text"],
        {
          md: "markdown",
          plaintext: "plain-text",
          text: "plain-text",
          unchanged: "as-is",
        },
        "as-is",
      ),
      length: coerceOption(
        raw.length,
        ["as-is", "shorter", "longer"],
        { short: "shorter", long: "longer", unchanged: "as-is" },
        "as-is",
      ),
    });
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
