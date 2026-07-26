import { describe, expect, it } from "vitest";
import { summarizeTextHasKnownSource } from "./summarizeProvenance.js";

describe("summarizeTextHasKnownSource", () => {
  const article =
    "Agentic applications need predictable browser capabilities, explicit boundaries, and inspectable tool results.";

  it("accepts text copied from the user message", () => {
    expect(
      summarizeTextHasKnownSource(
        article,
        `Summarize this text\n\n${article}`,
        [],
      ),
    ).toBe(true);
  });

  it("accepts text returned by a successful fetch", () => {
    expect(
      summarizeTextHasKnownSource(article, "Summarize the fetched article", [
        `Title\n\n${article}\n\nMore detail`,
      ]),
    ).toBe(true);
  });

  it("rejects model-generated text with no known source", () => {
    expect(
      summarizeTextHasKnownSource(
        article,
        "Write a new article about browser agents",
        [],
      ),
    ).toBe(false);
  });
});
