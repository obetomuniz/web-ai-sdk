import { clearLanguageDetectorSessions } from "@web-ai-sdk/detector";
import { clearProofreaderSessions } from "@web-ai-sdk/proofreader";
import { clearRewriterSessions } from "@web-ai-sdk/rewriter";
import { clearSummarizerSessions } from "@web-ai-sdk/summarizer";
import { clearTranslatorSessions } from "@web-ai-sdk/translator";
import { clearWriterSessions } from "@web-ai-sdk/writer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createToolLeaseScope } from "../toolLeases.js";
import type { AgentTool, AgentToolContext } from "../types.js";
import { detectLanguageTool } from "./detectLanguage.js";
import { proofreadTool } from "./proofread.js";
import { rewriteTool } from "./rewrite.js";
import { summarizeTool } from "./summarize.js";
import { translateTool } from "./translate.js";
import { writeTool } from "./write.js";

const context = (): AgentToolContext => ({
  signal: new AbortController().signal,
  callId: "test",
  step: 0,
  emit: vi.fn(),
});
const cases: [AgentTool, string, Record<string, unknown>, string][] = [
  [writeTool, "Writer", { task: "Draft an email" }, "WriterUnavailableError"],
  [
    rewriteTool,
    "Rewriter",
    { text: "Original text" },
    "RewriterUnavailableError",
  ],
  [
    proofreadTool,
    "Proofreader",
    { text: "She have books." },
    "ProofreaderUnavailableError",
  ],
  [
    summarizeTool,
    "Summarizer",
    { text: "Original text" },
    "SummarizerUnavailableError",
  ],
  [
    translateTool,
    "Translator",
    { text: "Hello", sourceLanguage: "en", targetLanguage: "pt" },
    "TranslatorUnavailableError",
  ],
  [
    detectLanguageTool,
    "LanguageDetector",
    { text: "Hello" },
    "DetectorUnavailableError",
  ],
];
afterEach(() => {
  // Agent-free calls keep SDK sessions cached; isolate each native stub.
  clearWriterSessions();
  clearRewriterSessions();
  clearProofreaderSessions();
  clearSummarizerSessions();
  clearTranslatorSessions();
  clearLanguageDetectorSessions();
  vi.unstubAllGlobals();
});

describe.each(cases)(
  "%s text adapter",
  (tool, globalName, input, errorName) => {
    it("preserves typed unavailability", async () => {
      vi.stubGlobal(globalName, undefined);
      await expect(tool.execute(input, context())).rejects.toMatchObject({
        name: errorName,
      });
    });
    it("rejects malformed arguments before model creation", async () => {
      const create = vi.fn();
      vi.stubGlobal(globalName, { create });
      await expect(
        tool.execute({ text: 42, task: false }, context()),
      ).rejects.toMatchObject({ name: "AgentToolValidationError" });
      expect(create).not.toHaveBeenCalled();
    });
    it("honors cancellation before work starts", async () => {
      const controller = new AbortController();
      controller.abort();
      await expect(
        tool.execute(input, { ...context(), signal: controller.signal }),
      ).rejects.toMatchObject({ name: "AbortError" });
    });
  },
);

it("reuses the agent's Writer session across matching calls and emits cumulative output", async () => {
  const destroy = vi.fn();
  const create = vi.fn(async () => ({
    destroy,
    write: vi.fn(),
    async *writeStreaming() {
      yield "Hello";
      yield "Hello world";
    },
  }));
  const availability = vi.fn(async () => "available");
  vi.stubGlobal("Writer", { create, availability });
  const leases = createToolLeaseScope();
  const ctx = { ...context(), leases };
  const input = { task: "Draft", tone: "formal", length: "medium" } as const;
  const result = await writeTool.execute(input, ctx);
  await writeTool.execute(input, { ...context(), leases });
  expect(result).toEqual({ output: "Hello world", cached: false });
  expect(create).toHaveBeenCalledTimes(1);
  expect(availability).toHaveBeenCalledWith(
    expect.objectContaining({
      tone: "formal",
      length: "medium",
      format: "plain-text",
    }),
  );
  expect(ctx.emit).toHaveBeenCalledWith({
    phase: "output",
    text: "Hello world",
  });
  await Promise.resolve();
  expect(destroy).not.toHaveBeenCalled();
  leases.releaseAll();
  await vi.waitFor(() => expect(destroy).toHaveBeenCalledTimes(1));
});

it("preserves operational errors from Summarizer", async () => {
  const failure = new Error("Native inference failed");
  vi.stubGlobal("Summarizer", {
    availability: async () => "available",
    create: async () => ({
      summarize: async () => {
        throw failure;
      },
      destroy() {},
    }),
  });
  await expect(
    summarizeTool.execute({ text: "Original source" }, context()),
  ).rejects.toBe(failure);
});

it("keeps Proofreader offsets, optional metadata and original input", async () => {
  const output = {
    correctedInput: "She has books.",
    corrections: [
      {
        startIndex: 4,
        endIndex: 8,
        correction: "has",
        type: "grammar",
        explanation: "Subject agreement",
      },
    ],
  };
  const proofread = vi.fn(async () => output);
  vi.stubGlobal("Proofreader", {
    availability: async () => "available",
    create: async () => ({ proofread, destroy() {} }),
  });
  const input = Object.freeze({
    text: "She have books.",
    expectedInputLanguages: ["en"],
  });
  expect(await proofreadTool.execute(input, context())).toEqual({
    output,
    cached: false,
  });
  expect(input.text).toBe("She have books.");
  expect(proofread).toHaveBeenCalledWith(input.text);
});

it("probes the actual translation language pair", async () => {
  const availability = vi.fn(async () => "available");
  vi.stubGlobal("Translator", {
    availability,
    create: async () => ({ translate: async () => "Olá", destroy() {} }),
  });
  const result = await translateTool.execute(
    { text: "Hello", sourceLanguage: "en", targetLanguage: "pt" },
    context(),
  );
  expect(availability).toHaveBeenCalledWith({
    sourceLanguage: "en",
    targetLanguage: "pt",
  });
  expect(result.translation).toBe("Olá");
});

it("tolerates planner mistakes in optional hints but not in required text", async () => {
  const summarizerCreate = vi.fn(async () => ({
    summarize: async () => "Summary",
    destroy() {},
  }));
  vi.stubGlobal("Summarizer", {
    availability: async () => "available",
    create: summarizerCreate,
  });
  await summarizeTool.execute(
    { text: "Original source", type: "summary", language: "en" } as never,
    context(),
  );
  expect(summarizerCreate).toHaveBeenCalledWith(
    expect.objectContaining({ type: "tldr", length: "short" }),
  );

  const proofreaderAvailability = vi.fn(async () => "available");
  vi.stubGlobal("Proofreader", {
    availability: proofreaderAvailability,
    create: async () => ({
      proofread: async () => ({ correctedInput: "Fine.", corrections: [] }),
      destroy() {},
    }),
  });
  await proofreadTool.execute(
    { text: "Fine.", expectedInputLanguages: "en" } as never,
    context(),
  );
  expect(proofreaderAvailability).toHaveBeenCalledWith({
    expectedInputLanguages: ["en"],
  });

  await expect(
    summarizeTool.execute({ text: "", type: "summary" } as never, context()),
  ).rejects.toMatchObject({ name: "AgentToolValidationError" });
});

it("downloads the exact language pair from a user gesture and keeps no session", async () => {
  const destroy = vi.fn();
  const create = vi.fn(
    async (options: {
      monitor?: (monitor: {
        addEventListener(
          type: string,
          listener: (event: { loaded: number }) => void,
        ): void;
      }) => void;
    }) => {
      options.monitor?.({
        addEventListener: (_type, listener) => listener({ loaded: 0.5 }),
      });
      return { translate: async () => "", destroy };
    },
  );
  vi.stubGlobal("Translator", {
    availability: async () => "downloadable",
    create,
  });
  const progress = vi.fn();
  await translateTool.download?.(
    { text: "こんにちは", sourceLanguage: "ja", targetLanguage: "pt" },
    progress,
  );
  expect(create).toHaveBeenCalledWith(
    expect.objectContaining({ sourceLanguage: "ja", targetLanguage: "pt" }),
  );
  expect(progress).toHaveBeenCalledWith(0.5);
  await vi.waitFor(() => expect(destroy).toHaveBeenCalledTimes(1));
});

it("requires a Translator result only for translation requests", () => {
  const needs = (userInput: string) =>
    translateTool.requiredCallIf?.({ userInput } as never) ?? false;
  expect(needs("Translate it to English and Portuguese.")).toBe(true);
  expect(needs("Thanks for the translation!")).toBe(false);
});

it("maps near-miss style values to the package's options", async () => {
  const create = vi.fn(async () => ({
    rewrite: async () => "Could you please send the notes?",
    destroy() {},
  }));
  vi.stubGlobal("Rewriter", { availability: async () => "available", create });
  await rewriteTool.execute(
    { text: "hey, send the notes", tone: "Formal", length: "short" } as never,
    context(),
  );
  expect(create).toHaveBeenCalledWith(
    expect.objectContaining({ tone: "more-formal", length: "shorter" }),
  );
});
