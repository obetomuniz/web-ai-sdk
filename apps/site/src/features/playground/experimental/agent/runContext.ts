/**
 * Per-run facts tools use in `acceptCall` guards. Keeps the loop generic:
 * each tool owns its dispatch policy; the loop only filters calls and
 * applies shared recovery (auto-fetch URLs, one direct-answer retry).
 */

export interface AgentRunContext {
  /** Original user message for this run. */
  readonly userInput: string;
  /**
   * Earlier user messages in this conversation, oldest first (restored
   * turns plus previous runs). Lets a tool read a short follow-up such as
   * "and Vancouver?" as a continuation of the request before it.
   */
  readonly previousUserInputs: readonly string[];
  /** Normalized HTTP(S) URLs the user named in `userInput`. */
  readonly userUrls: ReadonlySet<string>;
  /** Normalized URLs successfully fetched earlier in this conversation. */
  readonly knownUrls: ReadonlySet<string>;
  /** Bodies from successful fetches this run (for provenance checks). */
  readonly fetchedSources: readonly string[];
}
