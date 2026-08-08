import {
  isAvailable as isDetectorAvailable,
  prepareLanguageDetector,
} from "@web-ai-sdk/detector";
import { useDetector } from "@web-ai-sdk/detector/react";
import { useCallback, useEffect, useState } from "react";
import {
  useCapabilityLease,
  useDebouncedValue,
  useDemoIntent,
} from "../../../shared/demoLifecycle.js";
import {
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
  demoControls,
  fieldSpaced,
  label,
  outputBox,
  textarea,
} from "../../../shared/ui.js";
import {
  type DemoIntentProps,
  DownloadDonut,
  ErrorNotice,
  StatusBar,
  UnavailableNotice,
  useDownloadMonitor,
  useStreamStats,
} from "./shared.js";

const DETECT_EXAMPLES = [
  "Building blocks ship as small modules, so they fit any framework.",
  "Olá! Sou uma biblioteca leve para a Web's built-in AI.",
  "おはようございます。テキストの言語を検出します。",
  "Las APIs nativas del navegador son el futuro.",
] as const;

const EXAMPLE_LABELS = ["en", "pt", "ja", "es"] as const;

// Detection waits for a typing pause instead of running on every keystroke.
const DETECT_DEBOUNCE_MS = 600;

export const DetectorDemo = ({ intent: tabIntent }: DemoIntentProps) => {
  const [text, setText] = useState<string>(DETECT_EXAMPLES[0]);
  const [available, setAvailable] = useState<boolean | null>(null);
  const { stats, start, update, finish } = useStreamStats();
  const { progress, monitor } = useDownloadMonitor();
  const { intent, markInteracted } = useDemoIntent(tabIntent);
  const debouncedText = useDebouncedValue(text, DETECT_DEBOUNCE_MS);
  // Selecting the detector tab is the intent signal, so detection runs on
  // the seeded example right away; a hydration-only mount stays idle.
  const { status, output, error } = useDetector({
    input: debouncedText,
    monitor,
    enabled: intent && available !== false,
  });
  const language = output?.language ?? null;
  const confidence = output?.confidence ?? 0;
  const all = output?.all ?? [];

  useEffect(() => {
    setAvailable(isDetectorAvailable());
  }, []);

  const createLease = useCallback(
    () => prepareLanguageDetector({ monitor }),
    [monitor],
  );
  useCapabilityLease(intent && available === true, createLease);

  // biome-ignore lint/correctness/useExhaustiveDependencies: see comment above
  useEffect(() => {
    if (status === "loading") start();
    else if (status === "done") {
      if (language) update(language);
      finish("done");
    } else if (status === "unavailable" && stats.status === "running") {
      finish("unavailable");
    }
  }, [status, language]);

  const running = status === "loading";
  // Pending edits keep the previous result visible but marked stale.
  const stale = intent && text !== debouncedText && status === "done";
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
          detect() · debounced
        </span>
        <span className="inline-flex items-center gap-2">
          <DownloadDonut progress={progress} />
          {status === "done" && language
            ? `${language} · ${Math.round(confidence * 100)}%`
            : status === "idle"
              ? intent
                ? "awaiting input"
                : "awaiting interaction"
              : status === "loading"
                ? "detecting…"
                : "-"}
        </span>
      </div>
      <div className={cardBody}>
        {available === false && (
          <UnavailableNotice api="Language Detector API" />
        )}
        <ErrorNotice error={error?.message ?? null} />
        <div className={fieldSpaced}>
          <label className={label} htmlFor="detector-demo-input">
            input
          </label>
          <textarea
            id="detector-demo-input"
            className={`${textarea} min-h-16`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
          />
        </div>
        <div className={demoControls}>
          <div className={`${chipRow} ${chipRowEnd}`}>
            {DETECT_EXAMPLES.map((p, i) => (
              <button
                key={p}
                type="button"
                className={text === p ? chipActive : chip}
                onClick={() => setText(p)}
              >
                {EXAMPLE_LABELS[i]}
              </button>
            ))}
          </div>
        </div>
        <div className={`${outputBox} min-h-20`}>
          {status === "done" && all.length > 0 ? (
            <ol className="m-0 list-none p-0">
              {all.slice(0, 4).map((entry, i) => (
                <li
                  key={entry.detectedLanguage}
                  className={`flex justify-between py-0.5 ${i === 0 ? "text-fg" : "text-fg-3"}`}
                >
                  <span>
                    <code
                      className={i === 0 ? "text-accent-bright" : "text-fg-3"}
                    >
                      {entry.detectedLanguage}
                    </code>
                  </span>
                  <span className="tabular-nums">
                    {(entry.confidence * 100).toFixed(1)}%
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <span className="text-fg-4 italic">
              {available === false
                ? "Open in Chrome 138+ or Edge 148+ to detect."
                : !intent
                  ? "Focus the input or pick an example to start detection."
                  : status === "idle"
                    ? "Type or paste text above."
                    : status === "loading"
                      ? "Detecting…"
                      : "No confident match."}
            </span>
          )}
        </div>
        <StatusBar
          stats={displayStats}
          label={`debounce: ${DETECT_DEBOUNCE_MS}ms`}
        />
      </div>
    </div>
  );
};
