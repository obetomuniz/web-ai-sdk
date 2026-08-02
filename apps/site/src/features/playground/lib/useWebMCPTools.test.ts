import { registerTool } from "@web-ai-sdk/webmcp";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AgentThread } from "./agentThreads.js";
import {
  createPlaygroundWebMCPTools,
  type PlaygroundWebMCPContext,
} from "./useWebMCPTools.js";

const conversation: AgentThread = {
  id: "conversation-1",
  name: "Conversation",
  modeId: "minimal",
  turns: [],
  createdAt: 1,
  updatedAt: 1,
};

function createContext(
  overrides: Partial<PlaygroundWebMCPContext> = {},
): PlaygroundWebMCPContext {
  return {
    threads: [conversation],
    activeThread: conversation,
    busy: false,
    send: vi.fn(async () => true),
    newSession: vi.fn(),
    pushActivity: vi.fn(),
    ops: {
      create: vi.fn(() => conversation),
      remove: vi.fn(),
      select: vi.fn(),
      rename: vi.fn(),
      touch: vi.fn(),
      appendTurn: vi.fn(),
      setMode: vi.fn(),
    },
    ...overrides,
  };
}

interface RegisteredTool {
  name: string;
  execute: (input: unknown) => unknown;
}

function registerPlaygroundTools(context: PlaygroundWebMCPContext) {
  const registered = new Map<string, RegisteredTool>();
  Object.defineProperty(navigator, "modelContext", {
    value: {
      registerTool: (tool: RegisteredTool) => {
        registered.set(tool.name, tool);
      },
    },
    configurable: true,
  });
  const cleanups = createPlaygroundWebMCPTools({ current: context }).map(
    registerTool,
  );
  return { cleanups, registered };
}

function findTool(tools: Map<string, RegisteredTool>, name: string) {
  const tool = tools.get(name);
  if (!tool) throw new Error(`Missing tool ${name}`);
  return tool;
}

afterEach(() => {
  Object.defineProperty(navigator, "modelContext", {
    value: undefined,
    configurable: true,
  });
});

describe("createPlaygroundWebMCPTools", () => {
  it.each([
    ["new_conversation", {}],
    ["switch_conversation", { id: conversation.id }],
    ["delete_conversation", { id: conversation.id }],
    ["set_mode", { modeId: "platform" }],
    ["send_message", { text: "Hello" }],
  ])("rejects %s while a response is running", async (name, input) => {
    const context = createContext({ busy: true });
    const { cleanups, registered } = registerPlaygroundTools(context);
    const result = await findTool(registered, name).execute(input);

    expect(result).toMatchObject({ ok: false, error: expect.any(String) });
    expect(context.send).not.toHaveBeenCalled();
    expect(context.ops.create).not.toHaveBeenCalled();
    expect(context.ops.remove).not.toHaveBeenCalled();
    expect(context.ops.select).not.toHaveBeenCalled();
    expect(context.ops.setMode).not.toHaveBeenCalled();
    for (const cleanup of cleanups) cleanup();
  });

  it("reports whether a message was accepted", async () => {
    const context = createContext({ send: vi.fn(async () => false) });
    const { cleanups, registered } = registerPlaygroundTools(context);
    const result = await findTool(registered, "send_message").execute({
      text: "Hello",
    });

    expect(result).toMatchObject({ ok: false, error: expect.any(String) });
    for (const cleanup of cleanups) cleanup();
  });

  it("validates WebMCP input before invoking application code", async () => {
    const context = createContext();
    const { cleanups, registered } = registerPlaygroundTools(context);
    const sendMessage = findTool(registered, "send_message");

    await expect(sendMessage.execute({ text: 42 })).rejects.toMatchObject({
      name: "ToolValidationError",
    });
    expect(context.send).not.toHaveBeenCalled();
    for (const cleanup of cleanups) cleanup();
  });
});
