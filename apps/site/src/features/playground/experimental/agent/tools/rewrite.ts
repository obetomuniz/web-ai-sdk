import {
  checkAvailability,
  prepareRewriter,
  type RewriteResult,
  rewrite,
} from "@web-ai-sdk/rewriter";
import { z } from "zod";
import type { AgentTool } from "../types.js";
import { parseToolInput, withAliases } from "./input.js";
import {
  downloadModel,
  runTextOperation,
  type TextOperation,
} from "./lifecycle.js";

// Optional style hints fall back to defaults; on-device planners misspell them.
const schema = z.object({
  text: z
    .string()
    .min(1)
    .refine((value) => Boolean(value.trim())),
  context: z.string().optional().catch(undefined),
  tone: z
    .enum(["as-is", "more-formal", "more-casual"])
    .default("as-is")
    .catch("as-is"),
  length: z
    .enum(["as-is", "shorter", "longer"])
    .default("as-is")
    .catch("as-is"),
});

export const rewriteTool: AgentTool<z.input<typeof schema>, RewriteResult> = {
  name: "rewrite_text",
  description:
    "Revise text the user supplied with the browser's built-in Rewriter. Use when the user asks to rewrite, rephrase, or make text more formal, more casual, shorter, or longer. Required input field: `text` (copied exactly). Optional: `tone` (`as-is`, `more-formal`, `more-casual`), `length` (`as-is`, `shorter`, `longer`), `context`.",
  readOnly: true,
  returnDirect: true,
  inputSchema: z.toJSONSchema(schema, {
    io: "input",
  }) as AgentTool["inputSchema"],
  async execute(input, ctx) {
    return runTextOperation(ctx, operation(input, ctx.signal));
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
): TextOperation<RewriteResult> {
  const { text, context, tone, length } = parseToolInput(
    "rewrite_text",
    schema,
    withAliases(input, {
      tone: { formal: "more-formal", casual: "more-casual" },
      length: { short: "shorter", long: "longer" },
    }),
  );
  const options = { tone, length, format: "plain-text" as const };
  return {
    key: `rewrite_text:${JSON.stringify(options)}`,
    options,
    availability: () => checkAvailability(options),
    prepare: (monitor) => prepareRewriter({ ...options, monitor }),
    execute: (onUpdate, monitor) =>
      rewrite({ ...options, input: text, context, onUpdate, monitor, signal }),
  };
}
