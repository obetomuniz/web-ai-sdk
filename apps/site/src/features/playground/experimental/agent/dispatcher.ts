/**
 * Dispatcher: runs a batch of tool calls in parallel and yields a
 * fully-ordered event substream:
 *
 *   for each call (in order)            yield tool_call
 *   while calls run in parallel         yield tool_progress (as tools emit)
 *   for each result (resolution order)  yield tool_result
 *
 * The "calls fan out in parallel but events stay ordered" trick is
 * worth explaining: tools' progress events arrive on a single shared
 * queue (`emitChannel`). The generator drains that queue between
 * `await`s on the result promises. That way concurrent tools can emit
 * freely without losing causal order between (call, progress*, result)
 * triples.
 *
 * Centralizing this here keeps `createAgent` free of synchronization
 * code and makes it trivial to swap in alternative dispatchers later
 * (e.g. one that limits concurrency, or one that records call traces
 * for replay).
 */

import { AgentToolValidationError, AgentUnknownToolError } from "./errors.js";
import type { AgentEvent, AgentTool, AgentToolCallRecord } from "./types.js";

export interface DispatcherOptions {
  tools: readonly AgentTool[];
  calls: ReadonlyArray<{ name: string; input: Record<string, unknown> }>;
  stepIndex: number;
  signal: AbortSignal;
  callIdFactory?: () => string;
}

export interface DispatcherResult {
  records: AgentToolCallRecord[];
}

export async function* runDispatcher(
  options: DispatcherOptions,
): AsyncGenerator<AgentEvent, DispatcherResult, void> {
  const {
    tools,
    calls,
    stepIndex,
    signal,
    callIdFactory = defaultCallIdFactory,
  } = options;

  // Tag every call up-front so we can emit `tool_call` events in
  // planning order before any tool starts running.
  const prepared = calls.map((call) => ({
    name: call.name,
    input: call.input,
    callId: callIdFactory(),
  }));

  for (const p of prepared) {
    yield {
      type: "tool_call",
      index: stepIndex,
      callId: p.callId,
      name: p.name,
      input: p.input,
    };
  }

  if (prepared.length === 0) return { records: [] };

  // Shared channel for `tool_progress` events. Each tool gets an `emit`
  // bound to its callId; the dispatcher drains the channel between
  // resolutions so progress arrives in real time.
  const progressQueue: AgentEvent[] = [];
  let progressResolver: (() => void) | null = null;
  const pumpProgress = () => {
    progressResolver?.();
    progressResolver = null;
  };

  const records = new Array<AgentToolCallRecord | null>(prepared.length).fill(
    null,
  );

  const settlements = prepared.map(async (p, i) => {
    const tool = tools.find((t) => t.name === p.name);
    const start = nowMs();

    const emit = (data: unknown) => {
      progressQueue.push({
        type: "tool_progress",
        callId: p.callId,
        name: p.name,
        data,
      });
      pumpProgress();
    };

    if (!tool) {
      const err = new AgentUnknownToolError(p.name);
      records[i] = {
        callId: p.callId,
        name: p.name,
        input: p.input,
        error: { message: err.message, name: err.name },
        durationMs: nowMs() - start,
      };
      pumpProgress();
      return;
    }

    if (tool.validate && !lightValidate(tool.inputSchema, p.input)) {
      const err = new AgentToolValidationError(p.name, [
        "Input did not match tool inputSchema (lightweight check).",
      ]);
      records[i] = {
        callId: p.callId,
        name: p.name,
        input: p.input,
        error: { message: err.message, name: err.name },
        durationMs: nowMs() - start,
      };
      pumpProgress();
      return;
    }

    try {
      const output = await tool.execute(p.input, {
        signal,
        callId: p.callId,
        step: stepIndex,
        emit,
      });
      records[i] = {
        callId: p.callId,
        name: p.name,
        input: p.input,
        output,
        durationMs: nowMs() - start,
      };
    } catch (err) {
      if ((err as Error)?.name === "AbortError") {
        records[i] = {
          callId: p.callId,
          name: p.name,
          input: p.input,
          error: { message: "tool aborted", name: "AbortError" },
          durationMs: nowMs() - start,
        };
      } else {
        const e = err instanceof Error ? err : new Error(String(err));
        records[i] = {
          callId: p.callId,
          name: p.name,
          input: p.input,
          error: { message: e.message, name: e.name },
          durationMs: nowMs() - start,
        };
      }
    } finally {
      pumpProgress();
    }
  });

  // Wrap each settlement so we can race "any finished" against "new
  // progress available" without leaking awaiting promises.
  let pendingCount = settlements.length;
  const completionPromise = Promise.all(settlements).then(() => {
    pendingCount = 0;
    pumpProgress();
  });

  while (pendingCount > 0 || progressQueue.length > 0) {
    while (progressQueue.length > 0) {
      const progress = progressQueue.shift();
      if (progress) yield progress;
    }

    if (pendingCount === 0) break;

    await new Promise<void>((resolve) => {
      progressResolver = resolve;
      // Defensive: ensure resolution if everything finishes between
      // the queue drain and the await registration.
      if (progressQueue.length > 0 || pendingCount === 0) {
        resolve();
        progressResolver = null;
      }
    });
  }

  await completionPromise;
  while (progressQueue.length > 0) {
    const progress = progressQueue.shift();
    if (progress) yield progress;
  }

  // Emit `tool_result` events in completion order is appealing, but
  // most UIs want them paired with the matching `tool_call` (which we
  // emitted in planning order). Emit in planning order too - the
  // event log still shows the time difference because of when these
  // events flow through the consumer.
  const final: AgentToolCallRecord[] = [];
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    if (!r) throw new Error("Tool call did not produce a result.");
    final.push(r);
    yield {
      type: "tool_result",
      index: stepIndex,
      callId: r.callId,
      name: r.name,
      output: r.output,
      error: r.error,
      durationMs: r.durationMs,
    };
  }

  return { records: final };
}

function lightValidate(
  schema: AgentTool["inputSchema"],
  input: Record<string, unknown>,
): boolean {
  if (schema?.type !== "object") return true;
  const required = schema.required ?? [];
  for (const key of required) {
    if (!(key in input)) return false;
  }
  return true;
}

function defaultCallIdFactory(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `call-${crypto.randomUUID()}`;
  }
  return `call-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function nowMs(): number {
  if (typeof performance !== "undefined" && performance.now) {
    return performance.now();
  }
  return Date.now();
}
