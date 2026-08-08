// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DetectorDemo } from "./DetectorDemo.js";

interface DetectorHookOptions {
  input: string;
}

const mocks = vi.hoisted(() => ({
  useDetector: vi.fn((_options: DetectorHookOptions) => ({
    status: "idle" as const,
    output: null,
    error: null,
    fromCache: false,
  })),
}));

vi.mock("@web-ai-sdk/detector/react", () => ({
  useDetector: mocks.useDetector,
}));

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let container: HTMLDivElement;

const lastOptions = (): DetectorHookOptions => {
  const call = mocks.useDetector.mock.calls.at(-1);
  if (!call) throw new Error("useDetector was not called");
  return call[0];
};

beforeEach(() => {
  vi.useFakeTimers();
  mocks.useDetector.mockClear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe("docs DetectorDemo", () => {
  it("debounces typing instead of updating the hook per keystroke", () => {
    act(() => root?.render(<DetectorDemo initial="hola" />));
    expect(lastOptions().input).toBe("hola");

    const input = container.querySelector("textarea");
    act(() => {
      if (!input) return;
      // Assign through the prototype setter so React's value tracker
      // registers the change.
      Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      )?.set?.call(input, "hola mundo");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    // Before the pause elapses the hook still sees the old input.
    expect(lastOptions().input).toBe("hola");
    expect(container.textContent).toContain("Detection runs after you pause");

    act(() => vi.advanceTimersByTime(600));
    expect(lastOptions().input).toBe("hola mundo");
  });
});
