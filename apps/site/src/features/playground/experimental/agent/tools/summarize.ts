/**
 * `summarize_text` tool: wraps `@web-ai-sdk/summarizer`. Demonstrates how
 * the agent can compose multiple Built-in Web AI APIs through the SDK -
 * the planner (Prompt API) decides when a long piece of text needs to be
 * condensed and dispatches to the Summarizer model on the device.
 */

import {
  isAvailable as isSummarizerAvailable,
  summarize,
} from "@web-ai-sdk/summarizer";
import type { AgentRunContext } from "../runContext.js";
import { summarizeTextHasKnownSource } from "../summarizeProvenance.js";
import type { AgentTool } from "../types.js";

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

/** True when the tool ran but produced no summary (unavailable / race). */
export function isEmptySummarizeOutput(output: unknown): boolean {
  if (!output || typeof output !== "object") return true;
  return !(output as SummarizeOutput).summary?.trim();
}

export const summarizeTool: AgentTool<SummarizeInput, SummarizeOutput> = {
  name: "summarize_text",
  description:
    "Condense EXISTING text into a shorter form with the browser's built-in Summarizer (on-device). The `text` argument MUST be copied from text the user pasted in their message or from a successful fetch_url result in this conversation - never text you just generated. Use when the user wants a shorter form or key points from that source. Do NOT use to write, generate, compose, draft, or expand new content; produce that yourself with no tool. Returns an empty summary if the API is unavailable.",
  readOnly: true,
  acceptCall(input: Record<string, unknown>, ctx: AgentRunContext): boolean {
    if (!isSummarizerAvailable()) return false;
    return summarizeTextHasKnownSource(
      String(input.text ?? ""),
      ctx.userInput,
      ctx.fetchedSources,
    );
  },
  // When the summarizer returns text, finish with that summary only (no second
  // model paraphrase). If it returns empty (unavailable), the loop continues
  // so the planner can summarize in prose. Misroutes are blocked by acceptCall.
  returnDirectIf(_input, output) {
    const summary = (output as SummarizeOutput)?.summary?.trim();
    return summary.length > 0;
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
  async execute({ text, type = "tldr", length = "short" }, { signal }) {
    if (!isSummarizerAvailable()) {
      return { summary: "", cached: false };
    }
    try {
      const result = await summarize({
        input: text,
        type,
        length,
        language: "en",
        format: "plain-text",
        signal,
      });
      return { summary: result.output ?? "", cached: result.cached };
    } catch {
      // `isAvailable()` can be true while a later call fails (warm-up race).
      // Never surface SDK errors as tool failures - same as unavailable.
      return { summary: "", cached: false };
    }
  },
};
