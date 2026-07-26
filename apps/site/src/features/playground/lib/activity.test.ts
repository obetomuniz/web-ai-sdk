import { describe, expect, it } from "vitest";
import { activityPreview } from "./activity.js";

describe("activityPreview", () => {
  it("uses the first meaningful line", () => {
    expect(activityPreview("\n\nFirst answer\nSecond answer", "Fallback")).toBe(
      "First answer",
    );
  });

  it("removes common Markdown wrappers", () => {
    expect(activityPreview("## **Answer** with `code`", "Fallback")).toBe(
      "Answer with code",
    );
  });

  it("uses the fallback for empty content", () => {
    expect(activityPreview(" \n ", "Response completed")).toBe(
      "Response completed",
    );
  });
});
