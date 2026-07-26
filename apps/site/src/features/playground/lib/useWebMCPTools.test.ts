import type { Tool } from "@web-ai-sdk/webmcp";
import { describe, expect, it, vi } from "vitest";
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

function findTool(tools: Tool[], name: string): Tool {
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`Missing tool ${name}`);
  return tool;
}

describe("createPlaygroundWebMCPTools", () => {
  it.each([
    ["new_conversation", {}],
    ["switch_conversation", { id: conversation.id }],
    ["delete_conversation", { id: conversation.id }],
    ["set_mode", { modeId: "platform" }],
    ["send_message", { text: "Hello" }],
  ])("rejects %s while a response is running", async (name, input) => {
    const context = createContext({ busy: true });
    const result = await findTool(
      createPlaygroundWebMCPTools({ current: context }),
      name,
    ).execute(input);

    expect(result).toMatchObject({ ok: false, error: expect.any(String) });
    expect(context.send).not.toHaveBeenCalled();
    expect(context.ops.create).not.toHaveBeenCalled();
    expect(context.ops.remove).not.toHaveBeenCalled();
    expect(context.ops.select).not.toHaveBeenCalled();
    expect(context.ops.setMode).not.toHaveBeenCalled();
  });

  it("reports whether a message was accepted", async () => {
    const context = createContext({ send: vi.fn(async () => false) });
    const result = await findTool(
      createPlaygroundWebMCPTools({ current: context }),
      "send_message",
    ).execute({ text: "Hello" });

    expect(result).toMatchObject({ ok: false, error: expect.any(String) });
  });
});
