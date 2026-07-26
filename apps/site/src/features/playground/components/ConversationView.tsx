import { useLayoutEffect, useRef } from "react";
import { playground as ui } from "../../../shared/ui.js";
import type {
  AgentEvent,
  AgentStopReason,
} from "../experimental/agent/types.js";
import type { AgentMode } from "../experimental/playground/presets.js";
import type { AgentThread } from "../lib/agentThreads.js";
import { useStickToBottom } from "../lib/useStickToBottom.js";
import { Composer, type ComposerProps } from "./Composer.js";
import { ConversationTrack } from "./ConversationTrack.js";
import { PanelToggle } from "./PanelToggle.js";

interface Props {
  thread: AgentThread;
  mode: AgentMode;
  currentTurnId: string | null;
  currentInput: string;
  events: AgentEvent[];
  text: string;
  liveThought: { index: number; text: string } | null;
  stopReason: AgentStopReason | null;
  busy: boolean;
  conversationsOpen: boolean;
  runtimeOpen: boolean;
  onShowRuntime: () => void;
  composer: ComposerProps;
}

export function ConversationView({
  thread,
  mode,
  currentTurnId,
  currentInput,
  events,
  text,
  liveThought,
  stopReason,
  busy,
  conversationsOpen,
  runtimeOpen,
  onShowRuntime,
  composer,
}: Props) {
  const transcriptRef = useRef<HTMLDivElement>(null);
  const { isPinned, scrollToBottom } = useStickToBottom(transcriptRef, [
    thread.turns.length,
    text,
    events.length,
    liveThought?.text,
  ]);

  // Persisted local conversations should render at their final scroll
  // position. Streaming updates can then follow without animating through the
  // previous conversation's offset.
  useLayoutEffect(() => {
    if (!thread.id) return;
    scrollToBottom("auto");
  }, [thread.id, scrollToBottom]);

  // Sending is an explicit request to follow the latest turn, even when the
  // user had scrolled up to read history.
  useLayoutEffect(() => {
    if (!currentTurnId || !currentInput) return;
    scrollToBottom("auto");
  }, [currentInput, currentTurnId, scrollToBottom]);

  return (
    <div className={ui.main}>
      <header
        className={`${ui.mainHeader} ${
          conversationsOpen ? "" : ui.mainHeaderWithLeftRestore
        }`}
      >
        <h2 className={ui.title}>{thread.name}</h2>
        {!runtimeOpen && (
          <span className={ui.panelRestoreRightMobile}>
            <PanelToggle side="right" open={false} onClick={onShowRuntime} />
          </span>
        )}
      </header>

      <div className={ui.mainBody}>
        <section className={ui.transcriptPanel}>
          <div
            ref={transcriptRef}
            className={ui.answer}
            data-playground-transcript
          >
            <ConversationTrack
              turns={thread.turns}
              currentTurnId={currentTurnId}
              currentInput={currentInput}
              events={events}
              text={text}
              liveThought={liveThought}
              stopReason={stopReason}
              busy={busy}
              transcriptRendererId={mode.transcriptRendererId}
              toolRendererId={mode.toolRendererId}
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

        <Composer {...composer} />
      </div>
    </div>
  );
}
