import { useRewriter } from "@web-ai-sdk/rewriter/react";
import { useState } from "react";
import { UnavailableHint } from "./UnavailableHint.js";

const SAMPLE = "hey, can u send me that doc when u get a sec? thx a bunch";

export const RewriterDemo = ({ language = "en" }: { language?: string }) => {
  const [input, setInput] = useState(SAMPLE);

  const { status, output, error, fromCache, dismiss } = useRewriter({
    input,
    language,
    tone: "more-formal",
    length: "as-is",
  });

  return (
    <div className="demo-card">
      <label className="demo-label">
        Text to rewrite (more formal)
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
          api="Rewriter API"
          chrome={
            <>
              Rewriter API unavailable. Open in Chrome with the Rewriter API
              flag / origin trial enabled to exercise.
            </>
          }
          edge={
            <>
              Rewriter API unavailable. In Edge Canary/Dev 138+, open{" "}
              <code>edge://flags/</code>, search for "Rewriter API for Phi
              mini", enable it, and reload.
            </>
          }
        />
      )}
      {error && <p className="demo-error">{error.message}</p>}
      {output && (
        <aside className="demo-response">
          <header className="demo-response__header">
            <span>
              {fromCache ? "Cached rewrite" : "Rewrite"}{" "}
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
