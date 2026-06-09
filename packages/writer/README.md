# @web-ai-sdk/writer

web-ai-sdk building block for the Web's Built-in [Writer API](https://developer.chrome.com/docs/ai/writer-api). Generates new content from a writing task with session reuse, streaming, and opt-in result caching.

**Docs:** <https://web-ai-sdk.dev/docs/guides/writer/> · **React:** [`useWriter`](https://web-ai-sdk.dev/docs/react/use-writer/)

## Status

The Writer API is in a developer trial (origin trial) in Chrome 137 to 148, behind `chrome://flags/#writer-api-for-gemini-nano` on localhost (`chrome://flags/#optimization-guide-on-device-model` must also be enabled). In Edge it's a developer preview in Canary/Dev 138+ behind "Writer API for Phi mini". On any other browser this library is a no-op for the React hook (it stays in `"unavailable"`). The vanilla `write()` throws `WriterUnavailableError` so callers can branch explicitly.

## Install

```sh
pnpm add @web-ai-sdk/writer
# or: npm i @web-ai-sdk/writer / bun add @web-ai-sdk/writer
```

The React adapter ships as a subpath export, with no extra install. `react` is a peer dependency only when you import the `/react` entry.

## Vanilla TypeScript / DOM

```ts
import { write } from "@web-ai-sdk/writer";

const result = await write({
  input: "An inquiry to my bank about how to enable wire transfers.",
  context: "I'm a longstanding customer.",
  tone: "formal",
  length: "medium",
  onUpdate: (text) => console.log("partial", text),
});

console.log(result.output, result.cached);
```

`result.output` is the generated text (trimmed), or `null` when the input is empty. `result.cached` tells you whether the response came from the cache without invoking the model.

## React

```tsx
import { useWriter } from "@web-ai-sdk/writer/react";

export function Draft({ task }: { task: string }) {
  const { status, output } = useWriter({ input: task, tone: "casual" });

  if (status === "unavailable") return null;
  if (status === "loading") return <p>Drafting…</p>;
  return <article>{output}</article>;
}
```

State machine: `idle | loading | streaming | done | unavailable`. `output` is the latest text (grows during streaming). `fromCache` is `true` when the result came back without invoking the model.

## API

### `write(options): Promise<WriteResult>`

```ts
interface WriteOptions {
  input: string;                  // the writing task / prompt
  context?: string;               // per-call background info
  language?: string;              // BCP-47; drives input/output hints when supported
  supportedLanguages?: readonly string[]; // default ["en", "es", "ja"]
  tone?: "formal" | "neutral" | "casual";  // default "neutral"
  format?: "markdown" | "plain-text";       // default "markdown"
  length?: "short" | "medium" | "long";     // default "short"
  sharedContext?: string;
  monitor?: (m: CreateMonitor) => void;
  cache?: "session" | "local" | { get, set };
  cacheKey?: string;
  onUpdate?: (text: string) => void; // cumulative buffer, not deltas
  signal?: AbortSignal;
}

interface WriteResult {
  output: string | null;
  cached: boolean;
}
```

### `isAvailable(): boolean`

Feature-detect helper.

### `checkAvailability(options?): Promise<WriterAvailability | null>`

Forwards to the spec's `availability()` call. Returns `null` if the global is missing or the call throws.

### Cache controls

```ts
import {
  clearWriterSessions,    // drop every cached writer session
  clearWriterSession,     // drop one cached session by create-options
  configureWriterCache,   // change the LRU cap (default 8)
} from "@web-ai-sdk/writer";
```

The internal session cache is LRU-bounded (default 8). Evicted sessions have their `destroy()` invoked when present.

## Output normalization

The wrapper trims leading/trailing whitespace only, so internal markdown formatting and line breaks the model produces stay intact. Anything beyond that is the consumer's concern.

## Language support beyond en/es/ja

The Writer accepts `expectedInputLanguages` / `expectedContextLanguages` / `outputLanguage` for `["en", "es", "ja"]` by default. Pass any other `language` and the library omits those hints; steer output via `sharedContext` instead, or pass your own `supportedLanguages` when more land.

## License

MIT © Beto Muniz
