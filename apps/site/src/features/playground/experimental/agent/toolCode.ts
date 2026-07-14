/**
 * Parser for the on-device model's NATIVE tool-call format.
 *
 * When the Prompt API is given a `tools` list, Gemini Nano emits tool
 * calls in its trained Python-ish `tool_code` form rather than the
 * `responseConstraint` JSON we otherwise coax out of it. Observed live
 * (stable Chrome 148, native tool *execution* not yet wired):
 *
 *   ```tool_code
 *   print(get_magic_token())
 *   ```
 *   ```tool_code
 *   default_api.fetch_url(url="https://example.com")
 *   ```
 *
 * This module turns that text into structured `{ name, input }` calls the
 * dispatcher can run. It is a deliberately small, NON-EVALUATING parser:
 * it never executes the model's output, it only extracts a function name
 * and literal argument values. Anything it can't parse safely is dropped,
 * which simply means "no tool call" - the loop then treats the turn as a
 * final answer, the safe default.
 *
 * Rationale for the approach (see sdk/.ideas/native-tool-calling.md): the
 * model is *trained* to emit `tool_code`, so meeting it there should be
 * more reliable than forcing an ad-hoc JSON schema. This file is the
 * consumer-side half; the only SDK dependency is passing `tools` to
 * `create()`, which the spike does by calling the native API directly.
 */

import type { AgentTool } from "./types.js";

export interface ParsedToolCall {
  name: string;
  input: Record<string, unknown>;
}

/**
 * Extract every tool call the model emitted, mapped onto the known
 * tools. Calls naming an unknown function are ignored. Returns `[]` when
 * the text carries no recognizable call (i.e. it's a plain answer).
 */
export function parseToolCode(
  text: string,
  tools: readonly AgentTool[],
): ParsedToolCall[] {
  const known = new Map<string, AgentTool>(tools.map((t) => [t.name, t]));

  // Prefer fenced ```tool_code``` (also tolerate ```python / ```tool /
  // bare fences the model sometimes uses). If there are no fences, scan
  // the whole text - small models occasionally drop the fence.
  const blocks = collectCodeBlocks(text);
  const sources = blocks.length > 0 ? blocks : [text];

  const calls: ParsedToolCall[] = [];
  const seen = new Set<string>();
  for (const src of sources) {
    for (const { name, argString } of extractCallExpressions(src)) {
      const tool = known.get(name);
      if (!tool) continue; // not a tool (e.g. the wrapping `print(...)`)
      const input = mapArguments(argString, tool);
      // De-dupe identical calls the model sometimes repeats across blocks.
      const key = `${name}:${JSON.stringify(input)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      calls.push({ name, input });
    }
  }
  return calls;
}

/** True if the text contains at least one recognizable tool call. */
export function hasToolCall(
  text: string,
  tools: readonly AgentTool[],
): boolean {
  return parseToolCode(text, tools).length > 0;
}

/**
 * Strip tool-call scaffolding from a final answer so the user never sees
 * stray ```` ```tool_code ```` fences if the model mixes prose and code.
 */
export function stripToolCode(text: string): string {
  return text
    .replace(/```(?:tool_code|python|tool|json)?\s*[\s\S]*?```/gi, "")
    .trim();
}

/**
 * Index one past the last character of leading prose that is safe to show
 * while streaming: everything before the first ``` fence, minus a trailing
 * run of 1–2 backticks that might be the start of a fence still arriving.
 */
export function proseStreamLimit(text: string): number {
  const fence = text.indexOf("```");
  if (fence !== -1) return fence;
  if (text.endsWith("``")) return text.length - 2;
  if (text.endsWith("`")) return text.length - 1;
  return text.length;
}

function collectCodeBlocks(text: string): string[] {
  const blocks: string[] = [];
  const fence = /```(?:tool_code|python|tool)?\s*([\s\S]*?)```/gi;
  let m = fence.exec(text);
  while (m !== null) {
    const block = m[1];
    if (block?.trim()) blocks.push(block);
    m = fence.exec(text);
  }
  return blocks;
}

/**
 * Find `name(...args...)` expressions with balanced parentheses. Handles
 * a `print(...)` wrapper and a `default_api.` (or any dotted) prefix by
 * taking the last dotted segment as the function name - `print` itself
 * just won't match a known tool and is skipped, while its inner call is
 * found on its own.
 */
function extractCallExpressions(
  src: string,
): Array<{ name: string; argString: string }> {
  const out: Array<{ name: string; argString: string }> = [];
  const head = /([A-Za-z_][\w.]*)\s*\(/g;
  let m = head.exec(src);
  while (m !== null) {
    const dotted = m[1];
    if (!dotted) {
      m = head.exec(src);
      continue;
    }
    const name = dotted.includes(".")
      ? dotted.slice(dotted.lastIndexOf(".") + 1)
      : dotted;
    const open = head.lastIndex - 1; // index of "("
    const close = matchParen(src, open);
    if (close === -1) {
      m = head.exec(src);
      continue;
    }
    out.push({ name, argString: src.slice(open + 1, close) });
    m = head.exec(src);
  }
  return out;
}

/** Index of the `)` matching the `(` at `openIndex`, or -1. Quote-aware. */
function matchParen(src: string, openIndex: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = openIndex; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      if (ch === "\\") {
        i++; // skip escaped char
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
    } else if (ch === "(") {
      depth++;
    } else if (ch === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Map a raw argument string to the tool's input object. Supports both
 * keyword args (`url="x"`) and positional args (`57, 86`), the latter
 * assigned to the tool's schema properties in declared order.
 */
function mapArguments(
  argString: string,
  tool: AgentTool,
): Record<string, unknown> {
  const parts = splitTopLevel(argString);
  const props = Object.keys(
    (tool.inputSchema?.properties ?? {}) as Record<string, unknown>,
  );
  const input: Record<string, unknown> = {};
  let positional = 0;

  for (const raw of parts) {
    const part = raw.trim();
    if (!part) continue;
    const kw = part.match(/^([A-Za-z_]\w*)\s*=\s*([\s\S]+)$/);
    const key = kw?.[1];
    const value = kw?.[2];
    if (key && value !== undefined) {
      input[key] = parseLiteral(value);
    } else {
      const key = props[positional++];
      if (key) input[key] = parseLiteral(part);
    }
  }
  return input;
}

/** Split on top-level commas, ignoring those inside quotes/brackets. */
function splitTopLevel(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") depth--;
    else if (ch === "," && depth === 0) {
      parts.push(s.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(s.slice(start));
  return parts;
}

/** Parse a single argument literal (string / number / bool / null). */
function parseLiteral(raw: string): unknown {
  const s = raw.trim();
  if (s.length === 0) return "";
  const q = s[0];
  if ((q === '"' || q === "'" || q === "`") && s[s.length - 1] === q) {
    return s
      .slice(1, -1)
      .replace(/\\(["'`\\])/g, "$1")
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t");
  }
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if (s === "true" || s === "True") return true;
  if (s === "false" || s === "False") return false;
  if (s === "null" || s === "None") return null;
  // Fallback: treat as a bare string (e.g. an unquoted URL).
  return s;
}
