import { marked } from "marked";
import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";
import {
  caret,
  markdownProse,
  markdownProseEmpty,
  outputBox,
} from "../../../shared/ui.js";

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
 * Wire a Chrome Built-in AI `monitor` callback to React state. Returns the
 * monitor function to pass into `createOptions.monitor`, plus the current
 * progress (a fraction from 0..1) or `null` when no download is in flight.
 *
 * Chrome fires `downloadprogress` events with `loaded` as a 0..1 fraction
 * during the ~1.7 GB Gemini Nano download on a fresh profile.
 */
export const useDownloadMonitor = () => {
  const [progress, setProgress] = useState<number | null>(null);

  const monitor = useCallback((m: CreateMonitor) => {
    // Chrome emits a single `downloadprogress` with loaded=1 on warm starts
    // (model already cached) to signal readiness. Suppress that case so the
    // notice only surfaces for a real download in progress.
    let firstEvent = true;
    m.addEventListener("downloadprogress", (e) => {
      if (firstEvent && e.loaded >= 1) {
        firstEvent = false;
        return;
      }
      firstEvent = false;
      setProgress(e.loaded);
      if (e.loaded >= 1) {
        // Settle to "complete" briefly, then clear.
        setTimeout(() => setProgress(null), 600);
      }
    });
  }, []);

  const clear = useCallback(() => setProgress(null), []);

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

export const DownloadNotice = ({ progress }: { progress: number | null }) => {
  if (progress === null) return null;
  const pct = Math.round(progress * 100);
  return (
    <div className="flex flex-col gap-0 rounded-sm border border-hairline bg-surface px-3 py-[9px] font-mono text-[11.5px] text-fg-3">
      <div className="mb-1.5 flex justify-between">
        <span>Downloading on-device model…</span>
        <span className="tabular-nums">{pct}%</span>
      </div>
      <div className="h-1 overflow-hidden rounded-sm bg-surface-3">
        <div
          className="h-full bg-accent transition-[width] duration-200 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
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

  return { stats, start, update, finish };
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
      <span className="inline-flex items-center gap-1.5">
        <span className="text-fg-4">status</span>
        <span
          className={`tabular-nums text-fg-2 ${stats.status === "running" ? "text-accent" : ""}`}
        >
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

marked.use({ gfm: true, breaks: true });

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
  const html = useMemo(() => {
    if (!text) return "";
    return marked.parse(normalizeBullets(text)) as string;
  }, [text]);

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
      <div
        className="whitespace-normal"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: model output, demo only
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {cursor}
    </div>
  );
};

type NavigatorWithUserAgentData = Navigator & {
  userAgentData?: { brands?: Array<{ brand: string; version: string }> };
};

export const detectBrowser = (): "chrome" | "edge" | "other" => {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/\bEdg\//.test(ua)) return "edge";
  if (/\bChrome\//.test(ua)) return "chrome";
  return "other";
};

/** Desktop Chrome or Edge — excludes mobile UAs and other Chromium forks. */
export const isDesktopChromium = (): boolean => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(ua)) return false;

  const brands = (navigator as NavigatorWithUserAgentData).userAgentData
    ?.brands;
  if (brands) {
    return brands.some(
      (b) => b.brand === "Google Chrome" || b.brand === "Microsoft Edge",
    );
  }

  const browser = detectBrowser();
  return browser === "edge" || browser === "chrome";
};

export const detectModelName = (): string => {
  if (typeof globalThis === "undefined") return "on-device LM";
  const g = globalThis as Record<string, unknown>;
  const present =
    "LanguageModel" in g || "Summarizer" in g || "Translator" in g;
  if (!present) return "on-device LM";
  const browser = detectBrowser();
  if (browser === "edge") return "Phi-4-mini";
  if (browser === "chrome") return "Gemini Nano";
  return "on-device LM";
};

export const UnavailableNotice = ({
  api,
  flagSearch,
}: {
  api: string;
  flagSearch?: string;
}) => {
  const browser = detectBrowser();

  // Safari, Firefox, and mobile browsers (including Chrome and Edge on
  // iOS/Android, which report as "other") don't implement the Web AI
  // APIs, so Chrome/Edge flag instructions would mislead. These APIs are
  // desktop-only today; say so plainly.
  if (browser === "other") {
    return (
      <div className="block rounded-sm border border-[color-mix(in_oklch,var(--color-warn)_40%,var(--color-hairline))] bg-surface px-3 py-[9px] font-mono text-[11.5px] text-warn">
        <span>
          {api} isn't supported in this browser yet. The Web AI APIs currently
          run only on desktop Chrome and Edge (mobile browsers, including Chrome
          and Edge on iOS and Android, aren't supported yet). Open this page on
          desktop Chrome or Edge to try the demo.
        </span>
      </div>
    );
  }

  const scheme = browser === "edge" ? "edge://" : "chrome://";
  const browserName =
    browser === "edge" ? "Edge Canary/Dev 138+" : "Chrome 138+";
  return (
    <div className="block rounded-sm border border-[color-mix(in_oklch,var(--color-warn)_40%,var(--color-hairline))] bg-surface px-3 py-[9px] font-mono text-[11.5px] text-warn">
      <span>
        {api} unavailable in this browser.
        {flagSearch ? (
          <>
            {" "}
            Open <code>{`${scheme}flags/`}</code> in {browserName}, search for{" "}
            <code>{flagSearch}</code>, enable it, and reload.
          </>
        ) : (
          ` Open in ${browserName} to try it.`
        )}
      </span>
      {browser === "edge" && (
        <span className="mt-1.5 block text-[11px] text-fg-4">
          If the flag is enabled but the model still won't run, check{" "}
          <code>edge://on-device-internals</code>; the foundational model AND
          the supplementary safety models (GENERALIZED_SAFETY, TEXT_SAFETY,
          LANGUAGE_DETECTION) all need to show "Ready". Edge fails closed and
          blocks all output when any safety model is missing.
        </span>
      )}
    </div>
  );
};
