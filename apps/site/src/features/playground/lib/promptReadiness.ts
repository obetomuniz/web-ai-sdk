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

export function promptReadinessLabel(readiness: PromptReadiness): string {
  switch (readiness) {
    case "available":
      return "On";
    case "downloadable":
      return "Download";
    case "downloading":
      return "Downloading";
    case "checking":
    case "unknown":
      return "On";
    case "unavailable":
      return "Off";
  }
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
    return "Chrome can run the Prompt API, but it is not available here. Check Chrome's version, built-in AI settings, and model status, then reload.";
  }
  if (browser === "edge") {
    return "Edge can run the Prompt API in Canary and Dev, but it is not available here. Check Edge's AI settings and model status, then reload.";
  }
  return "This browser does not support the on-device Prompt API. Open the playground in desktop Chrome or Edge.";
}
