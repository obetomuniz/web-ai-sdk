import {
  isAvailable as isPromptAvailable,
  prepareLanguageModel,
} from "@web-ai-sdk/prompt";
import { usePrompt } from "@web-ai-sdk/prompt/react";
import { useCallback, useEffect, useState } from "react";
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
  demoControls,
  fieldSpaced,
  label,
  textarea,
} from "../../../shared/ui.js";
import {
  type DemoIntentProps,
  DownloadDonut,
  MarkdownOutput,
  StaleNotice,
  StatusBar,
  UnavailableNotice,
  useDownloadMonitor,
  useStreamStats,
} from "./shared.js";

const PROMPT_EXAMPLES = [
  "Explain feature detection in 2 sentences.",
  "Write a haiku about session caching.",
  "What's the difference between a hook and a wrapper?",
] as const;

const SYSTEM_PROMPT = "You are concise. Reply briefly and avoid preamble.";

export const PromptDemo = ({ intent: tabIntent }: DemoIntentProps) => {
  const [promptText, setPromptText] = useState<string>(PROMPT_EXAMPLES[0]);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [ranWith, setRanWith] = useState<string | null>(null);
  const { stats, start, update, finish, reset: resetStats } = useStreamStats();
  const { progress, monitor } = useDownloadMonitor();
  const { intent, markInteracted } = useDemoIntent(tabIntent);
  const { status, output, ask, abort, reset } = usePrompt({
    systemPrompt: SYSTEM_PROMPT,
    samplingMode: "balanced",
    monitor,
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: see comment above
  useEffect(() => {
    if (status === "loading") start();
    else if (status === "streaming" && output) update(output);
    else if (status === "done") {
      if (output) update(output);
      finish("done");
    } else if (status === "idle" && stats.status === "running") {
      finish("stopped");
    }
  }, [status, output]);

  useEffect(() => {
    setAvailable(isPromptAvailable());
  }, []);

  // Prepare the base session once the user shows intent. `ask()` runs on the
  // same configuration, so the first run reuses the prepared session.
  const createLease = useCallback(
    () =>
      prepareLanguageModel({
        systemPrompt: SYSTEM_PROMPT,
        samplingMode: "balanced",
        monitor,
      }),
    [monitor],
  );
  useCapabilityLease(intent && available === true, createLease);

  const streaming = status === "loading" || status === "streaming";
  const stale =
    !streaming && !!output && ranWith !== null && ranWith !== promptText;

  const run = async () => {
    if (streaming) return;
    const key = promptText;
    reset();
    setRanWith(key);
    await ask(key);
  };

  const dismissResult = () => {
    reset();
    setRanWith(null);
    resetStats();
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
          ask() · streaming
        </span>
        <span className="inline-flex items-center gap-2">
          <DownloadDonut progress={progress} />
          session: {intent ? "prepared" : "on-demand"} · balanced
        </span>
      </div>
      <div className={cardBody}>
        {available === false && <UnavailableNotice api="Prompt API" />}
        <div className={fieldSpaced}>
          <label className={label} htmlFor="prompt-demo-input">
            prompt
          </label>
          <textarea
            id="prompt-demo-input"
            className={textarea}
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            spellCheck={false}
          />
        </div>
        <div className={demoControls}>
          {!streaming ? (
            <button
              className={btnSm}
              onClick={run}
              disabled={!available || !promptText.trim()}
              type="button"
            >
              <span>▶</span> Run
            </button>
          ) : (
            <button className={btnSmGhost} onClick={abort} type="button">
              <span>■</span> Stop
            </button>
          )}
          <div className={`${chipRow} ${chipRowEnd}`}>
            {PROMPT_EXAMPLES.map((p, i) => (
              <button
                key={p}
                type="button"
                className={promptText === p ? chipActive : chip}
                onClick={() => setPromptText(p)}
                disabled={available === false}
              >
                {i === 0 ? "feature-detect" : i === 1 ? "haiku" : "explain"}
              </button>
            ))}
          </div>
        </div>
        <StaleNotice show={stale} onDismiss={dismissResult} />
        <MarkdownOutput
          text={output ?? ""}
          streaming={streaming}
          placeholder={
            available === false
              ? "Open in Chrome 148+ or Edge 138+ to stream a response."
              : "Output will stream here…"
          }
        />
        <StatusBar
          stats={displayStats}
          label="runtime: browser-provided model"
        />
      </div>
    </div>
  );
};
