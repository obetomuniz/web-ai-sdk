/**
 * `summarize_text` tool: wraps `@web-ai-sdk/summarizer`. Demonstrates how
 * the agent can compose multiple Built-in Web AI APIs through the SDK -
 * the planner (Prompt API) decides when a long piece of text needs to be
 * condensed and dispatches to the Summarizer model on the device.
 */

import {
  checkAvailability,
  prepareSummarizer,
  summarize,
} from "@web-ai-sdk/summarizer";
import { z } from "zod";
import type { AgentRunContext } from "../runContext.js";
import { summarizeTextHasKnownSource } from "../summarizeProvenance.js";
import type { AgentTool } from "../types.js";
import { parseToolInput, withAliases } from "./input.js";
import {
  downloadModel,
  runTextOperation,
  type TextOperation,
} from "./lifecycle.js";

// Optional style hints fall back to defaults; on-device planners misspell them.
const inputSchema = z.object({
  text: z
    .string()
    .min(1)
    .refine((value) => Boolean(value.trim())),
  type: z.enum(["tldr", "key-points", "headline"]).optional().catch(undefined),
  length: z.enum(["short", "medium", "long"]).optional().catch(undefined),
});

interface SummarizeInput {
  text: string;
  /** "tldr" (paragraph) | "key-points" (list) | "headline" (one line). */
  type?: "tldr" | "key-points" | "headline";
  /** "short" | "medium" | "long". */
  length?: "short" | "medium" | "long";
}

interface SummarizeOutput {
  summary: string;
  cached: boolean;
}

export const summarizeTool: AgentTool<SummarizeInput, SummarizeOutput> = {
  name: "summarize_text",
  description:
    "Condense EXISTING text into a shorter form with the browser's built-in Summarizer (on-device). The `text` argument MUST be copied from text the user pasted in their message or from a successful fetch_url result in this conversation - never text you just generated. Use when the user wants a shorter form or key points from that source. Do NOT use to write, generate, compose, draft, or expand new content; use `write_text` for that when available, otherwise produce it yourself with no tool.",
  readOnly: true,
  acceptCall(input: Record<string, unknown>, ctx: AgentRunContext): boolean {
    if (typeof input.text !== "string" || !input.text.trim()) return true;
    return summarizeTextHasKnownSource(
      String(input.text ?? ""),
      ctx.userInput,
      ctx.fetchedSources,
    );
  },
  // Return successful summaries without another model paraphrase.
  returnDirectIf(_input, output) {
    const summary = (output as SummarizeOutput)?.summary?.trim();
    return Boolean(summary?.length);
  },
  inputSchema: {
    type: "object",
    properties: {
      text: { type: "string" },
      type: { type: "string", enum: ["tldr", "key-points", "headline"] },
      length: { type: "string", enum: ["short", "medium", "long"] },
    },
    required: ["text"],
    additionalProperties: false,
  },
  async execute(input, ctx) {
    const result = await runTextOperation(ctx, operation(input, ctx.signal));
    return { summary: result.output ?? "", cached: result.cached };
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
): TextOperation<Awaited<ReturnType<typeof summarize>>> {
  const {
    text,
    type = "tldr",
    length = "short",
  } = parseToolInput(
    "summarize_text",
    inputSchema,
    withAliases(input, {
      type: {
        summary: "tldr",
        "tl;dr": "tldr",
        keyphrases: "key-points",
        "key points": "key-points",
        bullets: "key-points",
        title: "headline",
      },
      length: {},
    }),
  );
  const options = {
    type,
    length,
    language: "en",
    format: "plain-text" as const,
  };
  return {
    key: `summarize_text:${JSON.stringify(options)}`,
    options,
    availability: () =>
      checkAvailability({
        type,
        length,
        format: "plain-text",
        preference: "auto",
        expectedInputLanguages: ["en"],
        expectedContextLanguages: ["en"],
        outputLanguage: "en",
      }),
    prepare: (monitor) => prepareSummarizer({ ...options, monitor }),
    execute: (onUpdate, monitor) =>
      summarize({ ...options, input: text, onUpdate, monitor, signal }),
  };
}
