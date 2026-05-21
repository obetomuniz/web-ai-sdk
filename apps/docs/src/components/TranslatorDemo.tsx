import { useTranslator } from "@web-ai-sdk/translator/react";
import type { ReactElement } from "react";

export interface TranslatorDemoProps {
  sourceLanguage?: string;
  targetLanguage?: string;
}

const PT_ARTICLE: ReactElement = (
  <>
    <h1>
      O que são <strong>PWAs</strong>?
    </h1>
    <p>
      Uma <strong>Progressive Web App</strong> é um conjunto de práticas que
      combinam o melhor da web e dos apps nativos. Use{" "}
      <code>navigator.serviceWorker</code> para habilitar o modo offline.
    </p>
    <p>
      A <strong>StateX</strong> é uma biblioteca de gerenciamento de estado
      inspirada no <strong>Redux</strong> com uma API mais minimalista.
    </p>
  </>
);

const SAMPLE_ARTICLES: Record<string, ReactElement> = {
  pt: PT_ARTICLE,
  es: (
    <>
      <h1>
        ¿Qué son las <strong>PWAs</strong>?
      </h1>
      <p>
        Una <strong>Progressive Web App</strong> es un conjunto de prácticas que
        combinan lo mejor de la web y de las apps nativas. Usa{" "}
        <code>navigator.serviceWorker</code> para habilitar el modo sin
        conexión.
      </p>
      <p>
        <strong>StateX</strong> es una biblioteca de gestión de estado inspirada
        en <strong>Redux</strong> con una API más minimalista.
      </p>
    </>
  ),
  ja: (
    <>
      <h1>
        <strong>PWA</strong>とは？
      </h1>
      <p>
        <strong>Progressive Web App</strong>は、ウェブとネイティブアプリの
        長所を組み合わせた一連のプラクティスです。オフラインモードを有効に
        するには <code>navigator.serviceWorker</code> を使用してください。
      </p>
      <p>
        <strong>StateX</strong>は、<strong>Redux</strong>にインスパイアされた、
        よりミニマルなAPIを持つ状態管理ライブラリです。
      </p>
    </>
  ),
};

const articleFor = (lang: string): ReactElement => {
  const short = lang.split("-")[0]?.toLowerCase() ?? lang.toLowerCase();
  return SAMPLE_ARTICLES[short] ?? PT_ARTICLE;
};

export const TranslatorDemo = ({
  sourceLanguage = "pt",
  targetLanguage = "en",
}: TranslatorDemoProps) => {
  const { state, progress, translate, restore, error } = useTranslator({
    sourceLanguage,
    targetLanguage,
  });

  return (
    <div className="demo-card">
      <header
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
        }}
      >
        {state === "translated" ? (
          <button type="button" onClick={restore} className="demo-button">
            Show original
          </button>
        ) : (
          <button
            type="button"
            onClick={translate}
            disabled={state === "working" || state === "unavailable"}
            className="demo-button"
          >
            {state === "working"
              ? formatProgress(progress)
              : `Translate ${sourceLanguage} → ${targetLanguage}`}
          </button>
        )}
      </header>
      {state === "unavailable" && (
        <p className="demo-hint">
          Translator API unavailable. Open in Chrome 138+ (stable) or Edge
          Canary/Dev 143+ (with the translation API flag enabled) to exercise.
        </p>
      )}
      {error && <p className="demo-error">{error.message}</p>}
      <article
        // Re-mount the article when the source language changes so leftover
        // translated DOM from a previous run doesn't bleed into the new one.
        key={sourceLanguage}
        data-translate-root
        style={{ lineHeight: 1.5, fontSize: 16 }}
      >
        {articleFor(sourceLanguage)}
      </article>
    </div>
  );
};

const formatProgress = (
  progress: ReturnType<typeof useTranslator>["progress"],
) => {
  if (!progress) return "Working…";
  switch (progress.phase) {
    case "loading-model":
      return "Loading model…";
    case "downloading-model":
      return `Downloading model… ${Math.round(progress.loaded * 100)}%`;
    case "translating":
      return `Translating 0/${progress.total}…`;
    case "block-translated":
      return `Translating ${progress.done}/${progress.total}…`;
    default:
      return "Working…";
  }
};
