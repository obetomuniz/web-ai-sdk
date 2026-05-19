import { isDetectorAvailable } from "@web-ai-sdk/detector";
import { useDetector } from "@web-ai-sdk/detector/react";
import { useEffect, useState } from "react";
import {
  DownloadNotice,
  ErrorNotice,
  StatusBar,
  UnavailableNotice,
  detectModelName,
  useStreamStats,
} from "./shared.js";

const DETECT_EXAMPLES = [
  "Building blocks ship as small modules, so they fit any framework.",
  "Olá! Sou uma biblioteca leve para a Web's built-in AI.",
  "おはようございます。テキストの言語を検出します。",
  "Las APIs nativas del navegador son el futuro.",
] as const;

const EXAMPLE_LABELS = ["en", "pt", "ja", "es"] as const;

export const DetectorDemo = () => {
  const [text, setText] = useState<string>(DETECT_EXAMPLES[0]);
  const [available, setAvailable] = useState<boolean | null>(null);
  const { stats, start, update, finish } = useStreamStats();
  const { status, language, confidence, all, error } = useDetector({ text });

  useEffect(() => {
    setAvailable(isDetectorAvailable());
  }, []);

  // Track stats off of the lifecycle. Detection is one-shot, but we still
  // surface a status bar for visual consistency with the other demos. The
  // stats setters (`start`, `update`, `finish`) are intentionally not in
  // the deps array: they're stable across renders and re-running the
  // effect whenever they change would just thrash the status bar.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see comment above
  useEffect(() => {
    if (status === "loading") start();
    else if (status === "done") {
      if (language) update(language);
      finish("done");
    } else if (status === "unavailable" && stats.status === "running") {
      finish("unavailable");
    }
  }, [status, language]);

  const running = status === "loading";

  return (
    <div className="card">
      <div className="card-head">
        <span className="title">
          <span className={`dot ${running ? "live" : "ok"}`} />
          detect() · live
        </span>
        <span>
          {status === "done" && language
            ? `${language} · ${Math.round(confidence * 100)}%`
            : status === "pending"
              ? "awaiting input"
              : status === "loading"
                ? "detecting…"
                : "-"}
        </span>
      </div>
      <div className="card-body">
        {available === false && (
          <UnavailableNotice
            api="Language Detector API"
            flagSearch="language detection"
          />
        )}
        <DownloadNotice progress={null} />
        <ErrorNotice error={error?.message ?? null} />
        <div className="field" style={{ margin: "12px 0" }}>
          <label className="label" htmlFor="detector-demo-input">
            input
          </label>
          <textarea
            id="detector-demo-input"
            className="textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{ minHeight: 64 }}
            spellCheck={false}
          />
        </div>
        <div className="demo-controls">
          <div className="chip-row chip-row-end">
            {DETECT_EXAMPLES.map((p, i) => (
              <button
                key={p}
                type="button"
                className={`chip ${text === p ? "active" : ""}`}
                onClick={() => setText(p)}
              >
                {EXAMPLE_LABELS[i]}
              </button>
            ))}
          </div>
        </div>
        <div className="output" style={{ minHeight: 80 }}>
          {status === "done" && all.length > 0 ? (
            <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {all.slice(0, 4).map((entry, i) => (
                <li
                  key={entry.detectedLanguage}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "3px 0",
                    color: i === 0 ? "var(--fg)" : "var(--fg-3)",
                  }}
                >
                  <span>
                    <code
                      style={{
                        color: i === 0 ? "var(--accent-bright)" : "var(--fg-3)",
                      }}
                    >
                      {entry.detectedLanguage}
                    </code>
                  </span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    {(entry.confidence * 100).toFixed(1)}%
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <span style={{ color: "var(--fg-4)", fontStyle: "italic" }}>
              {available === false
                ? "Open in Chrome 138+ or Edge 138+ to detect."
                : status === "pending"
                  ? "Type or paste text above."
                  : status === "loading"
                    ? "Detecting…"
                    : "No confident match."}
            </span>
          )}
        </div>
        <StatusBar stats={stats} label={`model: ${detectModelName()}`} />
      </div>
    </div>
  );
};
