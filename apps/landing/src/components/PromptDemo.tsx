import { isPromptAvailable } from "@web-ai-sdk/prompt";
import { usePrompt } from "@web-ai-sdk/prompt/react";
import { useEffect, useState } from "react";
import {
  DownloadNotice,
  MarkdownOutput,
  StatusBar,
  UnavailableNotice,
  detectModelName,
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
  const { status, response, ask, abort, reset } = usePrompt({
    systemPrompt: "You are concise. Reply briefly and avoid preamble.",
    temperature: 0.7,
    createOptions: { monitor },
  });

  // Track stats off of the response stream. On `done`, also call update()
  // with the final response so the char/tok counts reflect non-streaming
  // results (e.g. Edge sometimes returns one-shot without firing chunks).
  // Stats setters (`start`, `update`, `finish`) are stable across renders;
  // including them in deps would only thrash the effect.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see comment above
  useEffect(() => {
    if (status === "loading") start();
    else if (status === "streaming" && response) update(response);
    else if (status === "done") {
      if (response) update(response);
      finish("done");
    } else if (status === "idle" && stats.status === "running") {
      finish("aborted");
    }
  }, [status, response]);

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
    <div className="card">
      <div className="card-head">
        <span className="title">
          <span
            className={`dot ${streaming ? "live" : status === "done" ? "ok" : "ok"}`}
          />
          ask() · streaming
        </span>
        <span>session: cached · temp 0.7</span>
      </div>
      <div className="card-body">
        {available === false && (
          <UnavailableNotice api="Prompt API" flagSearch="Prompt API" />
        )}
        <DownloadNotice progress={progress} />
        <div className="field" style={{ margin: "12px 0" }}>
          <label className="label" htmlFor="prompt-demo-input">
            prompt
          </label>
          <textarea
            id="prompt-demo-input"
            className="textarea"
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            spellCheck={false}
          />
        </div>
        <div className="demo-controls">
          {!streaming ? (
            <button
              className="btn-sm"
              onClick={run}
              disabled={!available || !promptText.trim()}
              type="button"
            >
              <span>▶</span> Run
            </button>
          ) : (
            <button className="btn-sm ghost" onClick={abort} type="button">
              <span>■</span> Stop
            </button>
          )}
          <div className="chip-row chip-row-end">
            {PROMPT_EXAMPLES.map((p, i) => (
              <button
                key={p}
                type="button"
                className={`chip ${promptText === p ? "active" : ""}`}
                onClick={() => setPromptText(p)}
              >
                {i === 0 ? "feature-detect" : i === 1 ? "haiku" : "explain"}
              </button>
            ))}
          </div>
        </div>
        <MarkdownOutput
          text={response ?? ""}
          streaming={streaming}
          placeholder={
            available === false
              ? "Open in Chrome 138+ or Edge 138+ to stream a response."
              : "Output will stream here…"
          }
        />
        <StatusBar stats={stats} label={`model: ${detectModelName()}`} />
      </div>
    </div>
  );
};
