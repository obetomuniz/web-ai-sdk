import { useTranslator } from "@web-ai-sdk/translator/react";
import { useState } from "react";
import { UnavailableHint } from "./UnavailableHint.js";

export interface TranslatorDemoProps {
  sourceLanguage?: string;
  targetLanguage?: string;
  initial?: string;
}

export const TranslatorDemo = ({
  sourceLanguage = "pt",
  targetLanguage = "en",
  initial = "Olá! As built-in AI APIs do navegador transformam o desenvolvimento web.",
}: TranslatorDemoProps) => {
  const [input, setInput] = useState(initial);
  const { status, output, error, fromCache } = useTranslator({
    input,
    sourceLanguage,
    targetLanguage,
  });

  return (
    <div className="demo-card">
      {status === "unavailable" && (
        <UnavailableHint api="Translator API">
          Translator API unavailable. Open in Chrome 138+ (stable) or Edge
          Canary/Dev 143+ (with the translation API flag enabled) to exercise.
        </UnavailableHint>
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
          <span>
            {fromCache
              ? "Cached"
              : status === "loading"
                ? "Translating…"
                : status === "idle"
                  ? "Waiting for input"
                  : `Translation (${targetLanguage})`}
          </span>
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
