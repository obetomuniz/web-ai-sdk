/**
 * `summarize_text` `acceptCall` helper: prove the `text` argument comes from
 * material the user supplied or a successful fetch in this run - not from
 * content the model invented on a generation task.
 *
 * This replaces keyword-matching on the user message. Routing intent stays in
 * the tool's JSON Schema `description` (the WebMCP / Language Model tool
 * contract); we only validate the structured call the model emitted.
 */

import type { AgentToolCallRecord } from "./types.js";

/** Min length for a standalone paste the user likely meant to summarize. */
const MIN_PASTE_CHARS = 80;

/** Prefix length used to match truncated `text` against a longer source. */
const PREFIX_MATCH_CHARS = 160;

export function extractFetchSourceText(
  record: AgentToolCallRecord,
): string | null {
  if (record.error) return null;
  const out = record.output as
    | {
        status?: number;
        error?: string;
        text?: string;
        body?: unknown;
      }
    | undefined;
  if (!out || out.error) return null;
  if (
    typeof out.status === "number" &&
    (out.status < 200 || out.status >= 300)
  ) {
    return null;
  }
  if (typeof out.text === "string" && out.text.trim()) return out.text;
  if (typeof out.body === "string" && out.body.trim()) return out.body;
  if (out.body !== undefined) {
    try {
      return JSON.stringify(out.body);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * True when `text` is plausibly sourced from the user's turn or from fetch
 * output accumulated this run (substring / prefix overlap). False for the
 * common misroute where the model passes freshly generated prose.
 */
export function summarizeTextHasKnownSource(
  text: string,
  userInput: string,
  fetchedSources: readonly string[],
): boolean {
  const t = text.trim();
  if (!t) return false;

  if (textMatchesUserSource(t, userInput)) return true;

  for (const src of fetchedSources) {
    if (!src?.trim()) continue;
    if (textMatchesFetchedSource(t, src)) return true;
  }
  return false;
}

function textMatchesUserSource(text: string, userInput: string): boolean {
  if (userInput.includes(text)) {
    // Long paste, or the message is mostly the content to summarize.
    if (text.length >= MIN_PASTE_CHARS) return true;
    if (userInput.length <= text.length * 1.5) return true;
    return false;
  }
  if (text.length >= MIN_PASTE_CHARS) {
    const prefix = text.slice(0, PREFIX_MATCH_CHARS);
    if (prefix.length >= 40 && userInput.includes(prefix)) return true;
  }
  return false;
}

function textMatchesFetchedSource(text: string, fetched: string): boolean {
  if (fetched.includes(text)) return true;
  const prefix = text.slice(0, PREFIX_MATCH_CHARS);
  if (prefix.length >= 40 && fetched.includes(prefix)) return true;
  const head = fetched.slice(0, PREFIX_MATCH_CHARS);
  if (head.length >= 40 && text.includes(head)) return true;
  return false;
}
