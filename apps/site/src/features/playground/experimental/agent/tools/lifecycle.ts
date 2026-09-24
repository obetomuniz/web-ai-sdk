import type { CreateMonitor } from "@web-ai-sdk/writer";
import { executeUntilAbort } from "../dispatcher.js";
import type { AgentToolContext, AgentToolLease } from "../types.js";

type Monitor = (monitor: CreateMonitor) => void;

export interface TextOperation<T> {
  /** Tool name plus session options; matching keys reuse one prepared session. */
  key: string;
  /** Effective session options, reported with readiness. */
  options?: Record<string, unknown>;
  availability: () => Promise<string | null>;
  prepare: (monitor: Monitor) => AgentToolLease;
  execute: (onUpdate: (text: string) => void, monitor: Monitor) => Promise<T>;
}

/** Runs one tool invocation, after its options and user intent are known. */
export async function runTextOperation<T>(
  ctx: AgentToolContext,
  operation: TextOperation<T>,
): Promise<T> {
  const { signal, emit, leases } = ctx;
  signal.throwIfAborted();
  const readiness = await executeUntilAbort(signal, () =>
    operation.availability(),
  );
  emit({
    phase: "readiness",
    state: readiness ?? "unknown",
    ...(operation.options ? { options: operation.options } : {}),
  });
  // Chrome reports progress on every create; only a real download is news.
  const downloading =
    readiness === "downloadable" || readiness === "downloading";
  const monitor: Monitor = (monitor) =>
    monitor.addEventListener("downloadprogress", ({ loaded }) => {
      if (downloading && !signal.aborted) emit({ phase: "download", loaded });
    });
  // The agent owns prepared sessions and releases them on destroy. Without
  // an agent, the SDK call creates (and caches) its own session.
  if (leases) {
    const lease = leases.acquire(operation.key, () =>
      operation.prepare(monitor),
    );
    await executeUntilAbort(signal, () => lease.ready);
    if (readiness !== "available")
      emit({ phase: "readiness", state: "available" });
  }
  return executeUntilAbort(signal, () =>
    operation.execute((text) => {
      if (!signal.aborted) emit({ phase: "output", text });
    }, monitor),
  );
}

/**
 * Starts a model download from a user gesture. The session is released once
 * ready; the downloaded model stays installed, so the next call can create
 * its session without a gesture.
 */
export async function downloadModel(
  prepare: TextOperation<unknown>["prepare"],
  onProgress: (loaded: number) => void,
): Promise<void> {
  const lease = prepare((monitor) =>
    monitor.addEventListener("downloadprogress", ({ loaded }) =>
      onProgress(loaded),
    ),
  );
  try {
    await lease.ready;
  } finally {
    lease.release();
  }
}
