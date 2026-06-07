import {
  isAvailable as isTranslatorAvailable,
  TranslatorUnavailableError,
  translate,
} from "@web-ai-sdk/translator";
import { useEffect, useRef, useState } from "react";
import {
  btnSm,
  card,
  cardBody,
  cardDotLive,
  cardDotOk,
  cardHead,
  cardHeadTitle,
  demoControls,
  fieldGroup,
  fieldSpaced,
  label,
  langPair,
  langSwapBtn,
  langSwapWrap,
  select,
  textarea,
} from "../../../shared/ui.js";
import {
  DownloadNotice,
  Output,
  StatusBar,
  UnavailableNotice,
  useDownloadMonitor,
  useStreamStats,
} from "./shared.js";

const LANGS = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "ja", name: "Japanese" },
  { code: "pt", name: "Portuguese" },
];

export const TranslatorDemo = () => {
  const [text, setText] = useState(
    "Building blocks ship as small modules, so they fit any framework.",
  );
  const [from, setFrom] = useState("en");
  const [to, setTo] = useState("ja");
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const { stats, start, update, finish } = useStreamStats();
  const { progress, monitor } = useDownloadMonitor();
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setAvailable(isTranslatorAvailable());
  }, []);

  const run = async () => {
    if (running || from === to) return;
    setOutput("");
    setRunning(true);
    start();
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const result = await translate({
        input: text,
        sourceLanguage: from,
        targetLanguage: to,
        monitor,
        signal: ac.signal,
      });
      if (ac.signal.aborted) return;
      if (result.output) {
        setOutput(result.output);
        update(result.output);
      }
      finish(result.cached ? "cached" : "done");
    } catch (err) {
      if (ac.signal.aborted) {
        finish("aborted");
      } else if (err instanceof TranslatorUnavailableError) {
        finish("unavailable");
      } else {
        finish("error");
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  };

  const swap = () => {
    setFrom(to);
    setTo(from);
    setText(output || text);
    setOutput("");
  };

  return (
    <div className={card}>
      <div className={cardHead}>
        <span className={cardHeadTitle}>
          <span className={running ? cardDotLive : cardDotOk} />
          translate() · pair cached
        </span>
        <span>
          {from} → {to}
        </span>
      </div>
      <div className={cardBody}>
        {available === false && <UnavailableNotice api="Translator API" />}
        <DownloadNotice progress={progress} />
        <div className={langPair}>
          <div className={fieldGroup}>
            <label className={label} htmlFor="translator-demo-from">
              from
            </label>
            <select
              id="translator-demo-from"
              className={select}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            >
              {LANGS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name} ({l.code})
                </option>
              ))}
            </select>
          </div>
          <div className={langSwapWrap}>
            <button
              type="button"
              className={langSwapBtn}
              onClick={swap}
              title="Swap"
              aria-label="Swap languages"
            >
              ⇄
            </button>
          </div>
          <div className={fieldGroup}>
            <label className={label} htmlFor="translator-demo-to">
              to
            </label>
            <select
              id="translator-demo-to"
              className={select}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            >
              {LANGS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name} ({l.code})
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className={fieldSpaced}>
          <label className={label} htmlFor="translator-demo-source">
            source
          </label>
          <textarea
            id="translator-demo-source"
            className={textarea}
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
          />
        </div>
        <div className={demoControls}>
          <button
            type="button"
            className={btnSm}
            onClick={run}
            disabled={running || from === to || !available}
          >
            <span>{running ? "…" : "▶"}</span> Translate
          </button>
          {from === to && (
            <span className="ml-auto block rounded-sm border border-[color-mix(in_oklch,var(--color-warn)_40%,var(--color-hairline))] px-3 py-2 font-mono text-[11.5px] text-warn max-[640px]:ml-0 max-[640px]:w-full">
              Source and target are the same.
            </span>
          )}
        </div>
        <Output
          text={output}
          streaming={running}
          placeholder={
            available === false
              ? "Open in Chrome 138+ or Edge 148+ to translate."
              : `Translation (${to}) will appear here.`
          }
        />
        <StatusBar stats={stats} label={`pair: ${from}→${to}`} />
      </div>
    </div>
  );
};
