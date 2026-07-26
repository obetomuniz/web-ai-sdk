import { useEffect, useRef, useState } from "react";
import { playground as ui } from "../../../../shared/ui.js";
import { StreamStats } from "./StreamStats.js";

interface Props {
  content: string;
  streaming?: boolean;
  durationMs?: number;
}

type CopyState = "idle" | "copied" | "error";

export function ResponseActions({ content, streaming, durationMs }: Props) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const resetTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    },
    [],
  );

  if (!content) return null;

  const copy = async () => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard unavailable");
      }
      await navigator.clipboard.writeText(content);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = window.setTimeout(() => setCopyState("idle"), 1600);
  };

  const copyLabel =
    copyState === "copied"
      ? "Response copied"
      : copyState === "error"
        ? "Couldn't copy response"
        : "Copy response";

  return (
    <div className={ui.responseActions}>
      <span className={ui.responseAction}>
        <button
          type="button"
          className={ui.responseActionTrigger}
          onClick={() => void copy()}
          aria-label={copyLabel}
        >
          {copyState === "copied" ? (
            <svg
              className={ui.responseActionIcon}
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="m6.5 12.5 3.5 3.5 7.5-8"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg
              className={ui.responseActionIcon}
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <rect
                x="8"
                y="8"
                width="10"
                height="11"
                rx="2"
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <path
                d="M15 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          )}
        </button>
        <span role="tooltip" className={ui.responseActionTooltip}>
          {copyLabel}
        </span>
      </span>
      <StreamStats
        content={content}
        streaming={streaming}
        durationMs={durationMs}
      />
    </div>
  );
}
