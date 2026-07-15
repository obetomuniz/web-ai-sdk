import { isAvailable as isPromptAvailable } from "@web-ai-sdk/prompt";
import { isAvailable as isSummarizerAvailable } from "@web-ai-sdk/summarizer";
import {
  type SyntheticEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { playground as ui } from "../../shared/ui.js";
import { useAgent } from "./experimental/agent/react/index.js";
import { MultiTurnTranscript } from "./experimental/playground/MultiTurnTranscript.js";
import { PRESETS } from "./experimental/playground/presets.js";
import { ToolList } from "./experimental/playground/ToolList.js";
import { useExamples } from "./experimental/playground/useExamples.js";
import type { ActivityEvent } from "./lib/types.js";
import { useAgentThreads } from "./lib/useAgentThreads.js";
import { useStickToBottom } from "./lib/useStickToBottom.js";
import { useWebMCPTools } from "./lib/useWebMCPTools.js";

const MAX_ACTIVITY = 50;

export function Playground() {
  const { threads, activeThread, activeSkill, ops } = useAgentThreads();
  const [draft, setDraft] = useState("");
  const [currentInput, setCurrentInput] = useState("");
  const [infoTab, setInfoTab] = useState<"activity" | "hints">("hints");
  const [eventsLog, setEventsLog] = useState<ActivityEvent[]>([]);
  const promptOn = useMemo(() => isPromptAvailable(), []);
  const summarizerOn = useMemo(() => isSummarizerAvailable(), []);

  const pushActivity = useCallback(
    (event: Omit<ActivityEvent, "id" | "ts">) => {
      setEventsLog((prev) =>
        [{ id: crypto.randomUUID(), ts: Date.now(), ...event }, ...prev].slice(
          0,
          MAX_ACTIVITY,
        ),
      );
    },
    [],
  );

  const tools = useMemo(() => activeSkill.tools, [activeSkill]);
  const {
    status,
    text,
    a2uiSnapshot,
    liveThought,
    events,
    steps,
    stopReason,
    error,
    run,
    abort,
    newSession,
    previewA2ui,
  } = useAgent({
    systemPrompt: activeSkill.systemPrompt,
    tools,
    maxSteps: 6,
    sessionMode: "thread",
    samplingMode: "predictable",
    language: "en",
    a2ui: activeSkill.a2ui,
    onTurnComplete: (turn) => {
      setCurrentInput("");
      ops.appendTurn(activeThread.id, turn);
      pushActivity({
        kind: "chat_response",
        message: "reply",
        detail: activeThread.name,
      });
    },
  });

  const {
    examples,
    regenerate: regenerateExamples,
    generating: generatingExamples,
    error: examplesError,
    canRegenerate: canRegenerateExamples,
  } = useExamples(activeSkill);

  const busy =
    status === "planning" ||
    status === "tool_calling" ||
    status === "streaming";

  const send = useCallback(
    async (textToSend: string) => {
      const trimmed = textToSend.trim();
      if (!trimmed || busy) return;
      pushActivity({
        kind: "chat_send",
        message: "send",
        detail: trimmed,
      });
      setCurrentInput(trimmed);
      try {
        await run(trimmed);
      } finally {
        setCurrentInput("");
      }
    },
    [busy, pushActivity, run],
  );

  const clear = useCallback(() => {
    ops.clearTurns(activeThread.id);
    newSession();
    pushActivity({
      kind: "chat_clear",
      message: "clear thread",
      detail: activeThread.name,
    });
  }, [activeThread.id, activeThread.name, newSession, ops, pushActivity]);

  const { available: webmcpAvailable } = useWebMCPTools({
    threads,
    activeThread,
    ops,
    send,
    clear,
    newSession,
    pushActivity,
  });

  useEffect(() => {
    pushActivity({
      kind: "info",
      message: "ready",
      detail: `prompt:${promptOn ? "on" : "off"} · webmcp:${webmcpAvailable ? "on" : "off"} · summarizer:${summarizerOn ? "on" : "off"}`,
    });
  }, [promptOn, pushActivity, summarizerOn, webmcpAvailable]);

  const transcriptRef = useRef<HTMLDivElement>(null);
  const { isPinned, scrollToBottom } = useStickToBottom(transcriptRef, [
    activeThread.turns.length,
    text,
    events.length,
    liveThought?.text,
  ]);

  const submitDraft = () => {
    if (!draft.trim() || busy) return;
    void send(draft);
    setDraft("");
  };

  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitDraft();
  };

  const createThread = (skillId = activeSkill.id) => {
    const thread = ops.create(skillId);
    newSession();
    pushActivity({
      kind: "chat_switch",
      message: "new thread",
      detail: thread.name,
    });
  };

  const selectThread = (id: string) => {
    if (busy || id === activeThread.id) return;
    ops.select(id);
    newSession();
    const thread = threads.find((candidate) => candidate.id === id);
    pushActivity({
      kind: "chat_switch",
      message: "thread",
      detail: thread?.name ?? id,
    });
  };

  const closeThread = (id: string) => {
    if (busy) return;
    const thread = threads.find((candidate) => candidate.id === id);
    if (!thread) return;
    const wasActive = id === activeThread.id;
    ops.remove(id);
    if (wasActive) newSession();
    pushActivity({
      kind: "chat_close",
      message: "close thread",
      detail: thread.name,
    });
  };

  const setSkill = (skillId: string) => {
    const skill = PRESETS.find((preset) => preset.id === skillId) ?? PRESETS[0];
    if (activeThread.turns.length === 0) {
      ops.setSkill(activeThread.id, skill.id);
      newSession();
    } else {
      createThread(skill.id);
    }
    setDraft("");
    pushActivity({ kind: "info", message: "skill", detail: skill.name });
  };

  return (
    <div className={ui.shell}>
      <aside className={ui.sidebar}>
        <header className={ui.sidebarHeader}>
          <div className={ui.brandStack}>
            <div className={ui.brand}>
              Playground
              <span className="inline-block h-[0.08em] w-[0.5em] animate-blink rounded-[1px] bg-accent" />
            </div>
            <div className={ui.brandSub}>on-device agent</div>
          </div>
        </header>

        <div className={ui.sidebarBody}>
          <section className={ui.sidebarSection}>
            <div className={ui.sectionTitle}>Threads</div>
            <button
              type="button"
              className={ui.wideButton}
              onClick={() => createThread()}
              disabled={busy}
            >
              + New thread
            </button>
            <div className={ui.presets}>
              {threads.map((thread) => (
                <div
                  key={thread.id}
                  data-thread-id={thread.id}
                  data-active={thread.id === activeThread.id}
                  className={
                    thread.id === activeThread.id
                      ? ui.threadItemActive
                      : ui.threadItem
                  }
                >
                  <button
                    type="button"
                    className={ui.threadSelect}
                    onClick={() => selectThread(thread.id)}
                    disabled={busy}
                  >
                    <span className={ui.presetName}>{thread.name}</span>
                    <span className={ui.presetDesc}>
                      {findSkillName(thread.skillId)} · {thread.turns.length}{" "}
                      turn{thread.turns.length === 1 ? "" : "s"}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={ui.threadClose}
                    onClick={() => closeThread(thread.id)}
                    disabled={busy}
                    aria-label={`Close thread ${thread.name}`}
                    title="Close thread"
                  >
                    <span aria-hidden="true">×</span>
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className={ui.sidebarSection}>
            <div className={ui.sectionTitle}>Skill</div>
            <div className={ui.presets}>
              {PRESETS.map((skill) => (
                <button
                  key={skill.id}
                  type="button"
                  data-preset-id={skill.id}
                  className={
                    skill.id === activeSkill.id ? ui.presetActive : ui.preset
                  }
                  onClick={() => setSkill(skill.id)}
                  disabled={busy}
                >
                  <span className={ui.presetName}>{skill.name}</span>
                  <span className={ui.presetDesc}>{skill.description}</span>
                </button>
              ))}
            </div>
          </section>

          <section className={ui.sidebarSection}>
            <div className={ui.sectionTitle}>Tools</div>
            <ToolList tools={tools} />
          </section>
        </div>
      </aside>

      <main className={ui.main}>
        <header className={ui.mainHeader}>
          <div className={ui.titleBlock}>
            <div className={ui.title}>{activeThread.name}</div>
            <div className={ui.subtitle}>{activeSkill.name}</div>
          </div>
          <div className={ui.headerActions}>
            <button
              type="button"
              className={ui.smallButton}
              onClick={() => {
                newSession();
                pushActivity({
                  kind: "info",
                  message: "reset session",
                  detail: activeThread.name,
                });
              }}
              disabled={busy}
              title="Reset the native model session for this thread. The visible history stays, but the model may not recall it until history re-seeding is added."
            >
              Reset session
            </button>
            <button
              type="button"
              className={ui.smallButton}
              onClick={clear}
              disabled={busy || activeThread.turns.length === 0}
            >
              Clear
            </button>
          </div>
        </header>

        <div className={ui.mainBody}>
          <div className={ui.colRow}>
            <div className={ui.colTitle}>Transcript</div>
            <span className={ui.status}>
              {promptOn ? status : "unavailable"}
              {stopReason &&
              stopReason !== status &&
              status !== "planning" &&
              status !== "tool_calling"
                ? ` · ${stopReason}`
                : ""}
            </span>
          </div>
          <section className={ui.transcriptPanel}>
            <div ref={transcriptRef} className={ui.answer}>
              {!promptOn && (
                <div className={ui.banner}>
                  Prompt API is unavailable. Use desktop Chrome 148+, or enable
                  the matching Prompt API flag in a supported Chrome or Edge
                  preview build, then reload.
                </div>
              )}
              <MultiTurnTranscript
                turns={activeThread.turns}
                currentInput={currentInput}
                events={events}
                text={text}
                a2uiSnapshot={a2uiSnapshot}
                liveThought={liveThought}
                stopReason={stopReason}
                busy={busy}
                transcriptRendererId={activeSkill.transcriptRendererId}
                toolRendererId={activeSkill.toolRendererId}
                a2uiEnabled={activeSkill.a2ui?.enabled}
              />
              {error && (
                <div className={ui.bannerError}>
                  {error.name}: {error.message}
                </div>
              )}
            </div>
            {!isPinned && (
              <button
                type="button"
                className={ui.jump}
                onClick={() => scrollToBottom()}
                aria-label="Scroll to latest"
              >
                <span aria-hidden="true">↓</span> Latest
              </button>
            )}
          </section>

          <form className={ui.composer} onSubmit={submit}>
            <textarea
              className={ui.composerInput}
              placeholder={
                promptOn
                  ? "Ask the agent something. Shift+Enter for newline."
                  : "Prompt API unavailable in this browser."
              }
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={!promptOn}
              rows={3}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitDraft();
                }
              }}
            />
            <div className={ui.composerRow}>
              <div
                className={ui.examples}
                title={
                  examplesError
                    ? `Couldn't generate fresh examples: ${examplesError.message}`
                    : undefined
                }
              >
                {(activeSkill.a2uiStaticDemos ?? []).map((demo) => (
                  <button
                    key={demo.id}
                    type="button"
                    className={ui.exampleStatic}
                    onClick={() => previewA2ui(demo.messages)}
                    disabled={busy}
                    title="Instant preview (no model call)"
                  >
                    {demo.label}
                  </button>
                ))}
                {examples.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    className={ui.example}
                    onClick={() => setDraft(ex)}
                    disabled={busy}
                  >
                    {truncate(ex, 60)}
                  </button>
                ))}
                {canRegenerateExamples && (
                  <button
                    type="button"
                    className={ui.example}
                    onClick={regenerateExamples}
                    disabled={busy || generatingExamples}
                    title="Generate fresh examples on-device with the Prompt API"
                  >
                    {generatingExamples ? "generating..." : "new examples"}
                  </button>
                )}
              </div>
              <div className={ui.composerActions}>
                {busy ? (
                  <button
                    type="button"
                    className={ui.stopButton}
                    onClick={() => {
                      abort();
                      pushActivity({
                        kind: "chat_abort",
                        message: "abort",
                        detail: activeThread.name,
                      });
                    }}
                  >
                    Stop
                  </button>
                ) : (
                  <button
                    type="submit"
                    className={ui.sendButton}
                    data-testid="agent-run"
                    disabled={!promptOn || !draft.trim()}
                  >
                    Send
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </main>

      <section className={ui.workspace}>
        <header className={ui.workspaceHeader}>
          <div className={ui.workspaceTitle}>
            Workspace
            <span className={ui.workspaceCount}>
              · {steps.length} step{steps.length === 1 ? "" : "s"}
            </span>
          </div>
        </header>
        <div className={ui.workspaceBody}>
          <div className={ui.colRow}>
            <div className={ui.chips}>
              <Chip on={promptOn} label="prompt" />
              <Chip on={summarizerOn} label="summarizer" />
              <Chip on={webmcpAvailable} label="webmcp" />
            </div>
          </div>
          <div className={ui.workspacePane}>
            <div className={ui.paneTabs}>
              <button
                type="button"
                className={infoTab === "hints" ? ui.paneTabActive : ui.paneTab}
                onClick={() => setInfoTab("hints")}
              >
                Hints
              </button>
              <button
                type="button"
                className={
                  infoTab === "activity" ? ui.paneTabActive : ui.paneTab
                }
                onClick={() => setInfoTab("activity")}
              >
                Activity
              </button>
            </div>
            {infoTab === "activity" ? (
              <ActivityList events={eventsLog} />
            ) : (
              <ul className={ui.hints}>
                <li>Threads persist only in this browser.</li>
                <li>Skills bundle prompts, tools, examples, and renderers.</li>
                <li>
                  Inference runs on-device through the browser's LanguageModel.
                  Conversation content is not sent to a hosted model.
                </li>
                <li>
                  WebMCP tools operate on agent threads:{" "}
                  <code>list_threads</code>, <code>new_thread</code>,{" "}
                  <code>switch_thread</code>, and <code>send_message</code>.
                </li>
                <li>
                  Built-in models have no live internet access. Use the fetch
                  tool for a URL and verify time-sensitive answers.
                </li>
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function Chip({ on, label }: { on: boolean; label: string }) {
  return (
    <span className={on ? ui.chipOn : ui.chipOff}>
      {label} {on ? "on" : "off"}
    </span>
  );
}

function ActivityList({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) {
    return <div className={ui.empty}>Activity appears here.</div>;
  }
  return (
    <ul className={ui.activity}>
      {events.map((event) => (
        <li key={event.id} className={ui.activityItem}>
          <span className={ui.activityTime}>{fmtTime(event.ts)}</span>
          <span className={ui.activityKind}>
            {event.kind.replace("chat_", "")}
          </span>
          <span className={ui.activityMain}>
            <span className={ui.activityMessage}>{event.message}</span>
            {event.detail && (
              <span className={ui.activityDetail}>{event.detail}</span>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

function findSkillName(skillId: string): string {
  return (
    PRESETS.find((preset) => preset.id === skillId)?.name ?? PRESETS[0].name
  );
}

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function truncate(s: string, n = 60): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}...`;
}
