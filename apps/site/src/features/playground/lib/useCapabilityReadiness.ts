import {
  checkAvailability as checkDetector,
  isAvailable as detectorExposed,
} from "@web-ai-sdk/detector";
import { isAvailable as proofreaderExposed } from "@web-ai-sdk/proofreader";
import { isAvailable as rewriterExposed } from "@web-ai-sdk/rewriter";
import {
  checkAvailability as checkSummarizer,
  isAvailable as summarizerExposed,
} from "@web-ai-sdk/summarizer";
import { isAvailable as translatorExposed } from "@web-ai-sdk/translator";
import { isAvailable as writerExposed } from "@web-ai-sdk/writer";
import { useEffect, useState } from "react";
import { toolOutcome } from "../experimental/agent/toolOutcome.js";
import type { AgentEvent } from "../experimental/agent/types.js";
import type { AgentMode } from "../experimental/playground/presets.js";

export interface CapabilityCheck {
  label: string;
  detail: string;
  state: string;
}
const exposure: Record<string, () => boolean> = {
  Writer: writerExposed,
  Rewriter: rewriterExposed,
  Proofreader: proofreaderExposed,
  Summarizer: summarizerExposed,
  Translator: translatorExposed,
  "Language Detector": detectorExposed,
};
export const titleOptions = {
  language: "und",
  type: "headline" as const,
  length: "short" as const,
  format: "plain-text" as const,
  preference: "auto" as const,
  sharedContext:
    "Create a concise, specific title for this AI conversation. Return only the title.",
};

/** Passive checks never create sessions. Unknown task options keep models lazy. */
export function useCapabilityReadiness(
  mode: AgentMode,
  events: AgentEvent[],
  titleLifecycle?: string | null,
) {
  const [titleState, setTitleState] = useState("checking");
  const [detectorState, setDetectorState] = useState("checking");
  const usesDetector = mode.tools.some(
    (tool) => tool.capability === "Language Detector",
  );
  useEffect(() => {
    let active = true;
    if (!summarizerExposed()) setTitleState("unavailable");
    else
      void checkSummarizer({
        type: titleOptions.type,
        length: titleOptions.length,
        format: titleOptions.format,
        preference: titleOptions.preference,
      }).then((state) => {
        if (active) setTitleState(state ?? "unknown");
      });
    if (usesDetector) {
      if (!detectorExposed()) setDetectorState("unavailable");
      else
        void checkDetector().then((state) => {
          if (active) setDetectorState(state ?? "unknown");
        });
    }
    return () => {
      active = false;
    };
  }, [usesDetector]);

  const checks: CapabilityCheck[] = [
    {
      label: "Summarizer · titles",
      detail:
        "Headline, short, automatic preference; created after the first completed response",
      state: titleLifecycle ?? titleState,
    },
  ];
  for (const tool of mode.tools) {
    if (!tool.capability) continue;
    const exposed = exposure[tool.capability]?.() ?? false;
    const check = {
      label: tool.capability,
      detail: exposed
        ? "API exposed; readiness checked for task options after Send"
        : "API not exposed",
      state: exposed ? "unknown" : "unavailable",
    };
    if (tool.capability === "Language Detector" && exposed)
      check.state = detectorState;
    // Each actual pair/configuration gets its own row, including parallel translations.
    const calls = events.filter(
      (event): event is Extract<AgentEvent, { type: "tool_call" }> =>
        event.type === "tool_call" && event.name === tool.name,
    );
    if (calls.length === 0) checks.push(check);
    for (const call of calls) {
      const {
        text: _text,
        task: _task,
        context: _context,
        ...config
      } = call.input;
      const taskCheck = {
        ...check,
        label: `${check.label} · ${call.callId}`,
        detail: `${tool.name} · ${Object.keys(config).length ? JSON.stringify(config) : "default options"}`,
      };
      for (const event of events) {
        if (
          event.type === "tool_progress" &&
          event.callId === call.callId &&
          event.data &&
          typeof event.data === "object"
        ) {
          const progress = event.data as {
            phase?: string;
            state?: string;
            loaded?: number;
          };
          if (progress.phase === "readiness")
            taskCheck.state = progress.state ?? "unknown";
          if (progress.phase === "download") {
            taskCheck.state = "downloading";
            taskCheck.detail += ` · ${Math.round((progress.loaded ?? 0) * 100)}%`;
          }
        }
        if (event.type === "tool_result" && event.callId === call.callId) {
          const outcome = toolOutcome(event);
          if (outcome === "success")
            taskCheck.state =
              event.output &&
              typeof event.output === "object" &&
              (event.output as { unchanged?: boolean }).unchanged
                ? "not required"
                : "available";
          else taskCheck.state = outcome;
        }
      }
      checks.push(taskCheck);
    }
  }
  return checks;
}
