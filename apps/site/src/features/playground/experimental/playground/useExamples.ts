/**
 * `useExamples` - per-preset example prompt generator.
 *
 * Default behavior: the preset's hardcoded `examples` array shows up
 * instantly (zero model cost). Clicking the "↻ new examples" chip
 * fires one constrained `ask()` against `@web-ai-sdk/prompt` and
 * replaces the chips with model-generated suggestions.
 *
 * Why `ask()` and not the agent's session: example generation is a
 * stateless single-shot, exactly the shape `ask()` was built for. The
 * SDK keeps a warm `LanguageModel` instance under the hood so repeated
 * regenerations are sub-second after the first.
 *
 * Why `responseConstraint`: the model returns a JSON object matching a
 * tiny schema (`{ examples: string[] }`) so we don't need to parse free
 * text. Same trick the agent's planner uses, scaled down to "one
 * structured field".
 *
 * Cache: per-preset, sessionStorage-backed. Survives navigation within
 * the tab, clears when the tab closes. Hardcoded examples are the
 * fallback if generation fails or the API is unavailable.
 */

import { ask, isAvailable as isPromptAvailable } from "@web-ai-sdk/prompt";
import { useCallback, useEffect, useState } from "react";
import type { AgentPreset } from "./presets.js";

interface UseExamplesReturn {
  examples: string[];
  regenerate: () => Promise<void>;
  generating: boolean;
  error: Error | null;
  canRegenerate: boolean;
}

const STORAGE_PREFIX = "agent-playground:examples:";
const MAX_EXAMPLES = 3;

const SCHEMA = {
  type: "object",
  properties: {
    examples: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["examples"],
  additionalProperties: false,
} as const;

export function useExamples(preset: AgentPreset): UseExamplesReturn {
  const [examples, setExamples] = useState<string[]>(preset.examples);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Load cached examples whenever the preset switches; fall back to the
  // hardcoded list. We deliberately don't trigger generation on switch -
  // that's an opt-in action.
  useEffect(() => {
    setError(null);
    if (preset.regenerateExamples === false) {
      setExamples(preset.examples);
      return;
    }
    try {
      const cached = sessionStorage.getItem(STORAGE_PREFIX + preset.id);
      if (cached) {
        const parsed = JSON.parse(cached) as unknown;
        if (
          Array.isArray(parsed) &&
          parsed.every((s) => typeof s === "string") &&
          parsed.length > 0
        ) {
          setExamples(parsed);
          return;
        }
      }
    } catch {
      // ignore storage errors / corrupted entries
    }
    setExamples(preset.examples);
  }, [preset.id, preset.examples, preset.regenerateExamples]);

  const canRegenerate =
    preset.regenerateExamples !== false && isPromptAvailable();

  const regenerate = useCallback(async () => {
    if (!canRegenerate || generating) return;
    setGenerating(true);
    setError(null);

    const toolCatalog =
      preset.tools.length === 0
        ? "no tools (the agent answers in pure natural language)"
        : preset.tools
            .map((t) => `- \`${t.name}\`: ${t.description}`)
            .join("\n");

    const promptInput = [
      `You are designing demo prompts for an on-device AI agent. The agent's persona is:\n"""${preset.systemPrompt}"""`,
      `The agent has these tools available:\n${toolCatalog}`,
      preset.a2ui?.enabled
        ? `Generate ${MAX_EXAMPLES} short example user prompts (one sentence each, under 100 characters) for this generative-UI agent. Prefer dashboards, bar charts, KPI cards, and welcome screens - NOT forms or random input fields. One example may be plain-text Q&A with no UI. Do not number them. Do not add explanations.`
        : `Generate ${MAX_EXAMPLES} short, concrete example user prompts (one sentence each, under 100 characters) that would showcase what this agent can do. Each example should naturally need one or two of the available tools (or none, if no tools are present). Vary the topic across examples. Do not number them. Do not add explanations.`,
      `Respond with a JSON object: { "examples": ["...", "...", "..."] }.`,
    ].join("\n\n");

    try {
      const result = await ask({
        input: promptInput,
        systemPrompt:
          "You generate JSON exactly matching the requested schema. Never write prose outside the JSON envelope. Never wrap the JSON in markdown fences.",
        samplingMode: "most-creative",
        responseConstraint: SCHEMA,
      });
      if (!result.output) throw new Error("Empty response from model.");

      const parsed = JSON.parse(result.output) as unknown;
      if (
        !parsed ||
        typeof parsed !== "object" ||
        !Array.isArray((parsed as { examples?: unknown }).examples)
      ) {
        throw new Error("Generated response missing `examples` array.");
      }

      const fresh = (parsed as { examples: unknown[] }).examples
        .filter(
          (s): s is string => typeof s === "string" && s.trim().length > 0,
        )
        .slice(0, MAX_EXAMPLES);

      if (fresh.length === 0) {
        throw new Error("Generated response contained no usable examples.");
      }

      setExamples(fresh);
      try {
        sessionStorage.setItem(
          STORAGE_PREFIX + preset.id,
          JSON.stringify(fresh),
        );
      } catch {
        // ignore quota / disabled storage
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      // Fall back to hardcoded examples so the UI never ends up empty.
      setExamples(preset.examples);
    } finally {
      setGenerating(false);
    }
  }, [preset, canRegenerate, generating]);

  return {
    examples,
    regenerate,
    generating,
    error,
    canRegenerate,
  };
}
