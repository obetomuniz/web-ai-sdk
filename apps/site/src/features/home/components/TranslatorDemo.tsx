import {
  isAvailable as isTranslatorAvailable,
  prepareTranslator,
  TranslatorUnavailableError,
  translate,
} from "@web-ai-sdk/translator";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  useCapabilityLease,
  useDemoIntent,
} from "../../../shared/demoLifecycle.js";
import {
  btnSm,
  btnSmGhost,
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
  CacheAwareRun,
  DEMO_RESULT_TTL_MS,
  type DemoIntentProps,
  DownloadDonut,
  FreshRunButton,
  Output,
  StaleNotice,
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

export const TranslatorDemo = ({ intent: tabIntent }: DemoIntentProps) => {
  const [text, setText] = useState(
    "Building blocks ship as small modules, so they fit any framework.",
  );
  const [from, setFrom] = useState("en");
  const [to, setTo] = useState("ja");
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [ranWith, setRanWith] = useState<string | null>(null);
  // Bumped when a run serves from the cache, replaying a short pulse so the
  // instant result still gives visible feedback.
  const [cacheFlash, setCacheFlash] = useState(0);
  const { stats, start, update, finish, reset } = useStreamStats();
  const { progress, monitor } = useDownloadMonitor();
  const { intent, markInteracted } = useDemoIntent(tabIntent);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setAvailable(isTranslatorAvailable());
  }, []);

  // Abort in-flight work when the demo unmounts (for example on tab change).
  useEffect(() => () => abortRef.current?.abort(), []);

  // Prepare the session for the selected language pair once the user shows
  // intent. Changing the pair releases the old lease and prepares the new one.
  const createLease = useCallback(
    () =>
      prepareTranslator({ sourceLanguage: from, targetLanguage: to, monitor }),
    [from, to, monitor],
  );
  useCapabilityLease(intent && available === true && from !== to, createLease);

  const runKey = JSON.stringify([text, from, to]);
  const stale = !running && !!output && ranWith !== null && ranWith !== runKey;

  const run = async (refresh = false) => {
    if (running || from === to) return;
    const key = runKey;
    setOutput("");
    setRanWith(null);
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
        cache: "session",
        cacheTtl: DEMO_RESULT_TTL_MS,
        cacheRefresh: refresh,
        signal: ac.signal,
        onUpdate: (chunk) => {
          if (ac.signal.aborted) return;
          setOutput(chunk);
          update(chunk);
        },
      });
      if (ac.signal.aborted) return;
      if (result.output) {
        setOutput(result.output);
        update(result.output);
      }
      setRanWith(key);
      if (result.cached) setCacheFlash((n) => n + 1);
      finish(result.cached ? "cached" : "done");
    } catch (err) {
      if (ac.signal.aborted) {
        finish("stopped");
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

  const stop = () => abortRef.current?.abort();
  const dismissResult = () => {
    setOutput("");
    setRanWith(null);
    reset();
  };

  const swap = () => {
    setFrom(to);
    setTo(from);
    setText(output || text);
    setOutput("");
    setRanWith(null);
  };

  const displayStats = stale ? { ...stats, status: "stale" } : stats;

  return (
    <div
      className={card}
      onFocusCapture={markInteracted}
      onPointerDownCapture={markInteracted}
    >
      <div className={cardHead}>
        <span className={cardHeadTitle}>
          <span className={running ? cardDotLive : cardDotOk} />
          translate() · streaming
        </span>
        <span className="inline-flex items-center gap-2">
          <DownloadDonut progress={progress} />
          {from} → {to}
        </span>
      </div>
      <div className={cardBody}>
        {available === false && <UnavailableNotice api="Translator API" />}
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
              disabled={available === false}
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
              disabled={available === false}
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
              disabled={available === false}
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
          {!running ? (
            <CacheAwareRun cached={stats.status === "cached"}>
              <button
                type="button"
                className={btnSm}
                onClick={() => run()}
                disabled={from === to || !available}
              >
                <span>▶</span> Translate
              </button>
            </CacheAwareRun>
          ) : (
            <button type="button" className={btnSmGhost} onClick={stop}>
              <span>■</span> Stop
            </button>
          )}
          <FreshRunButton
            show={
              !running && (stats.status === "done" || stats.status === "cached")
            }
            onClick={() => run(true)}
          />
          {from === to && (
            <span className="ml-auto block rounded-sm border border-[color-mix(in_oklch,var(--color-warn)_40%,var(--color-hairline))] px-3 py-2 font-mono text-[11.5px] text-warn max-[640px]:ml-0 max-[640px]:w-full">
              Source and target are the same.
            </span>
          )}
        </div>
        <StaleNotice show={stale} onDismiss={dismissResult} />
        <div
          key={cacheFlash}
          className={
            cacheFlash > 0 ? "animate-[demo-cache-flash_0.5s_ease-out]" : ""
          }
        >
          <Output
            text={output}
            streaming={running}
            placeholder={
              available === false
                ? "Open in Chrome 138+ or Edge 148+ to translate."
                : `Translation (${to}) will appear here.`
            }
          />
        </div>
        <StatusBar stats={displayStats} label={`pair: ${from}→${to}`} />
      </div>
    </div>
  );
};
