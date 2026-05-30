import {
  RewriterUnavailableError,
  isAvailable as isRewriterAvailable,
  rewrite,
} from "@web-ai-sdk/rewriter";
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
} from "../lib/ui.js";
import {
  DownloadNotice,
  ErrorNotice,
  MarkdownOutput,
  StatusBar,
  UnavailableNotice,
  useDownloadMonitor,
  useStreamStats,
} from "./shared.js";

const SAMPLE_TEXT =
  "hey, can u send me that doc when u get a sec? would be super helpful, thx a bunch!!";

type Tone = "as-is" | "more-formal" | "more-casual";
type Length = "as-is" | "shorter" | "longer";

export const RewriterDemo = () => {
  const [text, setText] = useState(SAMPLE_TEXT);
  const [tone, setTone] = useState<Tone>("more-formal");
  const [length, setLength] = useState<Length>("as-is");
  const [output, setOutput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { stats, start, update, finish } = useStreamStats();
  const { progress, monitor } = useDownloadMonitor();
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setAvailable(isRewriterAvailable());
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
      const result = await rewrite({
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
      } else if (err instanceof RewriterUnavailableError) {
        setError(err.message || "Rewriter API reported unavailable.");
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
          rewrite() · local
        </span>
        <span>
          {tone} · {length}
        </span>
      </div>
      <div className={cardBody}>
        {available === false && (
          <UnavailableNotice api="Rewriter API" flagSearch="Rewriter" />
        )}
        <DownloadNotice progress={progress} />
        <ErrorNotice error={error} />
        <div className={fieldSpaced}>
          <label className={label} htmlFor="rewriter-demo-input">
            text to rewrite
          </label>
          <textarea
            id="rewriter-demo-input"
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
            <span>{streaming ? "…" : "▶"}</span> Rewrite
          </button>
          <div className={`${chipRow} ${chipRowEnd}`}>
            {(["as-is", "more-formal", "more-casual"] as const).map((t) => (
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
            {(["as-is", "shorter", "longer"] as const).map((l) => (
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
              ? "Enable the Rewriter API flag in Chrome to rewrite."
              : "Run to rewrite the text above."
          }
        />
        <StatusBar stats={stats} label={`tone: ${tone}`} />
      </div>
    </div>
  );
};
