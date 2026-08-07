---
title: "@web-ai-sdk/prompt"
description: "This package wraps the Web's Built-in Prompt API (LanguageModel). Use ask() for one-shot prompts. Use createSession() or React useSession() for conversations and delta streams."
editUrl: https://github.com/obetomuniz/web-ai-sdk/edit/main/packages/prompt/README.md
---

:::note
This page is synced from [`packages/prompt/README.md`](https://github.com/obetomuniz/web-ai-sdk/blob/main/packages/prompt/README.md) by `pnpm --filter @web-ai-sdk-apps/site docs:sync`. Edits should go to the README.
:::

This package wraps the Web's Built-in [Prompt API](https://developer.chrome.com/docs/ai/prompt-api) (`LanguageModel`). Use `ask()` for one-shot prompts. Use `createSession()` or React `useSession()` for conversations and delta streams.

The package normalizes stream chunks, removes selected control characters, and wires abort signals. Application code owns UI state and message history.


## Status

Prompt API is [stable in Chrome 148+](https://developer.chrome.com/docs/ai/prompt-api). It does not require a flag.

Chrome 148+ also documents multimodal sessions with text, image, and audio expected inputs. Audio input requires a GPU. See [Multimodal input](#multimodal-input-text-image-audio).

Edge provides a [Canary/Dev preview](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/prompt-api) from 138.0.3309.2. Enable "Prompt API for on-device language model." Edge uses Phi-4-mini by default on High-class devices.

Canary/Dev 150.0.4070+ can use prerelease Aion-1.0-Instruct on Medium/Low devices. This path requires the "Enable prerelease on-device language model" flag.

See [Browser support](https://web-ai-sdk.dev/docs/browser-support/) for the full matrix. Without `LanguageModel`, React reports `"unavailable"` and `ask()` throws `PromptUnavailableError`.

## Install

```sh
pnpm add @web-ai-sdk/prompt
# or: npm i @web-ai-sdk/prompt / bun add @web-ai-sdk/prompt
```

The React adapter uses the `/react` subpath. `react` is an optional peer dependency.

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

Each `createSession()` call returns an independent `LanguageModelInstance`. It has its own history, system prompt, sampling, and lifecycle.

Calls on the same session are not queued. An overlapping `send()` or `sendStreaming()` call fails with `InvalidStateError`. Await the current call or call `session.abort()` first.

The native instance tracks conversation context. Your application owns the UI message list.

`createSession()` starts `LanguageModel.create()` immediately. Create a base session when the workflow becomes known to start preparation early.

The synchronous `Session` wrapper can return before native creation finishes. The first `send()`, `sendStreaming()`, or `clone()` waits for it. See [Context-window introspection](#context-window-introspection) for getter readiness.

**Concurrency note.** Each session has independent history, system prompts, sampling, and lifecycle. Scheduling across different native sessions is browser-defined, so do not depend on token-level interleaving or a particular parallelism policy.

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

`useSession` manages lifecycle only. It reports `"loading"` during native creation and `"ready"` when the session is usable. It destroys the session on unmount and recreates it when a primitive option changes.

The hook does not track responses, history, or streaming status. Keep that state in your component. Each hook call owns one native instance. Scheduling across instances is browser-defined.

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

### Treat model output as untrusted

The Prompt wrapper removes selected non-printing control characters from model responses. This is control-character cleanup, **not** HTML or Markdown sanitization. Treat every final response and streaming update as untrusted.

React interpolation (`<p>{output}</p>`) and DOM `textContent` are appropriate for plain text. If you convert model Markdown or HTML into rendered HTML, keep raw HTML disabled and sanitize the complete accumulated buffer before DOM insertion. Do not sanitize and concatenate individual deltas: a malicious construct can be split across stream updates.

If `systemPrompt` is passed alongside `createOptions.initialPrompts`, the SDK emits a one-shot `console.warn` because `initialPrompts` overrides the synthesized system prompt and the persona is silently lost.

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

The SDK only forwards `tools`; it does not call `execute`. Native tool execution depends on the browser. Treat it as experimental and provide a fallback.

Your application must parse tool-like model output and run any manual execution loop.

`tools` also works with `ask({ input, tools })`. Its base-session cache key uses `JSON.stringify(createOptions)`, which excludes functions. A tool's `execute` function does not affect the key; its metadata does.

Each `ask()` call still uses a clone or fresh instance. Prefer `createSession()` for tool-based sessions because it bypasses this cache.

To declare the native tool modalities, pass them through the advanced `expectedInputs` / `expectedOutputs` fields (`{ type: "tool-response" }` / `{ type: "tool-call" }`).

### Session resilience: base + per-task `clone()`

Do not reuse one session across unrelated tasks. Its history will continue to grow. Creating a new session for every task repeats setup work.

Chrome's [session-management guidance](https://developer.chrome.com/docs/ai/session-management) recommends a warm base session with only the system prompt. Call `clone()` for each task. Each clone inherits the prompt but has independent history and lifecycle.

```ts
// As soon as the workflow is chosen, begin native creation with final instructions.
const base = createSession({ systemPrompt }); // eager prewarm; keep this base
const outputElement = document.querySelector<HTMLElement>("#output");
// per task / run:
const turn = await base.clone();              // awaits base readiness, then fresh history
let response = "";
try {
  for await (const delta of turn.sendStreaming(input)) {
    response += delta;
    if (outputElement) outputElement.textContent = response;
  }
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
// The model completes the prefix with `feline"`; parse the JSON as {"thought":"feline"}.
```

**Prefill vs `responseConstraint`**: both shape output, different trade-offs:

- **Prefill** (`prefix: true`): cheaper per turn (no schema inlined into context), weaker guarantee; the model may drift off the prefixed format. Good for cheap nudges and structured-output hints that you parse defensively.
- **`responseConstraint`**: enforced JSON Schema (the runtime validates against it), higher per-turn token cost when the schema is large. Use `omitResponseConstraintInput: true` to drop the inlined schema and keep only the enforced constraint.

They compose: prefill the opening brace, set `responseConstraint` for the full shape.

**Spec rule:** `prefix: true` is valid only on the final `assistant` message. Other uses cause a `"SyntaxError"` `DOMException`. The SDK passes this error to the caller.

`LanguageModelMessage.content` also accepts an array of multimodal content parts. See [Multimodal input](#multimodal-input-text-image-audio).

### Multimodal input (text, image, audio)

`LanguageModelMessage.content` accepts a plain string or an ordered array of content parts:

```ts
type LanguageModelMessageContent =
  | { type: "text"; value: string }
  | { type: "image"; value: ImageBitmapSource | BufferSource }
  | { type: "audio"; value: AudioBuffer | Blob | BufferSource };

interface LanguageModelMessage {
  role: "system" | "user" | "assistant";
  content: string | LanguageModelMessageContent[];
  prefix?: boolean;
}
```

Image parts accept browser-native image values: `Blob`, `ImageData`, `ImageBitmap`, `VideoFrame`, `OffscreenCanvas`, canvas / image / video elements, and `BufferSource`. Audio parts accept `AudioBuffer`, `Blob`, and `BufferSource`.

Declare non-text modalities at creation with `expectedInputs`. Probe support first with `checkAvailability()` and pass the same `expectedInputs` and `expectedOutputs` you will use for creation:

```ts
import { checkAvailability, createSession } from "@web-ai-sdk/prompt";

const expectedInputs = [
  { type: "text" as const },
  { type: "image" as const },
  { type: "audio" as const },
];

const availability = await checkAvailability({ expectedInputs });
if (availability === null || availability === "unavailable") {
  // The browser cannot serve these modalities; fall back.
}

const session = createSession({ expectedInputs });

const description = await session.send([
  {
    role: "user",
    content: [
      { type: "text", value: "Describe this image." },
      { type: "image", value: imageBlob },
    ],
  },
]);
```

Content parts work everywhere messages flow: `initialPrompts` (through `createOptions.initialPrompts`), `send()`, `sendStreaming()`, and `append()`.

The SDK forwards media values losslessly to the browser. It never serializes, clones, transcodes, inspects, or reorders them.

A media-only message is never treated as empty. Empty strings, empty message arrays, and messages with only blank text parts still resolve to `null` without a model call.

Chrome requires a GPU for audio input. The browser throws a `"NotSupportedError"` `DOMException` for undeclared or unsupported modalities. The SDK passes that error through unchanged; it does not convert it into `PromptUnavailableError`.

On browsers without multimodal support, `checkAvailability({ expectedInputs })` reports `"unavailable"` (or `null` without the API). Session creation then fails, and the first `send()` surfaces the error.

`ask()` stays text-only: `AskOptions.input` is a `string`, and its result cache keys assume text. Use `createSession()` for multimodal prompts; it owns an explicit session lifecycle and bypasses the one-shot result cache.

### Context-window introspection

`Session` exposes the token budget reported by the native instance. Use it to size input for the current context window.

Both getters are `undefined` until native creation finishes. The first `send()` waits for creation. A resolved `clone()` is ready immediately. In React, `useSession` reports `"ready"` after creation finishes.

- `session.contextWindow` — max input tokens for the session (the context window).
- `session.contextUsage` — input tokens used so far. On a fresh base-clone this reflects the inherited history (≈ the system prompt), the right baseline to budget a turn against.

These mirror the Prompt API's `contextWindow` / `contextUsage`; the wrapper also reads the deprecated `inputQuota` / `inputUsage` names for compatibility.

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

`session.onContextOverflow(listener)` subscribes to the native `contextoverflow` event. The event fires when a turn exceeds the window and drops the oldest history.

Use it to compact history or create a fresh clone before `QuotaExceededError`. It returns an idempotent cleanup function. Unsupported instances return a no-op cleanup.

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

The hook detects support, creates a session, and destroys it on unmount. It recreates the session when a primitive option changes.

Object options participate by reference. Memoize them to avoid recreation. Store streamed output and other UI state in your component.

### `isAvailable(): boolean`

Feature-detect helper.

### `checkAvailability(opts?): Promise<LanguageModelAvailability | null>`

Forwards to `LanguageModel.availability()`. Returns `null` if the global is missing or the call throws.

## Caching

Two layers, same as `@web-ai-sdk/summarizer`:

- **Session cache** (internal, in-memory, on for `ask()`): a bounded LRU of base instances keyed by serialized creation options. When supported, each call uses an isolated clone. `createSession()` bypasses this cache.
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

`createSession()` starts native creation and returns a `Session` wrapper immediately. If creation fails, the first `send()`, `sendStreaming()`, or `clone()` reports the error.

In React, `useSession()` waits for creation before reporting `"ready"`. It reports `"unavailable"` and stores the error when creation fails.

Every API accepts `AbortSignal`. An aborted run does not write to the result cache. Both `ask()` and sessions reject with the exported `PromptAbortError`. Its `name` is `"AbortError"`.

## License

MIT © Beto Muniz
