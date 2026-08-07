---
title: "@web-ai-sdk/summarizer"
description: "This package wraps the Web's Built-in Summarizer API. It provides session reuse, output cleanup, streaming, and optional result caching."
editUrl: https://github.com/obetomuniz/web-ai-sdk/edit/main/packages/summarizer/README.md
---

:::note
This page is synced from [`packages/summarizer/README.md`](https://github.com/obetomuniz/web-ai-sdk/blob/main/packages/summarizer/README.md) by `pnpm --filter @web-ai-sdk-apps/site docs:sync`. Edits should go to the README.
:::

This package wraps the Web's Built-in [Summarizer API](https://developer.chrome.com/docs/ai/summarizer-api). It provides session reuse, output cleanup, streaming, and optional result caching.


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
  cacheTtl?: number;      // built-in shortcut TTL in ms; default 1 hour
  cacheRefresh?: boolean; // skip the cache read, write the fresh result
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

### Prepare and release

`prepareSummarizer(options)` starts native session creation when user intent is clear, before the input exists. It returns a `SummarizerLease`: `{ ready: Promise<void>; release(): void }`.

```ts
import { prepareSummarizer, summarize } from "@web-ai-sdk/summarizer";

// User hovers the "Summarize" button: warm the session now.
const summarizerModel = prepareSummarizer({ language: "en", type: "key-points" });

// The matching call reuses the prepared session; no second create.
const result = await summarize({
  input: articleText,
  language: "en",
  type: "key-points",
});

// User dismisses the feature: let the session go.
summarizerModel.release();
```

- `prepareSummarizer` never throws synchronously. Unavailability and creation failure reject `ready` with `SummarizerUnavailableError`.
- `release()` is idempotent. The final release destroys the session once no other lease or in-flight call uses it.
- Releasing before creation settles destroys the session after creation succeeds.
- Failed creation evicts the entry, so a later prepare retries.
- Sessions with active leases never evict from the LRU cache.

Reuse requires the same session-affecting options as the `summarize` call. For this package those are `language`, `supportedLanguages`, `type`, `length`, `format`, `preference`, and `sharedContext` (`PrepareSummarizerOptions`). `monitor` observes creation only and never affects reuse.

### Session cache controls

`configureSummarizerCache({ max })` bounds the internal warm `Summarizer` session cache (default `8`). `clearSummarizerSessions()` drops every warm session, and `clearSummarizerSession(createOptions)` drops one matching configuration. Clearing detaches sessions pinned by a lease or an in-flight call and destroys them when the last pin drops.

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

### Expiry and refresh

The built-in `"session"` / `"local"` shortcuts store each entry in a versioned envelope with an expiry time. Entries expire after one hour (`DEFAULT_CACHE_TTL_MS`) by default. Pass `cacheTtl` (milliseconds) to override the TTL per call. Expired entries, legacy raw strings, and malformed envelopes count as misses and are removed.

Pass `cacheRefresh: true` to force a fresh inference. The call skips the cache read, runs the model, and replaces the cached value after a successful run. Failed, aborted, or empty runs leave the cached value in place.

Custom `{ get, set }` caches own their expiry policy. `cacheTtl` does not apply to them; `cacheRefresh` still bypasses their read and updates them after success.

```ts
// Cache for five minutes instead of one hour.
summarize({ language: "en", input: text, cache: "local", cacheTtl: 5 * 60 * 1000 });

// Force a fresh inference; later calls reuse the new value.
summarize({ language: "en", input: text, cache: "local", cacheRefresh: true });
```

The internal session cache (warm `Summarizer` instances) is separate and always on, so same-config calls skip the ~1-3s cold start within a tab. Bound or clear it via the Session cache controls above.

## Output normalization

The wrapper strips wrapping quotes / whitespace and collapses internal whitespace on every result regardless of `type`. Anything beyond that — e.g. trimming the trailing period from a `type: "headline"` result — is the consumer's concern; apply your own post-process after the call returns.

## Language support

By default, the wrapper emits `expectedInputLanguages` / `outputLanguage` hints only for `["en", "es", "ja"]`. For other languages it omits those hints and you can steer output via `sharedContext` instead. Pass `supportedLanguages` explicitly when your target browser documents a broader set.

## License

MIT © Beto Muniz
