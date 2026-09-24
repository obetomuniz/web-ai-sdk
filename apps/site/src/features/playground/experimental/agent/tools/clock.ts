/**
 * `clock_now` tool: surfaces the current wall-clock time and the user's
 * IANA timezone. Solves "the model thinks it's 2024" without any model
 * fine-tuning. Read-only and trivially safe; included by default in the
 * playground.
 */

import type { AgentRunContext } from "../runContext.js";
import type { AgentTool } from "../types.js";

interface ClockInput {
  /** Optional IANA zone (e.g. `"America/Sao_Paulo"`). Defaults to the user's locale. */
  timeZone?: string;
}

interface ClockOutput {
  iso: string;
  epochMs: number;
  timeZone: string;
  formatted: string;
}

export const clockNowTool: AgentTool<ClockInput, ClockOutput> = {
  name: "clock_now",
  description:
    "Return the current time. Pass `timeZone` as an IANA zone name (e.g. 'Asia/Tokyo', 'Europe/London', 'America/Sao_Paulo') to get the current time THERE - use this for any 'what time is it in <place>' question instead of fetching a web API. Omit `timeZone` to use the user's local zone. Returns ISO 8601 (UTC instant), epoch milliseconds, the resolved zone, and a locale string formatted for that zone.",
  readOnly: true,
  inputSchema: {
    type: "object",
    properties: {
      timeZone: {
        type: "string",
        description:
          "IANA timezone name such as 'Asia/Tokyo'. Defaults to the user's local zone.",
      },
    },
    additionalProperties: false,
  },
  acceptCall(_input, ctx) {
    return isCurrentTimeRequest(ctx);
  },
  // Same predicate both ways: a current-time question is the only reason
  // to run this tool (acceptCall), and once the user asks one, an answer
  // without a successful run would be a guessed time (requiredCallIf).
  requiredCallIf(ctx) {
    return isCurrentTimeRequest(ctx);
  },
  async execute({ timeZone }) {
    const now = new Date();
    const resolved =
      timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

    let formatter: Intl.DateTimeFormat;
    try {
      formatter = new Intl.DateTimeFormat(undefined, {
        dateStyle: "full",
        timeStyle: "long",
        timeZone: resolved,
      });
    } catch {
      // `Intl` throws a RangeError on an unknown zone. Surface a clear,
      // recoverable message (the agent can retry with a valid name)
      // rather than crashing the run.
      throw new Error(
        `Unknown timeZone "${resolved}". Use an IANA name like "Asia/Tokyo".`,
      );
    }

    return {
      iso: now.toISOString(),
      epochMs: now.getTime(),
      timeZone: resolved,
      formatted: formatter.format(now),
    };
  },
};

const CURRENT_TIME_REQUESTS = [
  /\b(?:what(?:'s| is)?|tell|show|give|check|get)\b.{0,48}\b(?:time|date|day)\b/i,
  /\b(?:current|local|exact)\s+(?:time|date)\b/i,
  /\b(?:time|date)\s+(?:is it|right now|now|in|for|at)\b/i,
  /\bhow\s+late\s+is\s+it\b/i,
  /\bwhat\s+day\s+is\s+it\b/i,
  /\bis\s+it\s+(?:morning|afternoon|evening|night|midnight|noon)\b/i,
] as const;

/**
 * A short continuation such as "and Vancouver?", "what about London?" or
 * "e Londres?": a leading connective plus at most four words, with no
 * sentence punctuation, so URLs and second requests don't qualify. It has
 * no time words of its own, so it only counts as a time question when it
 * continues one (observed: "and vancouver ?" after a Tokyo time question
 * got a guessed time, 11 hours off, with no clock call).
 */
const FOLLOW_UP =
  /^\s*¿?(?:and|what about|how about|e|y|et|und)(?:\s+[^\s.!?]+){1,4}\s*\??\s*$/i;

/**
 * A reply that only acknowledges the last answer ("thanks!", "ok, cool").
 * It doesn't change the topic, so a follow-up after it still continues
 * the time question (observed: "and paris?" after "thanks!" got a guessed
 * time).
 */
const ACKNOWLEDGEMENT =
  /^\s*(?:(?:ok(?:ay)?|cool|great|nice|perfect|awesome|got it|thanks?(?: a lot| so much)?|thank you(?: so much)?|thx|ty|obrigad[oa]|valeu|gracias|merci|danke)[\s,.!]*)+$/i;

function isCurrentTimeRequest(ctx: AgentRunContext): boolean {
  if (asksForCurrentTime(ctx.userInput)) return true;
  if (!FOLLOW_UP.test(ctx.userInput)) return false;
  // Walk back through follow-ups ("and Vancouver?") and acknowledgements
  // to the message that started the exchange.
  for (const earlier of [...ctx.previousUserInputs].reverse()) {
    if (asksForCurrentTime(earlier)) return true;
    if (!FOLLOW_UP.test(earlier) && !ACKNOWLEDGEMENT.test(earlier)) {
      return false;
    }
  }
  return false;
}

function asksForCurrentTime(input: string): boolean {
  return CURRENT_TIME_REQUESTS.some((pattern) => pattern.test(input));
}
