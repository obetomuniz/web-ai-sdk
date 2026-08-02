import {
  isAvailable as isWebMCPAvailable,
  type ToolDefinition,
} from "@web-ai-sdk/webmcp";
import { useWebMCP } from "@web-ai-sdk/webmcp/react";
import { useMemo, useRef } from "react";
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

interface Current<T> {
  current: T;
}

const ConversationIdInput = z.object({
  id: z.string().min(1),
});
const NewConversationInput = z.object({ modeId: z.string().optional() });
const SetModeInput = z.object({ modeId: z.string().min(1) });
const SendMessageInput = z.object({
  text: z.string().min(1),
});

export function createPlaygroundWebMCPTools(
  argsRef: Current<PlaygroundWebMCPContext>,
) {
  const report = (name: string, detail?: string) => {
    argsRef.current.pushActivity({
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

  const listModes: ToolDefinition = {
    name: "list_modes",
    description:
      "List the agent modes available in Playground. Each mode configures the system prompt, tools, examples, and renderers.",
    readOnly: true,
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

  const listConversations: ToolDefinition = {
    name: "list_conversations",
    description:
      "List persisted agent conversations, with mode ids and turn counts. Use this before switching, deleting, or sending.",
    readOnly: true,
    execute: async () => {
      report("list_conversations");
      const { threads, activeThread } = argsRef.current;
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

  const newConversation: ToolDefinition<typeof NewConversationInput> = {
    name: "new_conversation",
    description:
      "Create and select a new agent conversation. Optionally pass a modeId from list_modes.",
    input: NewConversationInput,
    inputSchema: z.toJSONSchema(NewConversationInput, {
      io: "input",
      target: "draft-2020-12",
    }),
    execute: async ({ modeId }) => {
      if (argsRef.current.busy) return rejectBusy("new_conversation");
      const target = modeId ? findMode(modeId).id : undefined;
      const thread = argsRef.current.ops.create(target);
      argsRef.current.newSession();
      report("new_conversation", `-> ${thread.id}`);
      return { id: thread.id, modeId: thread.modeId };
    },
  };

  const switchConversation: ToolDefinition<typeof ConversationIdInput> = {
    name: "switch_conversation",
    description: "Switch the active agent conversation by id.",
    input: ConversationIdInput,
    inputSchema: z.toJSONSchema(ConversationIdInput, {
      io: "input",
      target: "draft-2020-12",
    }),
    execute: async ({ id }) => {
      if (argsRef.current.busy) return rejectBusy("switch_conversation");
      const match = argsRef.current.threads.find((thread) => thread.id === id);
      if (!match) {
        report("switch_conversation", `unknown id: ${id}`);
        throw new Error(`No conversation with id "${id}".`);
      }
      argsRef.current.ops.select(id);
      argsRef.current.newSession();
      report("switch_conversation", `-> ${match.name}`);
      return { ok: true, activeConversationId: id };
    },
  };

  const deleteConversation: ToolDefinition<typeof ConversationIdInput> = {
    name: "delete_conversation",
    description:
      "Delete an agent conversation by id. Destructive: persisted turns cannot be recovered.",
    destructive: true,
    input: ConversationIdInput,
    inputSchema: z.toJSONSchema(ConversationIdInput, {
      io: "input",
      target: "draft-2020-12",
    }),
    execute: async ({ id }) => {
      if (argsRef.current.busy) return rejectBusy("delete_conversation");
      const match = argsRef.current.threads.find((thread) => thread.id === id);
      if (!match) {
        report("delete_conversation", `unknown id: ${id}`);
        throw new Error(`No conversation with id "${id}".`);
      }
      argsRef.current.ops.remove(id);
      if (match.id === argsRef.current.activeThread.id) {
        argsRef.current.newSession();
      }
      report("delete_conversation", `x ${match.name}`);
      return { ok: true };
    },
  };

  const setMode: ToolDefinition<typeof SetModeInput> = {
    name: "set_mode",
    description:
      "Set the active conversation mode while keeping its existing turns.",
    input: SetModeInput,
    inputSchema: z.toJSONSchema(SetModeInput, {
      io: "input",
      target: "draft-2020-12",
    }),
    execute: async ({ modeId }) => {
      if (argsRef.current.busy) return rejectBusy("set_mode");
      const mode = MODES.find((candidate) => candidate.id === modeId);
      if (!mode) {
        report("set_mode", `unknown modeId: ${modeId}`);
        throw new Error(`No mode with id "${modeId}".`);
      }
      const { activeThread, ops } = argsRef.current;
      ops.setMode(activeThread.id, mode.id);
      argsRef.current.newSession();
      report("set_mode", `-> ${mode.name}`);
      return { ok: true, modeId: mode.id };
    },
  };

  const sendMessage: ToolDefinition<typeof SendMessageInput> = {
    name: "send_message",
    description:
      "Send a message to the active agent conversation. The reply streams into the conversation.",
    input: SendMessageInput,
    inputSchema: z.toJSONSchema(SendMessageInput, {
      io: "input",
      target: "draft-2020-12",
    }),
    execute: async ({ text }) => {
      if (argsRef.current.busy) return rejectBusy("send_message");
      report("send_message", text);
      const accepted = await argsRef.current.send(text);
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
  const argsRef = useRef(args);
  argsRef.current = args;

  const available = isWebMCPAvailable();
  const tools = useMemo(() => createPlaygroundWebMCPTools(argsRef), []);

  useWebMCP(tools);

  return { available };
}
