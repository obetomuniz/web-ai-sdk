import { useProofreader } from "@web-ai-sdk/proofreader/react";
import { useState } from "react";
import { FreshRunAction } from "./FreshRunAction.js";
import { UnavailableHint } from "./UnavailableHint.js";

const SAMPLE =
  "I seen him yesterday at the store, and he bought two loafs of bread.";

// Corrections are deterministic enough to reuse; expire them after ten minutes.
const RESULT_TTL_MS = 10 * 60 * 1000;

export const ProofreaderDemo = () => {
  const [input, setInput] = useState(SAMPLE);
  // The hook only sees input committed by the Proofread button; typing alone
  // never invokes the model.
  const [committed, setCommitted] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [stopped, setStopped] = useState(false);
  // Bumping the nonce changes the cache key, so a fresh generation skips the
  // stored result and writes under a new key. Old entries expire via TTL.
  const [freshNonce, setFreshNonce] = useState(0);

  const { status, output, error, fromCache } = useProofreader({
    input: committed ?? "",
    cache: "session",
    cacheTtl: RESULT_TTL_MS,
    cacheKey: `docs-proofreader:${freshNonce}:${committed ?? ""}`,
    enabled: enabled && committed !== null,
  });

  const busy = !stopped && status === "loading";
  const stale = !busy && !!output && committed !== null && input !== committed;

  const run = () => {
    setCommitted(input);
    setEnabled(true);
    setStopped(false);
  };
  // Disabling the hook aborts the in-flight call; Proofread re-enables it.
  const stop = () => {
    setEnabled(false);
    setStopped(true);
  };
  const freshRun = () => {
    setFreshNonce((n) => n + 1);
    run();
  };

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
            Proofread
          </button>
        )}
        <FreshRunAction show={status === "done" && !busy} onClick={freshRun} />
      </div>
      {status === "unavailable" && !error && (
        <UnavailableHint
          api="Proofreader API"
          chrome={
            <>
              Chrome labels Proofreader a Developer trial. For localhost, enable{" "}
              <code>chrome://flags/#proofreader-api</code> and reload.
            </>
          }
          edge={
            <>
              Proofreader API unavailable. In Edge Canary/Dev 142+, open{" "}
              <code>edge://flags/</code>, search for "Proofreader API for Phi
              mini", enable it, and reload.
            </>
          }
        />
      )}
      {error && <p className="demo-error">{error.message}</p>}
      {stale && (
        <p className="demo-hint" role="status">
          The text changed after this correction. Run Proofread again to update
          it.
        </p>
      )}
      {output && (
        <aside className="demo-response">
          <header className="demo-response__header">
            <span role="status">
              {stopped
                ? "Stopped"
                : stale
                  ? "Corrected (stale)"
                  : fromCache && status === "done"
                    ? "Cached correction"
                    : "Corrected"}
            </span>
          </header>
          <p className="demo-response__body">{output.correctedInput}</p>
          {output.corrections.length > 0 && (
            <p className="demo-hint">
              {output.corrections.length} correction
              {output.corrections.length === 1 ? "" : "s"} suggested. The
              original text above stays unchanged.
            </p>
          )}
        </aside>
      )}
    </div>
  );
};
