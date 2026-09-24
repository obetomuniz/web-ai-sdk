import { expect, it, vi } from "vitest";
import { createToolLeaseScope } from "../toolLeases.js";
import type { AgentToolContext } from "../types.js";
import { runTextOperation } from "./lifecycle.js";

const context = (
  overrides: Partial<AgentToolContext> = {},
): AgentToolContext => ({
  signal: new AbortController().signal,
  callId: "call",
  step: 0,
  emit: vi.fn(),
  ...overrides,
});

const operation = (key: string, prepare: () => unknown) => ({
  key,
  availability: async () => "available",
  prepare: vi.fn(prepare) as never,
  execute: vi.fn(async () => "result"),
});

it("reuses a prepared session for matching options until the scope is released", async () => {
  const leases = createToolLeaseScope();
  const release = vi.fn();
  const prepare = vi.fn(() => ({ ready: Promise.resolve(), release }));
  const first = operation("tool:a", prepare);
  const second = operation("tool:a", prepare);
  await runTextOperation(context({ leases }), first);
  await runTextOperation(context({ leases }), second);
  expect(prepare).toHaveBeenCalledTimes(1);
  expect(second.execute).toHaveBeenCalledTimes(1);
  expect(release).not.toHaveBeenCalled();
  leases.releaseAll();
  expect(release).toHaveBeenCalledTimes(1);
});

it("releases a pending preparation before readiness without running late work", async () => {
  const leases = createToolLeaseScope();
  const controller = new AbortController();
  let ready!: () => void;
  const release = vi.fn();
  const pending = operation("tool:pending", () => ({
    ready: new Promise<void>((resolve) => {
      ready = resolve;
    }),
    release,
  }));
  const result = runTextOperation(
    context({ leases, signal: controller.signal }),
    pending,
  );
  const rejected = expect(result).rejects.toMatchObject({ name: "AbortError" });
  await vi.waitFor(() => expect(pending.prepare).toHaveBeenCalledTimes(1));
  controller.abort();
  leases.releaseAll();
  await rejected;
  expect(release).toHaveBeenCalledTimes(1);
  ready();
  await Promise.resolve();
  expect(pending.execute).not.toHaveBeenCalled();
});

it("bounds prepared sessions and retries failed preparation", async () => {
  const leases = createToolLeaseScope();
  const releases = [0, 1, 2, 3, 4].map(() => vi.fn());
  for (const [index, release] of releases.entries()) {
    leases.acquire(`key:${index}`, () => ({
      ready: Promise.resolve(),
      release,
    }));
  }
  expect(releases[0]).toHaveBeenCalledTimes(1);
  expect(releases.slice(1).every((release) => !release.mock.calls.length)).toBe(
    true,
  );

  const failed = Promise.reject(new Error("create failed"));
  const failedRelease = vi.fn();
  leases.acquire("key:failed", () => ({
    ready: failed,
    release: failedRelease,
  }));
  await failed.catch(() => {});
  await Promise.resolve();
  expect(failedRelease).toHaveBeenCalledTimes(1);
  const retry = vi.fn(() => ({ ready: Promise.resolve(), release: vi.fn() }));
  leases.acquire("key:failed", retry);
  expect(retry).toHaveBeenCalledTimes(1);
});

it("lets the SDK call create its own session outside an agent", async () => {
  const standalone = operation("tool:standalone", () => {
    throw new Error("Standalone calls must not prepare");
  });
  await runTextOperation(context(), standalone);
  expect(standalone.prepare).not.toHaveBeenCalled();
  expect(standalone.execute).toHaveBeenCalledWith(
    expect.any(Function),
    expect.any(Function),
  );
});

it("reports download progress only for models that needed a download", async () => {
  const run = async (readiness: string) => {
    const emit = vi.fn();
    await runTextOperation(context({ emit, leases: createToolLeaseScope() }), {
      key: `tool:${readiness}`,
      availability: async () => readiness,
      prepare: (monitor) => {
        monitor({
          addEventListener: (
            _type: string,
            listener: (event: { loaded: number }) => void,
          ) => {
            listener({ loaded: 0 });
            listener({ loaded: 1 });
          },
        } as never);
        return { ready: Promise.resolve(), release: vi.fn() };
      },
      execute: async () => "result",
    });
    return emit.mock.calls.filter(([data]) => data.phase === "download").length;
  };
  expect(await run("available")).toBe(0);
  expect(await run("downloadable")).toBe(2);
});
