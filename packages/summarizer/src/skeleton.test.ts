import { describe, expect, it } from "vitest";
import { cleanSummary } from "./skeleton.js";

describe("cleanSummary", () => {
  it("strips wrapping quotes and whitespace", () => {
    expect(cleanSummary('  "Hello world."  ')).toBe("Hello world.");
  });

  it("collapses internal whitespace", () => {
    expect(cleanSummary("Hello\n\n  world\t.")).toBe("Hello world .");
  });
});
