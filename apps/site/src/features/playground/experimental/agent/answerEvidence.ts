/**
 * Deterministic evidence check for the final answer: numeric values the
 * model states must be traceable to this run's tool results or to the
 * user's own message. A hallucinated figure sitting beside real tool
 * output reads as tool-backed fact (observed: "1,238 stars" while the
 * fetched response said 19), so the loop uses this check to steer one
 * rewrite and to flag whatever stays unsupported as unavailable.
 *
 * Zero inference: plain token extraction and set membership. The check
 * runs only when the run produced tool records, so tool-free chat
 * (stories, math help, generated examples) is never second-guessed.
 */

import type { AgentToolCallRecord } from "./types.js";

/** Grouped ("1,238"), decimal ("3.14"), or plain ("1238") numeric tokens. */
const NUMBER_TOKEN = /\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;

/**
 * Single-digit mentions ("3 items", list markers, "the 2 pages") are
 * counts the model routinely derives itself; only longer figures are
 * treated as claims that need a supporting tool result.
 */
const MIN_CLAIM_DIGITS = 2;

/**
 * Numeric values in `answer` with no source in the user's message or in
 * any tool record from this run. Returned in their original display form
 * ("1,238", not "1238"), deduplicated, in answer order.
 */
export function findUnsupportedAnswerValues(
  answer: string,
  userInput: string,
  records: readonly AgentToolCallRecord[],
): string[] {
  const evidence = collectEvidenceNumbers(userInput, records);
  const unsupported: string[] = [];
  const seen = new Set<string>();
  for (const token of answer.match(NUMBER_TOKEN) ?? []) {
    const normalized = normalizeNumber(token);
    if (countDigits(normalized) < MIN_CLAIM_DIGITS) continue;
    if (evidence.has(normalized)) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    unsupported.push(token);
  }
  return unsupported;
}

/**
 * Every numeric token found in the user's message and in the recorded
 * tool calls (inputs, outputs, and error messages). Failed calls count
 * as evidence too: echoing a number from an error message is grounded,
 * even though the loop separately reports the failure itself.
 */
function collectEvidenceNumbers(
  userInput: string,
  records: readonly AgentToolCallRecord[],
): Set<string> {
  const evidence = new Set<string>();
  addNumbers(evidence, userInput);
  for (const record of records) {
    addNumbers(evidence, safeStringify(record.input));
    if (record.output !== undefined) {
      addNumbers(evidence, safeStringify(record.output));
    }
    if (record.error) addNumbers(evidence, record.error.message);
  }
  return evidence;
}

function addNumbers(target: Set<string>, text: string): void {
  for (const token of text.match(NUMBER_TOKEN) ?? []) {
    target.add(normalizeNumber(token));
  }
  // Raw digit runs as well, so a claim like "12" is supported by evidence
  // that only carries it embedded ("12:34:56", "2026-08-06", id fields).
  for (const run of text.match(/\d+/g) ?? []) {
    target.add(run);
  }
}

function normalizeNumber(token: string): string {
  return token.replace(/,/g, "");
}

function countDigits(normalized: string): number {
  return normalized.replace(/\D/g, "").length;
}

function safeStringify(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value) ?? "";
  } catch {
    return "";
  }
}
