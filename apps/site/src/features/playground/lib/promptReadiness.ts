import type { LanguageModelAvailability } from "@web-ai-sdk/prompt";
import { detectBrowser, type WebAIBrowser } from "../../../shared/browser.js";

export type PromptReadiness =
  | LanguageModelAvailability
  | "checking"
  | "unknown";

export function promptIsReady(readiness: PromptReadiness): boolean {
  return (
    readiness === "checking" ||
    readiness === "available" ||
    readiness === "unknown"
  );
}

export function promptReadinessMessage(
  readiness: PromptReadiness,
  browser: WebAIBrowser = detectBrowser(),
): string {
  switch (readiness) {
    case "downloadable":
    case "downloading":
      return `${browserName(browser)} is preparing the on-device model. Keep this page open while it finishes.`;
    case "unavailable":
      return unavailableMessage(browser);
    case "available":
    case "checking":
    case "unknown":
      return "";
  }
}

function browserName(browser: WebAIBrowser): string {
  if (browser === "chrome") return "Chrome";
  if (browser === "edge") return "Edge";
  return "Your browser";
}

function unavailableMessage(browser: WebAIBrowser): string {
  if (browser === "chrome") {
    return "The Prompt API is unavailable. Check Chrome's version, AI settings, and model status. Then reload.";
  }
  if (browser === "edge") {
    return "The Prompt API is unavailable. Check Edge's channel, AI settings, and model status. Then reload.";
  }
  return "This browser does not support the Prompt API. Open the Playground in desktop Chrome or Edge.";
}
