import { checkAvailability, prepareWriter, write } from "@web-ai-sdk/writer";
import { z } from "zod";
import type { AgentTool } from "../types.js";
import { requireTextResult, runPrepared } from "./lifecycle.js";
import { textInput, toolSchema } from "./textSchemas.js";

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
    "Draft new text with the Writer API. Supply task, optional context, tone (formal, neutral, casual), format, and length (short, medium, long).",
  capability: "Writer",
  readOnly: true,
  returnDirect: true,
  inputSchema: toolSchema(inputSchema),
  async execute(input, ctx) {
    const { task, context, ...config } = inputSchema.parse(input);
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
