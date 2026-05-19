import { useSummarizer } from "@web-ai-sdk/summarizer/react";
import { useEffect, useRef, useState } from "react";

export interface SummarizerDemoProps {
  language?: string;
  title?: string;
  description?: string;
}

const DEFAULT_BODY = `
  <h2>The case for a lifecycle layer</h2>
  <p>Browsers are shipping <strong>built-in AI APIs</strong> behind flags. The shape changes, but the lifecycle is similar across them.</p>
  <h3>What stays the same</h3>
  <p>Feature detection, session caching, streaming, and sensible defaults are all gnarly to get right and worth sharing.</p>
  <h3>What stays optional</h3>
  <p>Framework adapters, polyfills, UI primitives. <strong>Composable</strong> means the consumer picks what to plug in, instead of every package shipping every dependency.</p>
`;

export const SummarizerDemo = ({
  language = "en",
  title = "The case for building blocks",
  description = "Why a lifecycle layer around browser AI APIs is worth shipping.",
}: SummarizerDemoProps) => {
  const articleRef = useRef<HTMLDivElement | null>(null);
  const [article, setArticle] = useState<HTMLElement | undefined>(undefined);

  useEffect(() => {
    setArticle(articleRef.current ?? undefined);
  }, []);

  const { status, summary, error, fromCache, dismiss } = useSummarizer({
    language,
    article,
    title,
    description,
  });

  return (
    <div className="demo-card">
      {status === "unavailable" && !error && (
        <p className="demo-hint">
          Summarizer API unavailable. Open in Chrome 138+ or Edge 138+ to
          exercise.
        </p>
      )}
      {error && <p className="demo-error">{error.message}</p>}
      {summary && (
        <aside className="demo-response">
          <header className="demo-response__header">
            <span>
              {fromCache ? "Cached summary" : "Summary"}{" "}
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
          <p className="demo-response__body">{summary}</p>
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
