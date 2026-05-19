import { marked } from "marked";
import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";

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
    <div className="notice err" style={{ display: "block" }}>
      <strong style={{ display: "block", marginBottom: 4 }}>Run failed</strong>
      <span style={{ fontSize: "11px" }}>{error}</span>
    </div>
  );
};

export const DownloadNotice = ({ progress }: { progress: number | null }) => {
  if (progress === null) return null;
  const pct = Math.round(progress * 100);
  return (
    <div className="notice" style={{ display: "block" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <span>Downloading on-device model…</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{pct}%</span>
      </div>
      <div
        style={{
          height: 4,
          background: "var(--surface-3)",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: "var(--accent)",
            transition: "width 0.2s ease",
          }}
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
  <div className="status-bar">
    <div className="group">
      <span className="stat">
        <span className="k">status</span>
        <span className={`v ${stats.status === "running" ? "running" : ""}`}>
          {stats.status}
        </span>
      </span>
      <span className="stat">
        <span className="k">tok</span>
        <span className="v">{Math.round(stats.chars / 4)}</span>
      </span>
      <span className="stat">
        <span className="k">ms</span>
        <span className="v">{stats.ms}</span>
      </span>
      <span className="stat live">
        <span className="k">tok/s</span>
        <span className="v">{stats.tps}</span>
      </span>
    </div>
    <div className="group">
      {extra}
      <span className="stat">
        <span className="k">{label}</span>
      </span>
    </div>
  </div>
);

export const Output = ({
  text,
  streaming,
  placeholder,
  style,
}: {
  text: string;
  streaming: boolean;
  placeholder: string;
  style?: React.CSSProperties;
}) => (
  <div className={`output ${!text ? "empty" : ""}`} style={style}>
    {text || placeholder}
    {streaming && <span className="cursor" />}
  </div>
);

// Tune marked once: GFM tables + lists, line breaks treated as <br/>.
// We render to a sandbox element scoped by `.markdown` so the styles can't
// leak into the wider landing CSS.
marked.use({ gfm: true, breaks: true });

/**
 * Normalize inline-bullet runs before parsing.
 *
 * Phi-4-mini (and occasionally Gemini Nano in `key-points` mode) emits
 * bullet lists as a single line like:
 *
 *     "* item one. * item two. * item three."
 *
 * Marked correctly parses the first `* ` as a list item but treats the
 * remaining `* ` markers as literal asterisks inside the paragraph,
 * because the list-item rule requires a newline before each marker.
 *
 * This pre-pass detects that pattern and promotes each inline marker to
 * its own line so marked renders one `<li>` per item. Only runs when the
 * text begins with a bullet marker, so prose containing an asterisk
 * mid-sentence ("use 5 * 3") is untouched.
 */
const normalizeBullets = (text: string): string => {
  if (!/^[*-]\s/.test(text)) return text;
  return text.replace(/([^\n])\s+[*-]\s+/g, "$1\n* ");
};

/**
 * Render model output as markdown. The model emits real markdown (`##`,
 * `**`, lists, code fences) and rendering it inline is much easier on the
 * eye than a wall of monospace. Stream-safe: marked tolerates partial
 * input, so the typewriter cursor still works while chunks arrive.
 *
 * No HTML sanitizer dep; the input source is an on-device model running
 * in our own demo; the worst case is broken markup, not XSS.
 */
export const MarkdownOutput = ({
  text,
  streaming,
  placeholder,
  style,
}: {
  text: string;
  streaming: boolean;
  placeholder: string;
  style?: React.CSSProperties;
}) => {
  const html = useMemo(() => {
    if (!text) return "";
    // `marked.parse` is sync when no async extensions are loaded.
    return marked.parse(normalizeBullets(text)) as string;
  }, [text]);

  if (!text) {
    return (
      <div className="output empty markdown" style={style}>
        {placeholder}
        {streaming && <span className="cursor" />}
      </div>
    );
  }
  return (
    <div className="output markdown" style={style}>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: model output, demo only */}
      <div dangerouslySetInnerHTML={{ __html: html }} />
      {streaming && <span className="cursor" />}
    </div>
  );
};

/**
 * Detect the Chromium-derived browser. Edge ships the same Built-in AI APIs
 * as Chrome (same Chromium code) but uses `edge://` for its internal pages.
 * Falls back to "chrome" so the more common scheme renders for unknown UAs.
 */
export const detectBrowser = (): "chrome" | "edge" | "other" => {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/\bEdg\//.test(ua)) return "edge";
  if (/\bChrome\//.test(ua)) return "chrome";
  return "other";
};

/**
 * Best-effort detection of the on-device model name. The Built-in AI APIs
 * don't expose the model name, so we infer from the host browser:
 *
 *   - Chrome ships Gemini Nano (https://developer.chrome.com/docs/ai).
 *   - Edge ships Phi-4-mini via the Writing Assistance APIs
 *     (https://learn.microsoft.com/en-us/microsoft-edge/web-platform/writing-assistance-apis).
 *     On Copilot+ PCs this is a tuned variant called Phi-Silica, but we
 *     can't reliably detect ARM/NPU presence from JS, so we report the
 *     primary public name.
 *   - Unknown Chromium derivatives fall back to a generic label.
 */
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
  /**
   * Search term to type into the browser's `flags/` page. Use the API name
   * (e.g. "Prompt API", "Summarization API"); works in both Chrome
   * (`#…-gemini-nano`) and Edge (`#…-phi-mini`), which name the same flag
   * differently because the underlying models differ.
   */
  flagSearch?: string;
}) => {
  const browser = detectBrowser();
  const scheme = browser === "edge" ? "edge://" : "chrome://";
  const browserName =
    browser === "edge" ? "Edge Canary/Dev 138+" : "Chrome 138+";
  return (
    <div className="notice warn" style={{ display: "block" }}>
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
        <span
          style={{
            display: "block",
            marginTop: 6,
            fontSize: "11px",
            color: "var(--fg-4)",
          }}
        >
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
