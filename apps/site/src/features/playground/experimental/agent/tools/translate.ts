/**
 * `translate_text` tool: wraps `@web-ai-sdk/translator`. Demonstrates
 * how a single agent run composes Prompt + Translator (both Built-in
 * Web AI APIs) through the SDK rather than reaching for
 * `window.Translator` directly.
 *
 * History: this file previously bound `window.Translator` inline
 * because the SDK package wasn't on the dependency list. That direct
 * binding is gone - the SDK ships the same feature-detect, typed-error,
 * abort-aware shape every other tool in this folder relies on.
 */

import {
  checkAvailability,
  prepareTranslator,
  translate,
} from "@web-ai-sdk/translator";
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
  sourceLanguage: z.string().trim().min(1),
  targetLanguage: z.string().trim().min(1),
});

export const translateTool: AgentTool<
  z.input<typeof schema>,
  { translation: string; cached: boolean }
> = {
  name: "translate_text",
  description:
    "Translate text using the browser's built-in Translator. Required input fields: `text` (string), `sourceLanguage` and `targetLanguage` (BCP-47 codes like `en`, `pt`, `ja`). Do NOT use `from`/`to` - those names don't exist on this tool. Returns `{ translation }`.",
  readOnly: true,
  // A translation request needs a Translator result; prose from the planner
  // would present Prompt output as a translation.
  requiredCallIf(ctx) {
    return /\btranslate\b/i.test(ctx.userInput);
  },
  inputSchema: z.toJSONSchema(schema, {
    io: "input",
  }) as AgentTool["inputSchema"],
  async execute(input, ctx) {
    const result = await runTextOperation(ctx, operation(input, ctx.signal));
    return { translation: result.output ?? "", cached: result.cached };
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
): TextOperation<Awaited<ReturnType<typeof translate>>> {
  const { text, sourceLanguage, targetLanguage } = parseToolInput(
    "translate_text",
    schema,
    input,
  );
  const options = { sourceLanguage, targetLanguage };
  return {
    key: `translate_text:${JSON.stringify(options)}`,
    options,
    availability: () => checkAvailability(options),
    prepare: (monitor) => prepareTranslator({ ...options, monitor }),
    execute: (_onUpdate, monitor) =>
      translate({ ...options, input: text, monitor, signal }),
  };
}
