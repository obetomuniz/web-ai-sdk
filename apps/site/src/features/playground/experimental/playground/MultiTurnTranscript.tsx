import { playground as ui } from "../../../../shared/ui.js";
import type { AgentThreadTurn } from "../../lib/agentThreads.js";
import type {
  AgentEvent,
  AgentFailure,
  AgentStopReason,
  AgentTurn,
} from "../agent/types.js";
import { Transcript } from "./Transcript.js";
import type { ToolRendererId } from "./toolRenderers.js";
import type { TranscriptRendererId } from "./transcriptRenderers.js";

interface Props {
  turns: AgentThreadTurn[];
  currentTurnId?: string | null;
  currentInput?: string;
  events: AgentEvent[];
  text: string;
  liveThought: { index: number; text: string } | null;
  stopReason: AgentStopReason | null;
  failure?: AgentFailure;
  busy: boolean;
  transcriptRendererId?: TranscriptRendererId;
  toolRendererId?: ToolRendererId;
}

export function MultiTurnTranscript({
  turns,
  currentTurnId,
  currentInput,
  events,
  text,
  liveThought,
  stopReason,
  failure,
  busy,
  transcriptRendererId,
  toolRendererId,
}: Props) {
  const hasLiveTurn =
    Boolean(currentInput) || events.length > 0 || text || busy || stopReason;
  if (turns.length === 0 && !hasLiveTurn) {
    return (
      <div className={ui.emptyConversation}>
        <div className={ui.emptyConversationTitle}>Start a conversation</div>
        <p className={ui.emptyConversationText}>
          Messages, tool calls, and answers will appear here.
        </p>
      </div>
    );
  }

  const visibleTurns: TranscriptTurn[] = turns.map((turn) => ({
    id: turn.id,
    userInput: turn.userInput,
    events: eventsFromTurn(turn),
    text: turn.assistantText,
    liveThought: null,
    stopReason: turn.stopReason,
    durationMs: turn.durationMs,
    failure: turn.failure,
    busy: false,
  }));

  if (hasLiveTurn) {
    visibleTurns.push({
      id: currentTurnId ?? "live-turn",
      userInput: currentInput,
      events,
      text,
      liveThought,
      stopReason,
      failure,
      busy,
    });
  }

  return (
    <div className={ui.threadTranscript}>
      {visibleTurns.map((turn) => (
        <section key={turn.id} className={ui.threadTurn}>
          {turn.userInput && (
            <div className={ui.userBubble}>{turn.userInput}</div>
          )}
          <Transcript
            events={turn.events}
            text={turn.text}
            liveThought={turn.liveThought}
            stopReason={turn.stopReason}
            durationMs={turn.durationMs}
            failure={turn.failure}
            busy={turn.busy}
            transcriptRendererId={transcriptRendererId}
            toolRendererId={toolRendererId}
          />
        </section>
      ))}
    </div>
  );
}

interface TranscriptTurn {
  id: string;
  userInput?: string;
  events: AgentEvent[];
  text: string;
  liveThought: { index: number; text: string } | null;
  stopReason: AgentStopReason | null;
  durationMs?: number;
  failure?: AgentFailure;
  busy: boolean;
}

function eventsFromTurn(turn: AgentTurn): AgentEvent[] {
  const events: AgentEvent[] = [];
  for (const step of turn.steps) {
    events.push({ type: "step_start", index: step.index });
    if (step.plan.thought) {
      events.push({
        type: "thought",
        index: step.index,
        text: step.plan.thought,
      });
    }
    for (const call of step.toolCalls) {
      events.push({
        type: "tool_call",
        index: step.index,
        callId: call.callId,
        name: call.name,
        input: call.input,
      });
      events.push({
        type: "tool_result",
        index: step.index,
        callId: call.callId,
        name: call.name,
        output: call.output,
        error: call.error,
        durationMs: call.durationMs,
      });
    }
    if (step.plan.final) {
      events.push({ type: "plan", index: step.index, plan: step.plan });
    }
    events.push({ type: "step_end", index: step.index });
  }
  events.push({ type: "message", text: turn.assistantText });
  if (turn.stopReason) {
    events.push({
      type: "done",
      reason: turn.stopReason,
      text: turn.assistantText,
      failure: turn.failure,
    });
  }
  return events;
}
