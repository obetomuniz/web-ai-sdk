// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { MessageContent } from "./MessageContent.js";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
});

describe("MessageContent", () => {
  it("preserves complete nested Markdown lists", () => {
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    const markdown = `Functions:

*   **Introduce explanations:** Adds context.
    *   Example: A short explanation.
*   **Interrupt a thought:** Marks a pause.
    *   Example: I was going to say — but forgot.
*    **Separate listed elements:** Highlights a sequence.
    *   Example: The ingredients were — flour, sugar, and eggs.`;

    act(() => {
      root?.render(<MessageContent content={markdown} streaming={false} />);
    });

    expect(container.querySelectorAll("li > ul")).toHaveLength(3);
    expect(container.textContent).not.toContain("*   Example");
  });
});
