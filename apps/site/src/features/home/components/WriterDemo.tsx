import {
  isAvailable as isWriterAvailable,
  prepareWriter,
  WriterUnavailableError,
  write,
} from "@web-ai-sdk/writer";
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
  chip,
  chipActive,
  chipRow,
  chipRowEnd,
  chipSep,
  demoControls,
  fieldSpaced,
  label,
  textarea,
} from "../../../shared/ui.js";
import {
  type DemoIntentProps,
  DownloadDonut,
  ErrorNotice,
  MarkdownOutput,
  StaleNotice,
  StatusBar,
  UnavailableNotice,
  useDownloadMonitor,
  useStreamStats,
} from "./shared.js";

const SAMPLE_TASK =
  "A short, upbeat announcement that our app now runs AI fully on-device, with no data leaving the browser.";

type Tone = "formal" | "neutral" | "casual";
type Length = "short" | "medium" | "long";

export const WriterDemo = ({ intent: tabIntent }: DemoIntentProps) => {
  const [text, setText] = useState(SAMPLE_TASK);
  const [tone, setTone] = useState<Tone>("casual");
  const [length, setLength] = useState<Length>("short");
  const [output, setOutput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ranWith, setRanWith] = useState<string | null>(null);
  const { stats, start, update, finish, reset } = useStreamStats();
  const { progress, monitor } = useDownloadMonitor();
  const { intent, markInteracted } = useDemoIntent(tabIntent);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setAvailable(isWriterAvailable());
  }, []);

  // Abort in-flight work when the demo unmounts (for example on tab change).
  useEffect(() => () => abortRef.current?.abort(), []);

  // Prepare the session for the current tone and length once the user shows
  // intent. Option edits release the old lease and prepare the new one.
  const createLease = useCallback(
    () => prepareWriter({ language: "en", tone, length, monitor }),
    [tone, length, monitor],
  );
  useCapabilityLease(intent && available === true, createLease);

  const runKey = JSON.stringify([text, tone, length]);
  const stale =
    !streaming && !!output && ranWith !== null && ranWith !== runKey;

  const run = async () => {
    if (streaming) return;
    const key = runKey;
    setOutput("");
    setError(null);
    setRanWith(null);
    setStreaming(true);
    start();
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const result = await write({
        language: "en",
        input: text,
        tone,
        length,
        monitor,
        signal: ac.signal,
        onUpdate: (chunk) => {
          if (ac.signal.aborted) return;
          setOutput(chunk);
          update(chunk);
        },
      });
      if (!ac.signal.aborted && result.output) {
        setOutput(result.output);
        update(result.output);
      }
      setRanWith(key);
      finish("done");
    } catch (err: unknown) {
      if (ac.signal.aborted) {
        finish("stopped");
      } else if (err instanceof WriterUnavailableError) {
        setError(err.message || "Writer API reported unavailable.");
        finish("unavailable");
      } else {
        setError((err as Error)?.message ?? String(err));
        finish("error");
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const stop = () => abortRef.current?.abort();
  const dismissResult = () => {
    setOutput("");
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
          <span className={streaming ? cardDotLive : cardDotOk} />
          write() · local
        </span>
        <span className="inline-flex items-center gap-2">
          <DownloadDonut progress={progress} />
          {tone} · {length}
        </span>
      </div>
      <div className={cardBody}>
        {available === false && <UnavailableNotice api="Writer API" />}
        <ErrorNotice error={error} />
        <div className={fieldSpaced}>
          <label className={label} htmlFor="writer-demo-input">
            writing task
          </label>
          <textarea
            id="writer-demo-input"
            className={`${textarea} min-h-[90px]`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
          />
        </div>
        <div className={demoControls}>
          {!streaming ? (
            <button
              type="button"
              className={btnSm}
              onClick={run}
              disabled={!available}
            >
              <span>▶</span> Write
            </button>
          ) : (
            <button type="button" className={btnSmGhost} onClick={stop}>
              <span>■</span> Stop
            </button>
          )}
          <div className={`${chipRow} ${chipRowEnd}`}>
            {(["formal", "neutral", "casual"] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={tone === t ? chipActive : chip}
                onClick={() => setTone(t)}
              >
                {t}
              </button>
            ))}
            <span className={chipSep} aria-hidden="true" />
            {(["short", "medium", "long"] as const).map((l) => (
              <button
                key={l}
                type="button"
                className={length === l ? chipActive : chip}
                onClick={() => setLength(l)}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <StaleNotice show={stale} onDismiss={dismissResult} />
        <MarkdownOutput
          text={output}
          streaming={streaming}
          placeholder={
            available === false
              ? "Open this demo in a supported Writer API setup to draft."
              : "Run to draft content from the task above."
          }
        />
        <StatusBar stats={displayStats} label={`tone: ${tone}`} />
      </div>
    </div>
  );
};
