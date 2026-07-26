import { memo, useEffect, useId, useRef, useState } from "react";
import { playground as ui } from "../../../../shared/ui.js";

interface Props {
  content: string;
  streaming?: boolean;
  durationMs?: number;
}

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/**
 * Self-contained streaming-speed counter shown under a rendered message:
 * elapsed time from the first streamed chunk plus char/word throughput.
 * Drop it into any transcript renderer so every preset reports speed
 * identically. Manages its own timing - pass `content` and `streaming`.
 */
function StreamStatsImpl({ content, streaming, durationMs }: Props) {
  const startRef = useRef<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const tooltipId = useId();

  useEffect(() => {
    if (!content) {
      startRef.current = null;
      setElapsedMs(0);
      return;
    }
    if (streaming && startRef.current === null) {
      startRef.current = performance.now();
    }
    if (startRef.current !== null) {
      setElapsedMs(performance.now() - startRef.current);
    }
  }, [content, streaming]);

  if (!content) return null;

  const chars = content.length;
  const words = countWords(content);
  // Completed turns remount from persisted conversation state. Prefer the
  // run duration captured by useAgent so their speed does not reset to 0.
  const measuredElapsedMs = durationMs ?? elapsedMs;
  const seconds = measuredElapsedMs / 1000;
  const charsPerSec = seconds > 0 ? chars / seconds : 0;
  const wordsPerSec = seconds > 0 ? words / seconds : 0;
  const status = streaming ? "streaming" : "done";

  return (
    <div className={ui.streamStats}>
      <button
        type="button"
        className={ui.streamStatsTrigger}
        aria-label="Response metrics"
        aria-describedby={tooltipId}
        onPointerMove={() => setTooltipVisible(true)}
        onPointerLeave={() => setTooltipVisible(false)}
        onFocus={() => setTooltipVisible(true)}
        onBlur={() => setTooltipVisible(false)}
      >
        <svg
          className={ui.streamStatsIcon}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            cx="12"
            cy="13.5"
            r="7.5"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <path
            d="M9.5 3h5M12 3v3M12 13.5l3-2"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <circle cx="12" cy="13.5" r="0.9" fill="currentColor" />
        </svg>
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        className={`${ui.streamStatsTooltip} ${
          tooltipVisible ? ui.streamStatsTooltipVisible : ""
        }`}
      >
        <span>{seconds.toFixed(1)}s</span>
        <span>{words} words</span>
        <span>{chars} chars</span>
        <span>{charsPerSec.toFixed(0)} ch/s</span>
        <span>{wordsPerSec.toFixed(1)} w/s</span>
        <span>{status}</span>
      </span>
    </div>
  );
}

export const StreamStats = memo(StreamStatsImpl);
