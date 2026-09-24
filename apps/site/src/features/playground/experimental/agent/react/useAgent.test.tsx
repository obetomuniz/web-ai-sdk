// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { createToolLeaseScope } from "../toolLeases.js";
import { runTextOperation } from "../tools/lifecycle.js";
import type { AgentEvent } from "../types.js";
import { useAgent } from "./useAgent.js";

const { factory } = vi.hoisted(() => ({ factory: vi.fn() }));
vi.mock("../createAgent.js", () => ({ createAgent: factory }));
vi.mock("@web-ai-sdk/prompt", () => ({ isAvailable: () => true }));
(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => vi.clearAllMocks());

it.each(["mode change", "unmount"])(
  "releases pending preparation on %s and ignores late output",
  async (transition) => {
    const controller = new AbortController();
    const release = vi.fn();
    let ready!: () => void;
    const execute = vi.fn(async () => "late result");
    const prepare = vi.fn(() => ({
      ready: new Promise<void>((resolve) => {
        ready = resolve;
      }),
      release,
    }));
    factory.mockImplementation(() => {
      // Mirrors createAgentLoop: the agent owns its lease scope.
      const leases = createToolLeaseScope();
      return {
        destroy: () => {
          controller.abort();
          leases.releaseAll();
        },
        abort: () => controller.abort(),
        async *runStreaming(): AsyncGenerator<AgentEvent> {
          try {
            await runTextOperation(
              {
                signal: controller.signal,
                callId: "owned",
                step: 0,
                emit() {},
                leases,
              },
              {
                key: "owned",
                availability: async () => "downloadable",
                prepare,
                execute,
              },
            );
          } catch {
            /* The destroyed run may still finish its iterator. */
          }
          yield { type: "done", reason: "done", text: "late result" };
        },
      };
    });
    const complete = vi.fn();
    const root = createRoot(document.createElement("div"));
    let agent!: ReturnType<typeof useAgent>;
    function Harness({ mode }: { mode: string }) {
      agent = useAgent({ sessionKey: mode, onTurnComplete: complete });
      return null;
    }
    act(() => root.render(<Harness mode="first" />));
    let running!: Promise<void>;
    act(() => {
      running = agent.run("Test");
    });
    await vi.waitFor(() => expect(prepare).toHaveBeenCalledTimes(1));
    await act(async () => {
      if (transition === "mode change") root.render(<Harness mode="second" />);
      else root.unmount();
    });
    expect(release).toHaveBeenCalled();
    ready();
    await act(async () => {
      await running;
    });
    expect(execute).not.toHaveBeenCalled();
    expect(complete).not.toHaveBeenCalled();
    if (transition === "mode change") act(() => root.unmount());
  },
);
