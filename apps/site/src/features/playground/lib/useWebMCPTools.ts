import {
  defineTool,
  isAvailable as isWebMCPAvailable,
  type Tool,
} from "@web-ai-sdk/webmcp";
import { useWebMCP } from "@web-ai-sdk/webmcp/react";
import { useMemo, useRef } from "react";
import * as v from "valibot";
import { MODES } from "../experimental/playground/presets.js";
import { type AgentThread, findMode } from "./agentThreads.js";
import type { ActivityEvent } from "./types.js";
import type { AgentThreadOps } from "./useAgentThreads.js";

interface Args {
  threads: AgentThread[];
  activeThread: AgentThread;
  ops: AgentThreadOps;
  send: (text: string) => Promise<void> | void;
  newSession: () => void;
  pushActivity: (event: Omit<ActivityEvent, "id" | "ts">) => void;
}

const ConversationIdInput = v.object({
  id: v.pipe(v.string(), v.minLength(1)),
});
const NewConversationInput = v.object({ modeId: v.optional(v.string()) });
const SetModeInput = v.object({ modeId: v.pipe(v.string(), v.minLength(1)) });
const SendMessageInput = v.object({
  text: v.pipe(v.string(), v.minLength(1)),
});

export function useWebMCPTools(args: Args) {
  const argsRef = useRef(args);
  argsRef.current = args;

  const available = isWebMCPAvailable();

  const tools = useMemo<Tool[]>(() => {
    const report = (name: string, detail?: string) => {
      argsRef.current.pushActivity({
        kind: "tool_invoked",
        message: name,
        detail,
      });
    };

    const listModes = defineTool({
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
    });

    const listConversations = defineTool({
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
    });

    const newConversation = defineTool({
      name: "new_conversation",
      description:
        "Create and select a new agent conversation. Optionally pass a modeId from list_modes.",
      input: NewConversationInput,
      inputSchema: {
        type: "object",
        properties: { modeId: { type: "string" } },
      },
      execute: async ({ modeId }) => {
        const target = modeId ? findMode(modeId).id : undefined;
        const thread = argsRef.current.ops.create(target);
        argsRef.current.newSession();
        report("new_conversation", `-> ${thread.id}`);
        return { id: thread.id, modeId: thread.modeId };
      },
    });

    const switchConversation = defineTool({
      name: "switch_conversation",
      description: "Switch the active agent conversation by id.",
      input: ConversationIdInput,
      inputSchema: {
        type: "object",
        properties: { id: { type: "string", minLength: 1 } },
        required: ["id"],
      },
      execute: async ({ id }) => {
        const match = argsRef.current.threads.find(
          (thread) => thread.id === id,
        );
        if (!match) {
          report("switch_conversation", `unknown id: ${id}`);
          throw new Error(`No conversation with id "${id}".`);
        }
        argsRef.current.ops.select(id);
        argsRef.current.newSession();
        report("switch_conversation", `-> ${match.name}`);
        return { ok: true, activeConversationId: id };
      },
    });

    const deleteConversation = defineTool({
      name: "delete_conversation",
      description:
        "Delete an agent conversation by id. Destructive: persisted turns cannot be recovered.",
      destructive: true,
      input: ConversationIdInput,
      inputSchema: {
        type: "object",
        properties: { id: { type: "string", minLength: 1 } },
        required: ["id"],
      },
      execute: async ({ id }) => {
        const match = argsRef.current.threads.find(
          (thread) => thread.id === id,
        );
        if (!match) {
          report("delete_conversation", `unknown id: ${id}`);
          throw new Error(`No conversation with id "${id}".`);
        }
        argsRef.current.ops.remove(id);
        report("delete_conversation", `x ${match.name}`);
        return { ok: true };
      },
    });

    const setMode = defineTool({
      name: "set_mode",
      description:
        "Set the active conversation mode while keeping its existing turns.",
      input: SetModeInput,
      inputSchema: {
        type: "object",
        properties: { modeId: { type: "string", minLength: 1 } },
        required: ["modeId"],
      },
      execute: async ({ modeId }) => {
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
    });

    const sendMessage = defineTool({
      name: "send_message",
      description:
        "Send a message to the active agent conversation. The reply streams into the conversation.",
      input: SendMessageInput,
      inputSchema: {
        type: "object",
        properties: { text: { type: "string", minLength: 1 } },
        required: ["text"],
      },
      execute: async ({ text }) => {
        report("send_message", text);
        await argsRef.current.send(text);
        return { ok: true };
      },
    });

    return [
      listModes,
      listConversations,
      newConversation,
      switchConversation,
      deleteConversation,
      setMode,
      sendMessage,
    ] as unknown as Tool[];
  }, []);

  useWebMCP(tools);

  return { available };
}
