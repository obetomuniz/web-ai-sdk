import {
  defineTool,
  isAvailable as isWebMCPAvailable,
  type Tool,
} from "@web-ai-sdk/webmcp";
import { useWebMCP } from "@web-ai-sdk/webmcp/react";
import { useEffect, useMemo, useRef } from "react";
import * as v from "valibot";
import { PRESETS } from "../experimental/playground/presets.js";
import { type AgentThread, findSkill } from "./agentThreads.js";
import type { ActivityEvent } from "./types.js";
import type { AgentThreadOps } from "./useAgentThreads.js";

interface Args {
  threads: AgentThread[];
  activeThread: AgentThread;
  ops: AgentThreadOps;
  send: (text: string) => Promise<void> | void;
  clear: () => void;
  newSession: () => void;
  pushActivity: (event: Omit<ActivityEvent, "id" | "ts">) => void;
}

const ThreadIdInput = v.object({ id: v.pipe(v.string(), v.minLength(1)) });
const NewThreadInput = v.object({ skillId: v.optional(v.string()) });
const SetSkillInput = v.object({ skillId: v.pipe(v.string(), v.minLength(1)) });
const NewChatInput = v.object({ modeId: v.optional(v.string()) });
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

    const listSkills = defineTool({
      name: "list_skills",
      description:
        "List the agent skills available in Playground. Each skill bundles a system prompt, tools, examples, and renderers.",
      readOnly: true,
      execute: async () => {
        report("list_skills");
        return {
          skills: PRESETS.map((skill) => ({
            id: skill.id,
            name: skill.name,
            description: skill.description,
            toolCount: skill.tools.length,
          })),
        };
      },
    });

    const listThreads = defineTool({
      name: "list_threads",
      description:
        "List persisted agent threads, with skill ids and turn counts. Use this before switching, deleting, or sending.",
      readOnly: true,
      execute: async () => {
        report("list_threads");
        const { threads, activeThread } = argsRef.current;
        return {
          activeThreadId: activeThread.id,
          threads: threads.map((thread) => ({
            id: thread.id,
            name: thread.name,
            skillId: thread.skillId,
            skillName: findSkill(thread.skillId).name,
            turnCount: thread.turns.length,
            createdAt: thread.createdAt,
          })),
        };
      },
    });

    const newThread = defineTool({
      name: "new_thread",
      description:
        "Create and select a new agent thread. Optionally pass a skillId from list_skills.",
      input: NewThreadInput,
      inputSchema: {
        type: "object",
        properties: { skillId: { type: "string" } },
      },
      execute: async ({ skillId }) => {
        const target = skillId ? findSkill(skillId).id : undefined;
        const thread = argsRef.current.ops.create(target);
        argsRef.current.newSession();
        report("new_thread", `-> ${thread.id}`);
        return { id: thread.id, skillId: thread.skillId };
      },
    });

    const switchThread = defineTool({
      name: "switch_thread",
      description: "Switch the active agent thread by id.",
      input: ThreadIdInput,
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
          report("switch_thread", `unknown id: ${id}`);
          throw new Error(`No thread with id "${id}".`);
        }
        argsRef.current.ops.select(id);
        argsRef.current.newSession();
        report("switch_thread", `-> ${match.name}`);
        return { ok: true, activeThreadId: id };
      },
    });

    const deleteThread = defineTool({
      name: "delete_thread",
      description:
        "Delete an agent thread by id. Destructive: persisted turns cannot be recovered.",
      destructive: true,
      input: ThreadIdInput,
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
          report("delete_thread", `unknown id: ${id}`);
          throw new Error(`No thread with id "${id}".`);
        }
        argsRef.current.ops.remove(id);
        report("delete_thread", `x ${match.name}`);
        return { ok: true };
      },
    });

    const setSkill = defineTool({
      name: "set_skill",
      description:
        "Set the active thread skill. If the thread has turns, create a new thread with the requested skill.",
      input: SetSkillInput,
      inputSchema: {
        type: "object",
        properties: { skillId: { type: "string", minLength: 1 } },
        required: ["skillId"],
      },
      execute: async ({ skillId }) => {
        const skill = PRESETS.find((candidate) => candidate.id === skillId);
        if (!skill) {
          report("set_skill", `unknown skillId: ${skillId}`);
          throw new Error(`No skill with id "${skillId}".`);
        }
        const { activeThread, ops } = argsRef.current;
        if (activeThread.turns.length === 0) {
          ops.setSkill(activeThread.id, skill.id);
        } else {
          ops.create(skill.id);
        }
        argsRef.current.newSession();
        report("set_skill", `-> ${skill.name}`);
        return { ok: true, skillId: skill.id };
      },
    });

    const sendMessage = defineTool({
      name: "send_message",
      description:
        "Send a message to the active agent thread. The reply streams into the thread.",
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

    const clearThread = defineTool({
      name: "clear_thread",
      description:
        "Clear all turns in the active thread. Destructive: history cannot be recovered.",
      destructive: true,
      execute: async () => {
        argsRef.current.clear();
        report("clear_thread");
        return { ok: true };
      },
    });

    const aliases = [
      defineTool({
        name: "list_modes",
        description: "Deprecated alias for list_skills.",
        readOnly: true,
        execute: async () => {
          report("list_modes");
          return {
            modes: PRESETS.map((skill) => ({
              id: skill.id,
              name: skill.name,
              description: skill.description,
              samplingMode: "predictable",
            })),
          };
        },
      }),
      defineTool({
        name: "list_chats",
        description: "Deprecated alias for list_threads.",
        readOnly: true,
        execute: async () => {
          report("list_chats");
          const { threads, activeThread } = argsRef.current;
          return {
            activeChatId: activeThread.id,
            chats: threads.map((thread) => ({
              id: thread.id,
              name: thread.name,
              modeId: thread.skillId,
              modeName: findSkill(thread.skillId).name,
              messageCount: thread.turns.length,
              createdAt: thread.createdAt,
            })),
          };
        },
      }),
      defineTool({
        name: "new_chat",
        description: "Deprecated alias for new_thread.",
        input: NewChatInput,
        inputSchema: {
          type: "object",
          properties: { modeId: { type: "string" } },
        },
        execute: async ({ modeId }) => {
          const target = modeId ? findSkill(modeId).id : undefined;
          const thread = argsRef.current.ops.create(target);
          argsRef.current.newSession();
          report("new_chat", `-> ${thread.id}`);
          return { id: thread.id, modeId: thread.skillId };
        },
      }),
      defineTool({
        name: "switch_chat",
        description: "Deprecated alias for switch_thread.",
        input: ThreadIdInput,
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
            report("switch_chat", `unknown id: ${id}`);
            throw new Error(`No chat with id "${id}".`);
          }
          argsRef.current.ops.select(id);
          argsRef.current.newSession();
          report("switch_chat", `-> ${match.name}`);
          return { ok: true, activeChatId: id };
        },
      }),
      defineTool({
        name: "delete_chat",
        description: "Deprecated alias for delete_thread.",
        destructive: true,
        input: ThreadIdInput,
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
            report("delete_chat", `unknown id: ${id}`);
            throw new Error(`No chat with id "${id}".`);
          }
          argsRef.current.ops.remove(id);
          report("delete_chat", `x ${match.name}`);
          return { ok: true };
        },
      }),
      defineTool({
        name: "set_mode",
        description: "Deprecated alias for set_skill.",
        input: SetModeInput,
        inputSchema: {
          type: "object",
          properties: { modeId: { type: "string", minLength: 1 } },
          required: ["modeId"],
        },
        execute: async ({ modeId }) => {
          const skill = PRESETS.find((candidate) => candidate.id === modeId);
          if (!skill) {
            report("set_mode", `unknown modeId: ${modeId}`);
            throw new Error(`No mode with id "${modeId}".`);
          }
          const { activeThread, ops } = argsRef.current;
          if (activeThread.turns.length === 0) {
            ops.setSkill(activeThread.id, skill.id);
          } else {
            ops.create(skill.id);
          }
          argsRef.current.newSession();
          report("set_mode", `-> ${skill.name}`);
          return { ok: true, modeId: skill.id };
        },
      }),
      defineTool({
        name: "clear_chat",
        description: "Deprecated alias for clear_thread.",
        destructive: true,
        execute: clearThread.execute,
      }),
    ];

    return [
      listSkills,
      listThreads,
      newThread,
      switchThread,
      deleteThread,
      setSkill,
      sendMessage,
      clearThread,
      ...aliases,
    ] as unknown as Tool[];
  }, []);

  useWebMCP(tools);

  useEffect(() => {
    if (available) {
      argsRef.current.pushActivity({
        kind: "info",
        message: "WebMCP tools registered",
        detail: tools.map((tool) => tool.name).join(", "),
      });
    }
  }, [available, tools]);

  return { available };
}
