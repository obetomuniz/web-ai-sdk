import {
  isAvailable as isWriterAvailable,
  WriterUnavailableError,
  write,
} from "@web-ai-sdk/writer";
import { useEffect, useRef, useState } from "react";
import {
  btnSm,
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
  DownloadNotice,
  ErrorNotice,
  MarkdownOutput,
  StatusBar,
  UnavailableNotice,
  useDownloadMonitor,
  useStreamStats,
} from "./shared.js";

const SAMPLE_TASK =
  "A short, upbeat announcement that our app now runs AI fully on-device, with no data leaving the browser.";

type Tone = "formal" | "neutral" | "casual";
type Length = "short" | "medium" | "long";

export const WriterDemo = () => {
  const [text, setText] = useState(SAMPLE_TASK);
  const [tone, setTone] = useState<Tone>("casual");
  const [length, setLength] = useState<Length>("short");
  const [output, setOutput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { stats, start, update, finish } = useStreamStats();
  const { progress, monitor } = useDownloadMonitor();
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setAvailable(isWriterAvailable());
  }, []);

  const run = async () => {
    if (streaming) return;
    setOutput("");
    setError(null);
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
      finish(result.cached ? "cached" : "done");
    } catch (err: unknown) {
      if (ac.signal.aborted) {
        finish("aborted");
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

  return (
    <div className={card}>
      <div className={cardHead}>
        <span className={cardHeadTitle}>
          <span className={streaming ? cardDotLive : cardDotOk} />
          write() · local
        </span>
        <span>
          {tone} · {length}
        </span>
      </div>
      <div className={cardBody}>
        {available === false && <UnavailableNotice api="Writer API" />}
        <DownloadNotice progress={progress} />
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
          <button
            type="button"
            className={btnSm}
            onClick={run}
            disabled={streaming || !available}
          >
            <span>{streaming ? "…" : "▶"}</span> Write
          </button>
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
        <MarkdownOutput
          text={output}
          streaming={streaming}
          placeholder={
            available === false
              ? "Open this demo in a supported Writer API setup to draft."
              : "Run to draft content from the task above."
          }
        />
        <StatusBar stats={stats} label={`tone: ${tone}`} />
      </div>
    </div>
  );
};
