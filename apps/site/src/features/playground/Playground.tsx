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
import { useConversationAgent } from "./lib/useConversationAgent.js";
import { usePlaygroundLayout } from "./lib/usePlaygroundLayout.js";
import { usePromptReadiness } from "./lib/usePromptReadiness.js";
import { useWebMCPTools } from "./lib/useWebMCPTools.js";

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
    currentInput,
    currentTurnId,
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
  });

  const send = useCallback(
    async (textToSend: string) => {
      cancelExampleGeneration();
      return sendToAgent(textToSend);
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

  const { available: webmcpAvailable } = useWebMCPTools({
    threads,
    activeThread,
    ops,
    send,
    newSession,
    busy,
    pushActivity,
  });

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
          onCreate={() => createThread()}
          onSelect={selectThread}
          onClose={closeThread}
          onHide={layout.hideConversations}
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
          conversationsOpen={layout.conversationsOpen}
          runtimeOpen={layout.runtimeOpen}
          onShowRuntime={layout.showRuntime}
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
          promptReadiness={promptReadiness}
          summarizerOn={summarizerOn}
          webmcpAvailable={webmcpAvailable}
          events={eventsLog}
          onHide={layout.hideRuntime}
        />
      }
    />
  );
}
