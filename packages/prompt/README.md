# @web-ai-sdk/prompt

Building block for the Web's Built-in [Prompt API](https://developer.chrome.com/docs/extensions/ai/prompt-api) (`LanguageModel`). One-shot `ask()` for embeds and widgets, plus a thin `createSession()` primitive (and React `useSession`) for chat-shaped apps that need independent per-conversation sessions and delta-shaped streaming. The wrapper smooths cross-browser quirks (delta-vs-cumulative chunks, output sanitization, abort wiring); UI state and conversation history are the consumer's concern.

## Status

Prompt API ships in Chrome 138+ (behind `chrome://flags/#prompt-api-for-gemini-nano`) and Edge 138+ (behind `edge://flags/#prompt-api-for-phi-mini`). On any other browser this library is a no-op for the React hook (it stays in `"unavailable"`). The vanilla `ask()` throws `PromptUnavailableError` so callers can branch explicitly.

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
  temperature: 0.2,
  onUpdate: (text) => console.log("partial", text), // cumulative buffer
});

console.log(result.response, result.cached);
```

`ask()` shares a warm `LanguageModel` instance across same-shape callers so the cold start is paid once per persona. That's right for embeds, widgets, ask-and-display flows. It's the wrong shape for chat: two callers with the same mode would share one instance, so conversation history cross-bleeds and `abort()` on one caller kills the other.

### Chat — `createSession()`

```ts
import { createSession } from "@web-ai-sdk/prompt";

const session = createSession({
  systemPrompt: "You are a helpful assistant.",
  temperature: 0.7,
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

**Concurrency note.** Each session is an independent `LanguageModel` instance: independent history, system prompt, sampling, and lifecycle. The underlying on-device model is single-instance, so the browser currently schedules `sendStreaming` calls across sessions FIFO. Overlapping sends do not interleave token-by-token in Chrome 138 / Edge 138 — the second send waits for the first to drain. This is a constraint of the runtime, not of the API; code written against `createSession()` becomes faster automatically if a future release exposes parallel inference.

## React

### One-shot — `usePrompt`

```tsx
import { usePrompt } from "@web-ai-sdk/prompt/react";

export function AskBox() {
  const { status, response, error, ask, abort } = usePrompt({
    systemPrompt: "You are a helpful assistant. Be concise.",
    temperature: 0.7,
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
      {response && <p>{response}</p>}
      {error && <small>{error.message}</small>}
    </form>
  );
}
```

State machine: `idle | loading | streaming | done | unavailable`. `ask(input)` triggers a request, cancels any in-flight one, and updates `response` as chunks stream.

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

`useSession` is lifecycle-only: it creates the session on mount, destroys it on unmount, and recreates it when any primitive option changes. It deliberately does **not** track `response` / `history` / streaming status — that's your UI state, you own it. Each `useSession()` call owns its own underlying `LanguageModelInstance`, so component state and `abort()` / `destroy()` stay scoped to the owning component. Token-level interleaving across sessions is browser-defined (see the Concurrency note above) — N mounted components in Chrome 138 / Edge 138 still drain through one underlying model FIFO.

## API

### `ask(options): Promise<AskResult>`

```ts
interface AskOptions {
  input: string;
  systemPrompt?: string;
  temperature?: number;
  topK?: number;
  language?: string;                        // BCP-47 hint, folded into expectedInputs/Outputs
  supportedLanguages?: readonly string[];   // default ["en"]
  expectedInputs?: LanguageModelExpectedInput[];   // advanced passthrough
  expectedOutputs?: LanguageModelExpectedOutput[]; // advanced passthrough
  createOptions?: Partial<LanguageModelCreateOptions>;
  responseConstraint?: object;              // JSON Schema for structured output
  cache?: ResponseCache;
  cacheKey?: string;
  onUpdate?: (text: string) => void;        // CUMULATIVE buffer
  signal?: AbortSignal;
}

interface AskResult {
  response: string | null;
  cached: boolean;
}
```

`onUpdate` receives the cumulative text so far, not deltas. For delta-shaped streaming use `createSession().sendStreaming()`.

If `systemPrompt` is passed alongside `createOptions.initialPrompts`, the SDK emits a one-shot `console.warn` because `initialPrompts` overrides the synthesized system prompt and the persona is silently lost.

### `createSession(options?): Session`

```ts
interface CreateSessionOptions {
  systemPrompt?: string;
  temperature?: number;
  topK?: number;
  language?: string;
  supportedLanguages?: readonly string[];
  expectedInputs?: LanguageModelExpectedInput[];
  expectedOutputs?: LanguageModelExpectedOutput[];
  // Pass `initialPrompts` here to seed multi-turn context.
  createOptions?: Partial<LanguageModelCreateOptions>;
}

interface Session {
  readonly destroyed: boolean;
  send(input: string, options?: SessionSendOptions): Promise<string | null>;
  sendStreaming(input: string, options?: SessionSendOptions): AsyncIterable<string>;
  abort(): void;
  destroy(): void;
}
```

`Session.sendStreaming()` yields **deltas** (each chunk is the new text since the last yield, never cumulative). The wrapper does no extra bookkeeping: no history tracking, no concurrent-send queue, no usage telemetry. Always destroy sessions you no longer need.

### `useSession(options?): UseSessionReturn`

```ts
interface UseSessionReturn {
  status: "loading" | "ready" | "unavailable";
  error: Error | null;
  session: Session | null; // null until status === "ready"
}
```

Lifecycle-only: feature detection + create + destroy on unmount + recreate when any primitive option (`systemPrompt`, `temperature`, `topK`, `language`) changes. Object options (`expectedInputs`, `createOptions`) participate by reference; memoize them or accept the recreate cost. UI state is your concern — iterate `session.sendStreaming()` and accumulate text into your own component state.

### `isPromptAvailable(): boolean`

Feature-detect helper.

### `checkAvailability(opts?): Promise<LanguageModelAvailability | null>`

Forwards to `LanguageModel.availability()`. Returns `null` if the global is missing or the call throws.

### `createSessionStorageCache({ storage?, prefix? }): ResponseCache`

Optional cache backend. Pass it to `ask({ cache })` to enable response caching, with an optional custom `storage` (e.g. `localStorage`, an in-memory polyfill).

### Cache controls

```ts
import {
  clearSessions,        // drop every cached one-shot session
  clearSession,         // drop one cached session by create-options
  configurePromptCache, // change the LRU cap (default 8)
} from "@web-ai-sdk/prompt";
```

The internal session cache is LRU-bounded (default 8) and only memoizes sessions created by `ask()`; `createSession()` is never cached.

### Lower-level helpers (advanced)

`getLanguageModelApi`, `getOrCreateLanguageModel`, `defaultCacheKey`; exported so you can compose your own pipeline.

## Caching

Two layers, same as `@web-ai-sdk/summarizer`:

- **Session cache** (internal, in-memory, on by default for `ask()` only): a bounded LRU of `LanguageModel` instances keyed by stringified create-options. Cold-start ≈ 1-3s; warm calls are sub-second. `createSession()` bypasses this cache entirely.
- **Result cache** (opt-in): pass a `cache` (anything matching `{ get, set }`) to memoize final responses by `(input, systemPrompt, temperature, topK)`. Omit it for a fresh model call every time.

```ts
// Off by default; every call hits the model.
ask({ input: "hi" });

// Opt in for sessionStorage-backed caching.
ask({ input: "hi", cache: createSessionStorageCache() });

// Or roll your own.
ask({ input: "hi", cache: myMap, cacheKey: "greeting" });
```

## Errors and unavailability

The vanilla `ask()` throws `PromptUnavailableError` when the API is missing or reports `availability: "unavailable"`. The React hook absorbs this and returns `status: "unavailable"` instead.

`createSession()` returns a `Session` synchronously even if the underlying `create()` rejects; the error surfaces on the first `send` / `sendStreaming`.

`AbortSignal` is supported on every surface. Aborting mid-stream resolves cleanly; the result cache is not written for aborted runs.

## License

MIT © Beto Muniz
