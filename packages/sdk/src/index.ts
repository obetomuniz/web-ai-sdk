/**
 * @web-ai-sdk/all; meta-package that re-exports the `@web-ai-sdk/*` building
 * blocks behind a single install. Each scoped package is also reachable via a
 * subpath import (e.g. `@web-ai-sdk/all/prompt`,
 * `@web-ai-sdk/all/summarizer/react`).
 *
 * Two equivalent import shapes:
 *
 *   import { prompt, summarizer } from "@web-ai-sdk/all";
 *   await prompt.ask({ input: "Hello" });
 *
 *   // or
 *
 *   import { ask } from "@web-ai-sdk/all/prompt";
 *   import { useSummarizer } from "@web-ai-sdk/all/summarizer/react";
 *
 * The namespaced root avoids name collisions between packages
 * (e.g. `checkAvailability` is defined in most of them).
 */

export * as detector from "@web-ai-sdk/detector";
export * as prompt from "@web-ai-sdk/prompt";
export * as proofreader from "@web-ai-sdk/proofreader";
export * as rewriter from "@web-ai-sdk/rewriter";
export * as summarizer from "@web-ai-sdk/summarizer";
export * as translator from "@web-ai-sdk/translator";
export * as webmcp from "@web-ai-sdk/webmcp";
export * as writer from "@web-ai-sdk/writer";
