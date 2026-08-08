// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WriterDemo } from "./WriterDemo.js";

interface WriterHookOptions {
  input: string;
  enabled?: boolean;
}

const mocks = vi.hoisted(() => ({
  state: {
    status: "idle" as "idle" | "loading" | "streaming" | "done" | "unavailable",
    output: null as string | null,
  },
  useWriter: vi.fn((_options: WriterHookOptions) => ({
    status: mocks.state.status,
    output: mocks.state.output,
    error: null,
    fromCache: false,
    dismiss: vi.fn(),
  })),
}));

vi.mock("@web-ai-sdk/writer/react", () => ({
  useWriter: mocks.useWriter,
}));

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;
let container: HTMLDivElement;

const lastOptions = (): WriterHookOptions => {
  const call = mocks.useWriter.mock.calls.at(-1);
  if (!call) throw new Error("useWriter was not called");
  return call[0];
};

const findButton = (text: string) =>
  [...container.querySelectorAll("button")].find(
    (button) => button.textContent?.trim() === text,
  );

// Assign through the prototype setter so React's value tracker registers the
// change and the synthetic input event is not deduplicated.
const typeInput = (value: string) => {
  const input = container.querySelector("textarea");
  act(() => {
    if (!input) return;
    Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )?.set?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

beforeEach(() => {
  mocks.state.status = "idle";
  mocks.state.output = null;
  mocks.useWriter.mockClear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(<WriterDemo />));
});

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
});

describe("docs WriterDemo", () => {
  it("never invokes the hook from typing alone", () => {
    expect(lastOptions().enabled).toBe(false);
    typeInput("A different task.");
    expect(lastOptions().enabled).toBe(false);
    expect(lastOptions().input).toBe("");
  });

  it("commits the input on Write and runs only then", () => {
    typeInput("Announce the release.");
    act(() => findButton("Write")?.click());
    expect(lastOptions().enabled).toBe(true);
    expect(lastOptions().input).toBe("Announce the release.");

    // Later keystrokes leave the committed input untouched.
    typeInput("Announce the release. More detail.");
    expect(lastOptions().input).toBe("Announce the release.");
  });

  it("shows Stop while busy and disables the hook when clicked", () => {
    act(() => findButton("Write")?.click());
    mocks.state.status = "streaming";
    mocks.state.output = "Partial draft";
    typeInput("nudge rerender");
    typeInput("nudge rerender.");

    const stop = findButton("Stop");
    expect(stop).toBeDefined();
    act(() => stop?.click());
    expect(lastOptions().enabled).toBe(false);
    expect(container.textContent).toContain("Stopped");
  });

  it("marks the draft stale after edits and keeps it visible", () => {
    typeInput("First task.");
    act(() => findButton("Write")?.click());
    mocks.state.status = "done";
    mocks.state.output = "The finished draft.";
    typeInput("Second task.");

    expect(container.textContent).toContain("The finished draft.");
    expect(container.textContent).toContain(
      "The task changed after this draft",
    );
    expect(container.textContent).toContain("Draft (stale)");
  });
});
