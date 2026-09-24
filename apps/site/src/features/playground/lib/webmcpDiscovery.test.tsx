// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { usePlaygroundWebMCPTools } from "./usePlaygroundWebMCPTools.js";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
it("does not equate API exposure with successful discovery", async () => {
  const failure = new DOMException("Discovery denied", "NotAllowedError");
  Object.defineProperty(document, "modelContext", {
    configurable: true,
    value: {
      registerTool: vi.fn(),
      unregisterTool: vi.fn(),
      getTools: async () => {
        throw failure;
      },
    },
  });
  const root = createRoot(document.createElement("div"));
  let state!: ReturnType<typeof usePlaygroundWebMCPTools>;
  const thread = {
    id: "test",
    name: "Test",
    modeId: "minimal",
    turns: [],
    createdAt: 1,
    updatedAt: 1,
  };
  function Harness() {
    state = usePlaygroundWebMCPTools({
      threads: [thread],
      activeThread: thread,
      busy: false,
      send: async () => true,
      newSession: vi.fn(),
      pushActivity: vi.fn(),
      ops: {
        create: () => thread,
        select: vi.fn(),
        remove: vi.fn(),
        rename: vi.fn(),
        touch: vi.fn(),
        appendTurn: vi.fn(),
        setMode: vi.fn(),
      },
    });
    return null;
  }
  try {
    await act(async () => root.render(<Harness />));
    expect(state.available).toBe(true);
    expect(state.status).toBe("error");
    expect(state.error).toBe(failure);
    expect(state.registeredTools).toEqual([]);
  } finally {
    act(() => root.unmount());
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: undefined,
    });
  }
});
