import {
  isAvailable as isProofreaderAvailable,
  ProofreaderUnavailableError,
  prepareProofreader,
  proofread,
} from "@web-ai-sdk/proofreader";
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
  fieldSpaced,
  label,
  textarea,
} from "../../../shared/ui.js";
import {
  CacheAwareRun,
  DEMO_RESULT_TTL_MS,
  type DemoIntentProps,
  DownloadDonut,
  ErrorNotice,
  FreshRunButton,
  Output,
  StaleNotice,
  StatusBar,
  UnavailableNotice,
  useDownloadMonitor,
  useStreamStats,
} from "./shared.js";

const SAMPLE_TEXT =
  "I seen him yesterday at the store, and he bought two loafs of bread.";

export const ProofreaderDemo = ({ intent: tabIntent }: DemoIntentProps) => {
  const [text, setText] = useState(SAMPLE_TEXT);
  const [output, setOutput] = useState("");
  const [corrections, setCorrections] = useState(0);
  const [running, setRunning] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ranWith, setRanWith] = useState<string | null>(null);
  // Bumped when a run serves from the cache, replaying a short pulse so the
  // instant result still gives visible feedback.
  const [cacheFlash, setCacheFlash] = useState(0);
  const { stats, start, update, finish, reset } = useStreamStats();
  const { progress, monitor } = useDownloadMonitor();
  const { intent, markInteracted } = useDemoIntent(tabIntent);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setAvailable(isProofreaderAvailable());
  }, []);

  // Abort in-flight work when the demo unmounts (for example on tab change).
  useEffect(() => () => abortRef.current?.abort(), []);

  // Prepare the session once the user shows intent, mirroring the run call.
  const createLease = useCallback(
    () => prepareProofreader({ expectedInputLanguages: ["en"], monitor }),
    [monitor],
  );
  useCapabilityLease(intent && available === true, createLease);

  const stale = !running && !!output && ranWith !== null && ranWith !== text;

  const run = async (refresh = false) => {
    if (running) return;
    const key = text;
    setOutput("");
    setCorrections(0);
    setError(null);
    setRanWith(null);
    setRunning(true);
    start();
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const result = await proofread({
        input: text,
        expectedInputLanguages: ["en"],
        monitor,
        cache: "session",
        cacheTtl: DEMO_RESULT_TTL_MS,
        cacheRefresh: refresh,
        signal: ac.signal,
      });
      if (!ac.signal.aborted && result.output) {
        setOutput(result.output.correctedInput);
        setCorrections(result.output.corrections.length);
        update(result.output.correctedInput);
      }
      setRanWith(key);
      if (result.cached) setCacheFlash((n) => n + 1);
      finish(result.cached ? "cached" : "done");
    } catch (err: unknown) {
      if (ac.signal.aborted) {
        finish("stopped");
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

  const stop = () => abortRef.current?.abort();
  const dismissResult = () => {
    setOutput("");
    setCorrections(0);
    setRanWith(null);
    reset();
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
          proofread() · local
        </span>
        <span className="inline-flex items-center gap-2">
          <DownloadDonut progress={progress} />
          {corrections} fixes
        </span>
      </div>
      <div className={cardBody}>
        {available === false && <UnavailableNotice api="Proofreader API" />}
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
          {!running ? (
            <CacheAwareRun cached={stats.status === "cached"}>
              <button
                type="button"
                className={btnSm}
                onClick={() => run()}
                disabled={!available}
              >
                <span>▶</span> Proofread
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
                ? "Open this demo in a supported Proofreader API setup."
                : "Run to correct grammar, spelling, and punctuation."
            }
          />
        </div>
        <StatusBar stats={displayStats} label={`${corrections} corrections`} />
      </div>
    </div>
  );
};
