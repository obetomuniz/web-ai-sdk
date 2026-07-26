import type { LanguageModelAvailability } from "@web-ai-sdk/prompt";

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

export function promptReadinessMessage(readiness: PromptReadiness): string {
  switch (readiness) {
    case "downloadable":
    case "downloading":
      return "Chrome is preparing the on-device model. Keep this page open while it finishes.";
    case "unavailable":
      return "The on-device model is not available in this browser. Check Chrome settings and reload the page.";
    case "available":
    case "checking":
    case "unknown":
      return "";
  }
}
