/**
 * Per-run facts tools use in `acceptCall` guards. Keeps the loop generic:
 * each tool owns its dispatch policy; the loop only filters calls and
 * applies shared recovery (auto-fetch URLs, one direct-answer retry).
 */

export interface AgentRunContext {
  /** Original user message for this run. */
  readonly userInput: string;
  /** Normalized HTTP(S) URLs the user named in `userInput`. */
  readonly userUrls: ReadonlySet<string>;
  /** Normalized URLs successfully fetched earlier in this conversation. */
  readonly knownUrls: ReadonlySet<string>;
  /** Bodies from successful fetches this run (for provenance checks). */
  readonly fetchedSources: readonly string[];
}
