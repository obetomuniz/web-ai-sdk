import { looksLikeA2uiStream, unwrapA2uiFence } from "./detect.js";
import { A2uiJsonlBuffer } from "./jsonl.js";
import { parseA2uiLine } from "./parse.js";
import type { A2uiServerMessage } from "./types.js";

/**
 * Pull JSONL lines out of model text (plain stream, fences, or glued objects).
 */
export function extractA2uiJsonlLines(text: string): string[] {
  let src = text.trim();
  const fence = src.match(/```(?:jsonl|json|a2ui)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) src = fence[1].trim();
  else src = unwrapA2uiFence(src);

  const lines: string[] = [];
  for (const line of src.split(/\n/)) {
    const t = line.trim();
    if (t.startsWith("{")) lines.push(t);
  }

  if (lines.length === 0 && src.startsWith("{")) {
    const parts = src.split(/(?<=\})\s*(?=\{)/);
    for (const part of parts) {
      const t = part.trim();
      if (t.startsWith("{")) lines.push(t);
    }
  }

  return lines;
}

/** Parse every A2UI line from a completed model reply. */
export function parseA2uiMessagesFromText(text: string): A2uiServerMessage[] {
  const out: A2uiServerMessage[] = [];
  for (const line of extractA2uiJsonlLines(text)) {
    const msg = parseA2uiLine(line);
    if (msg) out.push(msg);
  }
  return out;
}

export function replyHasA2uiPayload(text: string): boolean {
  const trimmed = text.trimStart();
  if (!trimmed.startsWith("{") && !/```(?:jsonl|json|a2ui)?/i.test(text)) {
    return false;
  }
  return (
    looksLikeA2uiStream(text) || parseA2uiMessagesFromText(text).length > 0
  );
}

/** Feed a full reply through the line buffer (for end-of-turn catch-up). */
export function feedA2uiReply(text: string): string[] {
  const buf = new A2uiJsonlBuffer();
  return [
    ...buf.feed(`${extractA2uiJsonlLines(text).join("\n")}\n`),
    ...buf.flush(),
  ];
}
