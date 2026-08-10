import { useWriter } from "@web-ai-sdk/writer/react";
import { useState } from "react";
import { ModelMarkdown } from "../../../shared/components/ModelMarkdown.js";
import { useDownloadMonitor } from "../../../shared/demoLifecycle.js";
import { DownloadProgress } from "./DownloadProgress.js";
import { UnavailableHint } from "./UnavailableHint.js";

const SAMPLE =
  "A short, friendly announcement that our docs site now has live demos.";

export const WriterDemo = ({ language = "en" }: { language?: string }) => {
  const [input, setInput] = useState(SAMPLE);
  // The hook only sees input committed by the Write button; typing alone
  // never invokes the model.
  const [committed, setCommitted] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const { progress, monitor } = useDownloadMonitor();
  const { status, output, error } = useWriter({
    input: committed ?? "",
    language,
    tone: "casual",
    length: "short",
    monitor,
    enabled: enabled && committed !== null,
  });

  const busy = !stopped && (status === "loading" || status === "streaming");
  const stale =
    !busy &&
    !!output &&
    committed !== null &&
    input !== committed &&
    !dismissed;

  const run = () => {
    setCommitted(input);
    setEnabled(true);
    setStopped(false);
    setDismissed(false);
  };
  // Disabling the hook aborts the in-flight call; Write re-enables it.
  const stop = () => {
    setEnabled(false);
    setStopped(true);
  };

  return (
    <div className="demo-card">
      {status === "unavailable" && !error && (
        <UnavailableHint
          api="Writer API"
          chrome={
            <>
              Chrome labels Writer a Developer trial. For localhost, enable the
              current Writer setup listed in Browser support.
            </>
          }
          edge={
            <>
              Writer API unavailable. In Edge Canary/Dev 138+, open{" "}
              <code>edge://flags/</code>, search for "Writer API for on-device
              language model", enable it, and reload.
            </>
          }
        />
      )}
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
      <div className="demo-row">
        {busy ? (
          <button type="button" onClick={stop} className="demo-button">
            Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={run}
            disabled={status === "unavailable" || !input.trim()}
            className="demo-button"
          >
            Write
          </button>
        )}
        <DownloadProgress progress={progress} />
      </div>
      {error && <p className="demo-error">{error.message}</p>}
      {stale && (
        <p className="demo-hint" role="status">
          The task changed after this draft. Run Write again to update it, or
          dismiss the draft.
        </p>
      )}
      {output && !dismissed && (
        <aside className="demo-response">
          <header className="demo-response__header">
            <span role="status">
              {stopped ? "Stopped" : stale ? "Draft (stale)" : "Draft"}{" "}
              {busy && status === "streaming" && <em>(streaming…)</em>}
            </span>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="demo-dismiss"
              aria-label="dismiss"
            >
              ×
            </button>
          </header>
          <div className="demo-response__body">
            <ModelMarkdown
              content={output}
              streaming={busy && status === "streaming"}
            />
          </div>
        </aside>
      )}
    </div>
  );
};
