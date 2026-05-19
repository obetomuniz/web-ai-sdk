# @web-ai-sdk/summarizer

Building block for the Web's Built-in [Summarizer API](https://developer.chrome.com/docs/ai/summarizer-api). Skeleton extraction, sentence-boundary trimming, streaming, and sessionStorage caching.

## Status

Summarizer API is in Chrome 138+ and Edge 138+ stable on desktop. On any other browser this library is a no-op for the React hook (it stays in `"unavailable"`). The vanilla `summarize()` throws `SummarizerUnavailableError` so callers can branch explicitly.

## Install

```sh
pnpm add @web-ai-sdk/summarizer
# or: npm i @web-ai-sdk/summarizer / bun add @web-ai-sdk/summarizer
```

The React adapter ships as a subpath export, with no extra install. `react` is a peer dependency only when you import the `/react` entry.

## How it works

1. **Build a skeleton**: title + description + every `h1-h4` and `<strong>`/`<b>` inside the article. That's the highest-signal content; for long posts it drops the input from thousands of chars to a few hundred and produces a tighter summary. Falls back to the trimmed body when the skeleton is too thin.
2. **Trim to a sentence boundary** so the model never sees a half-cut sentence (default cap: 3000 chars).
3. **Cache `Summarizer.create()` sessions** by JSON-stringified options. First post pays the ~1-3s cold start; later same-config calls reuse the warm session.
4. **Stream `summarizeStreaming()`** when the instance supports it, falling back to one-shot `summarize()`. Cleaned chunks are pushed to `onChunk` as they arrive.
5. **Optionally cache the final summary** when you pass a `cache` (e.g. `createSessionStorageCache()`). Off by default; opt in for revisits in the same tab to render instantly without invoking the model.

## Vanilla TypeScript / DOM

```ts
import { summarize } from "@web-ai-sdk/summarizer";

const result = await summarize({
  language: "en",
  article: document.querySelector("article")!,
  title: "My Post",
  description: "About interesting things",
  onChunk: (text) => console.log("partial", text),
});

console.log(result.summary, result.cached);
```

## React

```tsx
import { useSummarizer } from "@web-ai-sdk/summarizer/react";
import { useMemo } from "react";

export function PostSummary({ article }: { article: HTMLElement | null }) {
  const result = useSummarizer({
    language: "en",
    article: article ?? undefined,
    title: "My Post",
    description: "About interesting things",
  });

  if (result.status === "unavailable") return null;
  if (result.status === "loading") return <p>Generating summary…</p>;
  if (!result.summary) return null;

  return (
    <aside>
      <p>{result.summary}</p>
      <button type="button" onClick={result.dismiss}>Dismiss</button>
    </aside>
  );
}
```

State machine: `pending | loading | streaming | done | unavailable`. `summary` is the latest cleaned text (grows during streaming). `fromCache` is `true` when the result came back without invoking the model.

## API

### `summarize(options): Promise<SummarizeResult>`

Run a one-shot summarization.

```ts
interface SummarizeOptions {
  language: string;
  article?: Element; // skeleton extracted from this
  text?: string;     // or pass pre-built input directly
  title?: string;
  description?: string;
  supportedLanguages?: readonly string[]; // default ["en", "es", "ja"]
  sharedContext?: Record<string, string>; // per-language steering prompt
  createOptions?: Partial<SummarizerCreateOptions>;
  maxInputChars?: number;     // default 3000
  minSkeletonChars?: number;  // default 200
  cache?: SummaryCache;
  cacheKey?: string;
  onChunk?: (text: string) => void;
  signal?: AbortSignal;
}

interface SummarizeResult {
  summary: string | null;
  cached: boolean;
}
```

### `isSummarizerAvailable(): boolean`

Feature-detect helper.

### `checkAvailability(): Promise<SummarizerAvailability | null>`

Forwards to the spec's `availability()` call. Returns `null` if the global is missing or the call throws.

### `createSessionStorageCache({ storage?, prefix? }): SummaryCache`

Optional cache backend. Pass it to `summarize({ cache })` to enable result caching, with an optional custom `storage` (e.g. `localStorage`, an in-memory polyfill).

```ts
// Off by default; every call hits the model.
summarize({ language: "en", article });

// Opt in for sessionStorage-backed caching.
summarize({ language: "en", article, cache: createSessionStorageCache() });
```

### Lower-level helpers (advanced)

`buildSkeleton`, `trimToSentenceBoundary`, `cleanSummary`, `getOrCreateSummarizer`, `defaultCacheKey`, `getSummarizerApi`. Exported so you can compose your own pipeline (e.g. extract a skeleton without summarizing, or share one cached session across multiple call sites).

## Language support

The Web's Built-in Summarizer (Chrome 138+ and Edge 138+) accepts `expectedInputLanguages` / `outputLanguage` only for `["en", "es", "ja"]`. For other languages this library omits those hints and steers output via `sharedContext` instead. Pass your own `supportedLanguages` if Chrome adds more.

## License

MIT © Beto Muniz
