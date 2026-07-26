// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MODES } from "./presets.js";
import { useExamples } from "./useExamples.js";

const { askMock } = vi.hoisted(() => ({ askMock: vi.fn() }));

vi.mock("@web-ai-sdk/prompt", () => ({
  ask: askMock,
  isAvailable: () => true,
}));

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;

beforeEach(() => {
  sessionStorage.clear();
  askMock.mockReset();
  askMock.mockResolvedValue({
    output: JSON.stringify({
      examples: [
        "Explain how the previous answer changes with TypeScript.",
        "Challenge the previous answer with a concrete counterexample.",
        "Turn the previous answer into a short implementation checklist.",
      ],
    }),
  });
});

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
});

describe("useExamples", () => {
  it("generates only after an explicit request", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    let regenerate: (() => Promise<void>) | undefined;

    function Harness({ withTurn }: { withTurn: boolean }) {
      const result = useExamples(MODES[0], {
        conversationId: "conversation-1",
        turns: withTurn
          ? [
              {
                id: "turn-1",
                userInput: "Explain promises.",
                assistantText: "Promises represent future values.",
              },
            ]
          : [],
      });
      regenerate = result.regenerate;
      return null;
    }

    act(() => root?.render(<Harness withTurn={false} />));
    act(() => root?.render(<Harness withTurn />));
    expect(askMock).not.toHaveBeenCalled();

    await act(async () => {
      await regenerate?.();
    });
    expect(askMock).toHaveBeenCalledOnce();
  });
});
