# @web-ai-sdk/summarizer

This package wraps the Web's Built-in [Summarizer API](https://developer.chrome.com/docs/ai/summarizer-api). It provides session reuse, output cleanup, streaming, and optional result caching.

**Docs:** <https://web-ai-sdk.dev/docs/guides/summarizer/> · **React:** [`useSummarizer`](https://web-ai-sdk.dev/docs/react/use-summarizer/) · **Production:** [Checklist](https://web-ai-sdk.dev/docs/production-checklist/)

## Status

Summarizer is stable in Chrome 138+ and enabled by default in Edge 138+. See the [Chrome status table](https://developer.chrome.com/docs/ai/built-in-apis) and [Edge guide](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/writing-assistance-apis).

Without `Summarizer`, React reports `"unavailable"` and `summarize()` throws `SummarizerUnavailableError`.

## Install

```sh
pnpm add @web-ai-sdk/summarizer
# or: npm i @web-ai-sdk/summarizer / bun add @web-ai-sdk/summarizer
```

The React adapter uses the `/react` subpath. `react` is an optional peer dependency.

## Vanilla TypeScript / DOM

```ts
import { summarize } from "@web-ai-sdk/summarizer";

const result = await summarize({
  input: longArticleText,
  language: "en",
  type: "key-points",
  length: "short",
  onUpdate: (text) => console.log("partial", text),
});

console.log(result.output, result.cached);
```

`result.output` is the cleaned summary text, or `null` when the input is empty. `result.cached` tells you whether the response came from the cache without invoking the model.

## React

```tsx
import { useSummarizer } from "@web-ai-sdk/summarizer/react";

export function PostSummary({ text }: { text: string }) {
  const { status, output, dismiss } = useSummarizer({
    input: text,
    language: "en",
    type: "key-points",
  });

  if (status === "unavailable") return null;
  if (status === "loading") return <p>Generating summary…</p>;
  if (!output) return null;

  return (
    <aside>
      <p>{output}</p>
      <button type="button" onClick={dismiss}>Dismiss</button>
    </aside>
  );
}
```

State machine: `idle | loading | streaming | done | unavailable`. `output` is the latest cleaned text (grows during streaming). `fromCache` is `true` when the result came back without invoking the model.

## API

### `summarize(options): Promise<SummarizeResult>`

```ts
interface SummarizeOptions {
  input: string;
  language: string;
  supportedLanguages?: readonly string[]; // default ["en", "es", "ja"]
  type?: "tldr" | "key-points" | "teaser" | "headline"; // default "tldr"
  length?: "short" | "medium" | "long";                 // default "medium"
  format?: "plain-text" | "markdown";                   // default "plain-text"
  preference?: "auto" | "speed" | "capability";         // default "auto"
  sharedContext?: string;
  monitor?: (m: CreateMonitor) => void;
  cache?: "session" | "local" | { get, set };
  cacheKey?: string; // default: JSON.stringify([pathname, trimmed input, normalizedLanguage, languageHints, type, length, format, preference, sharedContext]); normalizedLanguage = language's lowercase primary subtag (pt-BR becomes pt), languageHints = boolean (normalized language is in supportedLanguages)
  onUpdate?: (text: string) => void;
  signal?: AbortSignal;
}

interface SummarizeResult {
  output: string | null;
  cached: boolean;
}
```

### `isAvailable(): boolean`

Feature-detect helper.

### `checkAvailability(options?): Promise<SummarizerAvailability | null>`

Forwards to the spec's `availability()` call. Returns `null` if the global is missing or the call throws.

## Performance preference

`preference` is a hint about the speed/quality tradeoff the browser makes when picking the underlying model:

- `"auto"` (default) balances speed and capability.
- `"speed"` prioritizes low latency, which can route to a smaller, faster model that produces less nuanced summaries.
- `"capability"` prioritizes comprehensiveness and coherence at the cost of latency.

It's a hint, not a guarantee: the browser may override `"speed"` and fall back to a more capable model when a functional requirement (e.g. the requested language) needs one.

## Result caching

Off by default; every call hits the model. Pass `cache: "session"` for `sessionStorage`, `cache: "local"` for `localStorage`, or any `{ get, set }`-shaped object for a custom backend.

```ts
// Off by default; every call hits the model.
summarize({ language: "en", input: text });

// Per-tab caching via sessionStorage.
summarize({ language: "en", input: text, cache: "session" });

// Persistent caching across tabs.
summarize({ language: "en", input: text, cache: "local" });
```

The internal session cache (warm `Summarizer` instances) is separate and always on, so same-config calls skip the ~1-3s cold start within a tab.

## Output normalization

The wrapper strips wrapping quotes / whitespace and collapses internal whitespace on every result regardless of `type`. Anything beyond that — e.g. trimming the trailing period from a `type: "headline"` result — is the consumer's concern; apply your own post-process after the call returns.

## Language support

By default, the wrapper emits `expectedInputLanguages` / `outputLanguage` hints only for `["en", "es", "ja"]`. For other languages it omits those hints and you can steer output via `sharedContext` instead. Pass `supportedLanguages` explicitly when your target browser documents a broader set.

## License

MIT © Beto Muniz
