/**
 * `clock_now` tool: surfaces the current wall-clock time and the user's
 * IANA timezone. Solves "the model thinks it's 2024" without any model
 * fine-tuning. Read-only and trivially safe; included by default in the
 * playground.
 */

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
