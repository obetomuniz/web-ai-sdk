// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import type { UseAgentOptions } from "../experimental/agent/react/index.js";
import { MODES } from "../experimental/playground/presets.js";
import type { AgentThread } from "./agentThreads.js";
import { useConversationAgent } from "./useConversationAgent.js";

const { run, abort, agentOptions } = vi.hoisted(() => ({
  run: vi.fn(),
  abort: vi.fn(),
  agentOptions: { current: null as null | UseAgentOptions },
}));
vi.mock("../experimental/agent/react/index.js", () => ({
  useAgent: (options: UseAgentOptions) => {
    agentOptions.current = options;
    return { status: "idle", run, abort, isStreamingTurn: false };
  },
}));
(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => vi.clearAllMocks());

it("cancels only the invocation owning the signal and removes late abort listeners", async () => {
  const root = createRoot(document.createElement("div"));
  const thread: AgentThread = {
    id: "test",
    name: "Test",
    modeId: "minimal",
    turns: [],
    createdAt: 1,
    updatedAt: 1,
  };
  let agent!: ReturnType<typeof useConversationAgent>;
  const ops = {
    create: vi.fn(),
    select: vi.fn(),
    remove: vi.fn(),
    rename: vi.fn(),
    touch: vi.fn(),
    appendTurn: vi.fn(),
    setMode: vi.fn(),
  };
  function Harness() {
    agent = useConversationAgent({
      thread,
      mode: MODES[0],
      ops,
      promptOn: true,
      summarizerOn: false,
      pushActivity: vi.fn(),
    });
    return null;
  }
  act(() => root.render(<Harness />));
  let finish!: () => void;
  run.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const first = new AbortController();
  let pending!: Promise<boolean>;
  act(() => {
    pending = agent.send("First", first.signal);
  });
  expect(await agent.send("Concurrent")).toBe(false);
  await act(async () => {
    finish();
    await pending;
  });
  const second = new AbortController();
  act(() => {
    pending = agent.send("Second", second.signal);
  });
  act(() => first.abort());
  expect(abort).not.toHaveBeenCalled();
  act(() => second.abort());
  expect(abort).toHaveBeenCalledTimes(1);
  await act(async () => {
    finish();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
  act(() => root.unmount());
});

it("tracks model download progress in place instead of logging each tick", () => {
  const root = createRoot(document.createElement("div"));
  const pushActivity = vi.fn();
  let agent!: ReturnType<typeof useConversationAgent>;
  function Harness() {
    agent = useConversationAgent({
      thread: {
        id: "download",
        name: "Download",
        modeId: "minimal",
        turns: [],
        createdAt: 1,
        updatedAt: 1,
      },
      mode: MODES[0],
      ops: {
        create: vi.fn(),
        select: vi.fn(),
        remove: vi.fn(),
        rename: vi.fn(),
        touch: vi.fn(),
        appendTurn: vi.fn(),
        setMode: vi.fn(),
      },
      promptOn: true,
      promptReadiness: "downloadable",
      summarizerOn: false,
      pushActivity,
    });
    return null;
  }
  act(() => root.render(<Harness />));
  expect(agent.promptDownload).toBeNull();
  act(() => {
    agentOptions.current?.onModelDownload?.(0.25);
    agentOptions.current?.onModelDownload?.(0.57);
    for (const loaded of [0.25, 0.57]) {
      agentOptions.current?.onEvent?.({
        type: "tool_progress",
        callId: "call-1",
        name: "summarize_text",
        data: { phase: "download", loaded },
      });
    }
  });
  expect(agent.promptDownload).toBe(0.57);
  expect(pushActivity).not.toHaveBeenCalled();
  act(() => root.unmount());
});
