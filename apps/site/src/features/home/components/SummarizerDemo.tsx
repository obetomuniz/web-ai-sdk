import {
  isAvailable as isSummarizerAvailable,
  prepareSummarizer,
  SummarizerUnavailableError,
  summarize,
} from "@web-ai-sdk/summarizer";
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
  chipRowEnd,
  chipRowInline,
  chipSelect,
  chipSelectCaret,
  chipSelectWrap,
  chipSep,
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
  InfoNotice,
  MarkdownOutput,
  StaleNotice,
  StatusBar,
  UnavailableNotice,
  useDownloadMonitor,
  useStreamStats,
} from "./shared.js";

const SAMPLE_ARTICLE = `The Summarizer API is part of the browser's built-in AI surface. Applications should pass only the text that is relevant to the user's task, show model-download and generation progress, and treat every result as untrusted content. The API exposes multiple summary types and length presets. A lifecycle wrapper can handle feature detection, session reuse, streaming normalization, abort signals, and optional result caching. The application still owns text extraction, rendering, sanitization, cache freshness, fallback UI, and the decision to preserve or replace the original content.`;

type SummaryType = "key-points" | "tldr" | "headline";
type SummaryLength = "short" | "medium" | "long";
type SummaryPreference = "auto" | "speed" | "capability";

const preferenceInfo = (preference: SummaryPreference): string | null => {
  return `preference: ${preference} is experimental and may be unavailable in the current browser implementation.`;
};

const ChipSelect = <T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) => (
  <span className={chipSelectWrap}>
    <select
      className={chipSelect}
      value={value}
      aria-label={label}
      onChange={(e) => onChange(e.target.value as T)}
      disabled={disabled}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
    <span className={chipSelectCaret} aria-hidden="true">
      ▾
    </span>
  </span>
);

export const SummarizerDemo = ({ intent: tabIntent }: DemoIntentProps) => {
  const [text, setText] = useState(SAMPLE_ARTICLE);
  const [type, setType] = useState<SummaryType>("key-points");
  const [length, setLength] = useState<SummaryLength>("short");
  const [preference, setPreference] = useState<SummaryPreference>("auto");
  const [output, setOutput] = useState("");
  const [streaming, setStreaming] = useState(false);
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
    setAvailable(isSummarizerAvailable());
  }, []);

  // Abort in-flight work when the demo unmounts (for example on tab change).
  useEffect(() => () => abortRef.current?.abort(), []);

  // Prepare the session for the current configuration once the user shows
  // intent. The options mirror the run call, so the first Run reuses the
  // prepared session. Option edits release the old lease and prepare anew.
  const createLease = useCallback(
    () =>
      prepareSummarizer({ language: "en", type, length, preference, monitor }),
    [type, length, preference, monitor],
  );
  useCapabilityLease(intent && available === true, createLease);

  const info = preference !== "auto" ? preferenceInfo(preference) : null;
  const runKey = JSON.stringify([text, type, length, preference]);
  const stale =
    !streaming && !!output && ranWith !== null && ranWith !== runKey;

  const run = async (refresh = false) => {
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
      const result = await summarize({
        language: "en",
        input: text,
        type,
        length,
        preference,
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
      if (!ac.signal.aborted && result.output) {
        setOutput(result.output);
        update(result.output);
      }
      setRanWith(key);
      if (result.cached) setCacheFlash((n) => n + 1);
      finish(result.cached ? "cached" : "done");
    } catch (err: unknown) {
      if (ac.signal.aborted) {
        finish("stopped");
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

  const stop = () => abortRef.current?.abort();
  const dismissResult = () => {
    setOutput("");
    setRanWith(null);
    reset();
  };

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const displayStats = stale ? { ...stats, status: "stale" } : stats;

  return (
    // Focus and pointer interaction inside the card count as intent, so a
    // visitor who starts with the demo (not the tab) still gets preparation.
    <div
      className={card}
      onFocusCapture={markInteracted}
      onPointerDownCapture={markInteracted}
    >
      <div className={cardHead}>
        <span className={cardHeadTitle}>
          <span className={streaming ? cardDotLive : cardDotOk} />
          summarize() · local
        </span>
        <span className="inline-flex items-center gap-2">
          <DownloadDonut progress={progress} />
          {wordCount} words in
        </span>
      </div>
      <div className={cardBody}>
        {available === false && <UnavailableNotice api="Summarizer API" />}
        <InfoNotice message={info} />
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
          {!streaming ? (
            <CacheAwareRun cached={stats.status === "cached"}>
              <button
                type="button"
                className={btnSm}
                onClick={() => run()}
                disabled={!available}
              >
                <span>▶</span> Summarize
              </button>
            </CacheAwareRun>
          ) : (
            <button type="button" className={btnSmGhost} onClick={stop}>
              <span>■</span> Stop
            </button>
          )}
          <FreshRunButton
            show={
              !streaming &&
              (stats.status === "done" || stats.status === "cached")
            }
            onClick={() => run(true)}
          />
          <div className={`${chipRowInline} ${chipRowEnd}`}>
            <ChipSelect
              label="Summary type"
              value={type}
              options={["key-points", "tldr", "headline"]}
              onChange={setType}
              disabled={available === false}
            />
            <span className={chipSep} aria-hidden="true" />
            <ChipSelect
              label="Summary length"
              value={length}
              options={["short", "medium", "long"]}
              onChange={setLength}
              disabled={available === false}
            />
            <span className={chipSep} aria-hidden="true" />
            <ChipSelect
              label="Performance preference"
              value={preference}
              options={["auto", "speed", "capability"]}
              onChange={setPreference}
              disabled={available === false}
            />
          </div>
        </div>
        <StaleNotice show={stale} onDismiss={dismissResult} />
        <div
          key={cacheFlash}
          className={
            cacheFlash > 0 ? "animate-[demo-cache-flash_0.5s_ease-out]" : ""
          }
        >
          <MarkdownOutput
            text={output}
            streaming={streaming}
            placeholder={
              available === false
                ? "Open in Chrome 138+ or Edge 138+ to summarize."
                : "Run to summarize the article above."
            }
          />
        </div>
        <StatusBar
          stats={displayStats}
          label={`type: ${type} · preference: ${preference}`}
        />
      </div>
    </div>
  );
};
