import type { LanguageModelSamplingMode } from "@web-ai-sdk/prompt";
import type { A2uiServerMessage, A2uiSnapshot } from "./a2ui/types.js";

/**
 * Public types for the experimental agent loop prototype.
 *
 * The event vocabulary is the central design surface. It's deliberately
 * verbose (separate `step_start`/`step_end`, `plan_delta` AND `plan`,
 * `text_delta` AND `message`) so consumers can subscribe at exactly the
 * grain they need without writing parsing code:
 *
 * - A "raw firehose" debug pane subscribes to everything.
 * - A "chat bubble" UI subscribes to `text_delta` for streaming and
 *   `message` for non-streaming fallback.
 * - A "transcript" UI subscribes to `step_start` / `thought` /
 *   `tool_call` / `tool_progress` / `tool_result` / `message`.
 * - A logger filters to `done` to record outcomes.
 *
 * Adding a new event type means appending one variant to `AgentEvent`;
 * nothing else has to change because consumers exhaustively switch over
 * `ev.type` and TypeScript reminds them about the new case.
 */

/**
 * `AgentToolInput` and `AgentToolOutput` are deliberately `unknown` so a
 * tool can declare a strict `interface` for its arguments without paying
 * for an `extends Record<string, unknown>` index signature. The
 * trade-off is the same one `@web-ai-sdk/webmcp` ships: heterogeneous
 * `AgentTool<...>[]` arrays need a `as unknown as AgentTool[]` cast at
 * the boundary because `execute(input: TInput, ...)` is contravariant
 * under `strictFunctionTypes`. The runtime is identical.
 */
export type AgentToolInput = unknown;
export type AgentToolOutput = unknown;

/**
 * Context passed to every tool execution. Tools call `emit` to stream
 * their own progress events (e.g. `fetch_url` could emit
 * `{ phase: "request" }` then `{ phase: "decode" }`). The kit forwards
 * each emission as a `tool_progress` event with the parent `callId`,
 * so a transcript UI can show "calling fetch_url… requesting…
 * decoding… done in 220ms" without each tool inventing its own event
 * shape.
 */
import type { AgentRunContext } from "./runContext.js";

export interface AgentToolContext {
  /** Composite abort signal: agent-level abort OR caller-supplied signal. */
  readonly signal: AbortSignal;
  /** Stable id for this call (matches the `tool_call` / `tool_result` events). */
  readonly callId: string;
  /** Step index (0-based) of the planning turn that dispatched this tool. */
  readonly step: number;
  /**
   * Emit a structured progress event. Use small, JSON-serializable
   * objects; the kit doesn't constrain the shape.
   */
  emit(data: unknown): void;
}

export interface AgentTool<TInput = AgentToolInput, TOutput = AgentToolOutput> {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, unknown>;
    required?: readonly string[];
    additionalProperties?: boolean;
  };
  readOnly?: boolean;
  destructive?: boolean;
  validate?: boolean;
  /**
   * Optional dispatch gate: return false to skip this call before
   * `execute` (structured input + per-run context only - no regex on the
   * user message in the loop). See `runContext.ts` and `dispatchPolicy.ts`.
   */
  acceptCall?(input: Record<string, unknown>, ctx: AgentRunContext): boolean;
  /**
   * End the run by returning this tool's output directly (skip the
   * post-tool synthesis model turn). Use for deterministic tools whose
   * output is already user-facing.
   */
  returnDirect?: boolean;
  /**
   * Skip the post-tool model turn when this returns true (single-call
   * batch only). Safer than always-on `returnDirect` for tools that can
   * misroute but succeed when inputs are valid.
   */
  returnDirectIf?(
    input: Record<string, unknown>,
    output: unknown,
    ctx: AgentRunContext,
  ): boolean;
  /**
   * Method-shorthand (not arrow-property) on purpose: TypeScript
   * `strictFunctionTypes` makes function-typed properties contravariant
   * on parameters, which would force every consumer to write
   * `as unknown as AgentTool[]` at array boundaries. Method shorthand
   * stays bivariant for legacy reasons, so a typed
   * `AgentTool<{ x: string }, R>` is assignable to `AgentTool` without
   * a cast. The runtime is identical.
   */
  execute(input: TInput, ctx: AgentToolContext): Promise<TOutput> | TOutput;
}

export type AgentStopReason =
  | "done"
  | "budget_exhausted"
  | "aborted"
  | "tool_error"
  | "unavailable"
  | "context_overflow"
  | "stalled";

export interface AgentToolCallRecord {
  callId: string;
  name: string;
  input: Record<string, unknown>;
  output?: AgentToolOutput;
  error?: { message: string; name?: string };
  durationMs: number;
}

export interface AgentStep {
  index: number;
  plan: AgentPlan;
  toolCalls: AgentToolCallRecord[];
  /** Filled on the terminal step that resolved the run. */
  text?: string;
}

export interface AgentRunResult {
  text: string;
  steps: AgentStep[];
  stopReason: AgentStopReason;
}

/** Serializable result of one agent run - host apps persist these in a thread. */
export interface AgentTurn {
  userInput: string;
  assistantText: string;
  steps: AgentStep[];
  stopReason: AgentStopReason | null;
  a2uiSnapshot?: A2uiSnapshot;
}

export function toAgentTurn(
  userInput: string,
  result: AgentRunResult,
  extras: { a2uiSnapshot?: A2uiSnapshot } = {},
): AgentTurn {
  return {
    userInput,
    assistantText: result.text,
    steps: result.steps,
    stopReason: result.stopReason,
    ...extras,
  };
}

/**
 * Structured view of one planning turn, derived from the model's native
 * `tool_code` output (parsed by `toolCode.ts`). Surfaced as `plan` events
 * so the transcript can render per-step intent. Mutually exclusive
 * branches:
 *
 * - `toolCalls` (non-empty): run them in parallel, feed results back.
 * - `final: true` + `message`: terminate the loop with `message` as
 *   the user-facing answer.
 */
export interface AgentPlan {
  thought?: string;
  toolCalls?: Array<{
    name: string;
    input: Record<string, unknown>;
  }>;
  final?: boolean;
  message?: string;
}

// ─── Event vocabulary ──────────────────────────────────────────────────

export type AgentEvent =
  // Step boundaries - useful for UIs that group output per step
  | { type: "step_start"; index: number }
  | { type: "step_end"; index: number }
  // Emitted when a stalled planning turn is retried: consumers should
  // discard any partial streamed thought/answer for this step, since the
  // attempt is starting over.
  | { type: "step_reset"; index: number }

  // Planning - raw chunks for "live JSON" UIs, parsed plan for
  // structured ones, thought streamed token-by-token (`thought_delta`)
  // then consolidated once (`thought`) for the "thinking…" trace
  | { type: "plan_delta"; index: number; raw: string }
  | { type: "thought_delta"; index: number; delta: string }
  | { type: "thought"; index: number; text: string }
  | { type: "plan"; index: number; plan: AgentPlan }

  // Tools - every dispatch is a triple: call → progress* → result.
  // `tool_progress.data` is whatever the tool's execute() decided to
  // emit; the kit only adds `callId` and `tool` to the envelope.
  | {
      type: "tool_call";
      index: number;
      callId: string;
      name: string;
      input: Record<string, unknown>;
    }
  | {
      type: "tool_progress";
      callId: string;
      name: string;
      data: unknown;
    }
  | {
      type: "tool_result";
      index: number;
      callId: string;
      name: string;
      output?: AgentToolOutput;
      error?: { message: string; name?: string };
      durationMs: number;
    }

  // Final user-facing answer - `text_delta` for streamed UIs,
  // `message` is fired ONCE after the streaming completes so
  // non-streaming consumers (logs, batch APIs) don't have to
  // accumulate deltas themselves.
  | { type: "text_delta"; delta: string }
  | { type: "message"; text: string }

  // A2UI v0.8 - one parsed JSONL server message per line
  | {
      type: "a2ui_message";
      index: number;
      message: A2uiServerMessage;
    }

  // Terminal event - always last, always exactly one per run
  | { type: "done"; reason: AgentStopReason; text: string };

// Helpers for narrowing by `type`. Consumers use these to make
// pipe/filter expressions read naturally.
export type AgentEventOf<T extends AgentEvent["type"]> = Extract<
  AgentEvent,
  { type: T }
>;

// ─── Streaming surface ─────────────────────────────────────────────────

/**
 * A transform takes an iterable of agent events and returns another
 * iterable. The contract is: every transform must yield `done` exactly
 * once and must not introduce events out of step order. Beyond that,
 * transforms are free to filter, map, debounce, log, tee, or rewrite
 * events.
 */
export type AgentTransform<In extends AgentEvent = AgentEvent, Out = In> = (
  source: AsyncIterable<In>,
) => AsyncIterable<Out>;

/**
 * The object returned from `agent.runStreaming(input)`. Iterating it
 * once consumes the underlying generator; the `result` promise resolves
 * to the same `AgentRunResult` that `agent.run(input)` would return.
 *
 * Use `pipe()` to compose transforms; the result promise is shared
 * across the pipe chain so callers can attach their final transform AND
 * still await the typed result.
 */
export interface AgentStream<E = AgentEvent> extends AsyncIterable<E> {
  /** Resolves with the run's terminal result when the stream completes. */
  readonly result: Promise<AgentRunResult>;
  pipe<E2>(
    transform: (src: AsyncIterable<E>) => AsyncIterable<E2>,
  ): AgentStream<E2>;
}

// ─── Options + agent surface ───────────────────────────────────────────

export type AgentOnToolErrorPolicy = "report" | "throw" | "stop";

export interface CreateAgentOptions {
  systemPrompt?: string;
  tools?: readonly AgentTool[];
  /** Required upper bound on planning loop iterations. Defaults to 5. */
  maxSteps?: number;
  samplingMode?: LanguageModelSamplingMode;
  language?: string;
  /**
   * `run-isolated` (default): clone (or create) a fresh session per run,
   * destroy when the run ends. Good for one-shot tasks.
   * `thread`: reuse one conversation session across runs until
   * `newSession()` / `destroy()`. Native history carries prior turns.
   */
  sessionMode?: "run-isolated" | "thread";
  onToolError?: AgentOnToolErrorPolicy;
  /**
   * When the user's input references a URL and a URL-fetching tool is
   * available, deterministically fetch it if the model tries to finalize
   * without ever calling the tool (i.e. it's fabricating). The
   * orchestrator runs the fetch itself and forces one more turn - it does
   * NOT re-prompt the model. Bounded to once per run. Default `true`.
   */
  autoFetchUrls?: boolean;
  /**
   * Enable A2UI v0.8 JSONL generative UI in the system prompt and stream
   * parser. UI messages are emitted as `a2ui_message` events (transport is
   * your `AgentEvent` pipe; AG-UI is optional and not required).
   */
  a2ui?: {
    enabled?: boolean;
    catalogId?: string;
  };
}

export interface Agent {
  readonly tools: readonly AgentTool[];
  run(
    input: string,
    options?: { signal?: AbortSignal },
  ): Promise<AgentRunResult>;
  runStreaming(input: string, options?: { signal?: AbortSignal }): AgentStream;
  abort(): void;
  /**
   * Drop the underlying conversation session so the NEXT run starts with
   * a clean history. Use when runs should be independent rather than a
   * continuing conversation (the on-device model reuses prior answers
   * from session memory otherwise). The agent stays usable; the session
   * is lazily recreated on the next run.
   */
  newSession(): void;
  destroy(): void;
}
