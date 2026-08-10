import { useLayoutEffect, useRef, useState } from "react";
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
  composer,
}: Props) {
  const transcriptRef = useRef<HTMLDivElement>(null);
  const [hasScrolled, setHasScrolled] = useState(
    () =>
      document.querySelector<HTMLElement>("[data-playground-boot]")?.dataset
        .playgroundTranscriptScrolled === "true",
  );
  const { isPinned, scrollToBottom } = useStickToBottom(transcriptRef, [
    thread.turns.length,
    text,
    events.length,
    liveThought?.text,
  ]);

  const hasLiveTurn =
    Boolean(currentInput) ||
    events.length > 0 ||
    Boolean(text) ||
    busy ||
    Boolean(stopReason);
  const isEmpty = thread.turns.length === 0 && !hasLiveTurn;

  // Persisted local conversations should render at their final scroll
  // position. Streaming updates can then follow without animating through the
  // previous conversation's offset.
  useLayoutEffect(() => {
    if (!thread.id) return;
    scrollToBottom("auto");
    setHasScrolled((transcriptRef.current?.scrollTop ?? 0) > 1);
  }, [thread.id, scrollToBottom]);

  // Sending is an explicit request to follow the latest turn, even when the
  // user had scrolled up to read history.
  useLayoutEffect(() => {
    if (!currentTurnId || !currentInput) return;
    scrollToBottom("auto");
    setHasScrolled((transcriptRef.current?.scrollTop ?? 0) > 1);
  }, [currentInput, currentTurnId, scrollToBottom]);

  return (
    <div className={ui.main}>
      <header
        className={`${ui.mainHeader} ${hasScrolled ? ui.mainHeaderScrolled : ""}`}
        data-playground-main-header
      />

      <div className={isEmpty ? ui.mainBodyCentered : ui.mainBody}>
        {isEmpty ? (
          <>
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
            <Composer {...composer} />
          </>
        ) : (
          <>
            <section className={ui.transcriptPanel}>
              <div
                ref={transcriptRef}
                className={ui.answer}
                data-playground-transcript
                onScroll={(event) =>
                  setHasScrolled(event.currentTarget.scrollTop > 1)
                }
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
          </>
        )}
      </div>
    </div>
  );
}
