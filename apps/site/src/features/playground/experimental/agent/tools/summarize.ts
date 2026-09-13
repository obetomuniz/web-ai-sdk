import {
  checkAvailability,
  prepareSummarizer,
  summarize,
} from "@web-ai-sdk/summarizer";
import { z } from "zod";
import { summarizeTextHasKnownSource } from "../summarizeProvenance.js";
import type { AgentTool } from "../types.js";
import { requireTextResult, runPrepared } from "./lifecycle.js";
import { textInput, toolSchema } from "./textSchemas.js";

const inputSchema = z.strictObject({
  text: textInput,
  type: z.enum(["tldr", "key-points", "headline"]).default("tldr"),
  length: z.enum(["short", "medium", "long"]).default("short"),
});
export const summarizeTool: AgentTool = {
  name: "summarize_text",
  description:
    "Condense existing text with Summarizer. Copy text from the user's message or a successful fetch_url result. Never summarize invented source text. Options: type (tldr, key-points, headline), length (short, medium, long). Reports unavailable and operational errors explicitly.",
  capability: "Summarizer",
  readOnly: true,
  acceptCall(input, ctx) {
    return (
      typeof input.text !== "string" ||
      summarizeTextHasKnownSource(input.text, ctx.userInput, ctx.fetchedSources)
    );
  },
  returnDirect: true,
  inputSchema: toolSchema(inputSchema),
  async execute(input, ctx) {
    const { text, ...options } = inputSchema.parse(input);
    const config = {
      ...options,
      language: "en",
      format: "plain-text" as const,
    };
    const availabilityOptions = {
      ...options,
      format: config.format,
      preference: "auto" as const,
      expectedInputLanguages: ["en"],
      expectedContextLanguages: ["en"],
      outputLanguage: "en",
    };
    return runPrepared(
      ctx,
      () => checkAvailability(availabilityOptions),
      (monitor) => prepareSummarizer({ ...config, monitor }),
      async () => {
        const result = await summarize({
          ...config,
          input: text,
          signal: ctx.signal,
        });
        return {
          summary: requireTextResult(result.output, "Summarizer"),
          cached: result.cached,
        };
      },
    );
  },
};
