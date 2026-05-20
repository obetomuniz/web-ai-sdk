import { describe, expect, it } from "vitest";

import * as sdk from "./index.js";

import * as detectorSubpath from "./detector.js";
import * as promptSubpath from "./prompt.js";
import * as summarizerSubpath from "./summarizer.js";
import * as translatorSubpath from "./translator.js";
import * as webmcpSubpath from "./webmcp.js";

// Smoke tests for the aggregator's two import shapes:
//   1. Namespaced root  (`import { prompt, summarizer } from "@web-ai-sdk/all"`).
//   2. Per-package subpath (`import { prompt } from "@web-ai-sdk/all/prompt"`).
//
// We check a single representative export from each package as a tripwire;
// the full APIs are covered by each scoped package's own tests.

describe("web-ai-sdk root namespace", () => {
  it("exposes prompt, webmcp, summarizer, translator, detector", () => {
    expect(typeof sdk.prompt.ask).toBe("function");
    expect(typeof sdk.prompt.createSession).toBe("function");
    expect(typeof sdk.webmcp.registerTool).toBe("function");
    expect(typeof sdk.webmcp.defineTool).toBe("function");
    expect(typeof sdk.summarizer.summarize).toBe("function");
    expect(typeof sdk.translator.translate).toBe("function");
    expect(typeof sdk.detector.detect).toBe("function");
  });
});

describe("web-ai-sdk per-package subpaths", () => {
  it("mirrors the same surface as the scoped packages", () => {
    expect(typeof promptSubpath.ask).toBe("function");
    expect(typeof promptSubpath.createSession).toBe("function");
    expect(typeof webmcpSubpath.registerTool).toBe("function");
    expect(typeof webmcpSubpath.defineTool).toBe("function");
    expect(typeof summarizerSubpath.summarize).toBe("function");
    expect(typeof translatorSubpath.translate).toBe("function");
    expect(typeof detectorSubpath.detect).toBe("function");
  });
});
