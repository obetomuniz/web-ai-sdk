import { describe, expect, it } from "vitest";
import {
  buildSkeleton,
  cleanSummary,
  trimToSentenceBoundary,
} from "./skeleton.js";

const html = (markup: string): Element => {
  const div = document.createElement("div");
  div.innerHTML = markup;
  return div.firstElementChild ?? div;
};

describe("buildSkeleton", () => {
  it("includes title, description, headings, and bolds", () => {
    const article = html(
      "<article>" +
        "<h2>Heading One</h2>" +
        "<p>Some <strong>bold thing</strong> here.</p>" +
        "<h3>Heading Two</h3>" +
        "<p>Plain text only.</p>" +
        "</article>",
    );
    const skeleton = buildSkeleton({
      article,
      title: "My Post",
      description: "About interesting things",
    });
    expect(skeleton.split(". ").sort()).toEqual(
      [
        "About interesting things",
        "Heading One",
        "Heading Two",
        "My Post",
        "bold thing",
      ].sort(),
    );
  });

  it("collapses duplicates case-insensitively", () => {
    const article = html(
      "<article>" +
        "<h2>Hello World</h2>" +
        "<p><strong>HELLO WORLD</strong></p>" +
        "</article>",
    );
    const skeleton = buildSkeleton({ article });
    expect(skeleton).toBe("Hello World");
  });

  it("skips entries shorter than 3 chars", () => {
    const article = html("<article><h2>Hi</h2><h3>Heading</h3></article>");
    const skeleton = buildSkeleton({ article, title: "x" });
    expect(skeleton).toBe("Heading");
  });

  it("skips falsy and whitespace-only entries", () => {
    const article = html("<article><h2>   </h2><h3>Real</h3></article>");
    const skeleton = buildSkeleton({
      article,
      title: undefined,
      description: "",
    });
    expect(skeleton).toBe("Real");
  });

  it("respects a custom selector", () => {
    const article = html(
      "<article><h1>Big</h1><em>Italic</em><strong>Bold</strong></article>",
    );
    const skeleton = buildSkeleton({ article, selector: "em" });
    expect(skeleton).toBe("Italic");
  });
});

describe("trimToSentenceBoundary", () => {
  it("returns the text unchanged when it fits", () => {
    expect(trimToSentenceBoundary("Hello world.", 100)).toBe("Hello world.");
  });

  it("cuts at the last sentence terminator inside the budget", () => {
    const text = "First sentence. Second sentence. Third one is longer.";
    const out = trimToSentenceBoundary(text, 35);
    expect(out).toBe("First sentence. Second sentence.");
  });

  it("falls back to a hard cut when no boundary lands in the last 40%", () => {
    const text = "abcdefghijklmnopqrstuvwxyz";
    const out = trimToSentenceBoundary(text, 10);
    expect(out).toBe("abcdefghij");
  });
});

describe("cleanSummary", () => {
  it("strips wrapping quotes and whitespace", () => {
    expect(cleanSummary('  "Hello world."  ')).toBe("Hello world.");
  });

  it("collapses internal whitespace", () => {
    expect(cleanSummary("Hello\n\n  world\t.")).toBe("Hello world .");
  });
});
