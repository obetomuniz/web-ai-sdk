import { useWriter } from "@web-ai-sdk/writer/react";
import { useState } from "react";
import { UnavailableHint } from "./UnavailableHint.js";

const SAMPLE =
  "A short, friendly announcement that our docs site now has live demos.";

export const WriterDemo = ({ language = "en" }: { language?: string }) => {
  const [input, setInput] = useState(SAMPLE);

  const { status, output, error, fromCache, dismiss } = useWriter({
    input,
    language,
    tone: "casual",
    length: "short",
  });

  return (
    <div className="demo-card">
      <label className="demo-label">
        Writing task
        <textarea
          className="demo-textarea"
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
        />
      </label>
      {status === "unavailable" && !error && (
        <UnavailableHint
          api="Writer API"
          chrome={
            <>
              Writer API unavailable. Open in Chrome with the Writer API flag /
              origin trial enabled to exercise.
            </>
          }
          edge={
            <>
              Writer API unavailable. In Edge Canary/Dev 138+, open{" "}
              <code>edge://flags/</code>, search for "Writer API for Phi mini",
              enable it, and reload.
            </>
          }
        />
      )}
      {error && <p className="demo-error">{error.message}</p>}
      {output && (
        <aside className="demo-response">
          <header className="demo-response__header">
            <span>
              {fromCache ? "Cached draft" : "Draft"}{" "}
              {status === "streaming" && <em>(streaming…)</em>}
            </span>
            <button
              type="button"
              onClick={dismiss}
              className="demo-dismiss"
              aria-label="dismiss"
            >
              ×
            </button>
          </header>
          <p className="demo-response__body">{output}</p>
        </aside>
      )}
    </div>
  );
};
