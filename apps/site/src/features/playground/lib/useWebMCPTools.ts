import {
  isAvailable as isWebMCPAvailable,
  type ToolDefinition,
} from "@web-ai-sdk/webmcp";
import { useWebMCP } from "@web-ai-sdk/webmcp/react";
import { z } from "zod";
import { MODES } from "../experimental/playground/presets.js";
import { type AgentThread, findMode } from "./agentThreads.js";
import type { ActivityEvent } from "./types.js";
import type { AgentThreadOps } from "./useAgentThreads.js";

export interface PlaygroundWebMCPContext {
  threads: AgentThread[];
  activeThread: AgentThread;
  ops: AgentThreadOps;
  send: (text: string) => Promise<boolean>;
  newSession: () => void;
  busy: boolean;
  pushActivity: (event: Omit<ActivityEvent, "id" | "ts">) => void;
}

const ModeIds = MODES.map((mode) => mode.id) as [string, ...string[]];
const ModeIdInput = z
  .enum(ModeIds)
  .describe("Mode identifier returned by list_modes.");
const NewConversationInput = z.strictObject({
  modeId: ModeIdInput.optional(),
});
const SetModeInput = z.strictObject({ modeId: ModeIdInput });
const SendMessageInput = z.strictObject({ text: z.string().min(1) });

const OperationErrorOutput = z.object({
  ok: z.literal(false),
  error: z.string(),
});
const OperationOkOutput = z.object({ ok: z.literal(true) });
const ListModesOutput = z.object({
  modes: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      toolCount: z.number(),
    }),
  ),
});
const ListConversationsOutput = z.object({
  activeConversationId: z.string(),
  conversations: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      modeId: z.string(),
      modeName: z.string(),
      turnCount: z.number(),
      createdAt: z.number(),
      updatedAt: z.number(),
    }),
  ),
});
const NewConversationOutput = z.union([
  z.object({ id: z.string(), modeId: z.string() }),
  OperationErrorOutput,
]);
const SwitchConversationOutput = z.union([
  z.object({
    ok: z.literal(true),
    activeConversationId: z.string(),
  }),
  OperationErrorOutput,
]);
const SetModeOutput = z.union([
  z.object({ ok: z.literal(true), modeId: z.string() }),
  OperationErrorOutput,
]);
const OperationOutput = z.union([OperationOkOutput, OperationErrorOutput]);

export function createPlaygroundWebMCPTools(args: PlaygroundWebMCPContext) {
  const ConversationIds = Array.from(
    new Set([args.activeThread.id, ...args.threads.map((thread) => thread.id)]),
  ).sort() as [string, ...string[]];
  const ConversationIdInput = z.strictObject({
    id: z
      .enum(ConversationIds)
      .describe("Conversation identifier returned by list_conversations."),
  });
  const ConversationIdSchema = z.toJSONSchema(ConversationIdInput, {
    io: "input",
    target: "draft-2020-12",
  });

  const report = (name: string, detail?: string) => {
    args.pushActivity({
      kind: "tool_invoked",
      message: name,
      detail,
    });
  };
  const rejectBusy = (name: string) => {
    report(name, "rejected while a response is running");
    return {
      ok: false as const,
      error: "Playground is busy. Wait for the current response to finish.",
    };
  };

  const listModes: ToolDefinition<undefined, unknown, typeof ListModesOutput> =
    {
      name: "list_modes",
      title: "List playground modes",
      description:
        "List the agent modes available in Playground. Each mode configures the system prompt, tools, examples, and renderers.",
      readOnly: true,
      output: ListModesOutput,
      execute: async () => {
        report("list_modes");
        return {
          modes: MODES.map((mode) => ({
            id: mode.id,
            name: mode.name,
            description: mode.description,
            toolCount: mode.tools.length,
          })),
        };
      },
    };

  const listConversations: ToolDefinition<
    undefined,
    unknown,
    typeof ListConversationsOutput
  > = {
    name: "list_conversations",
    title: "List conversations",
    description:
      "List persisted agent conversations, with mode ids and turn counts. Use this before switching, deleting, or sending.",
    readOnly: true,
    annotations: { untrustedContentHint: true },
    output: ListConversationsOutput,
    execute: async () => {
      report("list_conversations");
      const { threads, activeThread } = args;
      return {
        activeConversationId: activeThread.id,
        conversations: threads.map((thread) => ({
          id: thread.id,
          name: thread.name,
          modeId: thread.modeId,
          modeName: findMode(thread.modeId).name,
          turnCount: thread.turns.length,
          createdAt: thread.createdAt,
          updatedAt: thread.updatedAt,
        })),
      };
    },
  };

  const newConversation: ToolDefinition<
    typeof NewConversationInput,
    unknown,
    typeof NewConversationOutput
  > = {
    name: "new_conversation",
    title: "New conversation",
    description:
      "Create and select a new agent conversation. Optionally pass a modeId from list_modes.",
    input: NewConversationInput,
    output: NewConversationOutput,
    inputSchema: z.toJSONSchema(NewConversationInput, {
      io: "input",
      target: "draft-2020-12",
    }),
    execute: async ({ modeId }) => {
      if (args.busy) return rejectBusy("new_conversation");
      const target = modeId ? findMode(modeId).id : undefined;
      const thread = args.ops.create(target);
      args.newSession();
      report("new_conversation", `-> ${thread.id}`);
      return { id: thread.id, modeId: thread.modeId };
    },
  };

  const switchConversation: ToolDefinition<
    typeof ConversationIdInput,
    unknown,
    typeof SwitchConversationOutput
  > = {
    name: "switch_conversation",
    title: "Switch conversation",
    description: "Switch the active agent conversation by id.",
    input: ConversationIdInput,
    output: SwitchConversationOutput,
    inputSchema: ConversationIdSchema,
    execute: async ({ id }) => {
      if (args.busy) return rejectBusy("switch_conversation");
      const match = args.threads.find((thread) => thread.id === id);
      if (!match) {
        report("switch_conversation", `unknown id: ${id}`);
        throw new Error(`No conversation with id "${id}".`);
      }
      args.ops.select(id);
      args.newSession();
      report("switch_conversation", `-> ${match.name}`);
      return { ok: true as const, activeConversationId: id };
    },
  };

  const deleteConversation: ToolDefinition<
    typeof ConversationIdInput,
    unknown,
    typeof OperationOutput
  > = {
    name: "delete_conversation",
    title: "Delete conversation",
    description:
      "Delete an agent conversation by id. Destructive: persisted turns cannot be recovered.",
    destructive: true,
    input: ConversationIdInput,
    output: OperationOutput,
    inputSchema: ConversationIdSchema,
    execute: async ({ id }) => {
      if (args.busy) return rejectBusy("delete_conversation");
      const match = args.threads.find((thread) => thread.id === id);
      if (!match) {
        report("delete_conversation", `unknown id: ${id}`);
        throw new Error(`No conversation with id "${id}".`);
      }
      args.ops.remove(id);
      if (match.id === args.activeThread.id) {
        args.newSession();
      }
      report("delete_conversation", `x ${match.name}`);
      return { ok: true as const };
    },
  };

  const setMode: ToolDefinition<
    typeof SetModeInput,
    unknown,
    typeof SetModeOutput
  > = {
    name: "set_mode",
    title: "Set conversation mode",
    description:
      "Set the active conversation mode while keeping its existing turns.",
    input: SetModeInput,
    output: SetModeOutput,
    inputSchema: z.toJSONSchema(SetModeInput, {
      io: "input",
      target: "draft-2020-12",
    }),
    execute: async ({ modeId }) => {
      if (args.busy) return rejectBusy("set_mode");
      const mode = MODES.find((candidate) => candidate.id === modeId);
      if (!mode) {
        report("set_mode", `unknown modeId: ${modeId}`);
        throw new Error(`No mode with id "${modeId}".`);
      }
      const { activeThread, ops } = args;
      ops.setMode(activeThread.id, mode.id);
      args.newSession();
      report("set_mode", `-> ${mode.name}`);
      return { ok: true as const, modeId: mode.id };
    },
  };

  const sendMessage: ToolDefinition<
    typeof SendMessageInput,
    unknown,
    typeof OperationOutput
  > = {
    name: "send_message",
    title: "Send playground message",
    description:
      "Send a message to the active agent conversation. The reply streams into the conversation.",
    input: SendMessageInput,
    output: OperationOutput,
    inputSchema: z.toJSONSchema(SendMessageInput, {
      io: "input",
      target: "draft-2020-12",
    }),
    execute: async ({ text }) => {
      if (args.busy) return rejectBusy("send_message");
      report("send_message", text);
      const accepted = await args.send(text);
      return accepted
        ? { ok: true as const }
        : {
            ok: false as const,
            error: "Message was empty or the on-device model is unavailable.",
          };
    },
  };

  return [
    listModes,
    listConversations,
    newConversation,
    switchConversation,
    deleteConversation,
    setMode,
    sendMessage,
  ] as const;
}

export function useWebMCPTools(args: PlaygroundWebMCPContext) {
  const available = isWebMCPAvailable();
  const tools = createPlaygroundWebMCPTools(args);

  useWebMCP(tools);

  return { available };
}
