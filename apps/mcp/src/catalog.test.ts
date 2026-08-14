import { describe, expect, it } from "vitest";
import {
  browserSupport,
  documents,
  getBrowserSupport,
  readDocumentation,
  searchDocumentation,
} from "./catalog.js";

describe("documentation catalog", () => {
  it("indexes every checked-in documentation page", () => {
    expect(documents).toHaveLength(33);
    expect(new Set(documents.map((document) => document.id)).size).toBe(33);
    expect(documents.every((document) => document.body.length > 0)).toBe(true);
  });

  it("removes render-only MDX from agent-facing content", () => {
    const browserSupportDoc = readDocumentation("browser-support");
    const reactPrompt = readDocumentation("react/use-prompt");

    expect(browserSupportDoc?.body).toContain("| Package | Chrome | Edge |");
    expect(browserSupportDoc?.body).not.toContain("BrowserTableHeading");
    expect(reactPrompt?.body).not.toContain("<DemoSlot");
    expect(reactPrompt?.body).not.toContain("<PromptDemo");
    expect(reactPrompt?.body).toContain(
      'import { usePrompt } from "@web-ai-sdk/prompt/react";',
    );
  });

  it("searches titles, package identities, descriptions, and bodies", () => {
    expect(searchDocumentation("@web-ai-sdk/prompt", 1)[0]?.id).toBe(
      "packages/prompt",
    );
    expect(searchDocumentation("session reuse").length).toBeGreaterThan(0);
    expect(searchDocumentation("definitely-not-in-these-docs")).toEqual([]);
  });

  it("reads documents through agent-friendly identifiers", () => {
    expect(readDocumentation("web-ai-sdk://docs/guides/webmcp")?.id).toBe(
      "guides/webmcp",
    );
    expect(readDocumentation("https://web-ai-sdk.dev/docs/")?.id).toBe("index");
    expect(readDocumentation("@web-ai-sdk/translator")?.id).toBe(
      "packages/translator",
    );
  });

  it("derives browser support from the canonical support table", () => {
    expect(browserSupport).toHaveLength(8);
    expect(getBrowserSupport("Language Detector")[0]?.package).toBe(
      "@web-ai-sdk/detector",
    );
    expect(getBrowserSupport("@web-ai-sdk/webmcp")[0]?.chrome).toContain(
      "OT from 149",
    );
  });
});
