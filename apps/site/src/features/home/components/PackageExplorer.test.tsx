// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PackageExplorer } from "./PackageExplorer.js";

const mocks = vi.hoisted(() => {
  const lease = () => ({ ready: Promise.resolve(), release: vi.fn() });
  return {
    prepareLanguageModel: vi.fn(lease),
    prepareSummarizer: vi.fn(lease),
    prepareTranslator: vi.fn(lease),
    prepareLanguageDetector: vi.fn(lease),
    prepareWriter: vi.fn(lease),
    prepareRewriter: vi.fn(lease),
    prepareProofreader: vi.fn(lease),
  };
});

vi.mock("@web-ai-sdk/prompt", () => ({
  ask: vi.fn(async () => ({ output: "" })),
  isAvailable: () => true,
  PromptUnavailableError: class PromptUnavailableError extends Error {},
  prepareLanguageModel: mocks.prepareLanguageModel,
}));

vi.mock("@web-ai-sdk/prompt/react", () => ({
  usePrompt: () => ({
    status: "idle",
    output: null,
    error: null,
    fromCache: false,
    ask: vi.fn(),
    abort: vi.fn(),
    reset: vi.fn(),
  }),
}));

vi.mock("@web-ai-sdk/summarizer", () => ({
  isAvailable: () => true,
  prepareSummarizer: mocks.prepareSummarizer,
  SummarizerUnavailableError: class SummarizerUnavailableError extends Error {},
  summarize: vi.fn(async () => ({ output: "", cached: false })),
}));

vi.mock("@web-ai-sdk/translator", () => ({
  isAvailable: () => true,
  prepareTranslator: mocks.prepareTranslator,
  TranslatorUnavailableError: class TranslatorUnavailableError extends Error {},
  translate: vi.fn(async () => ({ output: "", cached: false })),
}));

vi.mock("@web-ai-sdk/detector", () => ({
  isAvailable: () => true,
  prepareLanguageDetector: mocks.prepareLanguageDetector,
}));

vi.mock("@web-ai-sdk/detector/react", () => ({
  useDetector: () => ({
    status: "idle",
    output: null,
    error: null,
    fromCache: false,
  }),
}));

vi.mock("@web-ai-sdk/writer", () => ({
  isAvailable: () => true,
  prepareWriter: mocks.prepareWriter,
  WriterUnavailableError: class WriterUnavailableError extends Error {},
  write: vi.fn(async () => ({ output: "", cached: false })),
}));

vi.mock("@web-ai-sdk/rewriter", () => ({
  isAvailable: () => true,
  prepareRewriter: mocks.prepareRewriter,
  RewriterUnavailableError: class RewriterUnavailableError extends Error {},
  rewrite: vi.fn(async () => ({ output: "", cached: false })),
}));

vi.mock("@web-ai-sdk/proofreader", () => ({
  isAvailable: () => true,
  ProofreaderUnavailableError: class ProofreaderUnavailableError extends Error {},
  prepareProofreader: mocks.prepareProofreader,
  proofread: vi.fn(async () => ({ output: null, cached: false })),
}));

vi.mock("@web-ai-sdk/webmcp", () => ({
  executeTool: vi.fn(async () => "{}"),
  getTools: vi.fn(async () => []),
  isAvailable: () => true,
}));

vi.mock("@web-ai-sdk/webmcp/react", () => ({
  useWebMCP: () => ({
    tools: [],
    status: "ready",
    error: null,
    refresh: vi.fn(async () => []),
  }),
}));

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let container: HTMLDivElement;

const allPrepareMocks = [
  mocks.prepareLanguageModel,
  mocks.prepareSummarizer,
  mocks.prepareTranslator,
  mocks.prepareLanguageDetector,
  mocks.prepareWriter,
  mocks.prepareRewriter,
  mocks.prepareProofreader,
];

const selectTab = (slug: string) => {
  const tab = container.querySelector<HTMLButtonElement>(`#pkg-tab-${slug}`);
  expect(tab).not.toBeNull();
  act(() => tab?.click());
};

beforeEach(() => {
  for (const mock of allPrepareMocks) mock.mockClear();
  window.location.hash = "";
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
});

describe("PackageExplorer preparation intent", () => {
  it("prepares nothing on hydration alone", () => {
    act(() => root?.render(<PackageExplorer />));
    for (const mock of allPrepareMocks) {
      expect(mock).not.toHaveBeenCalled();
    }
  });

  it("prepares only the selected package on tab selection", () => {
    act(() => root?.render(<PackageExplorer />));
    selectTab("summarizer");

    expect(mocks.prepareSummarizer).toHaveBeenCalledTimes(1);
    expect(mocks.prepareLanguageModel).not.toHaveBeenCalled();
    expect(mocks.prepareTranslator).not.toHaveBeenCalled();
    expect(mocks.prepareWriter).not.toHaveBeenCalled();
  });

  it("releases the previous lease when the tab changes", () => {
    act(() => root?.render(<PackageExplorer />));
    selectTab("summarizer");
    const lease = mocks.prepareSummarizer.mock.results[0]?.value as {
      release: ReturnType<typeof vi.fn>;
    };
    expect(lease.release).not.toHaveBeenCalled();

    selectTab("translator");
    expect(lease.release).toHaveBeenCalledTimes(1);
    expect(mocks.prepareTranslator).toHaveBeenCalledTimes(1);
  });
});
