import {
  SummarizerUnavailableError,
  isAvailable as isSummarizerAvailable,
  summarize,
} from "@web-ai-sdk/summarizer";
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

const SAMPLE_ARTICLE = `The Summarizer API ships as part of the browser's built-in AI surface. The model runs locally; there's no network round-trip, no API key, and no per-call cost. Latency is bounded by the device. On a recent M-series Mac, an 800-word article summarizes in under 600 ms. On a mid-tier Pixel, the same call takes about 1.4 seconds. The API exposes four summary types (key-points, tl;dr, teaser, headline) and three length presets. Output is deterministic with the same input and seed. The downside: model weights are large, so the first call on a cold profile downloads ~1.7 GB. Subsequent calls are instant.`;

type SummaryType = "key-points" | "tldr" | "headline";
type SummaryLength = "short" | "medium" | "long";

export const SummarizerDemo = () => {
  const [text, setText] = useState(SAMPLE_ARTICLE);
  const [type, setType] = useState<SummaryType>("key-points");
  const [length, setLength] = useState<SummaryLength>("short");
  const [output, setOutput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { stats, start, update, finish } = useStreamStats();
  const { progress, monitor } = useDownloadMonitor();
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setAvailable(isSummarizerAvailable());
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
      const result = await summarize({
        language: "en",
        input: text,
        type,
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
      } else if (err instanceof SummarizerUnavailableError) {
        setError(err.message || "Summarizer API reported unavailable.");
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

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className={card}>
      <div className={cardHead}>
        <span className={cardHeadTitle}>
          <span className={streaming ? cardDotLive : cardDotOk} />
          summarize() · local
        </span>
        <span>{wordCount} words in</span>
      </div>
      <div className={cardBody}>
        {available === false && <UnavailableNotice api="Summarizer API" />}
        <DownloadNotice progress={progress} />
        <ErrorNotice error={error} />
        <div className={fieldSpaced}>
          <label className={label} htmlFor="summarizer-demo-input">
            input
          </label>
          <textarea
            id="summarizer-demo-input"
            className={`${textarea} min-h-[110px]`}
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
            <span>{streaming ? "…" : "▶"}</span> Summarize
          </button>
          <div className={`${chipRow} ${chipRowEnd}`}>
            {(["key-points", "tldr", "headline"] as const).map((t) => (
              <button
                key={t}
                type="button"
                className={type === t ? chipActive : chip}
                onClick={() => setType(t)}
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
              ? "Open in Chrome 138+ or Edge 138+ to summarize."
              : "Run to summarize the article above."
          }
        />
        <StatusBar stats={stats} label={`type: ${type}`} />
      </div>
    </div>
  );
};
