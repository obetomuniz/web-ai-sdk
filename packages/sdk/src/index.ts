/**
 * web-ai-sdk; meta-package that re-exports the five `@web-ai-sdk/*` building
 * blocks behind a single install. Each scoped package is also reachable via a
 * subpath import (e.g. `web-ai-sdk/prompt`, `web-ai-sdk/summarizer/react`).
 *
 * Two equivalent import shapes:
 *
 *   import { prompt, summarizer } from "web-ai-sdk";
 *   await prompt.prompt({ prompt: "Hello" });
 *
 *   // or
 *
 *   import { prompt } from "web-ai-sdk/prompt";
 *   import { useSummarizer } from "web-ai-sdk/summarizer/react";
 *
 * The namespaced root avoids name collisions between packages
 * (e.g. `checkAvailability` is defined in all five).
 */

export * as prompt from "@web-ai-sdk/prompt";
export * as webmcp from "@web-ai-sdk/webmcp";
export * as summarizer from "@web-ai-sdk/summarizer";
export * as translator from "@web-ai-sdk/translator";
export * as detector from "@web-ai-sdk/detector";
