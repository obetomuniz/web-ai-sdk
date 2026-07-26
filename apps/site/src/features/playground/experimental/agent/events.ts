/**
 * `AgentStream`: the consumer-facing handle to a single agent run.
 *
 * SDK FOLLOW-UP (sdk/.ideas/agent-prototype-followups.md, Phase 3):
 * This file (plus `transforms.ts`) is generic - it's not
 * agent-specific. The plan lifts it into
 * `@web-ai-sdk/stream` so every existing and future SDK package can
 * return `Stream<E, R>` instead of bare `AsyncIterable<string>`. When
 * that lands, this file becomes a one-line re-export.
 *
 * Design goals:
 *
 * 1. **One source of truth.** The agent's planning loop is an
 *    `AsyncGenerator<AgentEvent, AgentRunResult>`. `AgentStream` wraps
 *    it so the same run produces (a) the async iterable of events and
 *    (b) a `Promise<AgentRunResult>` - without forcing the consumer to
 *    accumulate the result themselves.
 *
 * 2. **Composability via `pipe`.** Transforms are plain functions
 *    (`AsyncIterable<E> -> AsyncIterable<E2>`). `pipe()` returns a new
 *    `AgentStream` whose event type is whatever the transform produces,
 *    while still sharing the original `result` promise. That makes
 *    common patterns like `agent.runStreaming(q).pipe(addTiming).pipe(logEvents(console))`
 *    feel natural and stay typed.
 *
 * 3. **Single subscription, predictable consumption.** The underlying
 *    generator is consumed at most once. This keeps the implementation
 *    tiny (no replay buffers, no fanout) and matches how `for await`
 *    works on async iterables. Need fanout? Use `tee` from
 *    `transforms.ts` to split a stream into two iterables.
 *
 * 4. **Independent from the kit's event vocabulary.** `AgentStream<E>`
 *    is generic on the event type so a consumer's transform can map to
 *    any shape (e.g. SSE strings, React state actions) and remain a
 *    well-typed `AgentStream`.
 */

import type { AgentEvent, AgentRunResult, AgentStream } from "./types.js";

class AgentStreamImpl<E> implements AgentStream<E> {
  constructor(
    private readonly source: AsyncIterable<E>,
    public readonly result: Promise<AgentRunResult>,
  ) {}

  [Symbol.asyncIterator](): AsyncIterator<E> {
    return this.source[Symbol.asyncIterator]();
  }

  pipe<E2>(
    transform: (src: AsyncIterable<E>) => AsyncIterable<E2>,
  ): AgentStream<E2> {
    return new AgentStreamImpl<E2>(transform(this.source), this.result);
  }
}

/**
 * Create an `AgentStream` from an `AsyncGenerator<AgentEvent, AgentRunResult>`.
 *
 * The trick: a generator's `return` value (from a `return r;` statement)
 * surfaces as `{ done: true, value: r }` from `iterator.next()`, but it
 * is INVISIBLE through `for await ... of`. We wrap the generator so:
 *
 * - Every yielded event is exposed on the iterable.
 * - The return value is captured and forwarded to the `result` promise.
 * - Exceptions reject the result promise and propagate to the iterable.
 *
 * Consumers can either iterate events, await `result`, or both. The
 * promise resolves whether or not the consumer iterated to completion,
 * as long as the iterator was driven at least once and reached its
 * natural end (we close via `return()` if the consumer breaks early).
 */
export function streamFromGenerator(
  gen: AsyncGenerator<AgentEvent, AgentRunResult, void>,
): AgentStream {
  let resolveResult!: (r: AgentRunResult) => void;
  let rejectResult!: (e: unknown) => void;
  let settled = false;
  const result = new Promise<AgentRunResult>((resolve, reject) => {
    resolveResult = (r) => {
      if (settled) return;
      settled = true;
      resolve(r);
    };
    rejectResult = (e) => {
      if (settled) return;
      settled = true;
      reject(e);
    };
  });

  // Swallow unhandled rejections on the result promise. Consumers who
  // only iterate events shouldn't be punished for never awaiting result;
  // they'll still see errors thrown through the iterator.
  result.catch(() => {});

  const source: AsyncIterable<AgentEvent> = {
    [Symbol.asyncIterator](): AsyncIterator<AgentEvent> {
      return {
        async next(): Promise<IteratorResult<AgentEvent>> {
          try {
            const r = await gen.next();
            if (r.done) {
              resolveResult(r.value);
              return { done: true, value: undefined as never };
            }
            return { done: false, value: r.value };
          } catch (err) {
            rejectResult(err);
            throw err;
          }
        },
        async return(): Promise<IteratorResult<AgentEvent>> {
          try {
            const r = await gen.return(undefined as unknown as AgentRunResult);
            if (r.done && r.value !== undefined) {
              resolveResult(r.value as AgentRunResult);
            } else if (!settled) {
              // Consumer broke out before `done` arrived and the
              // generator didn't return a value - surface that as an
              // aborted-style empty result rather than leaving result
              // pending forever.
              resolveResult({
                text: "",
                steps: [],
                stopReason: "aborted",
              });
            }
          } catch (err) {
            rejectResult(err);
          }
          return { done: true, value: undefined as never };
        },
      };
    },
  };

  return new AgentStreamImpl<AgentEvent>(source, result);
}

/**
 * Build an `AgentStream` from an already-resolved value (no source
 * generator). Used by the "unavailable" fallback agent so callers can
 * still `for await` and `await stream.result` without branching on the
 * environment.
 */
export function streamFromResult(
  result: AgentRunResult,
  finalEvent?: AgentEvent,
): AgentStream {
  const source: AsyncIterable<AgentEvent> = {
    async *[Symbol.asyncIterator]() {
      if (finalEvent) yield finalEvent;
    },
  };
  return new AgentStreamImpl<AgentEvent>(source, Promise.resolve(result));
}
