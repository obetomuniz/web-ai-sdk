---
title: "@web-ai-sdk/prompt"
description: "Building block for the Web's Built-in Prompt API (LanguageModel). Single-shot prompts with system message, sampling controls, streaming, session reuse, and pluggable result caching."
editUrl: https://github.com/obetomuniz/web-ai-sdk/edit/main/packages/prompt/README.md
---

:::note
This page is generated from [`packages/prompt/README.md`](https://github.com/obetomuniz/web-ai-sdk/blob/main/packages/prompt/README.md) on every build. Edits should go to the README.
:::
Building block for the Web's Built-in [Prompt API](https://developer.chrome.com/docs/extensions/ai/prompt-api) (`LanguageModel`). Single-shot prompts with system message, sampling controls, streaming, session reuse, and pluggable result caching.

## Status

Prompt API ships in Chrome 138+ (behind `chrome://flags/#prompt-api-for-gemini-nano`) and Edge 138+ (behind `edge://flags/#prompt-api-for-phi-mini`). On any other browser this library is a no-op for the React hook (it stays in `"unavailable"`). The vanilla `prompt()` throws `PromptUnavailableError` so callers can branch explicitly.

## Install

```sh
pnpm add @web-ai-sdk/prompt
# or: npm i @web-ai-sdk/prompt / bun add @web-ai-sdk/prompt
```

The React adapter ships as a subpath export, with no extra install. `react` is a peer dependency only when you import the `/react` entry.

## Vanilla TypeScript / DOM

```ts
import { prompt } from "@web-ai-sdk/prompt";

const result = await prompt({
  prompt: "Summarize this in one sentence: WebMCP lets web pages expose tools to agents.",
  systemPrompt: "You are concise. Reply with a single sentence.",
  temperature: 0.2,
  onChunk: (text) => console.log("partial", text),
});

console.log(result.response, result.cached);
```

## React

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

State machine: `idle | loading | streaming | done | unavailable`. `ask(input)` triggers a request, cancels any in-flight one, and updates `response` as chunks stream. `abort()` cancels the current request; `reset()` clears state.

## API

### `prompt(options): Promise<PromptResult>`

```ts
interface PromptOptions {
  prompt: string;
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
  onChunk?: (text: string) => void;
  signal?: AbortSignal;
}

interface PromptResult {
  response: string | null;
  cached: boolean;
}
```

### `isPromptAvailable(): boolean`

Feature-detect helper.

### `checkAvailability(opts?): Promise<LanguageModelAvailability | null>`

Forwards to `LanguageModel.availability()`. Returns `null` if the global is missing or the call throws.

### `createSessionStorageCache({ storage?, prefix? }): ResponseCache`

Optional cache backend. Pass it to `prompt({ cache })` to enable response caching, with an optional custom `storage` (e.g. `localStorage`, an in-memory polyfill).

### Lower-level helpers (advanced)

`getLanguageModelApi`, `getOrCreateLanguageModel`, `defaultCacheKey`; exported so you can compose your own pipeline (e.g. share one cached session across multiple call sites, or roll your own retry).

## Caching

Two layers, same as `@web-ai-sdk/summarizer`:

- **Session cache** (internal, in-memory, always on): a `Map<stringifiedCreateOptions, LanguageModel>` so consecutive calls with the same shape (system prompt, temperature, topK, language hints) reuse the warm session. Cold-start ≈ 1-3s; warm calls are sub-second.
- **Result cache** (opt-in): pass a `cache` (anything matching `{ get, set }`) to memoize final responses by `(prompt, systemPrompt, temperature, topK)`. Omit it for a fresh model call every time.

```ts
// Off by default; every call hits the model.
prompt({ prompt: "hi" });

// Opt in for sessionStorage-backed caching.
prompt({ prompt: "hi", cache: createSessionStorageCache() });

// Or roll your own.
prompt({ prompt: "hi", cache: myMap, cacheKey: "greeting" });
```

## Errors and unavailability

The vanilla `prompt()` throws `PromptUnavailableError` when the API is missing or reports `availability: "unavailable"`. The React hook absorbs this and returns `status: "unavailable"` instead.

`AbortSignal` is supported on both surfaces. Aborting mid-stream resolves cleanly; the result cache is not written for aborted runs.

## License

MIT © Beto Muniz
