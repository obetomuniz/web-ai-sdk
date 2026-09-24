import {
  checkAvailability,
  type ProofreadResult,
  prepareProofreader,
  proofread,
} from "@web-ai-sdk/proofreader";
import { z } from "zod";
import type { AgentTool } from "../types.js";
import { parseToolInput } from "./input.js";
import {
  downloadModel,
  runTextOperation,
  type TextOperation,
} from "./lifecycle.js";

const schema = z.object({
  text: z
    .string()
    .min(1)
    .refine((value) => Boolean(value.trim())),
  // Planners often send one language as a string; malformed hints are dropped.
  expectedInputLanguages: z
    .union([
      z
        .string()
        .min(1)
        .transform((language) => [language]),
      z.array(z.string().min(1)).min(1),
    ])
    .optional()
    .catch(undefined),
});

export const proofreadTool: AgentTool<
  z.input<typeof schema>,
  ProofreadResult
> = {
  name: "proofread_text",
  description:
    "Check and correct spelling and grammar with the browser's built-in Proofreader. Use when the user asks to proofread, fix typos, or check grammar or spelling. Required input field: `text` (copied exactly). Returns the corrected text and each correction.",
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
): TextOperation<ProofreadResult> {
  const { text, expectedInputLanguages } = parseToolInput(
    "proofread_text",
    schema,
    input,
  );
  const options = { expectedInputLanguages };
  return {
    key: `proofread_text:${JSON.stringify(options)}`,
    options,
    availability: () => checkAvailability(options),
    prepare: (monitor) => prepareProofreader({ ...options, monitor }),
    execute: (_onUpdate, monitor) =>
      proofread({ ...options, input: text, monitor, signal }),
  };
}
