import {
  checkAvailability as checkPromptAvailability,
  isAvailable as isPromptAvailable,
  type LanguageModelAvailability,
} from "@web-ai-sdk/prompt";
import { isAvailable as isSummarizerAvailable } from "@web-ai-sdk/summarizer";
import {
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type SyntheticEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { playground as ui } from "../../shared/ui.js";
import { useAgent } from "./experimental/agent/react/index.js";
import type { AgentStopReason } from "./experimental/agent/types.js";
import { MultiTurnTranscript } from "./experimental/playground/MultiTurnTranscript.js";
import { MODES } from "./experimental/playground/presets.js";
import { ToolSummary } from "./experimental/playground/ToolSummary.js";
import { useExamples } from "./experimental/playground/useExamples.js";
import type { ActivityEvent } from "./lib/types.js";
import { useAgentThreads } from "./lib/useAgentThreads.js";
import { useStickToBottom } from "./lib/useStickToBottom.js";
import { useWebMCPTools } from "./lib/useWebMCPTools.js";

const MAX_ACTIVITY = 50;
const DEFAULT_SIDEBAR_WIDTH = 260;
const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 400;
const SIDEBAR_RESIZE_STEP = 16;
const SIDEBAR_WIDTH_STORAGE_KEY = "web-ai-sdk:playground:sidebar-width";
type PromptReadiness = LanguageModelAvailability | "checking" | "unknown";

export function Playground() {
  const { threads, activeThread, activeMode, ops } = useAgentThreads();
  const [draft, setDraft] = useState("");
  const [currentInput, setCurrentInput] = useState("");
  const [currentTurnId, setCurrentTurnId] = useState<string | null>(null);
  const [eventsLog, setEventsLog] = useState<ActivityEvent[]>([]);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [conversationsOpen, setConversationsOpen] = useState(true);
  const [runtimeOpen, setRuntimeOpen] = useState(
    () => window.matchMedia("(min-width: 1181px)").matches,
  );
  const modeMenuRef = useRef<HTMLDivElement>(null);
  const currentTurnIdRef = useRef<string | null>(null);
  const sidebarResizeRef = useRef<{
    pointerId: number;
    startX: number;
    startWidth: number;
  } | null>(null);
  const promptExposed = useMemo(() => isPromptAvailable(), []);
  const [promptReadiness, setPromptReadiness] = useState<PromptReadiness>(
    promptExposed ? "checking" : "unavailable",
  );
  // Availability probing is asynchronous. Keep the composer optimistic while
  // it runs so the initial render does not flash an unavailable state. A
  // warning is reserved for a definitive unavailable or download-required
  // result.
  const promptOn =
    promptReadiness === "checking" ||
    promptReadiness === "available" ||
    promptReadiness === "unknown";
  const summarizerOn = useMemo(() => isSummarizerAvailable(), []);

  useEffect(() => {
    if (!promptExposed) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const inspect = async () => {
      const availability = await checkPromptAvailability({
        expectedInputs: [{ type: "text", languages: ["en"] }],
        expectedOutputs: [{ type: "text", languages: ["en"] }],
      });
      if (cancelled) return;
      setPromptReadiness(availability ?? "unknown");
      if (availability === "downloadable" || availability === "downloading") {
        timer = setTimeout(inspect, 2_000);
      }
    };
    void inspect();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [promptExposed]);

  useEffect(() => {
    try {
      const storedWidth = Number(
        window.localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY),
      );
      if (Number.isFinite(storedWidth) && storedWidth > 0) {
        setSidebarWidth(clampSidebarWidth(storedWidth));
      }
    } catch {
      // Storage is optional; resizing still works for the current page.
    }
  }, []);

  const updateSidebarWidth = useCallback((width: number) => {
    const nextWidth = clampSidebarWidth(width);
    setSidebarWidth(nextWidth);
    try {
      window.localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(nextWidth));
    } catch {
      // Storage is optional; keep the in-memory width.
    }
  }, []);

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

  const tools = useMemo(() => activeMode.tools, [activeMode]);
  const recentExampleTurns = useMemo(
    () =>
      activeThread.turns.slice(-6).map((turn) => ({
        id: turn.id,
        userInput: turn.userInput,
        assistantText: turn.assistantText,
      })),
    [activeThread.turns],
  );
  const {
    status,
    text,
    liveThought,
    events,
    stopReason,
    error,
    run,
    abort,
    newSession,
  } = useAgent({
    systemPrompt: activeMode.systemPrompt,
    tools,
    initialTurns: activeThread.turns,
    sessionKey: `${activeThread.id}:${activeMode.id}`,
    maxSteps: 6,
    sessionMode: "thread",
    samplingMode: "predictable",
    language: "en",
    onTurnComplete: (turn) => {
      ops.appendTurn(
        activeThread.id,
        turn,
        currentTurnIdRef.current ?? undefined,
      );
      // The Stop button records the user action synchronously. Avoid a second
      // terminal Activity row for the same cancellation.
      if (turn.stopReason === "aborted") return;
      const complete = turn.stopReason === "done";
      pushActivity({
        kind: complete ? "chat_response" : "chat_error",
        message: complete ? "reply" : (turn.stopReason ?? "stopped"),
        detail: turn.failure?.message ?? turn.userInput,
      });
    },
  });

  const busy =
    status === "planning" ||
    status === "tool_calling" ||
    status === "streaming";

  const {
    examples,
    regenerate: regenerateExamples,
    cancel: cancelExampleGeneration,
    generating: generatingExamples,
    canRegenerate: canRegenerateExamples,
  } = useExamples(activeMode, {
    conversationId: activeThread.id,
    turns: recentExampleTurns,
    suspended: busy,
  });

  useEffect(() => {
    if (!modeMenuOpen) return;
    const closeFromPointer = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !modeMenuRef.current?.contains(event.target)
      ) {
        setModeMenuOpen(false);
      }
    };
    const closeFromKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") setModeMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeFromPointer);
    document.addEventListener("keydown", closeFromKeyboard);
    return () => {
      document.removeEventListener("pointerdown", closeFromPointer);
      document.removeEventListener("keydown", closeFromKeyboard);
    };
  }, [modeMenuOpen]);

  const send = useCallback(
    async (textToSend: string) => {
      const trimmed = textToSend.trim();
      if (!trimmed || busy) return;
      cancelExampleGeneration();
      const turnId = crypto.randomUUID();
      currentTurnIdRef.current = turnId;
      setCurrentTurnId(turnId);
      ops.touch(activeThread.id);
      pushActivity({
        kind: "chat_send",
        message: "send",
        detail: trimmed,
      });
      setCurrentInput(trimmed);
      try {
        await run(trimmed);
      } finally {
        if (currentTurnIdRef.current === turnId) {
          currentTurnIdRef.current = null;
          setCurrentTurnId((current) => (current === turnId ? null : current));
        }
        setCurrentInput("");
      }
    },
    [activeThread.id, busy, cancelExampleGeneration, ops, pushActivity, run],
  );

  const { available: webmcpAvailable } = useWebMCPTools({
    threads,
    activeThread,
    ops,
    send,
    newSession,
    pushActivity,
  });

  useEffect(() => {
    if (promptReadiness === "checking") return;
    pushActivity({
      kind: "info",
      message: "ready",
      detail: `prompt:${promptReadinessLabel(promptReadiness).toLowerCase()} · webmcp:${webmcpAvailable ? "on" : "off"} · summarizer:${summarizerOn ? "on" : "off"}`,
    });
  }, [promptReadiness, pushActivity, summarizerOn, webmcpAvailable]);

  const transcriptRef = useRef<HTMLDivElement>(null);
  const { isPinned, scrollToBottom } = useStickToBottom(transcriptRef, [
    activeThread.turns.length,
    text,
    events.length,
    liveThought?.text,
  ]);

  // Sending is an explicit request to follow the latest turn, even when the
  // user had scrolled up to read history. Run after the new bubble commits and
  // before paint so we target the updated scroll height without a visible jump.
  useLayoutEffect(() => {
    if (!currentTurnId || !currentInput) return;
    scrollToBottom("auto");
  }, [currentInput, currentTurnId, scrollToBottom]);

  const submitDraft = () => {
    if (!draft.trim() || busy) return;
    void send(draft);
    setDraft("");
  };

  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitDraft();
  };

  const submitExample = (example: string) => {
    if (!promptOn || busy) return;
    setDraft("");
    void send(example);
  };

  const createThread = (modeId = activeMode.id) => {
    const thread = ops.create(modeId);
    newSession();
    pushActivity({
      kind: "chat_switch",
      message: "new conversation",
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
      message: "conversation",
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
      message: "close conversation",
      detail: thread.name,
    });
  };

  const setMode = (modeId: string) => {
    const mode = MODES.find((candidate) => candidate.id === modeId) ?? MODES[0];
    if (mode.id !== activeMode.id) {
      ops.setMode(activeThread.id, mode.id);
      newSession();
      pushActivity({ kind: "info", message: "mode", detail: mode.name });
    }
    setModeMenuOpen(false);
  };

  const startSidebarResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    sidebarResizeRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: sidebarWidth,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const resizeSidebar = (event: ReactPointerEvent<HTMLDivElement>) => {
    const resize = sidebarResizeRef.current;
    if (!resize || resize.pointerId !== event.pointerId) return;
    updateSidebarWidth(resize.startWidth + event.clientX - resize.startX);
  };

  const finishSidebarResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (sidebarResizeRef.current?.pointerId !== event.pointerId) return;
    sidebarResizeRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const resizeSidebarFromKeyboard = (
    event: ReactKeyboardEvent<HTMLDivElement>,
  ) => {
    const step = event.shiftKey ? SIDEBAR_RESIZE_STEP * 4 : SIDEBAR_RESIZE_STEP;
    let nextWidth: number | undefined;
    if (event.key === "ArrowLeft") nextWidth = sidebarWidth - step;
    if (event.key === "ArrowRight") nextWidth = sidebarWidth + step;
    if (event.key === "Home") nextWidth = MIN_SIDEBAR_WIDTH;
    if (event.key === "End") nextWidth = MAX_SIDEBAR_WIDTH;
    if (nextWidth === undefined) return;
    event.preventDefault();
    updateSidebarWidth(nextWidth);
  };

  const shellMobileRows = conversationsOpen
    ? ui.shellMobileWithSidebar
    : ui.shellMobileWithoutSidebar;

  return (
    <div
      className={ui.shell}
      style={
        {
          "--playground-sidebar-width": `${sidebarWidth}px`,
          "--playground-left-column": conversationsOpen
            ? `${sidebarWidth}px`
            : "0px",
          "--playground-right-column": runtimeOpen ? "340px" : "0px",
        } as CSSProperties
      }
    >
      <div className={`${ui.layoutGrid} ${shellMobileRows}`}>
        <div
          className={`${ui.sidebarSlot} ${
            conversationsOpen ? ui.panelSlotOpen : ui.sidebarSlotClosed
          }`}
          aria-hidden={!conversationsOpen}
          inert={!conversationsOpen}
        >
          <aside
            className={`${ui.sidebar} ${
              conversationsOpen ? ui.panelOpen : ui.sidebarClosed
            }`}
          >
            <header className={ui.sidebarHeader}>
              <h2 className={ui.sectionTitle}>Conversations</h2>
              <PanelToggle
                side="left"
                open
                onClick={() => setConversationsOpen(false)}
              />
            </header>
            <div className={ui.sidebarBody}>
              <section className={ui.sidebarSection}>
                <button
                  type="button"
                  className={ui.wideButton}
                  onClick={() => createThread()}
                  disabled={busy}
                  aria-label="New conversation"
                  title="New conversation"
                >
                  <span className={ui.wideButtonIcon} aria-hidden="true">
                    +
                  </span>
                  <span className={ui.wideButtonLabel}>New conversation</span>
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
                        <span className={ui.threadTitleRow}>
                          {thread.id === activeThread.id &&
                            conversationStatusTone(
                              promptOn,
                              status,
                              stopReason,
                            ) !== "idle" && (
                              <span
                                className={ui.threadStatus}
                                role="img"
                                data-tone={conversationStatusTone(
                                  promptOn,
                                  status,
                                  stopReason,
                                )}
                                title={conversationStatusName(
                                  promptOn,
                                  status,
                                  stopReason,
                                )}
                                aria-label={`Status: ${conversationStatusName(
                                  promptOn,
                                  status,
                                  stopReason,
                                )}`}
                              />
                            )}
                          <span className={ui.presetName}>{thread.name}</span>
                        </span>
                        <span className={ui.presetDesc}>
                          {findModeName(thread.modeId)} · {thread.turns.length}{" "}
                          turn
                          {thread.turns.length === 1 ? "" : "s"}
                        </span>
                      </button>
                      <button
                        type="button"
                        className={ui.threadClose}
                        onClick={() => closeThread(thread.id)}
                        disabled={busy}
                        aria-label={`Close conversation ${thread.name}`}
                      >
                        <svg
                          className={ui.threadCloseIcon}
                          viewBox="0 0 16 16"
                          fill="none"
                          aria-hidden="true"
                        >
                          <path
                            d="M4 4l8 8M12 4l-8 8"
                            stroke="currentColor"
                            strokeWidth="1.35"
                            strokeLinecap="round"
                          />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </aside>
        </div>

        {conversationsOpen && (
          <hr
            className={ui.sidebarResizeHandle}
            aria-label="Resize conversations column"
            aria-orientation="vertical"
            aria-valuemin={MIN_SIDEBAR_WIDTH}
            aria-valuemax={MAX_SIDEBAR_WIDTH}
            aria-valuenow={sidebarWidth}
            aria-valuetext={`${sidebarWidth} pixels`}
            tabIndex={0}
            title="Drag to resize. Double-click to reset."
            onPointerDown={startSidebarResize}
            onPointerMove={resizeSidebar}
            onPointerUp={finishSidebarResize}
            onPointerCancel={finishSidebarResize}
            onLostPointerCapture={() => {
              sidebarResizeRef.current = null;
            }}
            onKeyDown={resizeSidebarFromKeyboard}
            onDoubleClick={() => updateSidebarWidth(DEFAULT_SIDEBAR_WIDTH)}
          />
        )}

        {!conversationsOpen && (
          <span className={ui.panelRestoreLeft}>
            <PanelToggle
              side="left"
              open={false}
              onClick={() => setConversationsOpen(true)}
            />
          </span>
        )}

        {!runtimeOpen && (
          <span className={ui.panelRestoreRight}>
            <PanelToggle
              side="right"
              open={false}
              onClick={() => setRuntimeOpen(true)}
            />
          </span>
        )}

        <main className={ui.main}>
          <header className={ui.mainHeader}>
            <h1 className={ui.title}>{activeThread.name}</h1>
            {!runtimeOpen && (
              <span className={ui.panelRestoreRightMobile}>
                <PanelToggle
                  side="right"
                  open={false}
                  onClick={() => setRuntimeOpen(true)}
                />
              </span>
            )}
          </header>

          <div className={ui.mainBody}>
            <section className={ui.transcriptPanel}>
              <div ref={transcriptRef} className={ui.answer}>
                <MultiTurnTranscript
                  turns={activeThread.turns}
                  currentTurnId={currentTurnId}
                  currentInput={currentInput}
                  events={events}
                  text={text}
                  liveThought={liveThought}
                  stopReason={stopReason}
                  busy={busy}
                  transcriptRendererId={activeMode.transcriptRendererId}
                  toolRendererId={activeMode.toolRendererId}
                />
              </div>
              {!isPinned && (
                <button
                  type="button"
                  className={ui.jump}
                  onClick={() => scrollToBottom()}
                  aria-label="Scroll to latest"
                  title="Scroll to latest"
                >
                  <span aria-hidden="true">↓</span>
                </button>
              )}
            </section>

            <div className={ui.composerDock}>
              <div className={ui.composerNotices}>
                {!promptOn && (
                  <div
                    className={ui.composerNotice}
                    role="status"
                    aria-live="polite"
                  >
                    <NoticeIcon className={ui.composerNoticeIcon} />
                    <span>{promptReadinessMessage(promptReadiness)}</span>
                  </div>
                )}
                {error && (
                  <div className={ui.composerNoticeError} role="alert">
                    <NoticeIcon className={ui.composerNoticeErrorIcon} />
                    <span>
                      The agent could not finish this response. Please try
                      again.
                    </span>
                  </div>
                )}
              </div>

              <form className={ui.composer} onSubmit={submit}>
                <textarea
                  id="playground-message"
                  name="message"
                  className={ui.composerInput}
                  aria-label="Ask anything"
                  placeholder={
                    promptOn
                      ? "Ask anything"
                      : promptReadiness === "downloadable" ||
                          promptReadiness === "downloading"
                        ? "Waiting for the on-device model"
                        : "On-device model unavailable"
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
                  <div className={ui.composerLeading}>
                    <div className={ui.modeSelector} ref={modeMenuRef}>
                      <button
                        type="button"
                        className={ui.modeTrigger}
                        data-accent={activeMode.accent}
                        onClick={() => setModeMenuOpen((open) => !open)}
                        disabled={busy}
                        aria-label={`Mode: ${activeMode.name}`}
                        aria-expanded={modeMenuOpen}
                        aria-controls="playground-mode-menu"
                      >
                        <span
                          className={ui.modeTriggerName}
                          data-accent={activeMode.accent}
                        >
                          {activeMode.name}
                        </span>
                        <svg
                          className={
                            modeMenuOpen
                              ? ui.modeTriggerChevronOpen
                              : ui.modeTriggerChevron
                          }
                          viewBox="0 0 16 16"
                          fill="none"
                          aria-hidden="true"
                        >
                          <path
                            d="m4.5 6 3.5 3.5L11.5 6"
                            stroke="currentColor"
                            strokeWidth="1.4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                      {modeMenuOpen && (
                        <div className={ui.modeMenu}>
                          <div className={ui.modeMenuHeader}>
                            <span className={ui.modeMenuTitle}>
                              How should this agent work?
                            </span>
                            <span className={ui.modeMenuDescription}>
                              Choose a focused configuration for this
                              conversation.
                            </span>
                          </div>
                          <fieldset
                            id="playground-mode-menu"
                            className={ui.modeOptions}
                            aria-label="Agent mode"
                          >
                            {MODES.map((mode) => {
                              const selected = mode.id === activeMode.id;
                              return (
                                <button
                                  key={mode.id}
                                  type="button"
                                  aria-pressed={selected}
                                  data-accent={mode.accent}
                                  className={
                                    selected
                                      ? ui.modeOptionActive
                                      : ui.modeOption
                                  }
                                  onClick={() => setMode(mode.id)}
                                >
                                  <span className={ui.modeOptionCopy}>
                                    <span className={ui.modeOptionTitleRow}>
                                      <span className={ui.modeOptionIdentity}>
                                        <span
                                          className={ui.modeAccentDot}
                                          data-accent={mode.accent}
                                          aria-hidden="true"
                                        />
                                        <span
                                          className={ui.modeOptionName}
                                          data-accent={mode.accent}
                                        >
                                          {mode.name}
                                        </span>
                                      </span>
                                      <span className={ui.modeOptionToolCount}>
                                        {mode.tools.length === 0
                                          ? "no tools"
                                          : `${mode.tools.length} tool${mode.tools.length === 1 ? "" : "s"}`}
                                      </span>
                                    </span>
                                    <span className={ui.modeOptionDescription}>
                                      {mode.description}
                                    </span>
                                  </span>
                                </button>
                              );
                            })}
                          </fieldset>
                          <div className={ui.modeMenuNote}>
                            Mode changes keep this conversation and its history.
                          </div>
                        </div>
                      )}
                    </div>
                    <div className={ui.exampleRail}>
                      <div className={ui.examples}>
                        {examples.map((ex) => (
                          <button
                            key={ex}
                            type="button"
                            className={ui.example}
                            onClick={() => submitExample(ex)}
                            disabled={!promptOn || busy}
                            title={ex}
                          >
                            {truncate(ex, 60)}
                          </button>
                        ))}
                      </div>
                      <span className={ui.exampleRegenerateWrap}>
                        <button
                          type="button"
                          className={ui.exampleRegenerate}
                          onClick={() => void regenerateExamples()}
                          disabled={
                            busy || generatingExamples || !canRegenerateExamples
                          }
                          aria-label="Generate new examples"
                          aria-busy={generatingExamples}
                        >
                          <span aria-hidden="true">+</span>
                        </button>
                        <span
                          role="tooltip"
                          className={ui.exampleRegenerateTooltip}
                        >
                          Generate new examples
                        </span>
                      </span>
                    </div>
                  </div>
                  <div className={ui.composerActions}>
                    <ToolSummary tools={tools} />
                    {busy ? (
                      <button
                        type="button"
                        className={ui.stopButton}
                        onClick={() => {
                          abort();
                          pushActivity({
                            kind: "chat_abort",
                            message: "abort",
                            detail: currentInput || activeThread.name,
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
                        aria-label="Send message"
                      >
                        <span aria-hidden="true">↑</span>
                      </button>
                    )}
                  </div>
                </div>
              </form>
            </div>
          </div>
        </main>

        <div
          className={`${ui.workspaceSlot} ${
            runtimeOpen ? ui.panelSlotOpen : ui.workspaceSlotClosed
          }`}
          aria-hidden={!runtimeOpen}
          inert={!runtimeOpen}
        >
          <section
            className={`${ui.workspace} ${
              runtimeOpen ? ui.panelOpen : ui.workspaceClosed
            }`}
          >
            <header className={ui.workspaceHeader}>
              <span className={ui.workspaceHeading}>
                <h2 className={ui.workspaceTitle}>Runtime</h2>
              </span>
              <PanelToggle
                side="right"
                open
                onClick={() => setRuntimeOpen(false)}
              />
            </header>
            <div className={ui.workspaceBody}>
              <div className={ui.chips}>
                <Chip
                  on={promptOn}
                  label="prompt"
                  guidance="Runs conversation responses on-device with the browser's Prompt API."
                  stateLabel={promptReadinessLabel(promptReadiness)}
                />
                <Chip
                  on={summarizerOn}
                  label="summarizer"
                  guidance="Summarizes provided text on-device with the browser's Summarizer API."
                />
                <Chip
                  on={webmcpAvailable}
                  label="webmcp"
                  guidance="Exposes Playground conversation controls to compatible browser agents."
                />
              </div>
              <div className={ui.workspaceHeading}>
                <h2 className={ui.workspaceTitle}>Activity</h2>
                <div className={ui.workspaceCount}>
                  {eventsLog.length} event{eventsLog.length === 1 ? "" : "s"}
                </div>
              </div>
              <div className={ui.workspacePane}>
                <ActivityList events={eventsLog} />
              </div>
              <div className={ui.workspaceNotes}>
                <div className={ui.workspaceFootnote}>
                  Conversations stored in this browser
                </div>
                <div className={ui.workspaceAdvice}>
                  On-device AI can make mistakes. Verify important answers.
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function PanelToggle({
  side,
  open,
  onClick,
}: {
  side: "left" | "right";
  open: boolean;
  onClick: () => void;
}) {
  const panel = side === "left" ? "conversations" : "runtime";
  const action = open ? "Hide" : "Show";
  return (
    <button
      type="button"
      className={ui.panelToggle}
      onClick={onClick}
      aria-label={`${action} ${panel} panel`}
      title={`${action} ${panel} panel`}
    >
      <svg
        className={ui.panelToggleIcon}
        viewBox="0 0 18 18"
        fill="none"
        aria-hidden="true"
      >
        <rect
          x="2.25"
          y="2.75"
          width="13.5"
          height="12.5"
          rx="2.25"
          stroke="currentColor"
          strokeWidth="1.25"
        />
        <path
          d={side === "left" ? "M6.5 3.25v11.5" : "M11.5 3.25v11.5"}
          stroke="currentColor"
          strokeWidth="1.25"
        />
      </svg>
    </button>
  );
}

function Chip({
  on,
  label,
  guidance,
  stateLabel,
}: {
  on: boolean;
  label: string;
  guidance: string;
  stateLabel?: string;
}) {
  const state = stateLabel ?? (on ? "Available" : "Unavailable");
  return (
    <span
      className={on ? ui.chipOn : ui.chipOff}
      title={`${guidance} ${state} in this browser.`}
    >
      {label} {stateLabel ? stateLabel.toLowerCase() : on ? "on" : "off"}
    </span>
  );
}

function NoticeIcon({ className }: { className: string }) {
  return (
    <span className={className} aria-hidden="true">
      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M10 5.25v5.5" />
        <path d="M10 14.25h.01" />
        <circle cx="10" cy="10" r="7.25" />
      </svg>
    </span>
  );
}

function promptReadinessLabel(readiness: PromptReadiness): string {
  switch (readiness) {
    case "available":
      return "On";
    case "downloadable":
      return "Download";
    case "downloading":
      return "Downloading";
    case "checking":
      return "On";
    case "unknown":
      return "On";
    case "unavailable":
      return "Off";
  }
}

function promptReadinessMessage(readiness: PromptReadiness): string {
  switch (readiness) {
    case "checking":
      return "";
    case "downloadable":
    case "downloading":
      return "Chrome is preparing the on-device model. Keep this page open while it finishes.";
    case "unavailable":
      return "The on-device model is not available in this browser. Check Chrome settings and reload the page.";
    case "available":
    case "unknown":
      return "";
  }
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

function findModeName(modeId: string): string {
  return MODES.find((mode) => mode.id === modeId)?.name ?? MODES[0].name;
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

function clampSidebarWidth(width: number): number {
  return Math.min(
    MAX_SIDEBAR_WIDTH,
    Math.max(MIN_SIDEBAR_WIDTH, Math.round(width)),
  );
}

function conversationStatusName(
  promptOn: boolean,
  status: string,
  stopReason: AgentStopReason | null,
): string {
  const current =
    !promptOn || status === "unavailable"
      ? "unavailable"
      : status === "planning" ||
          status === "tool_calling" ||
          status === "streaming"
        ? status
        : stopReason && stopReason !== "done"
          ? stopReason
          : status === "done"
            ? "idle"
            : status;
  const label = current === "idle" ? "ready" : current.replaceAll("_", " ");
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
}

function conversationStatusTone(
  promptOn: boolean,
  status: string,
  stopReason: AgentStopReason | null,
): "active" | "error" | "idle" | "off" {
  const name = conversationStatusName(
    promptOn,
    status,
    stopReason,
  ).toLowerCase();
  if (name === "planning" || name === "tool calling" || name === "streaming") {
    return "active";
  }
  if (name === "unavailable") return "off";
  if (name !== "ready") return "error";
  return "idle";
}
