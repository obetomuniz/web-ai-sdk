import {
  checkAvailability,
  prepareWriter,
  type WriteResult,
  write,
} from "@web-ai-sdk/writer";
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
  task: z
    .string()
    .min(1)
    .refine((value) => Boolean(value.trim())),
  context: z.string().optional().catch(undefined),
  tone: z
    .enum(["formal", "neutral", "casual"])
    .default("neutral")
    .catch("neutral"),
  length: z.enum(["short", "medium", "long"]).default("short").catch("short"),
});

export const writeTool: AgentTool<z.input<typeof schema>, WriteResult> = {
  name: "write_text",
  description:
    "Draft NEW text with the browser's built-in Writer, such as an email, message, or short post. Use when the user asks to write or draft something. Required input field: `task` (string, the writing request). Optional: `context`, `tone`, `length`.",
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
): TextOperation<WriteResult> {
  const { task, context, tone, length } = parseToolInput(
    "write_text",
    schema,
    withAliases(input, { tone: {}, length: {} }),
  );
  const options = { tone, length, format: "plain-text" as const };
  return {
    key: `write_text:${JSON.stringify(options)}`,
    options,
    availability: () => checkAvailability(options),
    prepare: (monitor) => prepareWriter({ ...options, monitor }),
    execute: (onUpdate, monitor) =>
      write({ ...options, input: task, context, onUpdate, monitor, signal }),
  };
}
