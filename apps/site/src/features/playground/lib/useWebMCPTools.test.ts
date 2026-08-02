import { registerTool } from "@web-ai-sdk/webmcp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MODES } from "../experimental/playground/presets.js";
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

type PlaygroundToolDefinition = ReturnType<
  typeof createPlaygroundWebMCPTools
>[number];

const pendingCleanups: Array<() => void> = [];

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
  pendingCleanups.push(
    ...createPlaygroundWebMCPTools(context).map(registerTool),
  );
  return registered;
}

function findRegisteredTool(tools: Map<string, RegisteredTool>, name: string) {
  const tool = tools.get(name);
  if (!tool) throw new Error(`Missing tool ${name}`);
  return tool;
}

function findDefinition(
  tools: readonly PlaygroundToolDefinition[],
  name: string,
) {
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`Missing tool ${name}`);
  return tool;
}

afterEach(() => {
  for (const cleanup of pendingCleanups.splice(0)) cleanup();
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
    const result = await findRegisteredTool(
      registerPlaygroundTools(context),
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
    const result = await findRegisteredTool(
      registerPlaygroundTools(context),
      "send_message",
    ).execute({ text: "Hello" });

    expect(result).toMatchObject({ ok: false, error: expect.any(String) });
  });

  it("validates WebMCP input before invoking application code", async () => {
    const context = createContext();
    const sendMessage = findRegisteredTool(
      registerPlaygroundTools(context),
      "send_message",
    );

    await expect(sendMessage.execute({ text: 42 })).rejects.toMatchObject({
      name: "ToolValidationError",
    });
    expect(context.send).not.toHaveBeenCalled();
  });

  it("executes every registered tool on its happy path", async () => {
    const context = createContext();
    const tools = registerPlaygroundTools(context);
    const calls: Array<[string, Record<string, unknown>]> = [
      ["list_modes", {}],
      ["list_conversations", {}],
      ["new_conversation", { modeId: "minimal" }],
      ["switch_conversation", { id: conversation.id }],
      ["delete_conversation", { id: conversation.id }],
      ["set_mode", { modeId: "minimal" }],
      ["send_message", { text: "Hello" }],
    ];

    for (const [name, input] of calls) {
      await expect(
        findRegisteredTool(tools, name).execute(input),
      ).resolves.toBeDefined();
    }

    expect(tools).toHaveLength(7);
    expect(context.ops.create).toHaveBeenCalledWith("minimal");
    expect(context.ops.select).toHaveBeenCalledWith(conversation.id);
    expect(context.ops.remove).toHaveBeenCalledWith(conversation.id);
    expect(context.ops.setMode).toHaveBeenCalledWith(
      conversation.id,
      "minimal",
    );
    expect(context.send).toHaveBeenCalledWith("Hello");
  });

  it("publishes display titles and marks user-derived output as untrusted", () => {
    const tools = createPlaygroundWebMCPTools(createContext());

    expect(tools.every((tool) => Boolean(tool.title))).toBe(true);
    expect(
      findDefinition(tools, "list_conversations").annotations,
    ).toMatchObject({
      untrustedContentHint: true,
    });
    expect(findDefinition(tools, "list_modes").annotations).toBeUndefined();
  });

  it("publishes and validates the supported mode ids", async () => {
    const context = createContext();
    const definitions = createPlaygroundWebMCPTools(context);

    expect(findDefinition(definitions, "set_mode").inputSchema).toMatchObject({
      properties: {
        modeId: { enum: MODES.map((mode) => mode.id) },
      },
    });
    await expect(
      findRegisteredTool(registerPlaygroundTools(context), "set_mode").execute({
        modeId: "example_string",
      }),
    ).rejects.toMatchObject({ name: "ToolValidationError" });
    expect(context.ops.setMode).not.toHaveBeenCalled();
  });

  it("publishes closed object schemas for every tool input", () => {
    const tools = createPlaygroundWebMCPTools(createContext());

    for (const name of [
      "new_conversation",
      "switch_conversation",
      "delete_conversation",
      "set_mode",
      "send_message",
    ]) {
      expect(findDefinition(tools, name).inputSchema).toMatchObject({
        type: "object",
        additionalProperties: false,
      });
    }
  });

  it("publishes and validates the current conversation ids", async () => {
    const secondConversation = { ...conversation, id: "conversation-2" };
    const context = createContext({
      threads: [secondConversation, conversation],
    });
    const definitions = createPlaygroundWebMCPTools(context);
    const registered = registerPlaygroundTools(context);
    const expectedIds = [conversation.id, secondConversation.id].sort();

    for (const name of ["switch_conversation", "delete_conversation"]) {
      expect(findDefinition(definitions, name).inputSchema).toMatchObject({
        properties: { id: { enum: expectedIds } },
      });
      await expect(
        findRegisteredTool(registered, name).execute({
          id: "example_string",
        }),
      ).rejects.toMatchObject({ name: "ToolValidationError" });
    }
    expect(context.ops.select).not.toHaveBeenCalled();
    expect(context.ops.remove).not.toHaveBeenCalled();
  });

  it("validates WebMCP output before returning it to the host", async () => {
    const context = createContext({
      ops: {
        ...createContext().ops,
        create: vi.fn(
          () => ({ id: 42, modeId: "minimal" }) as unknown as AgentThread,
        ),
      },
    });
    const newConversation = findRegisteredTool(
      registerPlaygroundTools(context),
      "new_conversation",
    );

    await expect(newConversation.execute({})).rejects.toMatchObject({
      name: "ToolOutputValidationError",
      toolName: "new_conversation",
    });
  });
});
