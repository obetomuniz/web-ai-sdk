import { A2UI_SERVER_MESSAGE_KEYS } from "./types.js";

const MARKER = new RegExp(`"(${A2UI_SERVER_MESSAGE_KEYS.join("|")})"\\s*:`);

/**
 * Heuristic: does accumulated model text look like an A2UI JSONL stream?
 */
export function looksLikeA2uiStream(text: string): boolean {
  const trimmed = text.trimStart();
  if (!trimmed.startsWith("{")) return false;
  const head = trimmed.slice(0, 4096);
  return MARKER.test(head);
}

/** Strip optional markdown fence wrapping an A2UI JSONL block. */
export function unwrapA2uiFence(text: string): string {
  const m = text.match(/^```(?:a2ui|jsonl|json)?\s*\n?([\s\S]*?)```\s*$/im);
  return m?.[1]?.trim() ?? text;
}
