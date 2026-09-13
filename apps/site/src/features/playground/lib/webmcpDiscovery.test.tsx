// @vitest-environment happy-dom

import type { UseWebMCPReturn } from "@web-ai-sdk/webmcp/react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import {
  type PlaygroundWebMCPContext,
  usePlaygroundWebMCPTools,
} from "./usePlaygroundWebMCPTools.js";

const { discovery } = vi.hoisted(() => ({ discovery: vi.fn() }));
vi.mock("@web-ai-sdk/webmcp/react", () => ({ useWebMCP: discovery }));
(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  vi.unstubAllGlobals();
});
it.each(["loading", "error", "ready"] as const)(
  "reports discovery %s independently from exposure",
  async (status) => {
    vi.stubGlobal("document", document);
    Object.defineProperty(document, "modelContext", {
      value: { registerTool() {} },
      configurable: true,
    });
    const tools = [
      {
        name: "list_modes",
        description: "Modes",
        window,
        origin: location.origin,
        inputSchema: '{"type":"object"}',
      },
    ];
    const error = status === "error" ? new Error("Discovery failed") : null;
    discovery.mockReturnValue({
      status,
      tools,
      error,
      refresh: async () => tools,
    } as UseWebMCPReturn);
    const thread = {
      id: "test",
      name: "test",
      modeId: "minimal",
      turns: [],
      createdAt: 1,
      updatedAt: 1,
    };
    const context: PlaygroundWebMCPContext = {
      threads: [thread],
      activeThread: thread,
      busy: false,
      send: async () => true,
      newSession() {},
      pushActivity() {},
      ops: {
        create: () => thread,
        remove() {},
        select() {},
        rename() {},
        touch() {},
        appendTurn() {},
        setMode() {},
      },
    };
    let result!: ReturnType<typeof usePlaygroundWebMCPTools>;
    function Harness() {
      result = usePlaygroundWebMCPTools(context);
      return null;
    }
    root = createRoot(document.createElement("div"));
    await act(async () => root?.render(<Harness />));
    expect(result.available).toBe(true);
    expect(result.loading).toBe(status === "loading");
    expect(result.error).toBe(error);
    expect(result.discoveredToolCount).toBe(1);
    expect(result.registeredTools[0]?.inputSchema).toBe(tools[0]?.inputSchema);
  },
);
