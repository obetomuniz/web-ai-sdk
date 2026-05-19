import {
  getOrCreateTranslator,
  getTranslatorApi,
  isTranslatorAvailable,
} from "@web-ai-sdk/translator";
import { useEffect, useRef, useState } from "react";
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
      const api = getTranslatorApi();
      if (!api) throw new Error("Translator API missing");
      const translator = await getOrCreateTranslator(api, {
        sourceLanguage: from,
        targetLanguage: to,
        monitor,
      });
      if (ac.signal.aborted) return;
      const result = await translator.translate(text);
      if (ac.signal.aborted) return;
      setOutput(result);
      update(result);
      finish("done");
    } catch {
      finish(ac.signal.aborted ? "aborted" : "error");
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
    <div className="card">
      <div className="card-head">
        <span className="title">
          <span className={`dot ${running ? "live" : "ok"}`} />
          translate() · pair cached
        </span>
        <span>
          {from} → {to}
        </span>
      </div>
      <div className="card-body">
        {available === false && <UnavailableNotice api="Translator API" />}
        <DownloadNotice progress={progress} />
        <div className="lang-pair">
          <div className="field">
            <label className="label" htmlFor="translator-demo-from">
              from
            </label>
            <select
              id="translator-demo-from"
              className="select"
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
          <button
            type="button"
            className="btn-sm ghost lang-swap"
            onClick={swap}
            title="Swap"
            aria-label="Swap languages"
          >
            ⇄
          </button>
          <div className="field">
            <label className="label" htmlFor="translator-demo-to">
              to
            </label>
            <select
              id="translator-demo-to"
              className="select"
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
        <div className="field" style={{ margin: "12px 0" }}>
          <label className="label" htmlFor="translator-demo-source">
            source
          </label>
          <textarea
            id="translator-demo-source"
            className="textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
          />
        </div>
        <div className="demo-controls">
          <button
            type="button"
            className="btn-sm"
            onClick={run}
            disabled={running || from === to || !available}
          >
            <span>{running ? "…" : "▶"}</span> Translate
          </button>
          {from === to && (
            <span className="notice warn chip-row-end">
              Source and target are the same.
            </span>
          )}
        </div>
        <Output
          text={output}
          streaming={running}
          placeholder={
            available === false
              ? "Open in Chrome 138+ or Edge 138+ to translate."
              : `Translation (${to}) will appear here.`
          }
        />
        <StatusBar stats={stats} label={`pair: ${from}→${to}`} />
      </div>
    </div>
  );
};
