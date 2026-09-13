import { afterEach, describe, expect, it, vi } from "vitest";
import { runDispatcher } from "../dispatcher.js";
import { toolOutcome } from "../toolOutcome.js";
import type { AgentEvent, AgentTool, AgentToolContext } from "../types.js";
import { detectLanguageTool } from "./detectLanguage.js";
import { proofreadTool } from "./proofread.js";
import { rewriteTool } from "./rewrite.js";
import { summarizeTool } from "./summarize.js";
import { translateTool } from "./translate.js";
import { writeTool } from "./write.js";

const cases: Array<{
  tool: AgentTool;
  global: string;
  input: Record<string, unknown>;
  method: string;
  output: unknown;
}> = [
  {
    tool: writeTool,
    global: "Writer",
    input: { task: "Draft an email" },
    method: "write",
    output: "Hello",
  },
  {
    tool: rewriteTool,
    global: "Rewriter",
    input: { text: "hey" },
    method: "rewrite",
    output: "Hello",
  },
  {
    tool: proofreadTool,
    global: "Proofreader",
    input: { text: "I seen him." },
    method: "proofread",
    output: {
      correctedInput: "I saw him.",
      corrections: [
        {
          startIndex: 2,
          endIndex: 6,
          correction: "saw",
          type: "grammar",
          explanation: "Use the past tense.",
        },
      ],
    },
  },
  {
    tool: summarizeTool,
    global: "Summarizer",
    input: { text: "A source paragraph" },
    method: "summarize",
    output: "A summary",
  },
  {
    tool: translateTool,
    global: "Translator",
    input: { text: "Hello", sourceLanguage: "en", targetLanguage: "pt" },
    method: "translate",
    output: "Olá",
  },
  {
    tool: detectLanguageTool,
    global: "LanguageDetector",
    input: { text: "Olá" },
    method: "detect",
    output: [
      { detectedLanguage: "pt", confidence: 0.9 },
      { detectedLanguage: "es", confidence: 0.1 },
    ],
  },
];
afterEach(() => vi.unstubAllGlobals());
const context = (signal = new AbortController().signal): AgentToolContext => ({
  signal,
  emit: vi.fn(),
  callId: "test",
  step: 0,
});
async function dispatch(
  tool: AgentTool,
  input: Record<string, unknown>,
  signal = new AbortController().signal,
) {
  const events: AgentEvent[] = [];
  for await (const event of runDispatcher({
    tools: [tool],
    calls: [{ name: tool.name, input }],
    stepIndex: 0,
    signal,
  }))
    events.push(event);
  const result = events.find((event) => event.type === "tool_result");
  if (result?.type !== "tool_result") throw new Error("No result");
  return { result, events };
}

describe.each(cases)(
  "$tool.name",
  ({ tool, global, input, method, output }) => {
    it("preserves typed unavailability", async () => {
      vi.stubGlobal(global, undefined);
      const { result } = await dispatch(tool, input);
      expect(toolOutcome(result)).toBe("unavailable");
      expect(result.error?.name).toMatch(/UnavailableError$/);
    });
    it("reports malformed input without creating a model", async () => {
      const create = vi.fn();
      vi.stubGlobal(global, { create, availability: async () => "available" });
      const { result } = await dispatch(tool, {});
      expect(toolOutcome(result)).toBe("invalid input");
      expect(create).not.toHaveBeenCalled();
    });
    it.each(["empty", "null"])(
      "reports %s native output as an operational error",
      async (shape) => {
        const destroy = vi.fn();
        const empty =
          method === "detect"
            ? []
            : method === "proofread"
              ? { correctedInput: "", corrections: [] }
              : "   ";
        vi.stubGlobal(global, {
          availability: async () => "available",
          create: async () => ({
            [method]: async () => (shape === "null" ? null : empty),
            destroy,
          }),
        });
        const { result } = await dispatch(tool, input);
        expect(toolOutcome(result)).toBe("error");
        expect(result.output).toBeUndefined();
        expect(destroy).toHaveBeenCalledOnce();
      },
    );
    it("preserves native inference failures", async () => {
      const destroy = vi.fn();
      vi.stubGlobal(global, {
        availability: async () => "available",
        create: async () => ({
          [method]: async () => {
            throw new Error("Native inference failed");
          },
          destroy,
        }),
      });
      const { result } = await dispatch(tool, input);
      expect(toolOutcome(result)).toBe("error");
      expect(result.error?.message).toBe("Native inference failed");
      expect(destroy).toHaveBeenCalledOnce();
    });
    it("reuses matching preparation and releases only its lease", async () => {
      const destroy = vi.fn();
      const inference = vi.fn(async () => output);
      const create = vi.fn(async () => ({ [method]: inference, destroy }));
      vi.stubGlobal(global, { availability: async () => "available", create });
      const { result } = await dispatch(tool, input);
      expect(toolOutcome(result)).toBe("success");
      expect(create).toHaveBeenCalledOnce();
      expect(inference).toHaveBeenCalledOnce();
      expect(destroy).toHaveBeenCalledOnce();
      expect(result.output).toMatchObject({ cached: false });
    });
    it("releases before readiness and never emits late success", async () => {
      let resolve!: (instance: object) => void;
      const destroy = vi.fn();
      const inference = vi.fn(async () => output);
      const create = vi.fn(
        () =>
          new Promise<object>((done) => {
            resolve = done;
          }),
      );
      vi.stubGlobal(global, { availability: async () => "available", create });
      const controller = new AbortController();
      const running = dispatch(tool, input, controller.signal);
      await vi.waitFor(() => expect(create).toHaveBeenCalledOnce());
      controller.abort();
      const { result } = await running;
      expect(toolOutcome(result)).toBe("cancelled");
      resolve({ [method]: inference, destroy });
      await vi.waitFor(() => expect(destroy).toHaveBeenCalledOnce());
      expect(inference).not.toHaveBeenCalled();
    });
  },
);

it("preserves Proofreader metadata and the exact supplied original", async () => {
  const output = cases[2]?.output;
  vi.stubGlobal("Proofreader", {
    availability: async () => "available",
    create: async () => ({ proofread: async () => output, destroy() {} }),
  });
  const result = await proofreadTool.execute(
    { text: "  I seen him.  " },
    context(),
  );
  expect(result).toEqual({
    original: "  I seen him.  ",
    checkedText: "I seen him.",
    ...(output as object),
    cached: false,
  });
});

it("uses cumulative Writer updates without concatenating them", async () => {
  vi.stubGlobal("Writer", {
    availability: async () => "available",
    create: async () => ({
      writeStreaming: async function* () {
        yield "Hello";
        yield " world";
      },
      destroy() {},
    }),
  });
  const ctx = context();
  const result = await writeTool.execute({ task: "Draft an email" }, ctx);
  expect(result).toMatchObject({ text: "Hello world" });
  expect(ctx.emit).toHaveBeenCalledWith({ phase: "output", text: "Hello" });
  expect(ctx.emit).toHaveBeenCalledWith({
    phase: "output",
    text: "Hello world",
  });
});

it("normalizes Translator options consistently", async () => {
  const availability = vi.fn(async () => "available");
  const create = vi.fn(async () => ({
    translate: async () => "Olá",
    destroy() {},
  }));
  vi.stubGlobal("Translator", { availability, create });
  await translateTool.execute(
    { text: "Hello", sourceLanguage: "EN-us", targetLanguage: "PT-br" },
    context(),
  );
  expect(availability).toHaveBeenCalledWith({
    sourceLanguage: "en",
    targetLanguage: "pt",
  });
  expect(create).toHaveBeenCalledWith(
    expect.objectContaining({ sourceLanguage: "en", targetLanguage: "pt" }),
  );
});

it("does not report same-language translation as available without Translator", async () => {
  vi.stubGlobal("Translator", undefined);
  const { result } = await dispatch(translateTool, {
    text: "Hello",
    sourceLanguage: "en",
    targetLanguage: "en",
  });
  expect(toolOutcome(result)).toBe("unavailable");
});

it("labels same-language translation as a no-op without creating a model", async () => {
  const create = vi.fn();
  vi.stubGlobal("Translator", {
    availability: async () => "available",
    create,
  });
  const { result } = await dispatch(translateTool, {
    text: "Hello",
    sourceLanguage: "en-US",
    targetLanguage: "en",
  });
  expect(result.output).toEqual({
    translation: "Hello",
    cached: false,
    unchanged: true,
  });
  expect(create).not.toHaveBeenCalled();
});
