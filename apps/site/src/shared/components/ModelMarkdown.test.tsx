// @vitest-environment happy-dom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { ModelMarkdown } from "./ModelMarkdown.js";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | undefined;

const render = (content: string, streaming = false): HTMLElement => {
  let container = document.querySelector<HTMLElement>("[data-test-root]");
  if (!container) {
    container = document.createElement("div");
    container.dataset.testRoot = "";
    document.body.append(container);
    root = createRoot(container);
  }

  act(() => {
    root?.render(<ModelMarkdown content={content} streaming={streaming} />);
  });
  return container;
};

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
});

describe("ModelMarkdown", () => {
  it("ignores raw script elements and event-handler attributes", () => {
    const container = render(
      'Before<script>globalThis.modelXss = true</script><img src="x" onerror="globalThis.modelXss = true">After',
    );

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("[onerror]")).toBeNull();
    expect(
      (globalThis as typeof globalThis & { modelXss?: boolean }).modelXss,
    ).toBeUndefined();
  });

  it("keeps safe links hardened and removes unsafe protocols", () => {
    const container = render(
      [
        "[Web](https://example.com)",
        "[Docs](/docs/)",
        "[Email](mailto:hello@example.com)",
        "[Script](javascript:alert(1))",
        "[Data](data:text/html;base64,PHNjcmlwdD4=)",
      ].join(" "),
    );
    const links = [...container.querySelectorAll("a")];

    expect(links).toHaveLength(5);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "https://example.com",
      "/docs/",
      "mailto:hello@example.com",
      null,
      null,
    ]);
    for (const link of links) {
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noreferrer noopener");
    }
  });

  it("drops remote images and task-list form controls", () => {
    const container = render(
      [
        "![tracking pixel](https://tracker.example/pixel.gif)",
        "- [ ] Keep the task text",
      ].join("\n\n"),
    );

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("input")).toBeNull();
    expect(container.textContent).toContain("Keep the task text");
  });

  it("stabilizes partial fences, lists, links, and emphasis", () => {
    let container = render("**important", true);
    expect(container.querySelector("strong")?.textContent).toBe("important");

    container = render("* first item", true);
    expect(container.querySelector("li")?.textContent).toBe("first item");

    container = render("[Docs](https://example.com", true);
    expect(container.textContent).toContain("Docs");
    expect(container.querySelector("a")).toBeNull();

    container = render("[Docs](https://example.com)", true);
    expect(container.querySelector("a")?.textContent).toBe("Docs");
    expect(container.querySelector("a")?.getAttribute("href")).toBe(
      "https://example.com",
    );

    container = render("```ts\nconst answer = 42;", true);
    expect(container.querySelector("pre code.language-ts")?.textContent).toBe(
      "const answer = 42;\n",
    );
  });

  it("re-evaluates malicious constructs split across stream updates", () => {
    let container = render('<img src="x" one', true);
    expect(container.querySelector("img")).toBeNull();

    container = render(
      '<img src="x" onerror="globalThis.modelXss = true">',
      true,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("[onerror]")).toBeNull();

    container = render("[Run](java", true);
    expect(container.querySelector('a[href^="java"]')).toBeNull();

    container = render("[Run](javascript:alert(1))", true);
    expect(container.querySelector("a")?.getAttribute("href")).toBeNull();
  });
});
