import { isAvailable as isPromptAvailable } from "@web-ai-sdk/prompt";
import { usePrompt } from "@web-ai-sdk/prompt/react";
import { useEffect, useState } from "react";
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
  DownloadNotice,
  MarkdownOutput,
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

export const PromptDemo = () => {
  const [promptText, setPromptText] = useState<string>(PROMPT_EXAMPLES[0]);
  const [available, setAvailable] = useState<boolean | null>(null);
  const { stats, start, update, finish } = useStreamStats();
  const { progress, monitor } = useDownloadMonitor();
  const { status, output, ask, abort, reset } = usePrompt({
    systemPrompt: "You are concise. Reply briefly and avoid preamble.",
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
      finish("aborted");
    }
  }, [status, output]);

  useEffect(() => {
    setAvailable(isPromptAvailable());
  }, []);

  const streaming = status === "loading" || status === "streaming";

  const run = async () => {
    if (streaming) return;
    reset();
    await ask(promptText);
  };

  return (
    <div className={card}>
      <div className={cardHead}>
        <span className={cardHeadTitle}>
          <span className={streaming ? cardDotLive : cardDotOk} />
          ask() · streaming
        </span>
        <span>session: cached · balanced</span>
      </div>
      <div className={cardBody}>
        {available === false && <UnavailableNotice api="Prompt API" />}
        <DownloadNotice progress={progress} />
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
              >
                {i === 0 ? "feature-detect" : i === 1 ? "haiku" : "explain"}
              </button>
            ))}
          </div>
        </div>
        <MarkdownOutput
          text={output ?? ""}
          streaming={streaming}
          placeholder={
            available === false
              ? "Open in Chrome 148+ or Edge 138+ to stream a response."
              : "Output will stream here…"
          }
        />
        <StatusBar stats={stats} label="runtime: browser-provided model" />
      </div>
    </div>
  );
};
