import {
  defineTool,
  isAvailable as isWebMCPAvailable,
  type Tool,
} from "@web-ai-sdk/webmcp";
import { useWebMCP } from "@web-ai-sdk/webmcp/react";
import * as v from "valibot";
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
const ModeIdInput = v.picklist(ModeIds);
const NewConversationInput = v.object({ modeId: v.optional(ModeIdInput) });
const SetModeInput = v.object({ modeId: ModeIdInput });
const SendMessageInput = v.object({
  text: v.pipe(v.string(), v.minLength(1)),
});

const OperationErrorOutput = v.object({
  ok: v.literal(false),
  error: v.string(),
});
const OperationOkOutput = v.object({ ok: v.literal(true) });
const ListModesOutput = v.object({
  modes: v.array(
    v.object({
      id: v.string(),
      name: v.string(),
      description: v.string(),
      toolCount: v.number(),
    }),
  ),
});
const ListConversationsOutput = v.object({
  activeConversationId: v.string(),
  conversations: v.array(
    v.object({
      id: v.string(),
      name: v.string(),
      modeId: v.string(),
      modeName: v.string(),
      turnCount: v.number(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
  ),
});
const NewConversationOutput = v.union([
  v.object({ id: v.string(), modeId: v.string() }),
  OperationErrorOutput,
]);
const SwitchConversationOutput = v.union([
  v.object({
    ok: v.literal(true),
    activeConversationId: v.string(),
  }),
  OperationErrorOutput,
]);
const SetModeOutput = v.union([
  v.object({ ok: v.literal(true), modeId: v.string() }),
  OperationErrorOutput,
]);
const OperationOutput = v.union([OperationOkOutput, OperationErrorOutput]);

export function createPlaygroundWebMCPTools(
  args: PlaygroundWebMCPContext,
): Tool[] {
  const ConversationIds = Array.from(
    new Set([args.activeThread.id, ...args.threads.map((thread) => thread.id)]),
  ).sort() as [string, ...string[]];
  const ConversationIdInput = v.object({ id: v.picklist(ConversationIds) });
  const ConversationIdSchema = {
    type: "object",
    properties: {
      id: {
        type: "string",
        description: "Conversation identifier returned by list_conversations.",
        enum: ConversationIds,
      },
    },
    required: ["id"],
    additionalProperties: false,
  };
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

  const listModes = defineTool({
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
  });

  const listConversations = defineTool({
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
  });

  const newConversation = defineTool({
    name: "new_conversation",
    title: "New conversation",
    description:
      "Create and select a new agent conversation. Optionally pass a modeId from list_modes.",
    input: NewConversationInput,
    validate: true,
    output: NewConversationOutput,
    inputSchema: {
      type: "object",
      properties: {
        modeId: {
          type: "string",
          description: "Mode identifier returned by list_modes.",
          enum: ModeIds,
        },
      },
      additionalProperties: false,
    },
    execute: async ({ modeId }) => {
      if (args.busy) return rejectBusy("new_conversation");
      const target = modeId ? findMode(modeId).id : undefined;
      const thread = args.ops.create(target);
      args.newSession();
      report("new_conversation", `-> ${thread.id}`);
      return { id: thread.id, modeId: thread.modeId };
    },
  });

  const switchConversation = defineTool({
    name: "switch_conversation",
    title: "Switch conversation",
    description: "Switch the active agent conversation by id.",
    input: ConversationIdInput,
    validate: true,
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
  });

  const deleteConversation = defineTool({
    name: "delete_conversation",
    title: "Delete conversation",
    description:
      "Delete an agent conversation by id. Destructive: persisted turns cannot be recovered.",
    destructive: true,
    input: ConversationIdInput,
    validate: true,
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
  });

  const setMode = defineTool({
    name: "set_mode",
    title: "Set conversation mode",
    description:
      "Set the active conversation mode while keeping its existing turns.",
    input: SetModeInput,
    validate: true,
    output: SetModeOutput,
    inputSchema: {
      type: "object",
      properties: {
        modeId: {
          type: "string",
          description: "Mode identifier returned by list_modes.",
          enum: ModeIds,
        },
      },
      required: ["modeId"],
      additionalProperties: false,
    },
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
  });

  const sendMessage = defineTool({
    name: "send_message",
    title: "Send playground message",
    description:
      "Send a message to the active agent conversation. The reply streams into the conversation.",
    input: SendMessageInput,
    validate: true,
    output: OperationOutput,
    inputSchema: {
      type: "object",
      properties: { text: { type: "string", minLength: 1 } },
      required: ["text"],
      additionalProperties: false,
    },
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
  });

  // Each definition retains its own inferred input type; erase that variance
  // only at the registration boundary until heterogeneous arrays are native.
  return [
    listModes,
    listConversations,
    newConversation,
    switchConversation,
    deleteConversation,
    setMode,
    sendMessage,
  ] as unknown as Tool[];
}

export function useWebMCPTools(args: PlaygroundWebMCPContext) {
  const available = isWebMCPAvailable();
  const tools = createPlaygroundWebMCPTools(args);

  useWebMCP(tools);

  return { available };
}
