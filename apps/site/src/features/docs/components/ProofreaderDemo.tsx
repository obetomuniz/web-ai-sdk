import { useProofreader } from "@web-ai-sdk/proofreader/react";
import { useState } from "react";

const SAMPLE =
  "I seen him yesterday at the store, and he bought two loafs of bread.";

export const ProofreaderDemo = () => {
  const [input, setInput] = useState(SAMPLE);

  const { status, output, error, fromCache } = useProofreader({ input });

  return (
    <div className="demo-card">
      <label className="demo-label">
        Text to proofread
        <textarea
          className="demo-textarea"
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
        />
      </label>
      {status === "unavailable" && !error && (
        <p className="demo-hint">
          Proofreader API unavailable. Open in Chrome with the Proofreader API
          flag / origin trial enabled to exercise.
        </p>
      )}
      {error && <p className="demo-error">{error.message}</p>}
      {output && (
        <aside className="demo-response">
          <header className="demo-response__header">
            <span>{fromCache ? "Cached correction" : "Corrected"}</span>
          </header>
          <p className="demo-response__body">{output.correctedInput}</p>
          {output.corrections.length > 0 && (
            <p className="demo-hint">
              {output.corrections.length} correction
              {output.corrections.length === 1 ? "" : "s"} suggested.
            </p>
          )}
        </aside>
      )}
    </div>
  );
};
