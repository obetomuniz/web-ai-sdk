import { type ReactNode, useCallback, useRef, useState } from "react";
import { ModelMarkdown } from "../../../shared/components/ModelMarkdown.js";
import {
  caret,
  demoIconBtn,
  demoTooltip,
  demoTooltipBelow,
  demoTooltipWrap,
  markdownProse,
  markdownProseEmpty,
  outputBox,
} from "../../../shared/ui.js";

const browserSupportHref = `${import.meta.env.BASE_URL}docs/browser-support/`;

/**
 * TTL for demo result caches. Deterministic demos reuse a result for ten
 * minutes, then expire it. Creative demos do not cache at all.
 */
export const DEMO_RESULT_TTL_MS = 10 * 60 * 1000;

/** Props every package demo accepts from the explorer tab strip. */
export interface DemoIntentProps {
  /** True once the user selected this package tab. */
  intent?: boolean;
}

interface DownloadProgressEvent extends Event {
  readonly loaded: number;
}
interface CreateMonitor {
  addEventListener(
    type: "downloadprogress",
    listener: (event: DownloadProgressEvent) => void,
  ): void;
}

/**
 * Wire a Built-in AI `monitor` callback to React state. Returns the
 * monitor function to pass into `createOptions.monitor`, plus the current
 * progress (a fraction from 0..1) or `null` when no download is in flight.
 * Warm-model creations emit `downloadprogress` with loaded 0 and 1 only;
 * those events are ignored so the indicator surfaces for real downloads.
 */
export const useDownloadMonitor = () => {
  const [progress, setProgress] = useState<number | null>(null);
  // Tracked outside React state so completion can schedule its clear timer
  // without side effects inside a state updater.
  const visibleRef = useRef(false);

  const monitor = useCallback((m: CreateMonitor) => {
    m.addEventListener("downloadprogress", (e) => {
      if (e.loaded <= 0) return;
      if (e.loaded >= 1) {
        // Settle to "complete" briefly, then clear; stay hidden when no
        // fractional progress ever showed (warm start).
        if (!visibleRef.current) return;
        visibleRef.current = false;
        setProgress(1);
        setTimeout(() => setProgress(null), 900);
        return;
      }
      visibleRef.current = true;
      setProgress(e.loaded);
    });
  }, []);

  const clear = useCallback(() => {
    visibleRef.current = false;
    setProgress(null);
  }, []);

  return { progress, monitor, clear };
};

export const ErrorNotice = ({ error }: { error: string | null }) => {
  if (!error) return null;
  return (
    <div className="block rounded-sm border border-[color-mix(in_oklch,var(--color-err)_40%,var(--color-hairline))] bg-surface px-3 py-[9px] font-mono text-[11.5px] text-err">
      <strong className="mb-1 block">Run failed</strong>
      <span className="text-[11px]">{error}</span>
    </div>
  );
};

export const InfoNotice = ({ message }: { message: string | null }) => {
  if (!message) return null;
  return (
    <div className="block rounded-sm border border-[color-mix(in_oklch,var(--color-info)_40%,var(--color-hairline))] bg-surface px-3 py-[9px] font-mono text-[11.5px] text-info">
      <span className="text-[11px]">{message}</span>
    </div>
  );
};

export const WarnNotice = ({ message }: { message: string | null }) => {
  if (!message) return null;
  return (
    <div className="block rounded-sm border border-[color-mix(in_oklch,var(--color-warn)_40%,var(--color-hairline))] bg-surface px-3 py-[9px] font-mono text-[11.5px] text-warn">
      <span className="text-[11px]">{message}</span>
    </div>
  );
};

const DONUT_RADIUS = 5.5;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

/**
 * Minimal donut progress indicator for model downloads. Lives in the card
 * header, so it never shifts the demo layout. A custom tooltip carries the
 * detail on hover or focus.
 */
export const DownloadDonut = ({ progress }: { progress: number | null }) => {
  if (progress === null) return null;
  const pct = Math.round(progress * 100);
  const filled = (
    Math.min(Math.max(progress, 0), 1) * DONUT_CIRCUMFERENCE
  ).toFixed(2);
  return (
    // The aria-label on the live region carries the detail for keyboard and
    // screen-reader users; the tooltip is pointer-hover supplementary text.
    <span className={demoTooltipWrap}>
      <svg
        width="14"
        height="14"
        viewBox="0 0 15 15"
        role="status"
        aria-label={`Downloading on-device model ${pct}%`}
        className="shrink-0"
      >
        <circle
          cx="7.5"
          cy="7.5"
          r={DONUT_RADIUS}
          fill="none"
          stroke="var(--color-hairline-2)"
          strokeWidth="2.5"
        />
        <circle
          cx="7.5"
          cy="7.5"
          r={DONUT_RADIUS}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${DONUT_CIRCUMFERENCE.toFixed(2)}`}
          transform="rotate(-90 7.5 7.5)"
          className="transition-[stroke-dasharray] duration-200 ease-out"
        />
      </svg>
      <span className={demoTooltipBelow}>
        Downloading on-device model {pct}%
      </span>
    </span>
  );
};

export interface StreamStats {
  chars: number;
  ms: number;
  tps: number;
  status: string;
}

/**
 * Lightweight streaming stats helper. Tracks elapsed ms, chars, and
 * approximate tok/s for any streaming demo. Independent of the underlying
 * library so each demo can drop it in.
 */
export const useStreamStats = () => {
  const [stats, setStats] = useState<StreamStats>({
    chars: 0,
    ms: 0,
    tps: 0,
    status: "idle",
  });
  const startRef = useRef(0);

  const start = () => {
    startRef.current = performance.now();
    setStats({ chars: 0, ms: 0, tps: 0, status: "running" });
  };
  const update = (text: string) => {
    const ms = performance.now() - startRef.current;
    const chars = text.length;
    const tps = ms > 0 ? Math.round(chars / 4 / (ms / 1000)) : 0;
    setStats({ chars, ms: Math.round(ms), tps, status: "running" });
  };
  const finish = (status = "done") => {
    setStats((s) => ({ ...s, status }));
  };
  const reset = () => {
    setStats({ chars: 0, ms: 0, tps: 0, status: "idle" });
  };

  return { stats, start, update, finish, reset };
};

// Status colors follow DESIGN.md: warn for stale input, err for failures,
// accent for live work, neutral foreground otherwise.
const statusToneClass = (status: string): string => {
  if (status === "running") return "text-accent";
  if (status === "stale") return "text-warn";
  if (status === "error" || status === "unavailable") return "text-err";
  return "text-fg-2";
};

export const StatusBar = ({
  stats,
  label,
  extra,
}: {
  stats: StreamStats;
  label: string;
  extra?: ReactNode;
}) => (
  <div className="flex flex-wrap items-center justify-between gap-x-3.5 gap-y-2 font-mono text-[11px] tracking-[0.04em] text-fg-4 max-[480px]:gap-x-3.5 max-[480px]:gap-y-2">
    <div className="flex items-center gap-3.5">
      <span role="status" className="inline-flex items-center gap-1.5">
        <span className="text-fg-4">status</span>
        <span className={`tabular-nums ${statusToneClass(stats.status)}`}>
          {stats.status}
        </span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="text-fg-4">tok</span>
        <span className="tabular-nums text-fg-2">
          {Math.round(stats.chars / 4)}
        </span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="text-fg-4">ms</span>
        <span className="tabular-nums text-fg-2">{stats.ms}</span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="text-fg-4">tok/s</span>
        <span className="tabular-nums text-accent">{stats.tps}</span>
      </span>
    </div>
    <div className="flex items-center gap-3.5">
      {extra}
      <span className="inline-flex items-center gap-1.5">
        <span className="text-fg-4">{label}</span>
      </span>
    </div>
  </div>
);

const outputBase = outputBox;

export const Output = ({
  text,
  streaming,
  placeholder,
  className = "",
}: {
  text: string;
  streaming: boolean;
  placeholder: string;
  className?: string;
}) => (
  <div
    className={`${outputBase} ${!text ? "text-fg-4 italic" : ""} ${className}`}
  >
    {text || placeholder}
    {streaming && <span className={`${caret} ml-[0.15em]`} />}
  </div>
);

const normalizeBullets = (text: string): string => {
  if (!/^[*-]\s/.test(text)) return text;
  return text.replace(/([^\n])\s+[*-]\s+/g, "$1\n* ");
};

export const MarkdownOutput = ({
  text,
  streaming,
  placeholder,
  className = "",
}: {
  text: string;
  streaming: boolean;
  placeholder: string;
  className?: string;
}) => {
  const cursor = streaming ? <span className={`${caret} ml-[0.15em]`} /> : null;

  if (!text) {
    return (
      <div
        className={`${outputBase} ${markdownProseEmpty} text-fg-4 italic ${className}`}
      >
        {placeholder}
        {cursor}
      </div>
    );
  }
  return (
    <div className={`${outputBase} ${markdownProse} ${className}`}>
      <ModelMarkdown
        content={normalizeBullets(text)}
        streaming={streaming}
        className="whitespace-normal"
      />
      {cursor}
    </div>
  );
};

/**
 * Icon-only fresh-generation control shown once a run has completed.
 * Skips the cache read and replaces the stored value.
 */
export const FreshRunButton = ({
  show,
  onClick,
}: {
  show: boolean;
  onClick: () => void;
}) => {
  if (!show) return null;
  return (
    <span className={demoTooltipWrap}>
      <button
        type="button"
        className={demoIconBtn}
        onClick={onClick}
        aria-label="Fresh run"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
        </svg>
      </button>
      <span className={demoTooltip}>
        Skip the cached result and run the model again
      </span>
    </span>
  );
};

/**
 * Wraps a demo's primary Run control. While a cached result is on screen,
 * hovering the control explains that the run serves from the cache.
 */
export const CacheAwareRun = ({
  cached,
  children,
}: {
  cached: boolean;
  children: ReactNode;
}) => {
  if (!cached) return <>{children}</>;
  return (
    <span className={demoTooltipWrap}>
      {children}
      <span className={demoTooltip}>
        Serves the cached result instantly. Use ⟳ for a fresh generation.
      </span>
    </span>
  );
};

/**
 * Shown when the input changed after a completed run. The previous result
 * stays visible until a new run starts or the user dismisses it.
 */
export const StaleNotice = ({
  show,
  onDismiss,
}: {
  show: boolean;
  onDismiss: () => void;
}) => {
  if (!show) return null;
  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 rounded-sm border border-[color-mix(in_oklch,var(--color-warn)_40%,var(--color-hairline))] bg-surface px-3 py-[9px] font-mono text-[11.5px] text-warn"
    >
      <span className="text-[11px]">
        The input changed after this result. Run again to update it.
      </span>
      <button
        type="button"
        className="shrink-0 cursor-pointer rounded-sm border border-hairline-2 px-1.5 py-0.5 text-[12px] leading-none text-fg-2 hover:bg-surface-3"
        onClick={onDismiss}
        aria-label="Dismiss result"
      >
        ×
      </button>
    </div>
  );
};

export const UnavailableNotice = ({ api }: { api: string }) => {
  return (
    <div className="block rounded-sm border border-[color-mix(in_oklch,var(--color-warn)_40%,var(--color-hairline))] bg-surface px-3 py-[9px] font-mono text-[11.5px] text-warn">
      <span>
        {api} unavailable. See the{" "}
        <a className="underline underline-offset-2" href={browserSupportHref}>
          sourced browser-support guide
        </a>{" "}
        for current channels, trials, flags, and hardware requirements.
      </span>
    </div>
  );
};
