/**
 * Built-in toolbelt for the experimental agent. Bundling these here
 * keeps each module focused on one capability and gives the playground a
 * tidy import.
 *
 * Two categories:
 *
 * 1. **Built-in Web AI APIs** - `summarize_text`, `translate_text`,
 *    `detect_language`. These prove the thesis that an on-device agent
 *    can compose the entire Built-in AI suite, not just the Prompt API.
 * Tools may define `acceptCall` (see `runContext.ts`) to gate dispatch from
 * structured arguments + per-run context - the loop never special-cases
 * tool names.
 *
 * 2. **Platform** - `fetch_url`, `clock_now`, `clipboard_*`. Generic
 *    web-platform capabilities that round out the agent's reach.
 */

export { clipboardReadTool, clipboardWriteTool } from "./clipboard.js";
export { clockNowTool } from "./clock.js";
export { detectLanguageTool } from "./detectLanguage.js";
export {
  createFetchUrlTool,
  type FetchUrlToolOptions,
} from "./fetchUrl.js";
export { summarizeTool } from "./summarize.js";
export { translateTool } from "./translate.js";
