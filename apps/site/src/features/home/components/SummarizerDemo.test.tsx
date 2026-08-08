// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SummarizerDemo } from "./SummarizerDemo.js";

interface SummarizeCall {
  input: string;
  cache?: string;
  cacheTtl?: number;
  cacheRefresh?: boolean;
  signal: AbortSignal;
  onUpdate?: (chunk: string) => void;
}

const mocks = vi.hoisted(() => {
  const release = vi.fn();
  return {
    available: true,
    prepareSummarizer: vi.fn(() => ({ ready: Promise.resolve(), release })),
    release,
    resolveNext: null as
      | ((value: { output: string; cached: boolean }) => void)
      | null,
    summarize: vi.fn(
      (_options: SummarizeCall) =>
        new Promise<{ output: string; cached: boolean }>((resolve, reject) => {
          mocks.resolveNext = resolve;
          _options.signal.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    ),
  };
});

vi.mock("@web-ai-sdk/summarizer", () => ({
  isAvailable: () => mocks.available,
  prepareSummarizer: mocks.prepareSummarizer,
  SummarizerUnavailableError: class SummarizerUnavailableError extends Error {},
  summarize: mocks.summarize,
}));

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let container: HTMLDivElement;

const mount = (intent = false) => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(<SummarizerDemo intent={intent} />));
};

const findButton = (text: string) =>
  [...container.querySelectorAll("button")].find((button) =>
    button.textContent?.includes(text),
  );

const statusText = () =>
  [...container.querySelectorAll('[role="status"]')]
    .map((node) => node.textContent)
    .join(" ");

beforeEach(() => {
  mocks.available = true;
  mocks.prepareSummarizer.mockClear();
  mocks.release.mockClear();
  mocks.summarize.mockClear();
  mocks.resolveNext = null;
});

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
});

describe("SummarizerDemo preparation", () => {
  it("does not prepare on mount without intent", () => {
    mount(false);
    expect(mocks.prepareSummarizer).toHaveBeenCalledTimes(0);
  });

  it("prepares once on tab intent and releases the lease on unmount", () => {
    mount(true);
    expect(mocks.prepareSummarizer).toHaveBeenCalledTimes(1);
    expect(mocks.prepareSummarizer).toHaveBeenCalledWith(
      expect.objectContaining({
        language: "en",
        type: "key-points",
        length: "short",
        preference: "auto",
      }),
    );
    expect(mocks.release).not.toHaveBeenCalled();

    act(() => root?.unmount());
    expect(mocks.release).toHaveBeenCalledTimes(1);
  });

  it("prepares after direct interaction when the tab gave no intent", () => {
    mount(false);
    const input = container.querySelector("textarea");
    act(() => {
      input?.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    });
    expect(mocks.prepareSummarizer).toHaveBeenCalledTimes(1);
  });

  it("recycles the lease when a session option changes", () => {
    mount(true);
    const select = container.querySelector<HTMLSelectElement>(
      'select[aria-label="Summary type"]',
    );
    expect(select).toBeDefined();
    act(() => {
      if (!select) return;
      select.value = "tldr";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(mocks.release).toHaveBeenCalledTimes(1);
    expect(mocks.prepareSummarizer).toHaveBeenCalledTimes(2);
    expect(mocks.prepareSummarizer).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "tldr" }),
    );
  });
});

describe("SummarizerDemo runs", () => {
  it("passes the TTL cache options and reports a cached result", async () => {
    mount(true);
    await act(async () => {
      findButton("Summarize")?.click();
    });
    const call = mocks.summarize.mock.calls[0]?.[0] as SummarizeCall;
    expect(call.cache).toBe("session");
    expect(call.cacheTtl).toBe(10 * 60 * 1000);
    expect(call.cacheRefresh).toBe(false);

    await act(async () => {
      mocks.resolveNext?.({ output: "Cached summary.", cached: true });
    });
    expect(statusText()).toContain("cached");
  });

  it("exposes a fresh-generation control that bypasses the cache", async () => {
    mount(true);
    await act(async () => {
      findButton("Summarize")?.click();
    });
    await act(async () => {
      mocks.resolveNext?.({ output: "Cached summary.", cached: true });
    });

    const fresh = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Fresh run"]',
    );
    expect(fresh).not.toBeNull();
    await act(async () => {
      fresh?.click();
    });
    const call = mocks.summarize.mock.calls[1]?.[0] as SummarizeCall;
    expect(call.cacheRefresh).toBe(true);
  });

  it("shows Stop while busy and aborts the run when clicked", async () => {
    mount(true);
    await act(async () => {
      findButton("Summarize")?.click();
    });
    const call = mocks.summarize.mock.calls[0]?.[0] as SummarizeCall;
    expect(call.signal.aborted).toBe(false);

    const stop = findButton("Stop");
    expect(stop).toBeDefined();
    await act(async () => {
      stop?.click();
    });
    expect(call.signal.aborted).toBe(true);
    expect(statusText()).toContain("stopped");
  });

  it("aborts an in-flight run when the demo unmounts", async () => {
    mount(true);
    await act(async () => {
      findButton("Summarize")?.click();
    });
    const call = mocks.summarize.mock.calls[0]?.[0] as SummarizeCall;

    act(() => root?.unmount());
    expect(call.signal.aborted).toBe(true);
  });

  it("keeps the previous result visible but stale after input edits", async () => {
    mount(true);
    await act(async () => {
      findButton("Summarize")?.click();
    });
    await act(async () => {
      mocks.resolveNext?.({ output: "The summary.", cached: false });
    });
    expect(container.textContent).toContain("The summary.");
    expect(statusText()).toContain("done");

    const input = container.querySelector("textarea");
    act(() => {
      if (!input) return;
      // Assign through the prototype setter so React's value tracker
      // registers the change.
      Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )?.set?.call(input, "Different text.");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(container.textContent).toContain("The summary.");
    expect(statusText()).toContain("stale");
    expect(container.textContent).toContain(
      "The input changed after this result.",
    );

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="Dismiss result"]')
        ?.click();
    });
    expect(container.textContent).not.toContain("The summary.");
    expect(statusText()).toContain("idle");
  });
});
