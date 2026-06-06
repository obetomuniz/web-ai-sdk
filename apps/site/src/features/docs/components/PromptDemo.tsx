import { usePrompt } from "@web-ai-sdk/prompt/react";
import { type ComponentProps, useState } from "react";

export interface PromptDemoProps {
  systemPrompt?: string;
  temperature?: number;
}

export const PromptDemo = ({
  systemPrompt = "You are a concise assistant. Reply with a single short paragraph.",
  temperature = 0.7,
}: PromptDemoProps) => {
  const [input, setInput] = useState("What is React.js, in one sentence?");
  const { status, output, error, fromCache, ask, abort, reset } = usePrompt({
    systemPrompt,
    temperature,
  });

  const onSubmit: ComponentProps<"form">["onSubmit"] = (e) => {
    e.preventDefault();
    if (input.trim()) ask(input);
  };

  const busy = status === "loading" || status === "streaming";

  return (
    <div className="demo-card">
      {status === "unavailable" && (
        <p className="demo-hint">
          Prompt API unavailable. Enable{" "}
          <code>chrome://flags/#prompt-api-for-gemini-nano</code> in Chrome and
          reload to exercise.
        </p>
      )}
      <form onSubmit={onSubmit} className="demo-row">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything"
          className="demo-input"
          aria-label="prompt"
        />
        {busy ? (
          <button type="button" onClick={abort} className="demo-button">
            Cancel
          </button>
        ) : (
          <button
            type="submit"
            disabled={status === "unavailable" || !input.trim()}
            className="demo-button"
          >
            Ask
          </button>
        )}
      </form>
      {error && <p className="demo-error">{error.message}</p>}
      {(output || busy) && (
        <article className="demo-response">
          <header className="demo-response__header">
            <span>
              {fromCache
                ? "Cached"
                : status === "streaming"
                  ? "Streaming…"
                  : status === "loading"
                    ? "Thinking…"
                    : "Answer"}
            </span>
            {output && (
              <button
                type="button"
                onClick={reset}
                className="demo-dismiss"
                aria-label="dismiss"
              >
                ×
              </button>
            )}
          </header>
          {output ? (
            <p className="demo-response__body">{output}</p>
          ) : (
            <p className="demo-muted" style={{ margin: 0 }}>
              …
            </p>
          )}
        </article>
      )}
    </div>
  );
};
