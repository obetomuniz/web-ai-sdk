// @vitest-environment happy-dom

import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MODES } from "../experimental/playground/presets.js";
import { Composer, type ComposerProps } from "./Composer.js";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
});

function renderComposer(overrides: Partial<ComposerProps> = {}) {
  const props: ComposerProps = {
    draft: "",
    promptOn: true,
    promptReadiness: "available",
    error: null,
    busy: false,
    activeMode: MODES[0],
    modeMenuOpen: false,
    modeMenuRef: createRef<HTMLDivElement | null>(),
    examples: ["Summarize this page"],
    generatingExamples: false,
    canRegenerateExamples: true,
    tools: [],
    onDraftChange: vi.fn(),
    onSubmit: vi.fn(),
    onSubmitExample: vi.fn(),
    onToggleModeMenu: vi.fn(),
    onSelectMode: vi.fn(),
    onRegenerateExamples: vi.fn(),
    onAbort: vi.fn(),
    ...overrides,
  };

  const container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root?.render(<Composer {...props} />);
  });

  return { container, props };
}

function queryInput(container: HTMLElement): HTMLTextAreaElement {
  const input = container.querySelector("textarea");
  if (!input) throw new Error("composer textarea not found");
  return input;
}

function pressEnter(input: HTMLTextAreaElement, shiftKey: boolean) {
  act(() => {
    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        shiftKey,
        bubbles: true,
        cancelable: true,
      }),
    );
  });
}

describe("Composer", () => {
  it("starts with a single visible input line", () => {
    const { container } = renderComposer();
    expect(queryInput(container).getAttribute("rows")).toBe("1");
  });

  it("submits on Enter and keeps Shift+Enter for newlines", () => {
    const { container, props } = renderComposer({ draft: "hello" });
    const input = queryInput(container);

    pressEnter(input, true);
    expect(props.onSubmit).not.toHaveBeenCalled();

    pressEnter(input, false);
    expect(props.onSubmit).toHaveBeenCalledTimes(1);
  });

  it("disables send until the draft has content", () => {
    const empty = renderComposer({ draft: "   " });
    const emptySend = empty.container.querySelector(
      "[data-testid='agent-run']",
    ) as HTMLButtonElement;
    expect(emptySend.disabled).toBe(true);

    act(() => root?.unmount());
    document.body.replaceChildren();

    const filled = renderComposer({ draft: "hello" });
    const filledSend = filled.container.querySelector(
      "[data-testid='agent-run']",
    ) as HTMLButtonElement;
    expect(filledSend.disabled).toBe(false);
  });

  it("replaces send with a stop action while busy", () => {
    const { container, props } = renderComposer({ busy: true, draft: "hello" });
    expect(container.querySelector("[data-testid='agent-run']")).toBeNull();

    const stop = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Stop",
    );
    if (!stop) throw new Error("stop button not found");
    act(() => stop.click());
    expect(props.onAbort).toHaveBeenCalledTimes(1);
  });

  it("disables the input and explains a pending model download", () => {
    const { container } = renderComposer({
      promptOn: false,
      promptReadiness: "downloading",
    });
    const input = queryInput(container);
    expect(input.disabled).toBe(true);
    expect(input.placeholder).toBe("Waiting for the on-device model");
    expect(container.querySelector("[role='status']")).not.toBeNull();
  });

  it("links to browser support when the model is unavailable", () => {
    const { container } = renderComposer({
      promptOn: false,
      promptReadiness: "unavailable",
    });
    const link = container.querySelector("[role='status'] a");
    expect(link?.getAttribute("href")).toContain("docs/browser-support");
  });

  it("shows example suggestions only while the draft is empty and idle", () => {
    const typed = renderComposer({ draft: "hello" });
    expect(typed.container.querySelector("[title*='Summarize']")).toBeNull();

    act(() => root?.unmount());
    document.body.replaceChildren();

    const running = renderComposer({ busy: true });
    expect(running.container.querySelector("[title*='Summarize']")).toBeNull();

    act(() => root?.unmount());
    document.body.replaceChildren();

    const idle = renderComposer();
    expect(idle.container.querySelector("[title*='Summarize']")).not.toBeNull();
  });

  it("keeps examples in flow without adding top spacing", () => {
    const { container } = renderComposer();
    const example = container.querySelector("[title*='Summarize']");
    const suggestionRow = example?.parentElement?.parentElement;
    expect(suggestionRow?.className).toContain(
      "bg-[linear-gradient(to_top,var(--color-bg)_62%,transparent)]",
    );
    expect(suggestionRow?.className).not.toContain("absolute");
    expect(suggestionRow?.className).not.toContain("shadow-");
    expect(suggestionRow?.className).not.toContain(" pt-");
  });

  it("keeps example suggestions before the input in document order", () => {
    const { container } = renderComposer();
    const input = queryInput(container);
    const example = container.querySelector("[title*='Summarize']");
    if (!example) throw new Error("example button not found");
    const position = input.compareDocumentPosition(example);
    expect(position & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });

  it("submits an example suggestion directly", () => {
    const { container, props } = renderComposer();
    const example = [...container.querySelectorAll("button")].find((button) =>
      button.title.includes("Summarize this page"),
    );
    if (!example) throw new Error("example button not found");
    act(() => example.click());
    expect(props.onSubmitExample).toHaveBeenCalledWith("Summarize this page");
  });
});
