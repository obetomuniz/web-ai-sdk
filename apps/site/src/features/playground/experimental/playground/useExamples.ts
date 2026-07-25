/** Generate and cache fresh example prompts for one playground mode. */

import { ask, isAvailable as isPromptAvailable } from "@web-ai-sdk/prompt";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentMode } from "./presets.js";

interface ExampleTurnContext {
  id: string;
  userInput: string;
  assistantText: string;
}

interface ExampleConversationContext {
  conversationId: string;
  turns: ExampleTurnContext[];
  suspended?: boolean;
}

interface UseExamplesReturn {
  examples: string[];
  regenerate: () => Promise<void>;
  cancel: () => void;
  generating: boolean;
  canRegenerate: boolean;
}

const STORAGE_PREFIX = "agent-playground:examples:v3:";
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

export function useExamples(
  mode: AgentMode,
  context: ExampleConversationContext,
): UseExamplesReturn {
  const [examples, setExamples] = useState<string[]>(
    mode.examples.slice(0, MAX_EXAMPLES),
  );
  const [generating, setGenerating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const generatedContextRef = useRef("");
  const modeCacheKey = STORAGE_PREFIX + mode.id;
  const examplesScope = `${mode.id}:${context.conversationId}`;
  const contextKey = context.turns.map((turn) => turn.id).join(":");
  const autoGenerationKey = `${mode.id}:${context.conversationId}:${contextKey}`;
  const conversationContext = context.turns
    .map(
      (turn) =>
        `User: ${truncateContext(turn.userInput, 400)}\nAssistant: ${truncateContext(turn.assistantText, 700)}`,
    )
    .join("\n\n");

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    requestIdRef.current += 1;
    setGenerating(false);
  }, []);

  useEffect(() => {
    cancel();
    generatedContextRef.current = `reset:${examplesScope}`;
    try {
      const cached = sessionStorage.getItem(modeCacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as unknown;
        if (
          Array.isArray(parsed) &&
          parsed.every((example) => typeof example === "string") &&
          parsed.length > 0
        ) {
          setExamples(parsed.slice(0, MAX_EXAMPLES));
          return;
        }
      }
    } catch {
      // Cached suggestions are optional.
    }
    setExamples(mode.examples.slice(0, MAX_EXAMPLES));
  }, [cancel, examplesScope, mode.examples, modeCacheKey]);

  const canRegenerate = isPromptAvailable();

  const regenerate = useCallback(async () => {
    if (!canRegenerate || generating || context.suspended) return;
    const requestId = ++requestIdRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    setGenerating(true);

    const toolCatalog =
      mode.tools.length === 0
        ? "No tools. The agent answers in natural language."
        : mode.tools
            .map(
              (tool) =>
                `- ${tool.name}. ${truncateContext(tool.description, 180)}`,
            )
            .join("\n");

    const input = [
      `Create useful next-message suggestions for an on-device AI agent.`,
      `Agent mode: ${mode.name}. ${mode.description}`,
      `Available tools:\n${toolCatalog}`,
      conversationContext
        ? `Recent conversation:\n${conversationContext}`
        : "There is no conversation history yet.",
      [
        `Generate exactly ${MAX_EXAMPLES} short next messages, each under 100 characters.`,
        "Every suggestion must have a concrete goal and be immediately useful.",
        "When history exists, make at least two suggestions direct follow-ups that verify, compare, extend, or reuse a prior result.",
        "Do not repeat completed requests or retry a resource that already failed for the same reason.",
        "For web requests, use a specific CORS-accessible API endpoint or an unambiguous resource from the conversation.",
        "Never use placeholder or root URLs such as example.com, github.com, or localhost.",
        "Do not number, explain, or label the suggestions.",
      ].join("\n"),
      `Respond with a JSON object: { "examples": ["...", "..."] }.`,
    ].join("\n\n");

    try {
      const result = await ask({
        input,
        systemPrompt:
          "Return only JSON matching the requested schema. Do not use markdown fences.",
        language: "en",
        samplingMode: "predictable",
        responseConstraint: SCHEMA,
        signal: controller.signal,
      });
      if (!result.output) throw new Error("Empty response from model.");

      const parsed = JSON.parse(result.output) as unknown;
      if (
        !parsed ||
        typeof parsed !== "object" ||
        !Array.isArray((parsed as { examples?: unknown }).examples)
      ) {
        throw new Error("Generated response is missing an examples array.");
      }

      const fresh = (parsed as { examples: unknown[] }).examples
        .filter(
          (example): example is string =>
            typeof example === "string" &&
            example.trim().length > 0 &&
            isMeaningfulExample(example),
        )
        .map((example) => example.trim());
      const contextualFresh = fresh.filter((example) =>
        isContextualExample(example, context.turns),
      );
      const otherFresh = fresh.filter(
        (example) => !isContextualExample(example, context.turns),
      );
      const candidates = conversationContext
        ? [
            ...contextualFresh,
            ...buildContextualFallbacks(context.turns, mode.tools.length > 0),
            ...otherFresh,
            ...mode.examples,
          ]
        : [...fresh, ...mode.examples];
      const completeSet = candidates
        .filter(isMeaningfulExample)
        .filter(
          (example, index, all) =>
            all.findIndex(
              (candidate) =>
                candidate.toLocaleLowerCase() === example.toLocaleLowerCase(),
            ) === index,
        )
        .slice(0, MAX_EXAMPLES);
      if (completeSet.length === 0) {
        throw new Error("No usable examples generated.");
      }
      if (requestId !== requestIdRef.current) return;

      setExamples(completeSet);
      if (!conversationContext) {
        try {
          sessionStorage.setItem(modeCacheKey, JSON.stringify(completeSet));
        } catch {
          // Generated suggestions still work without storage.
        }
      }
    } catch {
      if (requestId === requestIdRef.current && !conversationContext) {
        setExamples(mode.examples.slice(0, MAX_EXAMPLES));
      }
    } finally {
      if (requestId === requestIdRef.current) {
        abortRef.current = null;
        setGenerating(false);
      }
    }
  }, [
    canRegenerate,
    context.suspended,
    context.turns,
    conversationContext,
    generating,
    mode,
    modeCacheKey,
  ]);

  useEffect(
    () => () => {
      cancel();
    },
    [cancel],
  );

  useEffect(() => {
    if (context.suspended) {
      cancel();
      return;
    }
    if (
      !contextKey ||
      generatedContextRef.current === autoGenerationKey ||
      !canRegenerate ||
      generating
    ) {
      return;
    }
    generatedContextRef.current = autoGenerationKey;
    void regenerate();
  }, [
    autoGenerationKey,
    canRegenerate,
    cancel,
    context.suspended,
    contextKey,
    generating,
    regenerate,
  ]);

  return { examples, regenerate, cancel, generating, canRegenerate };
}

function truncateContext(value: string, limit: number): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length <= limit
    ? normalized
    : `${normalized.slice(0, limit - 3)}...`;
}

function isMeaningfulExample(value: string): boolean {
  const normalized = value.trim().toLocaleLowerCase();
  if (!normalized) return false;
  const hasUrl = /https?:\/\/\S+/.test(normalized);
  const refersToContext =
    /\b(?:it|that|this|same|last|latest|previous|result|response|source)\b/.test(
      normalized,
    );
  if (/\bsummari[sz]e\b/.test(normalized) && !hasUrl && !/["“”]/.test(value)) {
    return false;
  }
  if (
    /\bbased on\b.*\b(?:info|information|data)\b/.test(normalized) &&
    !hasUrl &&
    !refersToContext
  ) {
    return false;
  }
  if (/^fetch\b/.test(normalized) && !hasUrl && !refersToContext) return false;
  return ![
    /\bexample\.com\b/,
    /https?:\/\/(?:www\.)?github\.com\/?(?:\s|$)/,
    /\blocalhost\b/,
  ].some((pattern) => pattern.test(normalized));
}

function isContextualExample(
  value: string,
  turns: ExampleTurnContext[],
): boolean {
  const normalized = value.toLocaleLowerCase();
  if (
    /\b(?:it|that|this|same|last|latest|previous|result|response|source)\b/.test(
      normalized,
    )
  ) {
    return true;
  }
  const contextTerms = turns
    .flatMap((turn) => turn.userInput.toLocaleLowerCase().match(/\b\w{5,}\b/g))
    .filter((term): term is string => Boolean(term))
    .filter((term) => !CONTEXT_STOP_WORDS.has(term));
  return contextTerms.some((term) => normalized.includes(term));
}

function buildContextualFallbacks(
  turns: ExampleTurnContext[],
  hasTools: boolean,
): string[] {
  const latest = turns.at(-1);
  if (!latest) return [];
  const failed =
    /\b(?:unable|cannot|can't|failed|error|cors|not enough information)\b/i.test(
      latest.assistantText,
    );
  if (failed) {
    return [
      "Explain why the last request failed and how to make it testable.",
      "What exact source should I provide to complete the previous request?",
      hasTools
        ? "Separate verified tool evidence from assumptions in the previous answer."
        : "Separate supported facts from assumptions in the previous answer.",
    ];
  }
  return [
    hasTools
      ? "Verify the last answer against the latest tool result."
      : "Challenge the last answer and identify its weakest assumption.",
    "Explain what the previous result proves and what remains uncertain.",
    "Turn the latest verified result into a concise status update.",
  ];
}

const CONTEXT_STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "could",
  "fetch",
  "please",
  "should",
  "their",
  "there",
  "these",
  "those",
  "using",
  "website",
  "would",
]);
