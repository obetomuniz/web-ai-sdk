/**
 * Generic dispatch filtering: tools opt in with `acceptCall`. The loop
 * never branches on individual tool names.
 */

import type { AgentRunContext } from "./runContext.js";
import type { ParsedToolCall } from "./toolCode.js";
import type { AgentTool } from "./types.js";

export const DIRECT_ANSWER_RETRY =
  "Answer the user's request directly in plain text now. Do not call or mention any tool - produce the full answer yourself.";

export function filterCallsForDispatch(
  calls: readonly ParsedToolCall[],
  tools: readonly AgentTool[],
  ctx: AgentRunContext,
): ParsedToolCall[] {
  return calls.filter((call) => {
    const tool = tools.find((t) => t.name === call.name);
    if (!tool?.acceptCall) return true;
    return tool.acceptCall(call.input, ctx);
  });
}

/** All proposed calls were rejected by tool policies - steer one direct turn. */
export function shouldSteerDirectAnswer(
  proposed: readonly ParsedToolCall[],
  accepted: readonly ParsedToolCall[],
): boolean {
  return proposed.length > 0 && accepted.length === 0;
}
