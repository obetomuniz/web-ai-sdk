/**
 * `createAgentLoop` - the agent's run loop. `createAgent.ts` is the public
 * factory; this is the implementation it delegates to.
 *
 * Tool calling is NATIVE: tools are passed to `createSession({ tools })`
 * (@web-ai-sdk/prompt ≥0.5.1) and the model's trained `tool_code` output
 * (`print(fetch_url(url="…"))`) is parsed and dispatched. Per run it:
 *
 *   1. clones a warm base session (system prompt + tools) for a fresh,
 *      cheap conversation (see the session-lifecycle notes below),
 *   2. streams the model's reply and parses any `tool_code` calls
 *      (`toolCode.ts`),
 *   3. dispatches them through `runDispatcher` (same tool events as any
 *      other consumer), feeds the results back, and
 *   4. repeats until the model answers in plain text.
 *
 * Native EXECUTION isn't wired on stable Chrome yet (the model surfaces
 * calls as `tool_code` text, which is why we parse it); if a future
 * runtime executes tools directly, the provided `execute` callbacks run
 * and this loop simply sees no `tool_code` and emits the final message.
 * See `web-ai-sdk/.ideas/native-tool-calling.md`.
 */

import {
  createSession,
  isAvailable as isPromptAvailable,
  type LanguageModelMessage,
  type LanguageModelTool,
  PromptAbortError,
  PromptUnavailableError,
  type Session,
} from "@web-ai-sdk/prompt";
import { runDispatcher } from "./dispatcher.js";
import {
  DIRECT_ANSWER_RETRY,
  filterCallsForDispatch,
  shouldSteerDirectAnswer,
} from "./dispatchPolicy.js";
import { AgentStalledError, AgentUnavailableError } from "./errors.js";
import { streamFromGenerator, streamFromResult } from "./events.js";
import type { AgentRunContext } from "./runContext.js";
import { extractFetchSourceText } from "./summarizeProvenance.js";
import { parseToolCode, proseStreamLimit, stripToolCode } from "./toolCode.js";
import { isEmptySummarizeOutput } from "./tools/summarize.js";
import type {
  Agent,
  AgentEvent,
  AgentFailure,
  AgentRunResult,
  AgentStep,
  AgentStopReason,
  AgentTool,
  AgentToolCallRecord,
  AgentTurn,
  CreateAgentOptions,
} from "./types.js";
import { normUrl, resolveContextualUrls } from "./urls.js";

const DEFAULT_MAX_STEPS = 5;
const STALL_TIMEOUT_MS = 15_000;
// Fallback fetch-content budget (chars), used only when the browser doesn't
// report the context window. When it does (`session.contextWindow`), the
// budget is sized to the real model - see the per-run calc in `loop()`.
const FETCH_CONTENT_BUDGET_CHARS = 8000;
// Convert the token-based context window to a char budget (~4 chars/token),
// reserving headroom for the answer + per-turn framing, with a floor so a
// page always gets some content.
const CHARS_PER_TOKEN = 4;
const ANSWER_RESERVE_TOKENS = 768;
const MIN_FETCH_BUDGET_CHARS = 1000;
// Per-URL cap for MULTI-doc runs. Counter-intuitively, giving each page MORE
// content hurts multi-doc coverage: filling the small context leaves the
// model no room to synthesize across pages, so it answers about only one.
// Capping each page to a synthesis-friendly size (and letting the dynamic
// budget shrink it further when there are many URLs) keeps every page
// covered. Single-URL runs aren't capped - there's nothing to synthesize.
const MULTI_DOC_PER_URL_MAX_CHARS = 4000;

export function createAgentLoop(options: CreateAgentOptions = {}): Agent {
  const tools = (options.tools ?? []).slice();
  if (!isPromptAvailable()) return makeUnavailableAgent(tools);

  const maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS;
  const onToolError = options.onToolError ?? "report";
  const sessionMode = options.sessionMode ?? "run-isolated";
  // URL safety net (same intent as the constraint loop): if the user
  // referenced a URL and a fetch tool exists, fetch it deterministically
  // when the model finalizes without fetching, and flag any URL answer
  // that wasn't backed by a successful fetch.
  const autoFetchUrls = options.autoFetchUrls ?? true;
  const systemPrompt = buildNativePrompt(options.systemPrompt, tools);
  // The `tools` passthrough on `createSession` (since @web-ai-sdk/prompt
  // 0.5.1) is what lets this run through the SDK instead of reaching for
  // `globalThis.LanguageModel`. The SDK forwards `tools` to the native
  // `create()`; on stable Chrome the model surfaces calls as `tool_code`
  // text, which `toolCode.ts` parses (the SDK does NOT execute tools).
  const sdkTools = tools.map(toSdkTool);
  const urlFetchingTool = findUrlFetchingTool(tools);
  const restoredFetchUrls = collectSuccessfulFetchUrls(
    options.initialTurns ?? [],
    urlFetchingTool,
  );
  const knownFetchUrls = new Set(restoredFetchUrls);
  const restoredMessages: LanguageModelMessage[] = (
    options.initialTurns ?? []
  ).flatMap((turn) => {
    // Failed/stopped runs belong in the visible history, but they are not
    // model answers. Replaying their guidance as assistant context makes the
    // next turn treat an error message as ground truth.
    if (
      turn.stopReason !== "done" ||
      !turn.userInput.trim() ||
      !turn.assistantText.trim()
    ) {
      return [];
    }
    return [
      { role: "user" as const, content: turn.userInput },
      { role: "assistant" as const, content: turn.assistantText },
    ];
  });

  const createConversationSession = (): Session =>
    createSession({
      systemPrompt,
      samplingMode: options.samplingMode,
      language: options.language,
      tools: sdkTools,
      ...(restoredMessages.length > 0
        ? {
            createOptions: {
              initialPrompts: [
                { role: "system", content: systemPrompt },
                ...restoredMessages,
              ],
            },
          }
        : {}),
    });

  // Same base-session + per-run-clone lifecycle as the constraint agent
  // (see createAgent.ts): one warm base holding the system prompt + tools,
  // cloned per run for a clean conversation without re-parsing or a fresh
  // create().
  let baseSession: Session | null = null;
  let currentController: AbortController | null = null;
  let currentClone: Session | null = null;
  let conversationSession: Session | null = null;
  let prefetchedClone: Session | null = null;
  let prefetchInFlight: Promise<void> | null = null;
  let prefetchEpoch = 0;
  let destroyed = false;

  const getBase = (): Session => {
    if (!baseSession) {
      baseSession = createConversationSession();
    }
    return baseSession;
  };

  const acquireRunSession = async (): Promise<Session> => {
    const base = getBase();
    try {
      return await base.clone();
    } catch {
      return createConversationSession();
    }
  };

  const acquireConversationSession = async (): Promise<Session> => {
    if (conversationSession) return conversationSession;
    conversationSession = await acquireRunSession();
    return conversationSession;
  };

  const invalidatePrefetchedClone = () => {
    prefetchEpoch++;
    if (prefetchedClone) {
      prefetchedClone.destroy();
      prefetchedClone = null;
    }
  };

  const prefetchRunClone = () => {
    if (destroyed || prefetchedClone || prefetchInFlight) return;
    const epoch = prefetchEpoch;
    prefetchInFlight = (async () => {
      let session: Session | null = null;
      try {
        session = await acquireRunSession();
      } catch {
        return;
      }
      if (destroyed || epoch !== prefetchEpoch || prefetchedClone) {
        session.destroy();
        return;
      }
      prefetchedClone = session;
    })().finally(() => {
      prefetchInFlight = null;
    });
  };

  const takeRunSession = async (): Promise<Session> => {
    if (sessionMode === "thread") {
      return acquireConversationSession();
    }
    if (prefetchedClone) {
      const session = prefetchedClone;
      prefetchedClone = null;
      return session;
    }
    if (prefetchInFlight) {
      try {
        await prefetchInFlight;
      } catch {
        // Best-effort warmup only. Fall back to on-demand clone below.
      }
      if (prefetchedClone) {
        const session = prefetchedClone;
        prefetchedClone = null;
        return session;
      }
    }
    return acquireRunSession();
  };

  // Pre-warm the model while the user reads the UI (mirrors the
  // constraint agent), so the first run can claim a ready clone.
  getBase();
  if (sessionMode === "run-isolated") prefetchRunClone();

  async function* loop(
    input: string,
    externalSignal?: AbortSignal,
  ): AsyncGenerator<AgentEvent, AgentRunResult, void> {
    if (destroyed) throw new AgentUnavailableError("Agent has been destroyed.");

    currentController?.abort();
    if (sessionMode === "run-isolated") currentClone?.destroy();
    const controller = new AbortController();
    currentController = controller;
    const signal = composeSignals(controller.signal, externalSignal);

    const inputUrls = resolveContextualUrls(input, [...knownFetchUrls]);
    const userUrls = new Set(inputUrls.map(normUrl));
    const fetchTool = urlFetchingTool;

    let session: Session;
    try {
      session = await takeRunSession();
    } catch (error) {
      if (currentController === controller) currentController = null;
      const terminal = describeRunFailure(error);
      if (terminal.text) yield { type: "message", text: terminal.text };
      yield {
        type: "done",
        reason: terminal.reason,
        text: terminal.text,
        failure: terminal.failure,
      };
      return {
        text: terminal.text,
        steps: [],
        stopReason: terminal.reason,
        failure: terminal.failure,
      };
    }
    currentClone = session;

    // Size the fetch-content budget to the model's ACTUAL context. A cloned
    // session reports `contextWindow` (max input tokens) and `contextUsage`
    // (≈ the system prompt on a fresh clone) the moment it's live
    // (@web-ai-sdk/prompt 0.5.2). Reserve headroom for the answer; fall back
    // to the fixed cap when the browser doesn't report the window. Splitting
    // the budget evenly per URL lets all pages fit at once → fetch them all,
    // then one streamed answer covering each.
    const budgetChars = (() => {
      const windowTokens = session.contextWindow;
      if (!windowTokens) return FETCH_CONTENT_BUDGET_CHARS;
      const usedTokens = session.contextUsage ?? 0;
      const availableTokens = windowTokens - usedTokens - ANSWER_RESERVE_TOKENS;
      return Math.max(
        MIN_FETCH_BUDGET_CHARS,
        availableTokens * CHARS_PER_TOKEN,
      );
    })();
    const perResultMaxChars =
      inputUrls.length > 1
        ? Math.min(
            Math.floor(budgetChars / inputUrls.length),
            MULTI_DOC_PER_URL_MAX_CHARS,
          )
        : budgetChars;

    const steps: AgentStep[] = [];
    let turnInput = input;
    let stopReason: AgentStopReason | null = null;
    let finalText = "";
    let failure: AgentFailure | undefined;

    // Track which of the user's URLs were actually fetched - PER URL, not
    // just "any fetch happened" - so we can force-fetch the ones the model
    // skipped (it often fetches only the first of several) and flag failures.
    const fetchedOk = new Set<string>();
    const fetchTried = new Set<string>();
    /** Extracted bodies from successful fetches - provenance for summarize_text. */
    const fetchedSources: string[] = [];
    const runCtx: AgentRunContext = {
      userInput: input,
      userUrls,
      knownUrls: knownFetchUrls,
      fetchedSources,
    };
    let autoFetchDone = false;
    // Guards the one-time "answer directly, no tools" self-heal below.
    let directRetryDone = false;
    const recordFetches = (records: AgentToolCallRecord[]) => {
      for (const r of records) {
        const src = extractFetchSourceText(r);
        if (src) fetchedSources.push(src);
      }
      if (!fetchTool) return;
      for (const r of records) {
        if (r.name !== fetchTool.name) continue;
        const url = (r.input as { url?: unknown }).url;
        if (typeof url !== "string") continue;
        fetchTried.add(normUrl(url));
        if (fetchDidSucceed(r)) {
          const normalizedUrl = normUrl(url);
          fetchedOk.add(normalizedUrl);
          knownFetchUrls.add(normalizedUrl);
        }
      }
    };

    let stepIndex = 0;
    try {
      // Proactive fetch: when the user's message contains URLs, fetch them
      // ALL up front, in parallel, BEFORE the model writes anything. The URL
      // is right there in the input, so fetching it is deterministic - not a
      // guess - which lets us skip the model's initial "decide to call
      // fetch_url" planning turn entirely. On-device that turn costs several
      // seconds of first-token latency per run, so eliminating it is the
      // biggest single TTFT win for any "summarize this link" prompt. For
      // multiple URLs it also gives the "fetch all → one answer" flow instead
      // of the model interleaving (fetch → answer page 1 → fetch → …). The
      // reactive backstop further down still covers model-driven fetches that
      // weren't in the original input. Bounded to once per run via
      // `autoFetchDone`.
      if (autoFetchUrls && fetchTool && inputUrls.length >= 1) {
        yield { type: "step_start", index: stepIndex };
        const fetchCalls = inputUrls.map((url) => ({
          name: fetchTool.name,
          input: { url },
        }));
        const { records } = yield* runDispatcher({
          tools,
          calls: fetchCalls,
          stepIndex,
          signal,
        });
        steps.push({
          index: stepIndex,
          plan: { toolCalls: fetchCalls },
          toolCalls: records,
        });
        yield { type: "step_end", index: stepIndex };
        recordFetches(records);
        // The URLs are already fetched; don't let the reactive backstop
        // re-fetch (a CORS failure here would just fail again).
        autoFetchDone = true;
        const closer =
          inputUrls.length > 1
            ? "Answer the user's request now in ONE reply that covers every URL."
            : "Answer the user's request now.";
        // Fold the user's original message INTO this turn. Because we fetched
        // eagerly we skipped the model's planning turn - which means the user's
        // message was never sent on its own. Without it here, the model only
        // sees raw tool output and "answer the request" with no idea what was
        // asked, so it summarizes generically and picks fields inconsistently.
        // Leading with the question keeps answers on-target (e.g. "how many
        // stars" → the star count), matching the pre-eager model-driven flow.
        turnInput = `The user asked: ${input}\n\n${buildToolResultTurn(records, perResultMaxChars)}\n\n${closer}`;
        stepIndex++;
      }

      for (; stepIndex < maxSteps; stepIndex++) {
        if (signal.aborted) {
          stopReason = "aborted";
          break;
        }
        yield { type: "step_start", index: stepIndex };

        let reply: string;
        let streamedAnswerText = false;
        try {
          const streamed = yield* streamReply(
            session,
            turnInput,
            signal,
            stepIndex,
            tools,
          );
          reply = streamed.text;
          streamedAnswerText = streamed.streamedAnswerText;
        } catch (err) {
          const terminal = describeRunFailure(err);
          stopReason = terminal.reason;
          finalText = terminal.text;
          failure = terminal.failure;
          yield { type: "step_end", index: stepIndex };
          if (finalText) yield { type: "message", text: finalText };
          break;
        }

        if (signal.aborted) {
          stopReason = "aborted";
          yield { type: "step_end", index: stepIndex };
          break;
        }

        const proposed = parseToolCode(reply, tools);
        const calls = filterCallsForDispatch(proposed, tools, runCtx);

        if (shouldSteerDirectAnswer(proposed, calls) && !directRetryDone) {
          directRetryDone = true;
          yield { type: "step_end", index: stepIndex };
          turnInput = DIRECT_ANSWER_RETRY;
          continue;
        }

        if (calls.length === 0) {
          // Deterministic auto-fetch (NOT a model retry): the user named
          // URLs and the model is finalizing with some still unfetched -
          // i.e. about to answer about pages it never read (the common
          // "fetched only the first of two" case). Fetch ALL the missing
          // ones ourselves in parallel, feed the real content back, and
          // force one more turn. Bounded to once per run.
          const missing = fetchTool
            ? inputUrls.filter((u) => !fetchedOk.has(normUrl(u)))
            : [];
          if (
            autoFetchUrls &&
            fetchTool &&
            missing.length > 0 &&
            !autoFetchDone
          ) {
            autoFetchDone = true;
            const fetchCalls = missing.map((url) => ({
              name: fetchTool.name,
              input: { url },
            }));
            const { records } = yield* runDispatcher({
              tools,
              calls: fetchCalls,
              stepIndex,
              signal,
            });
            steps.push({
              index: stepIndex,
              plan: { toolCalls: fetchCalls },
              toolCalls: records,
            });
            yield { type: "step_end", index: stepIndex };
            recordFetches(records);
            const noun =
              missing.length === 1 ? "the URL" : `${missing.length} URLs`;
            turnInput = `${buildToolResultTurn(records, perResultMaxChars)}\n\nYou had not fetched ${noun} the user asked about; the real content is above. Address EACH one in your answer - don't drop any.`;
            continue;
          }

          // Self-heal: the model emitted tool-call-like scaffolding that
          // didn't parse to a valid call. The small on-device model is primed
          // to emit `tool_code` (the system prompt teaches the format and
          // lists tools), so it sometimes reaches for a tool on tasks that
          // need none - e.g. "write an article" - and botches the syntax.
          // Rather than punting to the user, give it ONE more turn to answer
          // directly with no tool. The original request is already in the
          // session history, so the corrective turn produces the real answer.
          // Bounded once per run via `directRetryDone`.
          if (
            tools.length > 0 &&
            looksLikeUnparsedToolCall(reply, tools) &&
            !directRetryDone
          ) {
            directRetryDone = true;
            yield { type: "step_end", index: stepIndex };
            turnInput = DIRECT_ANSWER_RETRY;
            continue;
          }

          // After the retry is spent, if it STILL looks like unparsed tool
          // scaffolding, don't show raw call code to the user - say so and
          // suggest a re-run.
          let answer: string;
          if (tools.length > 0 && looksLikeUnparsedToolCall(reply, tools)) {
            answer =
              "The model tried to call a tool in a format I couldn't parse this time (its tool-call format varies between runs). Re-run - it usually works on another try.";
          } else {
            answer = stripToolCode(reply) || reply.trim();
          }
          // Flag any user URL that never fetched successfully (after the
          // auto-fetch backstop, that means a real CORS/network failure).
          const unfetched = fetchTool
            ? inputUrls.filter((u) => !fetchedOk.has(normUrl(u)))
            : [];
          finalText = maybeFlagUnverifiedUrl(answer, {
            hasFetchTool: !!fetchTool,
            totalUrls: inputUrls.length,
            unfetched,
            anyTried: fetchTried.size > 0,
          });
          yield {
            type: "plan",
            index: stepIndex,
            plan: { final: true, message: finalText },
          };
          steps.push({
            index: stepIndex,
            plan: { final: true, message: finalText },
            toolCalls: [],
            text: finalText,
          });
          yield { type: "step_end", index: stepIndex };
          stopReason = "done";
          yield { type: "message", text: finalText };
          break;
        }

        // A tool-calling turn. The model sometimes prefaces its `tool_code`
        // block with a sentence of reasoning ("I'll detect the language
        // first…"). Native has no dedicated reasoning channel, so surface
        // that prose as a synthesized `thought` for parity with the
        // constraint path's transcript.
        const thought = leadingProse(reply, tools);
        // We optimistically stream leading prose to the answer panel before
        // knowing the turn is a tool call. Now that it is, discard that
        // premature text so it isn't duplicated. It re-appears just below as
        // this turn's interleaved `thought`, beside the tool cards.
        if (streamedAnswerText) yield { type: "step_reset", index: stepIndex };
        if (thought) yield { type: "thought", index: stepIndex, text: thought };

        // Surface a plan so the UI flips to "tool_calling", then dispatch
        // through the shared dispatcher.
        yield {
          type: "plan",
          index: stepIndex,
          plan: {
            ...(thought ? { thought } : {}),
            toolCalls: calls.map((c) => ({ name: c.name, input: c.input })),
          },
        };
        const { records } = yield* runDispatcher({
          tools,
          calls,
          stepIndex,
          signal,
        });

        // Summarizer returned `{ summary: "" }` (availability race). The next
        // model turn will summarize in prose - drop the empty tool card so the
        // transcript does not look like the tool succeeded with no output.
        const summarizeOnlyEmpty =
          calls.length === 1 &&
          calls[0]?.name === "summarize_text" &&
          records[0] &&
          !records[0].error &&
          isEmptySummarizeOutput(records[0].output);
        if (summarizeOnlyEmpty) {
          yield { type: "step_reset", index: stepIndex };
          yield { type: "step_end", index: stepIndex };
          turnInput =
            "The on-device Summarizer returned no text. Summarize the user's source yourself in plain text now - do not call summarize_text or any other tool.";
          continue;
        }

        const directText = resolveDirectReturnText(
          calls,
          records,
          tools,
          runCtx,
        );
        if (directText !== null) {
          finalText = directText;
          steps.push({
            index: stepIndex,
            plan: {
              ...(thought ? { thought } : {}),
              toolCalls: calls,
              final: true,
              message: finalText,
            },
            toolCalls: records,
            text: finalText,
          });
          yield {
            type: "plan",
            index: stepIndex,
            plan: { final: true, message: finalText },
          };
          yield { type: "step_end", index: stepIndex };
          recordFetches(records);
          stopReason = "done";
          yield { type: "message", text: finalText };
          break;
        }
        steps.push({
          index: stepIndex,
          plan: { ...(thought ? { thought } : {}), toolCalls: calls },
          toolCalls: records,
        });
        yield { type: "step_end", index: stepIndex };

        // Track which URLs the model actually fetched (per-URL).
        recordFetches(records);

        const fatal = records.find((r) => r.error);
        if (fatal && onToolError !== "report") {
          stopReason = "tool_error";
          finalText = `I couldn't complete this request because ${fatal.name} failed.`;
          failure = {
            name: fatal.error?.name ?? "ToolError",
            message:
              fatal.error?.message ?? "The tool did not return a result.",
          };
          break;
        }

        turnInput = buildToolResultTurn(records, perResultMaxChars);
      }

      if (stopReason === null) stopReason = "budget_exhausted";
    } finally {
      if (currentController === controller) currentController = null;
      if (sessionMode === "run-isolated") {
        session.destroy();
        if (currentClone === session) currentClone = null;
        prefetchRunClone();
      } else if (currentClone === session) {
        currentClone = null;
      }
    }

    yield {
      type: "done",
      reason: stopReason,
      text: finalText,
      failure,
    };
    return { text: finalText, steps, stopReason, failure };
  }

  return {
    get tools() {
      return tools;
    },
    async run(input, runOptions) {
      const stream = streamFromGenerator(loop(input, runOptions?.signal));
      for await (const _ev of stream) void _ev;
      return stream.result;
    },
    runStreaming(input, runOptions) {
      return streamFromGenerator(loop(input, runOptions?.signal));
    },
    abort() {
      currentController?.abort();
    },
    newSession() {
      currentController?.abort();
      currentClone?.destroy();
      currentClone = null;
      invalidatePrefetchedClone();
      conversationSession?.destroy();
      conversationSession = null;
      baseSession?.destroy();
      baseSession = null;
      knownFetchUrls.clear();
      for (const url of restoredFetchUrls) knownFetchUrls.add(url);
      if (sessionMode === "run-isolated") prefetchRunClone();
    },
    destroy() {
      destroyed = true;
      currentController?.abort();
      currentController = null;
      currentClone?.destroy();
      currentClone = null;
      invalidatePrefetchedClone();
      conversationSession?.destroy();
      conversationSession = null;
      baseSession?.destroy();
      baseSession = null;
    },
  };
}

// ─── Streaming one model reply with abort + stall protection ──────────────

type RaceStep =
  | { kind: "chunk"; result: IteratorResult<string> }
  | { kind: "aborted" }
  | { kind: "stalled" };

type ReplyKind = "prose" | "tool";

interface StreamedReply {
  /** The full accumulated reply (prose or `tool_code`). */
  text: string;
  /** Whether any prose was streamed to the answer panel as `text_delta`. */
  streamedAnswerText: boolean;
}

async function* streamReply(
  session: Session,
  input: string,
  signal: AbortSignal,
  stepIndex: number,
  tools: readonly AgentTool[],
): AsyncGenerator<AgentEvent, StreamedReply, void> {
  const stream = session.sendStreaming(input, { signal });
  const it = stream[Symbol.asyncIterator]();

  let acc = "";
  let kind: ReplyKind | undefined;
  // How many chars of clean leading prose we've already streamed. The
  // model often prefaces a `tool_code` block with a sentence ("I'll detect
  // the language first…"), which classifies the reply as prose; we still
  // stream that sentence, but stop at the fence so the raw ```tool_code```
  // never reaches the answer. The held-back tail is parsed as the tool
  // call once the stream ends.
  let emittedProse = 0;

  try {
    while (true) {
      if (signal.aborted) {
        void it.return?.(undefined);
        throw makeAbortError();
      }
      const step = await raceNext(it, signal, STALL_TIMEOUT_MS);
      if (step.kind === "aborted") {
        void it.return?.(undefined);
        throw makeAbortError();
      }
      if (step.kind === "stalled") {
        void it.return?.(undefined);
        throw new AgentStalledError(STALL_TIMEOUT_MS);
      }
      if (step.result.done) break;

      const delta = step.result.value;
      if (!delta) continue;
      acc += delta;

      yield { type: "plan_delta", index: stepIndex, raw: delta };

      if (kind === undefined) {
        const trimmed = acc.trimStart();
        if (trimmed.startsWith("```")) {
          kind = "tool";
        } else if (
          /tool_code/i.test(acc) ||
          parseToolCode(acc, tools).length > 0
        ) {
          kind = "tool";
        } else if (
          trimmed.length >= 3 &&
          !couldStillBeToolCall(trimmed, tools)
        ) {
          kind = "prose";
        }
      }

      if (kind === "prose") {
        const fence = acc.indexOf("```");
        if (fence !== -1) {
          if (fence > emittedProse) {
            yield { type: "text_delta", delta: acc.slice(emittedProse, fence) };
            emittedProse = fence;
          }
          kind = "tool";
        } else {
          const limit = proseStreamLimit(acc);
          if (limit > emittedProse) {
            yield { type: "text_delta", delta: acc.slice(emittedProse, limit) };
            emittedProse = limit;
          }
        }
      }
    }
  } catch (err) {
    if (err instanceof AgentStalledError || isAbort(err)) throw err;
    throw err instanceof Error ? err : new Error(String(err));
  }

  return {
    text: acc,
    streamedAnswerText: emittedProse > 0,
  };
}

function raceNext(
  it: AsyncIterator<string>,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<RaceStep> {
  if (signal.aborted) return Promise.resolve({ kind: "aborted" });
  return new Promise<RaceStep>((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      fn();
    };
    const timer = setTimeout(
      () => finish(() => resolve({ kind: "stalled" })),
      timeoutMs,
    );
    const onAbort = () => finish(() => resolve({ kind: "aborted" }));
    signal.addEventListener("abort", onAbort, { once: true });
    it.next().then(
      (result) => finish(() => resolve({ kind: "chunk", result })),
      (err) => finish(() => reject(err)),
    );
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function toSdkTool(tool: AgentTool): LanguageModelTool {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    // Forwarded to the native `create()` by the SDK. It's only invoked
    // when a runtime executes tools natively (not on stable Chrome today);
    // there we still parse the `tool_code` text ourselves. The result must
    // be a string for the native channel.
    async execute(args: unknown) {
      const out = await tool.execute(args as never, {
        signal: new AbortController().signal,
        callId: `native-${tool.name}`,
        step: 0,
        emit: () => {},
      });
      return typeof out === "string" ? out : JSON.stringify(out);
    },
  };
}

/**
 * System prompt for the native path. Even though we pass `tools` to
 * `create()`, stable Chrome doesn't reliably inject the catalog into the
 * model's context (the model invented a `datetime_fetch` tool when only
 * `clock_now` exists). So we list the real tool names + input shapes here
 * and show the exact `tool_code` format - the same catalog the constraint
 * path provides, just expressed as the call syntax the model is trained
 * to emit. This is what makes it pick the correct tool instead of
 * narrating an intent to use a made-up one.
 */
function buildNativePrompt(
  base: string | undefined,
  tools: readonly AgentTool[],
): string {
  const preamble =
    base ?? "You are a helpful, on-device assistant in the user's browser.";

  if (tools.length === 0) {
    return [preamble, "Reply to the user directly in plain text."].join("\n\n");
  }

  const catalog = tools
    .map(
      (t) =>
        `- ${t.name}${describeInputShape(t.inputSchema)}: ${t.description}`,
    )
    .join("\n");

  return [
    preamble,
    `You can call these tools (use the EXACT names from this list; do not invent tools, and pick the most specific tool for the task):\n${catalog}`,
    [
      // The example is a NEUTRAL placeholder on purpose: anchoring it on a
      // real tool (e.g. `fetch_url`) biases the model into using that tool
      // for everything - observed: it tried to fetch a time API for "what
      // time is it" instead of calling the dedicated clock tool. A generic
      // shape teaches the syntax without steering tool choice.
      "When a tool is needed (e.g. to read a URL the user gave you, get the current date/time, or fetch fresh data), emit ONLY a tool_code block that CALLS the most appropriate tool - do not just describe what you will do. Format (use empty parentheses if the tool takes no arguments):",
      "```tool_code",
      'tool_name(argument="value")',
      "```",
      "If the user gives MULTIPLE URLs or asks about several items, fetch EACH one (call the tool again for each), then write ONE final answer that covers ALL of them - never answer about a URL you haven't fetched, and don't drop any.",
      "Never invent values a tool can provide. After you receive the tool results, reply to the user directly in plain text.",
    ].join("\n"),
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Compact `(field, field?)` signature for the tool catalog. */
function describeInputShape(schema: AgentTool["inputSchema"]): string {
  const props = (schema.properties ?? {}) as Record<string, unknown>;
  const required = new Set(schema.required ?? []);
  const names = Object.keys(props);
  if (names.length === 0) return "()";
  return `(${names.map((n) => (required.has(n) ? n : `${n}?`)).join(", ")})`;
}

function buildToolResultTurn(
  records: AgentToolCallRecord[],
  maxChars: number,
): string {
  const lines = records.map((r) =>
    JSON.stringify({
      name: r.name,
      ...(r.error
        ? { error: truncate(r.error.message, 300) }
        : { output: truncateForContext(r.output, maxChars) }),
    }),
  );
  const unavailableSummarize = records.some(
    (r) =>
      r.name === "summarize_text" &&
      !r.error &&
      r.output &&
      typeof r.output === "object" &&
      !(r.output as { summary?: string }).summary?.trim(),
  );
  const preamble = unavailableSummarize
    ? "Tool results (summarize_text returned no summary - the Summarizer API was unavailable; summarize the source yourself in plain text):\n"
    : "Tool results:\n";
  return [
    preamble,
    ...lines,
    // Fetch-all → one answer: if other URLs the user mentioned aren't
    // fetched yet, fetch them first; once everything is in, write a single
    // reply that covers them all. Per-URL content is budgeted upstream so
    // they fit the small context together.
    "Use these results to answer. If the user mentioned other URLs you haven't fetched yet, fetch those first; once you have them all, write ONE reply that covers every one of them.",
  ].join("\n");
}

/**
 * Fast-path: when a single successful call targets a `returnDirect` tool,
 * finish the run with its output and skip the extra model synthesis turn.
 */
function resolveDirectReturnText(
  calls: ReadonlyArray<{ name: string; input: Record<string, unknown> }>,
  records: readonly AgentToolCallRecord[],
  tools: readonly AgentTool[],
  ctx: AgentRunContext,
): string | null {
  if (calls.length !== 1 || records.length !== 1) return null;
  const call = calls[0];
  const record = records[0];
  if (!call || !record) return null;
  if (record.error) return null;

  const tool = tools.find((t) => t.name === call.name);
  if (!tool) return null;
  const useDirect =
    tool.returnDirect === true ||
    tool.returnDirectIf?.(call.input, record.output, ctx) === true;
  if (!useDirect) return null;

  return directOutputToText(record.output, tool.name);
}

function directOutputToText(output: unknown, toolName: string): string {
  if (typeof output === "string") return output.trim();
  // Summarizer returns `{ summary, cached }`; expose the summary as-is.
  if (toolName === "summarize_text" && output && typeof output === "object") {
    const summary = (output as { summary?: unknown }).summary;
    if (typeof summary === "string") return summary.trim();
  }
  if (output === null || output === undefined) return "";
  try {
    return JSON.stringify(output, null, 2);
  } catch {
    return String(output);
  }
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

function truncateForContext(value: unknown, maxChars: number): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return truncate(value, maxChars);
  let json: string;
  try {
    json = JSON.stringify(value);
  } catch {
    return "[unserializable]";
  }
  if (json.length <= maxChars) return value;
  return `${json.slice(0, maxChars - 16)}…[truncated]`;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Heuristic: does this reply look like a tool call we failed to parse,
 * rather than a plain answer? Catches the explicit `tool_code` fence, a
 * python-ish `print(call())`, and any known tool name immediately invoked
 * (`fetch_url(`). Used to avoid printing raw call scaffolding as the
 * user-facing answer when parsing came up empty.
 */
function looksLikeUnparsedToolCall(
  reply: string,
  tools: readonly AgentTool[],
): boolean {
  if (/```tool_code/i.test(reply)) return true;
  if (/\bprint\s*\(\s*\w/.test(reply)) return true;
  return tools.some((t) =>
    new RegExp(`(^|[^\\w.])${escapeRegExp(t.name)}\\s*\\(`).test(reply),
  );
}

// ─── URL safety net (parity with createAgent.ts) ──────────────────────────

const NOTE_NOT_FETCHED =
  "> ⚠ This page was not fetched, so the response below has no page content to rely on.\n\n";
const NOTE_FETCH_FAILED =
  "> ⚠ Browser access to this page failed (often CORS). The response below has no page content to rely on.\n\n";

/**
 * Whether a fetch-tool call actually retrieved the page. A CORS / network
 * failure does NOT throw - `fetch_url` returns `{ status: 0, error }` - so
 * "no record-level error" is not enough; we must inspect the output. A
 * fetch counts as succeeded only when it didn't throw, reported no
 * `error` field, and came back with a 2xx status.
 */
function fetchDidSucceed(r: AgentToolCallRecord): boolean {
  if (r.error) return false;
  const out = r.output as { status?: number; error?: string } | undefined;
  if (!out || out.error) return false;
  if (
    typeof out.status === "number" &&
    (out.status < 200 || out.status >= 300)
  ) {
    return false;
  }
  return true;
}

/** First tool whose input schema declares a `url` property. */
function findUrlFetchingTool(
  tools: readonly AgentTool[],
): AgentTool | undefined {
  return tools.find((t) => {
    const props = (t.inputSchema?.properties ?? {}) as Record<string, unknown>;
    return Object.hasOwn(props, "url");
  });
}

function collectSuccessfulFetchUrls(
  turns: readonly Pick<AgentTurn, "steps">[],
  fetchTool: AgentTool | undefined,
): string[] {
  if (!fetchTool) return [];
  const urls: string[] = [];
  for (const turn of turns) {
    for (const step of turn.steps) {
      for (const record of step.toolCalls) {
        const url = (record.input as { url?: unknown }).url;
        if (
          record.name === fetchTool.name &&
          typeof url === "string" &&
          fetchDidSucceed(record)
        ) {
          urls.push(normUrl(url));
        }
      }
    }
  }
  return Array.from(new Set(urls));
}

/**
 * Prepend an honest disclaimer when a URL was given, a fetch tool was
 * available, but no fetch SUCCEEDED - never-attempted vs attempted-and-
 * failed get different wording. Deterministic; zero extra inference.
 */
function maybeFlagUnverifiedUrl(
  finalText: string,
  ctx: {
    hasFetchTool: boolean;
    totalUrls: number;
    /** User URLs that never fetched successfully. */
    unfetched: readonly string[];
    /** Whether any fetch was attempted at all (for single-URL wording). */
    anyTried: boolean;
  },
): string {
  if (!ctx.hasFetchTool || ctx.totalUrls === 0 || ctx.unfetched.length === 0) {
    return finalText;
  }
  if (!finalText.trim()) return finalText;

  // Single URL keeps the original two-way wording (never-fetched vs
  // attempted-and-failed). Multiple URLs name the specific ones that
  // didn't come back, so the user knows which parts to distrust.
  let note: string;
  if (ctx.totalUrls === 1) {
    note = ctx.anyTried ? NOTE_FETCH_FAILED : NOTE_NOT_FETCHED;
  } else {
    const list = ctx.unfetched.join(", ");
    note =
      `> ⚠ Browser access failed for ${ctx.unfetched.length} of ${ctx.totalUrls} URLs ` +
      `(often CORS): ${list}. The response below has no content from ` +
      `${ctx.unfetched.length === 1 ? "that page" : "those pages"}.\n\n`;
  }
  return `${note}${finalText}`;
}

/**
 * The reasoning the model wrote BEFORE its `tool_code` block, if any -
 * used as a synthesized `thought`. Returns "" when the reply opens
 * straight into the call (the common case) or has no fence.
 */
function leadingProse(reply: string, tools: readonly AgentTool[]): string {
  const end = proseStreamLimit(reply);
  if (end <= 0) return "";
  const beforeFence = reply.slice(0, end);
  const callStart = firstToolCallStart(beforeFence, tools);
  const prose = beforeFence
    .slice(0, callStart ?? beforeFence.length)
    .replace(/(?:^|\s)tool_code\s*$/i, "")
    .replace(/(?:^|\s)print\s*\(\s*$/i, "")
    .trim();
  // Guard against a stray short token; only treat a real sentence as a
  // thought, and keep it bounded so a runaway preface can't flood the UI.
  if (prose.length < 4) return "";
  return prose.length > 600 ? `${prose.slice(0, 599)}…` : prose;
}

/** Keep an incomplete native call out of the prose stream until it resolves. */
function couldStillBeToolCall(
  text: string,
  tools: readonly AgentTool[],
): boolean {
  const normalized = text.trimStart().toLocaleLowerCase();
  const withoutMarker = normalized.replace(/^tool_code\b\s*/i, "");
  if (withoutMarker !== normalized) {
    if (!withoutMarker) return true;
    return couldStillBeToolCall(withoutMarker, tools);
  }

  const prefixes = [
    "tool_code",
    "print",
    "default_api",
    ...tools.map((tool) => tool.name),
  ];
  if (prefixes.some((prefix) => prefix.startsWith(normalized))) return true;

  const callHead = normalized.match(
    /^(?:print\s*\(\s*)?(?:[a-z_]\w*\.)?([a-z_]\w*)\s*\(/i,
  );
  return Boolean(
    callHead?.[1] && tools.some((tool) => tool.name === callHead[1]),
  );
}

function firstToolCallStart(
  text: string,
  tools: readonly AgentTool[],
): number | undefined {
  let first: number | undefined;
  for (const tool of tools) {
    const pattern = new RegExp(
      `(^|[^\\w.])(?:[A-Za-z_]\\w*\\.)?${escapeRegExp(tool.name)}\\s*\\(`,
    );
    const match = pattern.exec(text);
    if (!match) continue;
    const start = match.index + (match[1]?.length ?? 0);
    first = first === undefined ? start : Math.min(first, start);
  }
  return first;
}

function makeAbortError(): Error {
  const e = new Error("aborted");
  e.name = "AbortError";
  return e;
}

function isAbort(err: unknown): boolean {
  return (err as Error)?.name === "AbortError";
}

function composeSignals(
  primary: AbortSignal,
  external: AbortSignal | undefined,
): AbortSignal {
  if (!external) return primary;
  if (primary.aborted || external.aborted) {
    const c = new AbortController();
    c.abort();
    return c.signal;
  }
  const c = new AbortController();
  const onAbort = () => c.abort();
  primary.addEventListener("abort", onAbort, { once: true });
  external.addEventListener("abort", onAbort, { once: true });
  return c.signal;
}

function makeUnavailableAgent(tools: readonly AgentTool[]): Agent {
  const text =
    "The on-device model isn't available yet. Confirm the Prompt API model is downloaded in a supported Chrome build, then reload the playground.";
  const failure: AgentFailure = {
    name: "PromptUnavailableError",
    message: "Prompt API is unavailable in this environment.",
  };
  const fallback: AgentRunResult = {
    text,
    steps: [],
    stopReason: "unavailable",
    failure,
  };
  return {
    get tools() {
      return tools;
    },
    async run() {
      return fallback;
    },
    runStreaming() {
      return streamFromResult(fallback, {
        type: "done",
        reason: "unavailable",
        text,
        failure,
      });
    },
    abort() {},
    newSession() {},
    destroy() {},
  };
}

function describeRunFailure(error: unknown): {
  reason: AgentStopReason;
  text: string;
  failure?: AgentFailure;
} {
  if (error instanceof PromptAbortError || isAbort(error)) {
    return { reason: "aborted", text: "" };
  }

  const failure = toAgentFailure(error);
  if (failure.name === "QuotaExceededError") {
    return {
      reason: "context_overflow",
      text: "This conversation filled the model's context window. Start a new conversation or shorten the request, then try again.",
      failure,
    };
  }
  if (error instanceof AgentStalledError) {
    return { reason: "stalled", text: error.message, failure };
  }
  if (error instanceof PromptUnavailableError) {
    return {
      reason: "unavailable",
      text: "The on-device model couldn't start this response. Confirm the Prompt API model is downloaded, then try again or reload the playground.",
      failure,
    };
  }

  return {
    reason: "model_error",
    text: "The on-device model stopped before producing an answer. Try again; if it repeats, reload the playground.",
    failure,
  };
}

function toAgentFailure(error: unknown): AgentFailure {
  if (error instanceof Error) {
    return {
      name: error.name || "Error",
      message: error.message || "No technical detail was provided.",
    };
  }
  return {
    name: "Error",
    message: String(error ?? "No technical detail was provided."),
  };
}
