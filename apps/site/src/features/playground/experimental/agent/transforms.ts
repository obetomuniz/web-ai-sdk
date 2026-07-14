/**
 * Composable transforms for `AgentStream`. Every export is a plain
 * function from `AsyncIterable<In>` to `AsyncIterable<Out>` so they're
 * easy to write, test, mix with hand-rolled generators, and pass to
 * `agentStream.pipe(...)` directly.
 *
 *   agent.runStreaming(q)
 *     .pipe(addTiming(performance.now))
 *     .pipe(tap(logEvents))
 *     .pipe(onlyType("text_delta"))
 *     .pipe(map((ev) => ev.delta));
 *
 * The chain stays typed end-to-end because each `pipe` is generic on
 * the transform's output type.
 */

import type { AgentEvent, AgentEventOf, AgentTransform } from "./types.js";

// ─── Generic shapes ────────────────────────────────────────────────────

export function map<In, Out>(
  fn: (value: In) => Out,
): (source: AsyncIterable<In>) => AsyncIterable<Out> {
  return async function* (source) {
    for await (const value of source) yield fn(value);
  };
}

export function filter<In, Narrowed extends In = In>(
  predicate: (value: In) => value is Narrowed,
): (source: AsyncIterable<In>) => AsyncIterable<Narrowed>;
export function filter<In>(
  predicate: (value: In) => boolean,
): (source: AsyncIterable<In>) => AsyncIterable<In>;
export function filter<In>(predicate: (value: In) => boolean) {
  return async function* (source: AsyncIterable<In>) {
    for await (const value of source) {
      if (predicate(value)) yield value;
    }
  };
}

export function tap<In>(
  side: (value: In) => void,
): (source: AsyncIterable<In>) => AsyncIterable<In> {
  return async function* (source) {
    for await (const value of source) {
      try {
        side(value);
      } catch {
        // tap is best-effort; logging failures must not break the stream
      }
      yield value;
    }
  };
}

// ─── Event-shaped helpers ──────────────────────────────────────────────

/**
 * Narrow to a single event type. The return type is the narrowed
 * variant so downstream transforms see the exact payload shape.
 */
export function onlyType<T extends AgentEvent["type"]>(
  type: T,
): (source: AsyncIterable<AgentEvent>) => AsyncIterable<AgentEventOf<T>> {
  return async function* (source) {
    for await (const ev of source) {
      if (ev.type === type) yield ev as AgentEventOf<T>;
    }
  };
}

/**
 * Append a monotonically-increasing `t` field to every event, in ms
 * from the first event seen. Useful for transcripts that want "+0ms /
 * +124ms / …" labels or for cheap profiling. `now` is injectable to
 * keep this testable.
 */
export function addTiming(
  now: () => number = () => Date.now(),
): AgentTransform<AgentEvent, AgentEvent & { t: number }> {
  return async function* (source) {
    let start: number | null = null;
    for await (const ev of source) {
      if (start === null) start = now();
      yield { ...ev, t: now() - start } as AgentEvent & { t: number };
    }
  };
}

/**
 * Coalesce bursts of `text_delta` events into one event per `windowMs`.
 * Useful for React state updates: rendering 60 partial text frames
 * per second is wasteful when the model emits 200+ tokens per second.
 * Other event types pass through unchanged.
 */
export function debounceText(windowMs: number): AgentTransform {
  return async function* (source) {
    let pending = "";
    let lastFlush = 0;

    function shouldFlush(now: number): boolean {
      return pending.length > 0 && now - lastFlush >= windowMs;
    }

    for await (const ev of source) {
      if (ev.type === "text_delta") {
        pending += ev.delta;
        const now = Date.now();
        if (shouldFlush(now)) {
          yield { type: "text_delta", delta: pending };
          pending = "";
          lastFlush = now;
        }
        continue;
      }

      if (pending) {
        yield { type: "text_delta", delta: pending };
        pending = "";
        lastFlush = Date.now();
      }
      yield ev;
    }

    if (pending) yield { type: "text_delta", delta: pending };
  };
}

/**
 * Cheap logger transform. Pass `console` or any `{ log }` shape; gets
 * every event verbatim and forwards it untouched.
 */
export function logEvents(
  logger: { log: (...args: unknown[]) => void } = console,
  prefix = "[agent]",
): AgentTransform {
  return tap<AgentEvent>((ev) => logger.log(prefix, ev.type, ev));
}

/**
 * Split a single stream into two independent iterables that both see
 * every event, in order. The underlying source is consumed once; each
 * branch buffers events the other branch hasn't read yet.
 *
 * Use sparingly - long-running branches keep events in memory until
 * both sides have read past them.
 */
export function tee<T>(
  source: AsyncIterable<T>,
): [AsyncIterable<T>, AsyncIterable<T>] {
  const queueA: T[] = [];
  const queueB: T[] = [];
  const waitersA: Array<(v: IteratorResult<T>) => void> = [];
  const waitersB: Array<(v: IteratorResult<T>) => void> = [];
  let done = false;
  let started = false;
  let consumeErr: unknown;

  async function pump() {
    try {
      for await (const value of source) {
        const a: IteratorResult<T> = { done: false, value };
        const b: IteratorResult<T> = { done: false, value };
        if (waitersA.length) waitersA.shift()?.(a);
        else queueA.push(value);
        if (waitersB.length) waitersB.shift()?.(b);
        else queueB.push(value);
      }
    } catch (err) {
      consumeErr = err;
    } finally {
      done = true;
      for (const w of waitersA.splice(0))
        w({ done: true, value: undefined as never });
      for (const w of waitersB.splice(0))
        w({ done: true, value: undefined as never });
    }
  }

  function ensurePumping() {
    if (started) return;
    started = true;
    void pump();
  }

  const make = (queue: T[], waiters: typeof waitersA): AsyncIterable<T> => ({
    [Symbol.asyncIterator](): AsyncIterator<T> {
      return {
        next(): Promise<IteratorResult<T>> {
          ensurePumping();
          if (queue.length > 0) {
            return Promise.resolve({
              done: false,
              value: queue.shift() as T,
            });
          }
          if (done) {
            if (consumeErr) return Promise.reject(consumeErr);
            return Promise.resolve({ done: true, value: undefined as never });
          }
          return new Promise<IteratorResult<T>>((resolve) =>
            waiters.push(resolve),
          );
        },
      };
    },
  });

  return [make(queueA, waitersA), make(queueB, waitersB)];
}

// ─── Convenience shortcuts ────────────────────────────────────────────

/**
 * Reduce a stream to just the streamed final answer text. Returns a
 * `Promise<string>`; useful when the caller doesn't care about events.
 */
export async function collectText(
  source: AsyncIterable<AgentEvent>,
): Promise<string> {
  let buf = "";
  for await (const ev of source) {
    if (ev.type === "text_delta") buf += ev.delta;
    else if (ev.type === "message" && !buf) buf = ev.text;
  }
  return buf;
}

/**
 * Get a string-only iterable of the final answer's delta tokens.
 * `for await (const chunk of textStream(stream)) process.stdout.write(chunk);`
 */
export function textStream(
  source: AsyncIterable<AgentEvent>,
): AsyncIterable<string> {
  return (async function* () {
    for await (const ev of source) {
      if (ev.type === "text_delta") yield ev.delta;
    }
  })();
}
