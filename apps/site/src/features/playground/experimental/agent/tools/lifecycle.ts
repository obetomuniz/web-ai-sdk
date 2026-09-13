import type { CreateMonitor } from "@web-ai-sdk/writer";
import type { AgentToolContext } from "../types.js";

export function abortError(): Error {
  return new DOMException("Operation cancelled.", "AbortError");
}

/** Stop waiting even when a host ignores cancellation. Observe late rejection. */
export function withSignal<T>(
  work: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(abortError());
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
    work.then(
      (value) => {
        signal.removeEventListener("abort", abort);
        signal.aborted ? abort() : resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", abort);
        reject(signal.aborted ? abortError() : error);
      },
    );
  });
}

export function downloadMonitor(
  ctx: Pick<AgentToolContext, "signal" | "emit">,
) {
  return (monitor: CreateMonitor) => {
    monitor.addEventListener("downloadprogress", ({ loaded }) => {
      if (!ctx.signal.aborted && Number.isFinite(loaded)) {
        ctx.emit({
          phase: "download",
          loaded: Math.max(0, Math.min(1, loaded)),
        });
      }
    });
  };
}

/** A dispatched task is user intent. Own only this task's preparation lease. */
export async function runPrepared<T>(
  ctx: AgentToolContext,
  availability: () => Promise<string | null>,
  prepare: (monitor: (m: CreateMonitor) => void) => {
    ready: Promise<void>;
    release(): void;
  },
  execute: () => Promise<T>,
): Promise<T> {
  if (ctx.signal.aborted) throw abortError();
  const state = await withSignal(availability(), ctx.signal);
  ctx.emit({ phase: "readiness", state: state ?? "unknown" });
  // Let the SDK produce its typed unavailable error without creating a model.
  if (state === "unavailable") return withSignal(execute(), ctx.signal);
  const lease = prepare(downloadMonitor(ctx));
  let released = false;
  const release = () => {
    if (!released) {
      released = true;
      lease.release();
    }
  };
  ctx.signal.addEventListener("abort", release, { once: true });
  try {
    await withSignal(lease.ready, ctx.signal);
    ctx.emit({ phase: "readiness", state: "available" });
    return await withSignal(execute(), ctx.signal);
  } finally {
    ctx.signal.removeEventListener("abort", release);
    release();
  }
}

/** Successful demonstrations must contain usable text, not only result metadata. */
export function requireTextResult(output: unknown, capability: string): string {
  if (typeof output !== "string" || !output.trim())
    throw new Error(`${capability} returned no usable text.`);
  return output;
}
