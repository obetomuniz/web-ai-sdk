import {
  isAvailable as isProofreaderAvailable,
  ProofreaderUnavailableError,
  proofread,
} from "@web-ai-sdk/proofreader";
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
  fieldSpaced,
  label,
  textarea,
} from "../lib/ui.js";
import {
  DownloadNotice,
  ErrorNotice,
  Output,
  StatusBar,
  UnavailableNotice,
  useDownloadMonitor,
  useStreamStats,
} from "./shared.js";

const SAMPLE_TEXT =
  "I seen him yesterday at the store, and he bought two loafs of bread.";

export const ProofreaderDemo = () => {
  const [text, setText] = useState(SAMPLE_TEXT);
  const [output, setOutput] = useState("");
  const [corrections, setCorrections] = useState(0);
  const [running, setRunning] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { stats, start, update, finish } = useStreamStats();
  const { progress, monitor } = useDownloadMonitor();
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setAvailable(isProofreaderAvailable());
  }, []);

  const run = async () => {
    if (running) return;
    setOutput("");
    setCorrections(0);
    setError(null);
    setRunning(true);
    start();
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const result = await proofread({
        input: text,
        expectedInputLanguages: ["en"],
        monitor,
        signal: ac.signal,
      });
      if (!ac.signal.aborted && result.output) {
        setOutput(result.output.correctedInput);
        setCorrections(result.output.corrections.length);
        update(result.output.correctedInput);
      }
      finish(result.cached ? "cached" : "done");
    } catch (err: unknown) {
      if (ac.signal.aborted) {
        finish("aborted");
      } else if (err instanceof ProofreaderUnavailableError) {
        setError(err.message || "Proofreader API reported unavailable.");
        finish("unavailable");
      } else {
        setError((err as Error)?.message ?? String(err));
        finish("error");
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  };

  return (
    <div className={card}>
      <div className={cardHead}>
        <span className={cardHeadTitle}>
          <span className={running ? cardDotLive : cardDotOk} />
          proofread() · local
        </span>
        <span>{corrections} fixes</span>
      </div>
      <div className={cardBody}>
        {available === false && (
          <UnavailableNotice api="Proofreader API" flagSearch="Proofreader" />
        )}
        <DownloadNotice progress={progress} />
        <ErrorNotice error={error} />
        <div className={fieldSpaced}>
          <label className={label} htmlFor="proofreader-demo-input">
            text to proofread
          </label>
          <textarea
            id="proofreader-demo-input"
            className={`${textarea} min-h-[90px]`}
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
            disabled={running || !available}
          >
            <span>{running ? "…" : "▶"}</span> Proofread
          </button>
        </div>
        <Output
          text={output}
          streaming={running}
          placeholder={
            available === false
              ? "Enable the Proofreader API flag in Chrome to check grammar."
              : "Run to correct grammar, spelling, and punctuation."
          }
        />
        <StatusBar stats={stats} label={`${corrections} corrections`} />
      </div>
    </div>
  );
};
