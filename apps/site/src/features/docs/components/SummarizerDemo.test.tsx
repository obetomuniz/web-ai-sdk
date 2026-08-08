// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SummarizerDemo } from "./SummarizerDemo.js";

interface SummarizerHookOptions {
  input: string;
  enabled?: boolean;
  cache?: string;
  cacheTtl?: number;
  cacheKey?: string;
}

const mocks = vi.hoisted(() => ({
  state: {
    status: "idle" as "idle" | "loading" | "streaming" | "done" | "unavailable",
    output: null as string | null,
    fromCache: false,
  },
  useSummarizer: vi.fn((_options: SummarizerHookOptions) => ({
    status: mocks.state.status,
    output: mocks.state.output,
    error: null,
    fromCache: mocks.state.fromCache,
    dismiss: vi.fn(),
  })),
}));

vi.mock("@web-ai-sdk/summarizer/react", () => ({
  useSummarizer: mocks.useSummarizer,
}));

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let container: HTMLDivElement;

const lastOptions = (): SummarizerHookOptions => {
  const call = mocks.useSummarizer.mock.calls.at(-1);
  if (!call) throw new Error("useSummarizer was not called");
  return call[0];
};

const findButton = (text: string) =>
  [...container.querySelectorAll("button")].find((button) =>
    button.textContent?.includes(text),
  );

beforeEach(() => {
  mocks.state.status = "idle";
  mocks.state.output = null;
  mocks.state.fromCache = false;
  mocks.useSummarizer.mockClear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(<SummarizerDemo />));
});

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
});

describe("docs SummarizerDemo", () => {
  it("does not run on page load; the button enables the hook", () => {
    expect(lastOptions().enabled).toBe(false);

    act(() => findButton("Summarize the article")?.click());
    expect(lastOptions().enabled).toBe(true);
  });

  it("passes the TTL cache options", () => {
    expect(lastOptions().cache).toBe("session");
    expect(lastOptions().cacheTtl).toBe(10 * 60 * 1000);
  });

  it("bumps the cache key on Fresh run to regenerate", () => {
    act(() => findButton("Summarize the article")?.click());
    const firstKey = lastOptions().cacheKey;
    mocks.state.status = "done";
    mocks.state.output = "A summary.";
    mocks.state.fromCache = true;
    act(() => root?.render(<SummarizerDemo />));

    const fresh = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Fresh run"]',
    );
    expect(fresh).not.toBeNull();
    act(() => fresh?.click());
    expect(lastOptions().cacheKey).not.toBe(firstKey);
  });
});
