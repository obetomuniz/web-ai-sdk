import { describe, expect, it } from "vitest";
import * as detectorSubpath from "./detector.js";
import * as sdk from "./index.js";
import * as promptSubpath from "./prompt.js";
import * as proofreaderSubpath from "./proofreader.js";
import * as rewriterSubpath from "./rewriter.js";
import * as summarizerSubpath from "./summarizer.js";
import * as translatorSubpath from "./translator.js";
import * as webmcpSubpath from "./webmcp.js";
import * as writerSubpath from "./writer.js";

// Smoke tests for the aggregator's two import shapes:
//   1. Namespaced root  (`import { prompt, summarizer } from "@web-ai-sdk/all"`).
//   2. Per-package subpath (`import { prompt } from "@web-ai-sdk/all/prompt"`).
//
// We check a single representative export from each package as a tripwire;
// the full APIs are covered by each scoped package's own tests.

// Compile-time tripwire: the shared result-cache options exist with the same
// names on every result-producing package.
type SharedCacheOptions = { cacheTtl?: number; cacheRefresh?: boolean };
const _cacheOptionTripwire: [
  Pick<sdk.prompt.AskOptions, "cacheTtl" | "cacheRefresh">,
  Pick<sdk.summarizer.SummarizeOptions, "cacheTtl" | "cacheRefresh">,
  Pick<sdk.translator.TranslateOptions, "cacheTtl" | "cacheRefresh">,
  Pick<sdk.detector.DetectOptions, "cacheTtl" | "cacheRefresh">,
  Pick<sdk.writer.WriteOptions, "cacheTtl" | "cacheRefresh">,
  Pick<sdk.rewriter.RewriteOptions, "cacheTtl" | "cacheRefresh">,
  Pick<sdk.proofreader.ProofreadOptions, "cacheTtl" | "cacheRefresh">,
] extends [
  SharedCacheOptions,
  SharedCacheOptions,
  SharedCacheOptions,
  SharedCacheOptions,
  SharedCacheOptions,
  SharedCacheOptions,
  SharedCacheOptions,
]
  ? true
  : never = true;
void _cacheOptionTripwire;

// Compile-time tripwire: every task package exposes the same lease shape from
// its prepare function.
type LeaseShape = { ready: Promise<void>; release(): void };
const _prepareLeaseTripwire: [
  ReturnType<typeof sdk.prompt.prepareLanguageModel>,
  ReturnType<typeof sdk.summarizer.prepareSummarizer>,
  ReturnType<typeof sdk.translator.prepareTranslator>,
  ReturnType<typeof sdk.detector.prepareLanguageDetector>,
  ReturnType<typeof sdk.writer.prepareWriter>,
  ReturnType<typeof sdk.rewriter.prepareRewriter>,
  ReturnType<typeof sdk.proofreader.prepareProofreader>,
] extends [
  LeaseShape,
  LeaseShape,
  LeaseShape,
  LeaseShape,
  LeaseShape,
  LeaseShape,
  LeaseShape,
]
  ? true
  : never = true;
void _prepareLeaseTripwire;

describe("web-ai-sdk root namespace", () => {
  it("exposes every scoped package", () => {
    expect(typeof sdk.prompt.ask).toBe("function");
    expect(typeof sdk.prompt.createSession).toBe("function");
    expect(typeof sdk.webmcp.registerTool).toBe("function");
    expect(typeof sdk.webmcp.getTools).toBe("function");
    expect(typeof sdk.webmcp.executeTool).toBe("function");
    expect(typeof sdk.webmcp.defineTool).toBe("function");
    expect(typeof sdk.summarizer.summarize).toBe("function");
    expect(typeof sdk.translator.translate).toBe("function");
    expect(typeof sdk.detector.detect).toBe("function");
    expect(typeof sdk.writer.write).toBe("function");
    expect(typeof sdk.rewriter.rewrite).toBe("function");
    expect(typeof sdk.proofreader.proofread).toBe("function");
  });

  it("exposes the prepare lifecycle on every task package", () => {
    expect(typeof sdk.prompt.prepareLanguageModel).toBe("function");
    expect(typeof sdk.summarizer.prepareSummarizer).toBe("function");
    expect(typeof sdk.translator.prepareTranslator).toBe("function");
    expect(typeof sdk.detector.prepareLanguageDetector).toBe("function");
    expect(typeof sdk.writer.prepareWriter).toBe("function");
    expect(typeof sdk.rewriter.prepareRewriter).toBe("function");
    expect(typeof sdk.proofreader.prepareProofreader).toBe("function");
    expect(typeof sdk.prompt.clearLanguageModelSessions).toBe("function");
    expect(typeof sdk.summarizer.clearSummarizerSessions).toBe("function");
    expect(typeof sdk.translator.clearTranslatorSessions).toBe("function");
    expect(typeof sdk.detector.clearLanguageDetectorSessions).toBe("function");
    expect(typeof sdk.writer.clearWriterSessions).toBe("function");
    expect(typeof sdk.rewriter.clearRewriterSessions).toBe("function");
    expect(typeof sdk.proofreader.clearProofreaderSessions).toBe("function");
  });

  it("exposes the shared cache TTL default on result-producing packages", () => {
    const oneHour = 60 * 60 * 1000;
    expect(sdk.prompt.DEFAULT_CACHE_TTL_MS).toBe(oneHour);
    expect(sdk.summarizer.DEFAULT_CACHE_TTL_MS).toBe(oneHour);
    expect(sdk.translator.DEFAULT_CACHE_TTL_MS).toBe(oneHour);
    expect(sdk.detector.DEFAULT_CACHE_TTL_MS).toBe(oneHour);
    expect(sdk.writer.DEFAULT_CACHE_TTL_MS).toBe(oneHour);
    expect(sdk.rewriter.DEFAULT_CACHE_TTL_MS).toBe(oneHour);
    expect(sdk.proofreader.DEFAULT_CACHE_TTL_MS).toBe(oneHour);
  });
});

describe("web-ai-sdk per-package subpaths", () => {
  it("mirrors the same surface as the scoped packages", () => {
    expect(typeof promptSubpath.ask).toBe("function");
    expect(typeof promptSubpath.createSession).toBe("function");
    expect(typeof webmcpSubpath.registerTool).toBe("function");
    expect(typeof webmcpSubpath.getTools).toBe("function");
    expect(typeof webmcpSubpath.executeTool).toBe("function");
    expect(typeof webmcpSubpath.defineTool).toBe("function");
    expect(typeof summarizerSubpath.summarize).toBe("function");
    expect(typeof translatorSubpath.translate).toBe("function");
    expect(typeof detectorSubpath.detect).toBe("function");
    expect(typeof writerSubpath.write).toBe("function");
    expect(typeof rewriterSubpath.rewrite).toBe("function");
    expect(typeof proofreaderSubpath.proofread).toBe("function");
  });
});
