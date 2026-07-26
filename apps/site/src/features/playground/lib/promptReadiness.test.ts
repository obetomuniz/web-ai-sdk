import { describe, expect, it } from "vitest";
import { promptReadinessMessage } from "./promptReadiness.js";

describe("promptReadinessMessage", () => {
  it("guides Chrome users through local model troubleshooting", () => {
    expect(promptReadinessMessage("unavailable", "chrome")).toBe(
      "Chrome can run the Prompt API, but it is not available here. Check Chrome's version, built-in AI settings, and model status, then reload.",
    );
  });

  it("guides Edge users through its preview setup", () => {
    expect(promptReadinessMessage("unavailable", "edge")).toBe(
      "Edge can run the Prompt API in Canary and Dev, but it is not available here. Check Edge's AI settings and model status, then reload.",
    );
  });

  it("does not send unsupported browsers to Chrome settings", () => {
    expect(promptReadinessMessage("unavailable", "other")).toBe(
      "This browser does not support the on-device Prompt API. Open the playground in desktop Chrome or Edge.",
    );
  });
});
