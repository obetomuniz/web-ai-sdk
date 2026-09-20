import { checkAvailability, prepareWriter, write } from "@web-ai-sdk/writer";
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
  task: textInput,
  context: z.string().optional(),
  tone: z.enum(["formal", "neutral", "casual"]).default("neutral"),
  format: z.enum(["markdown", "plain-text"]).default("markdown"),
  length: z.enum(["short", "medium", "long"]).default("short"),
});

export const writeTool: AgentTool = {
  name: "write_text",
  description:
    "Draft new text with the Writer API. Required: task. Optional: context; tone (formal, neutral, casual); format (markdown, plain-text); length (short, medium, long). Omit optional fields unless the user asks for them.",
  capability: "Writer",
  readOnly: true,
  returnDirect: true,
  inputSchema: toolSchema(inputSchema),
  async execute(input, ctx) {
    const raw = asToolArgs(input);
    const { task, context, ...config } = parseToolInput(inputSchema, {
      ...raw,
      tone: coerceOption(
        raw.tone,
        ["formal", "neutral", "casual"],
        { professional: "formal", informal: "casual" },
        "neutral",
      ),
      format: coerceOption(
        raw.format,
        ["markdown", "plain-text"],
        {
          md: "markdown",
          email: "plain-text",
          plaintext: "plain-text",
          text: "plain-text",
          txt: "plain-text",
        },
        "markdown",
      ),
      length: coerceOption(
        raw.length,
        ["short", "medium", "long"],
        { brief: "short", detailed: "long" },
        "short",
      ),
    });
    return runPrepared(
      ctx,
      () => checkAvailability(config),
      (monitor) => prepareWriter({ ...config, monitor }),
      async () => {
        const result = await write({
          ...config,
          input: task,
          context,
          signal: ctx.signal,
          onUpdate: (text) => ctx.emit({ phase: "output", text }),
        });
        return {
          text: requireTextResult(result.output, "Writer"),
          cached: result.cached,
        };
      },
    );
  },
};
