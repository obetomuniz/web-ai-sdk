import { useDetector } from "@web-ai-sdk/detector/react";
import { useState } from "react";
import { UnavailableHint } from "./UnavailableHint.js";

export interface DetectorDemoProps {
  initial?: string;
}

export const DetectorDemo = ({
  initial = "Olá, mundo! Os blocos modulares são uma boa ideia.",
}: DetectorDemoProps) => {
  const [text, setText] = useState(initial);
  const { status, output, error, fromCache } = useDetector({
    input: text,
  });
  const language = output?.language ?? null;
  const confidence = output?.confidence ?? 0;
  const all = output?.all ?? [];

  return (
    <div className="demo-card demo-card--narrow">
      {status === "unavailable" && (
        <UnavailableHint api="Language Detector">
          Language Detector unavailable. Open in Chrome 138+ (stable) or Edge
          Canary/Dev 147+ with the language detection flag enabled (search the
          flags page for "language detection").
        </UnavailableHint>
      )}
      <label className="demo-label">
        Input
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          className="demo-textarea"
          spellCheck={false}
        />
      </label>
      {error && <p className="demo-error">{error.message}</p>}
      <article className="demo-response">
        <header className="demo-response__header">
          <span>
            {fromCache
              ? "Cached"
              : status === "loading"
                ? "Detecting…"
                : status === "idle"
                  ? "Waiting for input"
                  : "Result"}
          </span>
          {status === "done" && language && (
            <span className="demo-badge">
              {language} · {Math.round(confidence * 100)}%
            </span>
          )}
        </header>
        {status === "done" && all.length > 0 ? (
          <ol className="demo-list">
            {all.slice(0, 5).map((entry) => (
              <li key={entry.detectedLanguage} className="demo-list__item">
                <code>{entry.detectedLanguage}</code>
                <span className="demo-muted">
                  {(entry.confidence * 100).toFixed(1)}%
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="demo-muted" style={{ margin: 0 }}>
            {status === "idle"
              ? "Type or paste text above."
              : status === "loading"
                ? "…"
                : "No confident match."}
          </p>
        )}
      </article>
    </div>
  );
};
