/**
 * Clipboard tools: read/write via the async Clipboard API. The browser
 * gates these behind user permission and (for read) a user gesture, so
 * both calls can reject with `NotAllowedError`. The tools surface that
 * to the agent as an `error` field rather than throwing, so the planner
 * can recover (e.g. ask the user, or fall back to a different tool).
 */

import type { AgentTool } from "../types.js";

interface WriteInput {
  text: string;
}
interface WriteOutput {
  ok: boolean;
  error?: string;
}

export const clipboardWriteTool: AgentTool<WriteInput, WriteOutput> = {
  name: "clipboard_write",
  description:
    "Write a string to the system clipboard. Requires browser clipboard permission. Surfaces `{ ok: false, error }` when the browser denies the write.",
  destructive: true,
  inputSchema: {
    type: "object",
    properties: { text: { type: "string" } },
    required: ["text"],
    additionalProperties: false,
  },
  async execute({ text }) {
    if (
      typeof navigator === "undefined" ||
      !navigator.clipboard ||
      typeof navigator.clipboard.writeText !== "function"
    ) {
      return { ok: false, error: "Clipboard API unavailable." };
    }
    try {
      await navigator.clipboard.writeText(text);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  },
};

interface ReadInput {
  _?: never;
}
interface ReadOutput {
  text?: string;
  error?: string;
}

export const clipboardReadTool: AgentTool<ReadInput, ReadOutput> = {
  name: "clipboard_read",
  description:
    "Read the current text on the system clipboard. Requires the browser's clipboard-read permission AND a recent user gesture; otherwise returns `{ error }`.",
  readOnly: true,
  inputSchema: { type: "object", additionalProperties: false },
  async execute() {
    if (
      typeof navigator === "undefined" ||
      !navigator.clipboard ||
      typeof navigator.clipboard.readText !== "function"
    ) {
      return { error: "Clipboard API unavailable." };
    }
    try {
      return { text: await navigator.clipboard.readText() };
    } catch (err) {
      return { error: (err as Error).message };
    }
  },
};
