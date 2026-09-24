import { isAvailable as detectorAvailable } from "@web-ai-sdk/detector";
import { isAvailable as proofreaderAvailable } from "@web-ai-sdk/proofreader";
import { isAvailable as rewriterAvailable } from "@web-ai-sdk/rewriter";
import {
  checkAvailability as checkSummarizer,
  isAvailable as summarizerAvailable,
} from "@web-ai-sdk/summarizer";
import { isAvailable as translatorAvailable } from "@web-ai-sdk/translator";
import { isAvailable as writerAvailable } from "@web-ai-sdk/writer";
import { useEffect, useState } from "react";
import type { AgentEvent, AgentTool } from "../experimental/agent/types.js";

export interface CapabilityCheck {
  label: string;
  detail: string;
  state:
    | "ready"
    | "checking"
    | "download"
    | "downloading"
    | "unavailable"
    | "unknown"
    | "error";
}

const capabilities = [
  {
    tool: "summarize_text",
    label: "Summarizer API",
    exposed: summarizerAvailable,
  },
  {
    tool: "translate_text",
    label: "Translator API",
    exposed: translatorAvailable,
  },
  {
    tool: "detect_language",
    label: "Language Detector API",
    exposed: detectorAvailable,
  },
  { tool: "write_text", label: "Writer API", exposed: writerAvailable },
  { tool: "rewrite_text", label: "Rewriter API", exposed: rewriterAvailable },
  {
    tool: "proofread_text",
    label: "Proofreader API",
    exposed: proofreaderAvailable,
  },
];

export function selectedCapabilityChecks(
  tools: readonly AgentTool[],
): CapabilityCheck[] {
  return capabilities
    .filter((capability) => tools.some((tool) => tool.name === capability.tool))
    .map((capability) => ({
      label: capability.label,
      detail: capability.exposed()
        ? capability.tool === "translate_text"
          ? "API exposed; language pair checked when translation is requested"
          : "API exposed; task options checked when requested"
        : "API not exposed in this browser",
      state: capability.exposed() ? "unknown" : "unavailable",
    }));
}

export function useCapabilityChecks(
  tools: readonly AgentTool[],
  events: readonly AgentEvent[] = [],
): CapabilityCheck[] {
  const [titleState, setTitleState] =
    useState<CapabilityCheck["state"]>("checking");
  useEffect(() => {
    let active = true;
    if (!summarizerAvailable()) {
      setTitleState("unavailable");
      return;
    }
    void checkSummarizer({
      type: "headline",
      length: "short",
      format: "plain-text",
      preference: "auto",
    }).then((state) => {
      if (active)
        setTitleState(
          state === "available"
            ? "ready"
            : state === "downloadable"
              ? "download"
              : (state ?? "unknown"),
        );
    });
    return () => {
      active = false;
    };
  }, []);
  // Live run events end with each turn; keep the last observed state.
  const [observed, setObserved] = useState<
    Record<string, Pick<CapabilityCheck, "state" | "detail">>
  >({});
  useEffect(() => {
    const updates = Object.fromEntries(
      capabilities.flatMap((capability) => {
        const seen = observeCapability(capability.tool, events);
        return seen ? [[capability.tool, seen]] : [];
      }),
    );
    if (Object.keys(updates).length === 0) return;
    setObserved((current) =>
      Object.entries(updates).every(
        ([tool, seen]) =>
          current[tool]?.state === seen.state &&
          current[tool]?.detail === seen.detail,
      )
        ? current
        : { ...current, ...updates },
    );
  }, [events]);
  return [
    ...selectedCapabilityChecks(tools).map((check) => {
      const tool = capabilities.find(
        (candidate) => candidate.label === check.label,
      )?.tool;
      const seen = tool ? observed[tool] : undefined;
      return seen ? { ...check, ...seen } : check;
    }),
    {
      label: "Conversation titles",
      detail: "Summarizer: headline, short; request text is the fallback",
      state: titleState,
    },
  ];
}

function observeCapability(
  tool: string,
  events: readonly AgentEvent[],
): Pick<CapabilityCheck, "state" | "detail"> | null {
  const progress = events
    .filter((event) => event.type === "tool_progress" && event.name === tool)
    .at(-1);
  if (
    progress?.type !== "tool_progress" ||
    !progress.data ||
    typeof progress.data !== "object"
  )
    return null;
  const data = progress.data as {
    phase?: string;
    state?: string;
    loaded?: number;
  };
  if (data.phase === "download")
    return {
      state: "downloading",
      detail: `Model download: ${Math.round((data.loaded ?? 0) * 100)}%`,
    };
  // Tools report the options the SDK actually used, after normalization.
  const reported = events.find(
    (event) =>
      event.type === "tool_progress" &&
      event.callId === progress.callId &&
      typeof event.data === "object" &&
      event.data !== null &&
      "options" in event.data,
  );
  const state: CapabilityCheck["state"] =
    data.state === "available" || data.phase === "output"
      ? "ready"
      : data.state === "downloadable"
        ? "download"
        : data.state === "unavailable"
          ? "unavailable"
          : data.state === "downloading"
            ? "downloading"
            : "unknown";
  const options =
    reported?.type === "tool_progress"
      ? Object.entries(
          (reported.data as { options: Record<string, unknown> }).options,
        ).filter(([, value]) => value !== undefined)
      : [];
  return {
    state,
    detail: options.length
      ? `Last task options: ${options
          .map(([key, value]) => `${key} ${String(value)}`)
          .join(", ")}`
      : "Last task used default options",
  };
}
