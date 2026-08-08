import { useTranslator } from "@web-ai-sdk/translator/react";
import { useState } from "react";
import { useDebouncedValue } from "../../../shared/demoLifecycle.js";
import { FreshRunAction } from "./FreshRunAction.js";
import { UnavailableHint } from "./UnavailableHint.js";

export interface TranslatorDemoProps {
  sourceLanguage?: string;
  targetLanguage?: string;
  initial?: string;
}

// Translation waits for a typing pause instead of running on every keystroke.
const TRANSLATE_DEBOUNCE_MS = 600;
// Translations are deterministic enough to reuse; expire them after ten minutes.
const RESULT_TTL_MS = 10 * 60 * 1000;

export const TranslatorDemo = ({
  sourceLanguage = "pt",
  targetLanguage = "en",
  initial = "Olá! As built-in AI APIs do navegador transformam o desenvolvimento web.",
}: TranslatorDemoProps) => {
  const [input, setInput] = useState(initial);
  const debounced = useDebouncedValue(input, TRANSLATE_DEBOUNCE_MS);
  // Bumping the nonce changes the cache key, so a fresh generation skips the
  // stored result and replaces it.
  const [freshNonce, setFreshNonce] = useState(0);
  const { status, output, error, fromCache } = useTranslator({
    input: debounced,
    sourceLanguage,
    targetLanguage,
    cache: "session",
    cacheTtl: RESULT_TTL_MS,
    cacheKey: `docs-translator:${sourceLanguage}:${targetLanguage}:${freshNonce}:${debounced}`,
  });
  const pending = input !== debounced;

  return (
    <div className="demo-card">
      {status === "unavailable" && (
        <UnavailableHint
          api="Translator API"
          chrome="Translator API unavailable. Open in Chrome 138+ (stable) to exercise."
          edge="Translator API unavailable. Open in Edge 148+ (stable) to exercise."
        />
      )}
      {error && <p className="demo-error">{error.message}</p>}
      <label className="demo-label">
        Source ({sourceLanguage})
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={3}
          className="demo-textarea"
          spellCheck={false}
        />
      </label>
      <article className="demo-response">
        <header className="demo-response__header">
          <span role="status">
            {pending
              ? "Input changed. Translation runs after you pause."
              : fromCache && status === "done"
                ? "Cached translation"
                : status === "loading"
                  ? "Translating…"
                  : status === "idle"
                    ? "Waiting for input"
                    : `Translation (${targetLanguage})`}{" "}
            {status === "streaming" && <em>(streaming…)</em>}
          </span>
          <FreshRunAction
            show={status === "done" && !pending}
            onClick={() => setFreshNonce((n) => n + 1)}
            tooltipSide="right"
          />
        </header>
        <p className="demo-response__body">
          {output ?? (
            <span className="demo-muted">
              {status === "idle"
                ? "Type or paste text above."
                : status === "loading"
                  ? "…"
                  : "No translation available."}
            </span>
          )}
        </p>
      </article>
    </div>
  );
};
