import { useSummarizer } from "@web-ai-sdk/summarizer/react";
import { useEffect, useRef, useState } from "react";
import { ModelMarkdown } from "../../../shared/components/ModelMarkdown.js";
import { FreshRunAction } from "./FreshRunAction.js";
import { UnavailableHint } from "./UnavailableHint.js";

export interface SummarizerDemoProps {
  language?: string;
  title?: string;
  description?: string;
}

// Summaries of the fixed article are deterministic enough to reuse; expire
// them after ten minutes.
const RESULT_TTL_MS = 10 * 60 * 1000;

const DEFAULT_BODY = `
  <h2>The case for a lifecycle layer</h2>
  <p>Browsers are shipping <strong>built-in AI APIs</strong> behind flags. The shape changes, but the lifecycle is similar across them.</p>
  <h3>What stays the same</h3>
  <p>Feature detection, session caching, streaming, and sensible defaults are all gnarly to get right and worth sharing.</p>
  <h3>What stays optional</h3>
  <p>Framework adapters, polyfills, UI primitives. <strong>Composable</strong> means the consumer picks what to plug in, instead of every package shipping every dependency.</p>
`;

export const SummarizerDemo = ({ language = "en" }: SummarizerDemoProps) => {
  const articleRef = useRef<HTMLDivElement | null>(null);
  const [input, setInput] = useState("");
  // The summary runs only on the button, never on page load.
  const [enabled, setEnabled] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  // Bumping the nonce changes the cache key, so a fresh generation skips the
  // stored result and replaces it.
  const [freshNonce, setFreshNonce] = useState(0);

  useEffect(() => {
    setInput(articleRef.current?.innerText ?? "");
  }, []);

  const { status, output, error, fromCache } = useSummarizer({
    language,
    input,
    cache: "session",
    cacheTtl: RESULT_TTL_MS,
    cacheKey: `docs-summarizer:${language}:${freshNonce}`,
    enabled: enabled && input.trim().length > 0,
  });

  const busy = !stopped && (status === "loading" || status === "streaming");

  const run = () => {
    setEnabled(true);
    setStopped(false);
    setDismissed(false);
  };
  // Disabling the hook aborts the in-flight call; Run re-enables it.
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
      {status === "unavailable" && !error && (
        <UnavailableHint
          api="Summarizer API"
          chrome="Summarizer API unavailable. Open in Chrome 138+ (stable) to exercise."
          edge="Summarizer API unavailable. Open in Edge 138+ (stable) to exercise."
        />
      )}
      {error && <p className="demo-error">{error.message}</p>}
      <div className="demo-row">
        {busy ? (
          <button type="button" onClick={stop} className="demo-button">
            Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={run}
            disabled={status === "unavailable"}
            className="demo-button"
          >
            Summarize the article
          </button>
        )}
        <FreshRunAction
          show={status === "done" && !busy && !dismissed}
          onClick={freshRun}
        />
      </div>
      {output && !dismissed && (
        <aside className="demo-response">
          <header className="demo-response__header">
            <span role="status">
              {stopped
                ? "Stopped"
                : fromCache && status === "done"
                  ? "Cached summary"
                  : "Summary"}{" "}
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
      <div
        ref={articleRef}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: demo-only fixture
        dangerouslySetInnerHTML={{ __html: DEFAULT_BODY }}
        style={{ lineHeight: 1.5 }}
      />
    </div>
  );
};
