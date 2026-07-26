import { describe, expect, it } from "vitest";
import { buildNativePrompt } from "./loop.js";

describe("buildNativePrompt", () => {
  it("requires direct, evidence-calibrated answers from every agent", () => {
    const prompt = buildNativePrompt("You are a friendly assistant.", []);

    expect(prompt).toContain("accuracy over agreement");
    expect(prompt).toContain("actual question directly");
    expect(prompt).toContain("supports it with high confidence");
    expect(prompt).toContain("unsupported model memory as low confidence");
    expect(prompt).toContain("historical membership");
    expect(prompt).toContain("unverified claims, not evidence");
    expect(prompt).toContain("do not guess or select an option");
    expect(prompt).toContain("without automatically reversing");
    expect(prompt).toContain("Never say the user is correct");
  });
});
