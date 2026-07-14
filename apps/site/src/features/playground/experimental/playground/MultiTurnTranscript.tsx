import { playground as ui } from "../../../../shared/ui.js";
import type { A2uiSnapshot } from "../agent/a2ui/index.js";
import { createEmptyA2uiSnapshot } from "../agent/a2ui/index.js";
import type { AgentEvent, AgentStopReason, AgentTurn } from "../agent/types.js";
import { Transcript } from "./Transcript.js";
import type { ToolRendererId } from "./toolRenderers.js";
import type { TranscriptRendererId } from "./transcriptRenderers.js";

interface Props {
  turns: AgentTurn[];
  currentInput?: string;
  events: AgentEvent[];
  text: string;
  a2uiSnapshot: A2uiSnapshot;
  liveThought: { index: number; text: string } | null;
  stopReason: AgentStopReason | null;
  busy: boolean;
  transcriptRendererId?: TranscriptRendererId;
  toolRendererId?: ToolRendererId;
  a2uiEnabled?: boolean;
}

export function MultiTurnTranscript({
  turns,
  currentInput,
  events,
  text,
  a2uiSnapshot,
  liveThought,
  stopReason,
  busy,
  transcriptRendererId,
  toolRendererId,
  a2uiEnabled,
}: Props) {
  const hasLiveTurn =
    Boolean(currentInput) || events.length > 0 || text || busy || stopReason;
  if (turns.length === 0 && !hasLiveTurn) {
    return (
      <div className={ui.empty}>
        Start a thread to see the agent's messages, tool calls, and answers
        appear here.
      </div>
    );
  }

  return (
    <div className={ui.threadTranscript}>
      {turns.map((turn, index) => (
        <section key={turnKey(turn, index)} className={ui.threadTurn}>
          <div className={ui.userBubble}>{turn.userInput}</div>
          <Transcript
            events={eventsFromTurn(turn)}
            text={turn.assistantText}
            a2uiSnapshot={turn.a2uiSnapshot ?? createEmptyA2uiSnapshot()}
            liveThought={null}
            stopReason={turn.stopReason}
            busy={false}
            transcriptRendererId={transcriptRendererId}
            toolRendererId={toolRendererId}
            a2uiEnabled={a2uiEnabled}
          />
        </section>
      ))}
      {hasLiveTurn && (
        <section className={ui.threadTurn}>
          {currentInput && <div className={ui.userBubble}>{currentInput}</div>}
          <Transcript
            events={events}
            text={text}
            a2uiSnapshot={a2uiSnapshot}
            liveThought={liveThought}
            stopReason={stopReason}
            busy={busy}
            transcriptRendererId={transcriptRendererId}
            toolRendererId={toolRendererId}
            a2uiEnabled={a2uiEnabled}
          />
        </section>
      )}
    </div>
  );
}

function turnKey(turn: AgentTurn, index: number): string {
  const maybePersisted = turn as AgentTurn & { id?: string };
  return maybePersisted.id ?? `${turn.userInput}-${index}`;
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
    });
  }
  return events;
}
