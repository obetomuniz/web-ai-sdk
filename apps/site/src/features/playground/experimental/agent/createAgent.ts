/**
 * `createAgent` - the public entry point for the experimental agent.
 *
 * The agent uses the Prompt API's NATIVE tool calling: tools are passed to
 * `createSession({ tools })` (@web-ai-sdk/prompt ≥0.5.1) and the model's
 * trained `tool_code` output is parsed and dispatched. This replaced the
 * earlier `responseConstraint` JSON polyfill ("constraint mode"), which was
 * removed once native tool calling proved reliable and faster on-device.
 *
 * The run loop lives in `loop.ts`; this module is the stable public name
 * consumers import. The orchestration split:
 *
 *   • run loop + tool-call parsing → `loop.ts` + `toolCode.ts`
 *   • tool dispatch + progress      → `dispatcher.ts`
 *   • event stream consumption      → `events.ts` (`AgentStream`)
 *   • tool definitions + registry   → `tools/`
 */

import { createAgentLoop } from "./loop.js";
import type { Agent, CreateAgentOptions } from "./types.js";

export function createAgent(options: CreateAgentOptions = {}): Agent {
  return createAgentLoop(options);
}
