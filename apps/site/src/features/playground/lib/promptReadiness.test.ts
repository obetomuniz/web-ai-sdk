import { describe, expect, it } from "vitest";
import { promptReadinessMessage } from "./promptReadiness.js";

describe("promptReadinessMessage", () => {
  it("guides Chrome users through local model troubleshooting", () => {
    expect(promptReadinessMessage("unavailable", "chrome")).toBe(
      "The Prompt API is unavailable. Check Chrome's version, AI settings, and model status. Then reload.",
    );
  });

  it("guides Edge users through its preview setup", () => {
    expect(promptReadinessMessage("unavailable", "edge")).toBe(
      "The Prompt API is unavailable. Check Edge's channel, AI settings, and model status. Then reload.",
    );
  });

  it("does not send unsupported browsers to Chrome settings", () => {
    expect(promptReadinessMessage("unavailable", "other")).toBe(
      "This browser does not support the Prompt API. Open the Playground in desktop Chrome or Edge.",
    );
  });
});
