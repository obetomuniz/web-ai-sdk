---
title: "@web-ai-sdk/prompt"
description: "web-ai-sdk building block for the Web's Built-in Prompt API (LanguageModel). Single-shot prompts with system message, sampling controls, streaming, session reuse, and pluggable result caching."
editUrl: https://github.com/obetomuniz/web-ai-sdk/edit/main/packages/prompt/README.md
---

:::note
This page is generated from [`packages/prompt/README.md`](https://github.com/obetomuniz/web-ai-sdk/blob/main/packages/prompt/README.md) on every build. Edits should go to the README.
:::
web-ai-sdk building block for the Web's Built-in [Prompt API](https://developer.chrome.com/docs/extensions/ai/prompt-api) (`LanguageModel`). Single-shot prompts with system message, sampling controls, streaming, session reuse, and pluggable result caching.

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

`ask()` shares a warm `LanguageModel` instance across same-shape callers so the cold start is paid once per persona. That's right for embeds, widgets, ask-and-display flows. It's the wrong shape for chat: two callers with the same mode would share one instance, so conversation history cross-bleeds and `abort()` on one caller kills the other.

## React

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

State machine: `idle | loading | streaming | done | unavailable`. `ask(input)` triggers a request, cancels any in-flight one, and updates `output` as chunks stream. `abort()` cancels the current request; `reset()` clears state.

## API

### `ask(options): Promise<AskResult>`

```ts
interface AskOptions {
  input: string;
  systemPrompt?: string;
  samplingMode?: "most-predictable" | "predictable" | "balanced" | "creative" | "most-creative";
  temperature?: number;
  topK?: number;
  language?: string;                        // BCP-47 hint, folded into expectedInputs/Outputs
  supportedLanguages?: readonly string[];   // default ["en"]
  expectedInputs?: LanguageModelExpectedInput[];   // advanced passthrough
  expectedOutputs?: LanguageModelExpectedOutput[]; // advanced passthrough
  tools?: LanguageModelTool[];              // experimental: native function-calling passthrough
  monitor?: (m: CreateMonitor) => void;
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

### `isAvailable(): boolean`

Feature-detect helper.

### `checkAvailability(opts?): Promise<LanguageModelAvailability | null>`

Forwards to `LanguageModel.availability()`. Returns `null` if the global is missing or the call throws.

### Lower-level helpers (advanced)

`getLanguageModelApi`, `getOrCreateLanguageModel`, `defaultCacheKey`; exported so you can compose your own pipeline (e.g. share one cached session across multiple call sites, or roll your own retry).

## Caching

Two layers, same as `@web-ai-sdk/summarizer`:

- **Session cache** (internal, in-memory, always on): a `Map<stringifiedCreateOptions, LanguageModel>` so consecutive calls with the same shape (system prompt, sampling mode or raw sampling params, language hints) reuse the warm session. Cold-start ≈ 1-3s; warm calls are sub-second.
- **Result cache** (opt-in): pass a `cache` (anything matching `{ get, set }`) to memoize final responses by `(prompt, systemPrompt, samplingMode / temperature / topK)`. Omit it for a fresh model call every time.

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

`AbortSignal` is supported on both surfaces. Aborting mid-stream resolves cleanly; the result cache is not written for aborted runs.

## License

MIT © Beto Muniz
