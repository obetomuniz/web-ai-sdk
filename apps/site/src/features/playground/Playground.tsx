import { isAvailable as isSummarizerAvailable } from "@web-ai-sdk/summarizer";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ConversationsPanel } from "./components/ConversationsPanel.js";
import { ConversationView } from "./components/ConversationView.js";
import { PlaygroundLayout } from "./components/PlaygroundLayout.js";
import { RuntimePanel } from "./components/RuntimePanel.js";
import { MODES } from "./experimental/playground/presets.js";
import { useExamples } from "./experimental/playground/useExamples.js";
import { useActivityLog } from "./lib/useActivityLog.js";
import { useAgentThreads } from "./lib/useAgentThreads.js";
import { useCapabilityReadiness } from "./lib/useCapabilityReadiness.js";
import { useConversationAgent } from "./lib/useConversationAgent.js";
import { usePlaygroundLayout } from "./lib/usePlaygroundLayout.js";
import { usePlaygroundWebMCPTools } from "./lib/usePlaygroundWebMCPTools.js";
import { usePromptReadiness } from "./lib/usePromptReadiness.js";

export function Playground() {
  const layout = usePlaygroundLayout();
  const { threads, activeThread, activeMode, ops } = useAgentThreads();
  const [draft, setDraft] = useState("");
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const modeMenuRef = useRef<HTMLDivElement>(null);
  const { promptReadiness, promptOn } = usePromptReadiness();
  const summarizerOn = useMemo(() => isSummarizerAvailable(), []);
  const { events: eventsLog, push: pushActivity } = useActivityLog();

  const tools = activeMode.tools;
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
    abort,
    newSession,
    busy,
    isBusy,
    currentInput,
    currentTurnId,
    capabilityEvents,
    titleLifecycle,
    send: sendToAgent,
  } = useConversationAgent({
    thread: activeThread,
    mode: activeMode,
    ops,
    promptOn,
    summarizerOn,
    pushActivity,
  });

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
    onLifecycle: (message, detail) =>
      pushActivity({ kind: "info", message, detail }),
  });

  const send = useCallback(
    async (textToSend: string, options?: { signal?: AbortSignal }) => {
      cancelExampleGeneration();
      return sendToAgent(textToSend, options);
    },
    [cancelExampleGeneration, sendToAgent],
  );

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

  const {
    available: webmcpAvailable,
    loading: webmcpLoading,
    error: webmcpError,
    discoveredToolCount,
  } = usePlaygroundWebMCPTools({
    threads,
    activeThread,
    ops,
    send,
    newSession,
    busy,
    isBusy,
    pushActivity,
  });

  const capabilityChecks = useCapabilityReadiness(
    activeMode,
    capabilityEvents,
    titleLifecycle,
  );
  const checks = [
    {
      label: "Prompt",
      detail: "Conversation responses and requested example generation",
      state: promptReadiness,
    },
    ...capabilityChecks,
    {
      label: "WebMCP discovery",
      detail:
        webmcpError?.message ??
        `${discoveredToolCount} tools discovered in this page; external consumer support varies`,
      state: !webmcpAvailable
        ? "unavailable"
        : webmcpLoading
          ? "checking"
          : webmcpError
            ? "error"
            : "available",
    },
  ];

  const submitDraft = () => {
    if (!draft.trim() || busy) return;
    void send(draft);
    setDraft("");
  };

  const submitExample = (example: string) => {
    if (!promptOn || busy) return;
    setDraft("");
    void send(example);
  };

  const createThread = (modeId = activeMode.id) => {
    if (isBusy()) return;
    const thread = ops.create(modeId);
    newSession();
    pushActivity({
      kind: "chat_switch",
      message: "new conversation",
      detail: thread.name,
    });
  };

  const selectThread = (id: string) => {
    if (isBusy() || id === activeThread.id) return;
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
    if (isBusy()) return;
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
    if (isBusy()) return;
    const mode = MODES.find((candidate) => candidate.id === modeId) ?? MODES[0];
    if (mode.id !== activeMode.id) {
      ops.setMode(activeThread.id, mode.id);
      newSession();
      pushActivity({ kind: "info", message: "mode", detail: mode.name });
    }
    setModeMenuOpen(false);
  };

  return (
    <PlaygroundLayout
      layout={layout}
      conversations={
        <ConversationsPanel
          open={layout.conversationsOpen}
          threads={threads}
          activeId={activeThread.id}
          busy={busy}
          promptOn={promptOn}
          status={status}
          stopReason={stopReason}
          runtimeOpen={layout.runtimeOpen}
          onCreate={() => createThread()}
          onSelect={selectThread}
          onClose={closeThread}
          onHide={layout.hideConversations}
          onShowRuntime={layout.showRuntime}
        />
      }
      conversation={
        <ConversationView
          thread={activeThread}
          mode={activeMode}
          currentTurnId={currentTurnId}
          currentInput={currentInput}
          events={events}
          text={text}
          liveThought={liveThought}
          stopReason={stopReason}
          busy={busy}
          composer={{
            draft,
            promptOn,
            promptReadiness,
            error,
            busy,
            activeMode,
            modeMenuOpen,
            modeMenuRef,
            examples,
            generatingExamples,
            canRegenerateExamples,
            tools,
            onDraftChange: setDraft,
            onSubmit: submitDraft,
            onSubmitExample: submitExample,
            onToggleModeMenu: () => setModeMenuOpen((open) => !open),
            onSelectMode: setMode,
            onRegenerateExamples: () => void regenerateExamples(),
            onAbort: () => {
              abort();
              pushActivity({
                kind: "chat_abort",
                message: "abort",
                detail: currentInput || activeThread.name,
              });
            },
          }}
        />
      }
      runtime={
        <RuntimePanel
          open={layout.runtimeOpen}
          conversationsOpen={layout.conversationsOpen}
          checks={checks}
          events={eventsLog}
          onHide={layout.hideRuntime}
        />
      }
    />
  );
}
