---
title: "@web-ai-sdk/prompt"
description: "web-ai-sdk building block for the Web's Built-in Prompt API (LanguageModel). One-shot ask() for embeds and widgets, plus a thin createSession() primitive (and React useSession) for chat-shaped apps that need independent per-conversation sessions and delta-shaped streaming. The wrapper smooths cross-browser quirks (delta-vs-cumulative chunks, output sanitization, abort wiring); UI state and conversation history are the consumer's concern."
editUrl: https://github.com/obetomuniz/web-ai-sdk/edit/main/packages/prompt/README.md
---

:::note
This page is synced from [`packages/prompt/README.md`](https://github.com/obetomuniz/web-ai-sdk/blob/main/packages/prompt/README.md) by `pnpm --filter @web-ai-sdk-apps/site docs:sync`. Edits should go to the README.
:::

web-ai-sdk building block for the Web's Built-in [Prompt API](https://developer.chrome.com/docs/extensions/ai/prompt-api) (`LanguageModel`). One-shot `ask()` for embeds and widgets, plus a thin `createSession()` primitive (and React `useSession`) for chat-shaped apps that need independent per-conversation sessions and delta-shaped streaming. The wrapper smooths cross-browser quirks (delta-vs-cumulative chunks, output sanitization, abort wiring); UI state and conversation history are the consumer's concern.


## Status

Prompt API ships stable in Chrome 148+ — no flag required. Chrome 138–147 still works with `chrome://flags/#prompt-api-for-gemini-nano` enabled. On Edge it remains a developer preview in Canary/Dev 138+ behind `edge://flags/#prompt-api-for-phi-mini`, with Phi-4-mini's stricter safety pipeline often refusing output (see [Browser support](https://web-ai-sdk.dev/browser-support)). On any other browser this library is a no-op for the React hook (it stays in `"unavailable"`). The vanilla `ask()` throws `PromptUnavailableError` so callers can branch explicitly.

## Install

```sh
pnpm add @web-ai-sdk/prompt
# or: npm i @web-ai-sdk/prompt / bun add @web-ai-sdk/prompt
```

The React adapter ships as a subpath export, with no extra install. `react` is a peer dependency only when you import the `/react` entry.

## Vanilla TypeScript / DOM

### One-shot — `ask()`

```ts
import { ask } from "@web-ai-sdk/prompt";

const result = await ask({
  input: "Summarize this in one sentence: WebMCP lets web pages expose tools to agents.",
  systemPrompt: "You are concise. Reply with a single sentence.",
  samplingMode: "predictable",
  onUpdate: (text) => console.log("partial", text), // cumulative buffer
});

console.log(result.output, result.cached);
```

`ask()` is isolated per call: it may keep a warm base `LanguageModel` for same-shape calls, but each prompt runs on a fresh clone when the browser supports `clone()`, or on a fresh one-shot instance otherwise. That's right for embeds, widgets, and ask-and-display flows. For chat-shaped apps where turns need to remember each other, use `createSession()`.

### Chat — `createSession()`

```ts
import { createSession } from "@web-ai-sdk/prompt";

const session = createSession({
  systemPrompt: "You are a helpful assistant.",
  samplingMode: "balanced",
});

// Streaming, yields DELTA chunks (not cumulative buffers):
for await (const delta of session.sendStreaming("Tell me about WebMCP.")) {
  process.stdout.write(delta);
}

// Or one-shot per turn:
const text = await session.send("And what about the Prompt API?");

// Tear down explicitly when the conversation ends.
session.destroy();
```

Every `createSession()` call returns an independent `LanguageModelInstance` with its own history, system prompt, sampling, and lifecycle — `abort()` / `destroy()` on one session never touch another. Concurrent `send` / `sendStreaming` calls on the **same** session are NOT queued — the underlying `LanguageModel` is sequential per instance and will reject the overlapping call with `InvalidStateError`. Either `await` the previous send or call `session.abort()` before issuing a new turn. Multi-turn conversation context is tracked by the native instance itself; UI message lists are your data model.

Calling `createSession()` starts `LanguageModel.create()` immediately. The first `send`, `sendStreaming`, or `clone` only awaits that already-started creation, so creating a base session as soon as the user's intent is clear is a valid prewarming primitive. The synchronous `Session` wrapper is returned before native creation necessarily resolves; see [Context-window introspection](#context-window-introspection) for the resulting getter-readiness distinction.

**Concurrency note.** Each session is an independent `LanguageModel` instance: independent history, system prompt, sampling, and lifecycle. The underlying on-device model is single-instance, so the browser currently schedules `sendStreaming` calls across sessions FIFO. Overlapping sends do not interleave token-by-token in Chrome 148 / Edge 138 — the second send waits for the first to drain. This is a constraint of the runtime, not of the API; code written against `createSession()` becomes faster automatically if a future release exposes parallel inference.

## React

### One-shot — `usePrompt`

```tsx
import { usePrompt } from "@web-ai-sdk/prompt/react";

export function AskBox() {
  const { status, output, error, ask, abort } = usePrompt({
    systemPrompt: "You are a helpful assistant. Be concise.",
    samplingMode: "balanced",
  });

  if (status === "unavailable") return null;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const input = new FormData(e.currentTarget).get("q") as string;
        if (input) ask(input);
      }}
    >
      <input name="q" placeholder="Ask me anything" />
      <button type="submit" disabled={status === "loading" || status === "streaming"}>
        {status === "streaming" ? "Streaming…" : "Ask"}
      </button>
      {output && <p>{output}</p>}
      {error && <small>{error.message}</small>}
    </form>
  );
}
```

State machine: `idle | loading | streaming | done | unavailable`. `ask(input)` triggers a request, cancels any in-flight one, and updates `output` as chunks stream.

### Chat — `useSession`

```tsx
import { useSession } from "@web-ai-sdk/prompt/react";
import { useState } from "react";

export function Chat({ persona }: { persona: string }) {
  const { status, session } = useSession({ systemPrompt: persona });
  const [response, setResponse] = useState("");

  if (status === "unavailable" || !session) return null;

  const send = async (text: string) => {
    setResponse("");
    let buffer = "";
    for await (const delta of session.sendStreaming(text)) {
      buffer += delta;
      setResponse(buffer);
    }
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); send("Hello"); }}>
      <button type="submit">Send</button>
      <button type="button" onClick={() => session.abort()}>Stop</button>
      <p>{response}</p>
    </form>
  );
}
```

`useSession` is lifecycle-only: it starts in `"loading"` while the native `LanguageModel.create()` call is in flight, moves to `"ready"` when `session` is usable, destroys the session on unmount, and recreates it when any primitive option changes. It deliberately does **not** track `response` / `history` / streaming status — that's your UI state, you own it. Each `useSession()` call owns its own underlying `LanguageModelInstance`, so component state and `abort()` / `destroy()` stay scoped to the owning component. Token-level interleaving across sessions is browser-defined (see the Concurrency note above) — Chrome 148 / Edge 138 currently drain through one underlying model FIFO.

## API

### `ask(options): Promise<AskResult>`

```ts
interface AskOptions {
  input: string;
  systemPrompt?: string;
  samplingMode?: "most-predictable" | "predictable" | "balanced" | "creative" | "most-creative";
  /** @deprecated Web page contexts are moving to samplingMode. */
  temperature?: number;
  /** @deprecated Web page contexts are moving to samplingMode. */
  topK?: number;
  language?: string;                        // BCP-47 hint, folded into expectedInputs/Outputs
  supportedLanguages?: readonly string[];   // default ["en"]
  expectedInputs?: LanguageModelExpectedInput[];   // advanced passthrough
  expectedOutputs?: LanguageModelExpectedOutput[]; // advanced passthrough
  tools?: LanguageModelTool[];              // experimental: native function-calling passthrough
  monitor?: (m: CreateMonitor) => void;     // observe first-call model download
  responseConstraint?: object;              // JSON Schema for structured output
  omitResponseConstraintInput?: boolean;
  cache?: ResponseCache;
  cacheKey?: string;
  onUpdate?: (text: string) => void;        // CUMULATIVE buffer
  signal?: AbortSignal;
}

interface AskResult {
  output: string | null;
  cached: boolean;
}
```

`onUpdate` receives the cumulative text so far, not deltas. For delta-shaped streaming use `createSession().sendStreaming()`.

### `createSession(options?): Session`

```ts
interface CreateSessionOptions {
  systemPrompt?: string;
  samplingMode?: "most-predictable" | "predictable" | "balanced" | "creative" | "most-creative";
  /** @deprecated Web page contexts are moving to samplingMode. */
  temperature?: number;
  /** @deprecated Web page contexts are moving to samplingMode. */
  topK?: number;
  language?: string;
  supportedLanguages?: readonly string[];
  expectedInputs?: LanguageModelExpectedInput[];
  expectedOutputs?: LanguageModelExpectedOutput[];
  tools?: LanguageModelTool[]; // experimental: native function-calling passthrough
  monitor?: (m: CreateMonitor) => void;     // observe first-call model download; wins over createOptions.monitor
  // Pass `initialPrompts` here to seed multi-turn context.
  createOptions?: Partial<LanguageModelCreateOptions>;
}

interface SessionSendOptions {
  signal?: AbortSignal;
  responseConstraint?: object;        // JSON Schema for structured output
  omitResponseConstraintInput?: boolean; // drop the inlined schema to save tokens
}

interface Session {
  readonly destroyed: boolean;
  readonly contextWindow?: number; // context window in tokens; undefined until eager creation resolves
  readonly contextUsage?: number;  // tokens used so far; undefined until eager creation resolves
  send(input: string | LanguageModelMessage[], options?: SessionSendOptions): Promise<string | null>;
  sendStreaming(input: string | LanguageModelMessage[], options?: SessionSendOptions): AsyncIterable<string>;
  abort(): void;
  clone(options?: { signal?: AbortSignal }): Promise<Session>;
  append(messages: LanguageModelMessage[], options?: { signal?: AbortSignal }): Promise<void>; // context without a turn
  onContextOverflow(listener: () => void): () => void; // returns an idempotent cleanup
  destroy(): void;
}
```

`createOptions` is merged last for advanced native control. If both `systemPrompt` and `createOptions.initialPrompts` are provided, `createOptions.initialPrompts` remains authoritative and the SDK emits a clear `console.warn` once per loaded module instance. Use one instruction surface: `systemPrompt` for the shorthand, or `initialPrompts` when restoring richer context.

`Session.sendStreaming()` yields **deltas** (each chunk is the new text since the last yield, never cumulative). The wrapper does no extra bookkeeping: no history tracking, no concurrent-send queue, no usage telemetry. Always destroy sessions you no longer need.

`omitResponseConstraintInput` is only forwarded when `responseConstraint` is also set; the native API throws a `TypeError` otherwise. When you omit the schema, include format guidance in the prompt text itself (the model no longer sees the schema).

### Native tool calling (experimental)

The Prompt API spec defines native function calling: register `tools` on the session and the runtime invokes their `execute` on the model's behalf, feeding results back. `ask()` and `createSession()` forward a `tools` array straight through to `LanguageModel.create()`:

```ts
import { createSession, type LanguageModelTool } from "@web-ai-sdk/prompt";

const tools: LanguageModelTool[] = [
  {
    name: "fetch_url",
    description: "Fetch a URL and return its text.",
    inputSchema: {
      type: "object",
      properties: { url: { type: "string" } },
      required: ["url"],
    },
    async execute(args) {
      const { url } = args as { url: string };
      return await (await fetch(url)).text();
    },
  },
];

const session = createSession({ systemPrompt, tools });
```

This is **pass-through only**: the SDK forwards `tools` and never calls `execute` itself. Whether the model actually invokes a tool depends on the browser. Native execution is **not** wired on current stable Chrome — the option is accepted but is a silent no-op, and the model may surface its tool call as plain text (a `tool_code` block) that your code must parse. The passthrough begins working automatically on browsers that ship native execution; until then, `responseConstraint` remains the robust default. The heuristic `tool_code` parser and the tool-execution loop are deliberately left in the consumer layer.

`tools` works on `ask()` too (`ask({ input, tools })`), with one caveat: `ask()` may keep warm base sessions through an LRU keyed by `JSON.stringify(createOptions)`, and `JSON.stringify` drops functions — so a tool's `execute` doesn't contribute to the key, only its `name` / `description` / `inputSchema` do. Each `ask()` prompt still runs on a clone or fresh one-shot instance. It's harmless today (the SDK never runs `execute`), but it matters once native execution lands, so prefer `createSession()` for tool-bearing sessions — it bypasses the cache and matches the base-session + per-run-`clone()` pattern.

To declare the native tool modalities, pass them through the advanced `expectedInputs` / `expectedOutputs` fields (`{ type: "tool-response" }` / `{ type: "tool-call" }`).

### Session resilience: base + per-task `clone()`

For agents and multi-task flows, reusing one long-lived session lets history accumulate (later runs "echo" earlier ones, and you eventually hit `QuotaExceededError`), while recreating a session per task pays the cold start and can hit Chrome's single-instance degradation. The spec's [recommended pattern](https://developer.chrome.com/docs/ai/session-management) is to keep one warm **base** session (system prompt only) and `clone()` it per task: the clone inherits the system prompt and history without re-parsing or another `create()`, then gets independent history and lifecycle.

```ts
// As soon as the workflow is chosen, begin native creation with final instructions.
const base = createSession({ systemPrompt }); // eager prewarm; keep this base
// per task / run:
const turn = await base.clone();              // awaits base readiness, then fresh history
try {
  for await (const delta of turn.sendStreaming(input)) render(delta);
} finally {
  turn.destroy();                             // free the clone, keep base
}
```

`clone()` throws `SessionDestroyedError` if the base is destroyed and `PromptUnavailableError` if the browser instance doesn't support cloning. Destroying a clone never affects the base, and vice versa.

### Injecting context without a turn — `Session.append()`

Agent loops often need to push tool results or other context into conversation history **without** triggering a model turn. Faking this with an extra `send()` wastes tokens and latency on an empty intermediate response. `Session.append()` forwards to the native `LanguageModel.append()`: the messages land in history, and the next `send` / `sendStreaming` sees them as prior turns.

```ts
const session = createSession({ systemPrompt });
await session.send("What's the weather in Tokyo?");
// The model asked to call a tool; run it yourself, then inject the result:
await session.append([
  { role: "assistant", content: "I'll check the weather." },
  { role: "user", content: "tool result: 24°C, clear" },
]);
// The next turn sees the tool result as history — no wasted intermediate turn.
const plan = await session.send("Based on that, suggest an outfit.");
```

`append()` throws `SessionDestroyedError` if the session is destroyed and `PromptUnavailableError` if the browser instance doesn't support `append()`. Aborts reject with `PromptAbortError`.

### Prefill and message arrays

`Session.send` / `sendStreaming` accept either a single string turn or a full `LanguageModelMessage[]`. Passing an array lets you supply multi-message context, control roles per turn, and, most usefully, **prefill** the assistant's reply: set `prefix: true` on the trailing `assistant` message and the model treats its `content` as the start of its own answer rather than a turn to respond to.

```ts
const session = createSession({ systemPrompt });

// Multi-message turn: full conversation context, roles per message.
const reply = await session.send([
  { role: "user", content: "What is RAG?" },
  { role: "assistant", content: "Retrieval-Augmented Generation." },
  { role: "user", content: "Give me the three-step recipe." },
]);

// Prefill: bias the model toward JSON without a full schema.
const json = await session.send([
  { role: "user", content: "Describe a cat in one word of JSON." },
  { role: "assistant", content: '{"thought":"', prefix: true },
]);
// model completes: feline"}  ->  you parse {"thought":"feline"}
```

**Prefill vs `responseConstraint`**: both shape output, different trade-offs:

- **Prefill** (`prefix: true`): cheaper per turn (no schema inlined into context), weaker guarantee; the model may drift off the prefixed format. Good for cheap nudges and structured-output hints that you parse defensively.
- **`responseConstraint`**: enforced JSON Schema (the runtime validates against it), higher per-turn token cost when the schema is large. Use `omitResponseConstraintInput: true` to drop the inlined schema and keep only the enforced constraint.

They compose: prefill the opening brace, set `responseConstraint` for the full shape.

**Spec rule:** `prefix: true` is only valid on the **trailing** `assistant` message. Anywhere else (a non-final message, a non-assistant role) the browser throws a `"SyntaxError"` `DOMException`. The SDK does **not** catch this, so it propagates to your `send` / `sendStreaming` caller.

> **Note on `content`:** `LanguageModelMessage.content` is currently `string` only. Multimodal `ContentPart[]` content (images, audio) is tracked as a future enhancement; no timeline is promised.

### Context-window introspection

`Session` surfaces the live token budget the native instance reports, so consumers can size work to the actual context window instead of hardcoding a char cap. Calling `createSession()` starts native creation eagerly, but the wrapper returns synchronously: both getters remain `undefined` while that creation promise is in flight. The first `send` awaits the already-started creation; alternatively, read the getters on a session from `clone()`, whose instance is live the moment `clone()` resolves. In React, `useSession` does not report `"ready"` until the same native creation has resolved.

- `session.contextWindow` — max input tokens for the session (the context window).
- `session.contextUsage` — input tokens used so far. On a fresh base-clone this reflects the inherited history (≈ the system prompt), the right baseline to budget a turn against.

These mirror the Prompt API's `contextWindow` / `contextUsage` (the renamed successors of `inputQuota` / `inputUsage`); the wrapper reads the new names and falls back to the deprecated ones on older Chrome builds.

```ts
const base = createSession({ systemPrompt }); // native creation starts here
const turn = await base.clone();               // awaits readiness; clone is live here
const quota = turn.contextWindow;              // e.g. 4096 / 6144 tokens
const used = turn.contextUsage ?? 0;           // ≈ system prompt
if (quota) {
  const available = quota - used - ANSWER_RESERVE_TOKENS;
  const budgetChars = Math.max(0, available) * 4; // ~4 chars/token
  // truncate fetched content to budgetChars so it fits in one turn
}
// Fall back to a fixed char cap when contextWindow is undefined
// (older browsers / pre-creation).
```

`session.onContextOverflow(listener)` subscribes to the native `contextoverflow` event, which fires when a turn pushes usage past the window and the oldest history is dropped. Use it to compact or fork a fresh `clone()` before hitting `QuotaExceededError`. It returns an idempotent cleanup function, and is a no-op (returns a no-op cleanup) when the instance doesn't expose the event.

```ts
const stop = session.onContextOverflow(() => {
  // compact, summarize, or start a fresh clone before QuotaExceededError
});
// later
stop();
```

### `useSession(options?): UseSessionReturn`

```ts
interface UseSessionReturn {
  status: "loading" | "ready" | "unavailable";
  error: Error | null;
  session: Session | null; // null until status === "ready"
}
```

Lifecycle-only: feature detection + create + destroy on unmount + recreate when any primitive option (`systemPrompt`, `samplingMode`, `temperature`, `topK`, `language`) changes. Object options (`expectedInputs`, `createOptions`) participate by reference; memoize them or accept the recreate cost. UI state is your concern — iterate `session.sendStreaming()` and accumulate text into your own component state.

### `isAvailable(): boolean`

Feature-detect helper.

### `checkAvailability(opts?): Promise<LanguageModelAvailability | null>`

Forwards to `LanguageModel.availability()`. Returns `null` if the global is missing or the call throws.

## Caching

Two layers, same as `@web-ai-sdk/summarizer`:

- **Session cache** (internal, in-memory, on by default for `ask()` only): a bounded LRU of warm base `LanguageModel` instances keyed by stringified create-options. Cold-start ≈ 1-3s; when `clone()` is supported, warm calls can skip re-parsing the same base instructions while still prompting on an isolated clone. `createSession()` bypasses this cache entirely.
- **Result cache** (opt-in): pass a `cache` (anything matching `{ get, set }`) to memoize final responses by `(input, systemPrompt, samplingMode / temperature / topK)`. Omit it for a fresh model call every time.

```ts
// Off by default; every call hits the model.
ask({ input: "hi" });

// Opt in for sessionStorage-backed caching.
ask({ input: "hi", cache: "session" });

// Or persistent localStorage-backed caching.
ask({ input: "hi", cache: "local" });

// Or roll your own.
ask({ input: "hi", cache: myMap, cacheKey: "greeting" });
```

## Errors and unavailability

The vanilla `ask()` throws `PromptUnavailableError` when the API is missing or reports `availability: "unavailable"`. The React hook absorbs this and returns `status: "unavailable"` instead.

`createSession()` starts native creation immediately and returns a `Session` wrapper synchronously. If the underlying `create()` rejects, the error surfaces when the first `send`, `sendStreaming`, or `clone` awaits that already-started work. In React, `useSession()` waits for native creation before reporting `"ready"` and reports `"unavailable"` with `error` if creation fails.

`AbortSignal` is supported on every surface. Aborting mid-stream resolves cleanly; the result cache is not written for aborted runs. Aborts reject with `PromptAbortError` (exported; `instanceof PromptAbortError` works, and its `name` is `"AbortError"`), thrown by both `ask()` and sessions.

## License

MIT © Beto Muniz
