/**
 * `useAgent`: React adapter on top of `AgentStream`.
 *
 * The hook is intentionally a thin projection of the event stream into
 * React state. Each event maps to a state update that React will batch
 * by default. Consumers that need a different projection (e.g. only
 * keep the last 200 events, or compute a custom "trace" type) can call
 * `stream.pipe(...)` themselves and ignore the hook's `events` array.
 *
 * The hook exposes `getStream(input)` for that exact use case: it
 * returns the raw `AgentStream` so the caller can iterate / pipe /
 * await `result` and treat the React state as optional.
 */

import { isAvailable as isPromptAvailable } from "@web-ai-sdk/prompt";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createAgent } from "../createAgent.js";
import type {
  Agent,
  AgentEvent,
  AgentStep,
  AgentStopReason,
  AgentStream,
  AgentTool,
  AgentTurn,
  CreateAgentOptions,
} from "../types.js";

export type UseAgentStatus =
  | "idle"
  | "planning"
  | "tool_calling"
  | "streaming"
  | "done"
  | "aborted"
  | "error"
  | "unavailable";

export interface UseAgentOptions extends CreateAgentOptions {
  tools?: readonly AgentTool[];
  /** Recreate the native session when the host selects another conversation. */
  sessionKey?: string;
  /**
   * Cap on how many events to keep in `events`. Older events are
   * dropped. Default 500. The full stream is still consumed; this only
   * bounds the React state slice.
   */
  eventLimit?: number;
  /** Called when a run completes so hosts can persist it as a thread turn. */
  onTurnComplete?: (turn: AgentTurn) => void;
}

/** The thought currently being streamed, with the step it belongs to. */
export type LiveThought = { index: number; text: string } | null;

export interface UseAgentReturn {
  status: UseAgentStatus;
  text: string;
  /** Streaming thought of the in-flight planning turn (null when idle/none). */
  liveThought: LiveThought;
  steps: AgentStep[];
  events: AgentEvent[];
  stopReason: AgentStopReason | null;
  error: Error | null;
  isStreamingTurn: boolean;
  run: (input: string) => Promise<void>;
  /** Lower-level alternative to `run`: returns the underlying stream. */
  getStream: (input: string) => AgentStream;
  abort: () => void;
  /** Clear the conversation session so the next run starts fresh. */
  newSession: () => void;
  reset: () => void;
  clearStreamingTurn: () => void;
}

const EMPTY_EVENTS: AgentEvent[] = [];
const EMPTY_STEPS: AgentStep[] = [];

export function useAgent(options: UseAgentOptions): UseAgentReturn {
  const promptAvailable = useMemo(() => isPromptAvailable(), []);
  const eventLimit = options.eventLimit ?? 500;

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const agentRef = useRef<Agent | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Agent identity must refresh when any construction option changes; the current values are read from optionsRef.
  useEffect(() => {
    agentRef.current = promptAvailable ? createAgent(optionsRef.current) : null;
    return () => {
      agentRef.current?.destroy();
      agentRef.current = null;
    };
  }, [
    options.systemPrompt,
    options.maxSteps,
    options.samplingMode,
    options.language,
    options.sessionMode,
    options.onToolError,
    options.tools,
    options.sessionKey,
    promptAvailable,
  ]);

  const [status, setStatus] = useState<UseAgentStatus>(
    promptAvailable ? "idle" : "unavailable",
  );
  const [text, setText] = useState("");
  // Thought of the in-flight planning turn, streamed token-by-token.
  // Kept separate from `steps`/`events` (like `text`) so the high-freq
  // deltas don't flood the structural feed.
  const [liveThought, setLiveThought] = useState<LiveThought>(null);
  const [steps, setSteps] = useState<AgentStep[]>(EMPTY_STEPS);
  const [events, setEvents] = useState<AgentEvent[]>(EMPTY_EVENTS);
  const [stopReason, setStopReason] = useState<AgentStopReason | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const runningRef = useRef(false);
  // Set the moment the user hits Stop. The run loop checks it on every
  // event and breaks immediately, so the transcript freezes at the current
  // partial output instead of waiting for Chrome's AbortSignal to land
  // (it's honored only at chunk boundaries, and short generations / tool
  // calls often finish first - which made Stop look like a no-op).
  const abortedRef = useRef(false);

  const reset = useCallback(() => {
    setStatus(promptAvailable ? "idle" : "unavailable");
    setText("");
    setLiveThought(null);
    setSteps(EMPTY_STEPS);
    setEvents(EMPTY_EVENTS);
    setStopReason(null);
    setError(null);
  }, [promptAvailable]);

  const clearStreamingTurn = useCallback(() => {
    setText("");
    setLiveThought(null);
    setSteps(EMPTY_STEPS);
    setEvents(EMPTY_EVENTS);
    setStopReason(null);
    setError(null);
  }, []);

  const abort = useCallback(() => {
    if (!runningRef.current) return;
    // True STOP, not a reset: freeze the UI on the partial output right
    // now and tear down the model session, rather than waiting for the
    // Prompt API to honor the signal at the next chunk boundary. We flip
    // to the aborted state synchronously; the run loop sees `abortedRef`
    // and breaks, running the generator's `finally` (which destroys the
    // cloned session and stops generation).
    abortedRef.current = true;
    agentRef.current?.abort();
    runningRef.current = false;
    setLiveThought(null);
    setStopReason("aborted");
    setStatus("aborted");
  }, []);

  // Clear the agent's conversation session AND the UI state, so the next
  // run is a fresh, independent conversation (the on-device model reuses
  // prior answers from session memory otherwise).
  const newSession = useCallback(() => {
    agentRef.current?.newSession();
    setStatus(promptAvailable ? "idle" : "unavailable");
    clearStreamingTurn();
  }, [clearStreamingTurn, promptAvailable]);

  const getStream = useCallback(
    (input: string): AgentStream => {
      if (!promptAvailable || !agentRef.current) {
        // Use the unavailable agent's own stream so consumers always get
        // an iterable + a resolved `result` promise.
        return createAgent(optionsRef.current).runStreaming(input);
      }
      return agentRef.current.runStreaming(input);
    },
    [promptAvailable],
  );

  const run = useCallback(
    async (input: string) => {
      if (!promptAvailable) {
        setStatus("unavailable");
        return;
      }
      if (!agentRef.current) return;
      if (runningRef.current) agentRef.current.abort();

      runningRef.current = true;
      abortedRef.current = false;
      const startedAt = performance.now();
      setStatus("planning");
      clearStreamingTurn();
      setEvents([]);

      const eventBuffer: AgentEvent[] = [];
      const stepsByIndex = new Map<number, AgentStep>();
      let projectedText = "";
      let completedTurn = false;
      // Coalesce token-level text updates to one React render per frame.
      // High token rates (100+ deltas/s) otherwise cause visible stutter.
      let pendingTextDelta = "";
      // The FIRST answer token is painted synchronously instead of waiting
      // for the next animation frame - that one frame (~8-16ms) is the only
      // app-layer latency between the model emitting the first character and
      // the user seeing the answer begin. Subsequent tokens stay coalesced.
      let hasPaintedFirstText = false;
      let textFlushHandle: number | null = null;
      let textFlushUsesRaf = false;
      const flushPendingText = () => {
        if (!pendingTextDelta) return;
        const delta = pendingTextDelta;
        pendingTextDelta = "";
        setText((prev) => prev + delta);
      };
      const cancelTextFlush = () => {
        if (textFlushHandle === null) return;
        if (textFlushUsesRaf && typeof cancelAnimationFrame === "function") {
          cancelAnimationFrame(textFlushHandle);
        } else {
          clearTimeout(textFlushHandle);
        }
        textFlushHandle = null;
      };
      const scheduleTextFlush = () => {
        if (textFlushHandle !== null) return;
        if (typeof requestAnimationFrame === "function") {
          textFlushUsesRaf = true;
          textFlushHandle = requestAnimationFrame(() => {
            textFlushHandle = null;
            flushPendingText();
          });
          return;
        }
        textFlushUsesRaf = false;
        textFlushHandle = setTimeout(() => {
          textFlushHandle = null;
          flushPendingText();
        }, 16) as unknown as number;
      };

      const stream = agentRef.current.runStreaming(input);

      try {
        for await (const ev of stream) {
          // User hit Stop: stop applying any further streamed updates so
          // the transcript freezes exactly where it is. Breaking the loop
          // calls the stream's `return()`, which runs the generator's
          // `finally` and destroys the model session (stopping generation).
          if (abortedRef.current) break;

          // `plan_delta` and `text_delta` arrive at token frequency
          // (often 50-200 per step). Pushing them through React state
          // produces hundreds of renders that the UI never displays:
          // `text_delta` is separately accumulated into the `text` state
          // below, and the transcript builds from the structural events.
          // Skip them at the projection boundary so the event buffer stays
          // usable. Advanced consumers who want the raw firehose can
          // iterate `getStream()` directly.
          const isHighFreq =
            ev.type === "plan_delta" ||
            ev.type === "text_delta" ||
            ev.type === "thought_delta";
          if (!isHighFreq) {
            eventBuffer.push(ev);
            const tail =
              eventBuffer.length > eventLimit
                ? eventBuffer.slice(-eventLimit)
                : eventBuffer;
            setEvents([...tail]);
          }

          switch (ev.type) {
            case "step_start":
              stepsByIndex.set(ev.index, {
                index: ev.index,
                plan: {},
                toolCalls: [],
              });
              setStatus("planning");
              setLiveThought(null);
              break;
            case "step_end":
              break;
            case "step_reset": {
              // Retry or empty summarize fallback - discard partial UI for
              // this step (including tool cards that should not stay visible).
              cancelTextFlush();
              pendingTextDelta = "";
              hasPaintedFirstText = false;
              setLiveThought((prev) =>
                prev && prev.index === ev.index ? null : prev,
              );
              setText("");
              const step = stepsByIndex.get(ev.index);
              if (step) {
                step.toolCalls = [];
                step.plan = { ...step.plan, toolCalls: undefined };
              }
              break;
            }
            case "plan_delta":
              break;
            case "thought_delta":
              setLiveThought((prev) =>
                prev && prev.index === ev.index
                  ? { index: ev.index, text: prev.text + ev.delta }
                  : { index: ev.index, text: ev.delta },
              );
              break;
            case "thought":
              {
                const step = stepsByIndex.get(ev.index);
                if (step) step.plan = { ...step.plan, thought: ev.text };
                // Final thought is now in the structural feed; the live
                // (streaming) copy for this step is no longer needed.
                setLiveThought((prev) =>
                  prev && prev.index === ev.index ? null : prev,
                );
              }
              break;
            case "plan": {
              const step = stepsByIndex.get(ev.index);
              if (step) step.plan = ev.plan;
              if (!ev.plan.final) setStatus("tool_calling");
              break;
            }
            case "tool_call":
              setStatus("tool_calling");
              break;
            case "tool_progress":
              break;
            case "tool_result": {
              const step = stepsByIndex.get(ev.index);
              if (step) {
                const callEvent = eventBuffer.find(
                  (e): e is Extract<AgentEvent, { type: "tool_call" }> =>
                    e.type === "tool_call" && e.callId === ev.callId,
                );
                step.toolCalls = [
                  ...step.toolCalls,
                  {
                    callId: ev.callId,
                    name: ev.name,
                    input: callEvent?.input ?? {},
                    output: ev.output,
                    error: ev.error,
                    durationMs: ev.durationMs,
                  },
                ];
              }
              break;
            }
            case "text_delta":
              setStatus("streaming");
              projectedText += ev.delta;
              if (!hasPaintedFirstText) {
                // Paint the first chunk now so the answer starts the moment
                // the model produces it, with no frame of buffering delay.
                hasPaintedFirstText = true;
                const first = ev.delta;
                setText((prev) => prev + first);
                break;
              }
              pendingTextDelta += ev.delta;
              scheduleTextFlush();
              break;
            case "message":
              // Authoritative final text. We REPLACE (not "keep if
              // streamed") because the agent may post-process the
              // streamed message - e.g. prepend the "unverified" URL
              // disclaimer - and that version only arrives here. On the
              // normal path this equals the streamed text (no flicker).
              cancelTextFlush();
              pendingTextDelta = "";
              projectedText = ev.text;
              setText(ev.text);
              break;
            case "done":
              completedTurn = true;
              setLiveThought(null);
              {
                const completedSteps = Array.from(stepsByIndex.values());
                setSteps(completedSteps);
                if (ev.failure) {
                  const terminalError = new Error(ev.failure.message);
                  terminalError.name = ev.failure.name;
                  setError(terminalError);
                }
                optionsRef.current.onTurnComplete?.({
                  userInput: input,
                  assistantText: ev.text,
                  steps: completedSteps,
                  stopReason: ev.reason,
                  durationMs: performance.now() - startedAt,
                  failure: ev.failure,
                });
              }
              setStopReason(ev.reason);
              setStatus(
                ev.reason === "aborted"
                  ? "aborted"
                  : ev.reason === "done"
                    ? "done"
                    : ev.reason === "unavailable"
                      ? "unavailable"
                      : "error",
              );
              break;
          }
        }
      } catch (err) {
        cancelTextFlush();
        flushPendingText();
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        setStopReason("model_error");
        setStatus("error");
        completedTurn = true;
        optionsRef.current.onTurnComplete?.({
          userInput: input,
          assistantText:
            "The run stopped unexpectedly. Try again; if it repeats, reload the playground.",
          steps: Array.from(stepsByIndex.values()),
          stopReason: "model_error",
          durationMs: performance.now() - startedAt,
          failure: { name: e.name, message: e.message },
        });
      } finally {
        cancelTextFlush();
        flushPendingText();
        if (abortedRef.current && !completedTurn) {
          optionsRef.current.onTurnComplete?.({
            userInput: input,
            assistantText: projectedText,
            steps: Array.from(stepsByIndex.values()),
            stopReason: "aborted",
            durationMs: performance.now() - startedAt,
          });
        }
        runningRef.current = false;
        if (optionsRef.current.sessionMode === "thread") {
          clearStreamingTurn();
        }
      }
    },
    [clearStreamingTurn, promptAvailable, eventLimit],
  );

  return {
    status,
    text,
    liveThought,
    steps,
    events,
    stopReason,
    error,
    isStreamingTurn: runningRef.current,
    run,
    getStream,
    abort,
    newSession,
    reset,
    clearStreamingTurn,
  };
}
