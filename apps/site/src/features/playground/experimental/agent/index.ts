/**
 * Experimental agent loop barrel.
 *
 * Three layers:
 *
 *   1. Core      - `createAgent`, the modules behind it, and the
 *                  AgentStream wrapper that consumers iterate.
 *   2. Composition - `transforms` for pipe()ing onto a stream.
 *   3. Registry  - `ToolRegistry` for sharing tools between the in-page
 *                  agent and external agents via @web-ai-sdk/webmcp.
 *
 * See `./README.md` for the architecture diagram and composition
 * examples.
 */

export {
  A2UI_V0_8_STANDARD_CATALOG,
  A2uiJsonlBuffer,
  type A2uiServerMessage,
  type A2uiSnapshot,
  applyA2uiMessage,
  buildA2uiPromptAppendix,
  createEmptyA2uiSnapshot,
  extractA2uiJsonlLines,
  feedA2uiReply,
  looksLikeA2uiStream,
  parseA2uiLine,
  parseA2uiMessagesFromText,
  replyHasA2uiPayload,
  unwrapA2uiFence,
} from "./a2ui/index.js";
export { createAgent } from "./createAgent.js";
export {
  AgentToolExecutionError,
  AgentToolValidationError,
  AgentUnavailableError,
  AgentUnknownToolError,
} from "./errors.js";
export {
  streamFromGenerator,
  streamFromResult,
} from "./events.js";
export * as tools from "./tools/index.js";
export {
  type RegisterToolOptions,
  sharedToolRegistry,
  ToolRegistry,
} from "./tools/registry.js";
export * as transforms from "./transforms.js";
export {
  addTiming,
  collectText,
  debounceText,
  filter,
  logEvents,
  map,
  onlyType,
  tap,
  tee,
  textStream,
} from "./transforms.js";
export type {
  Agent,
  AgentEvent,
  AgentEventOf,
  AgentOnToolErrorPolicy,
  AgentPlan,
  AgentRunResult,
  AgentStep,
  AgentStopReason,
  AgentStream,
  AgentTool,
  AgentToolCallRecord,
  AgentToolContext,
  AgentToolInput,
  AgentToolOutput,
  AgentTransform,
  CreateAgentOptions,
} from "./types.js";
