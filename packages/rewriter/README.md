# @web-ai-sdk/rewriter

Building block for the Web's Built-in [Rewriter API](https://developer.chrome.com/docs/ai/rewriter-api). Revises and restructures existing text with tone / length adjustments, session reuse, streaming, and opt-in result caching.

**Docs:** <https://web-ai-sdk.dev/docs/guides/rewriter/> · **React:** [`useRewriter`](https://web-ai-sdk.dev/docs/react/use-rewriter/)

## Status

The Rewriter API is in a developer trial (origin trial) in Chrome 137 to 148. It shares the Writer's joint trial, so it's enabled via the same `chrome://flags/#writer-api-for-gemini-nano` flag on localhost (there is no separate Rewriter flag; `chrome://flags/#optimization-guide-on-device-model` must also be enabled). In Edge it's a developer preview in Canary/Dev 138+ behind "Rewriter API for Phi mini". On any other browser this library is a no-op for the React hook (it stays in `"unavailable"`). The vanilla `rewrite()` throws `RewriterUnavailableError` so callers can branch explicitly.

## Install

```sh
pnpm add @web-ai-sdk/rewriter
# or: npm i @web-ai-sdk/rewriter / bun add @web-ai-sdk/rewriter
```

The React adapter ships as a subpath export, with no extra install. `react` is a peer dependency only when you import the `/react` entry.

## Vanilla TypeScript / DOM

```ts
import { rewrite } from "@web-ai-sdk/rewriter";

const result = await rewrite({
  input: "hey, can u send me that doc when u get a sec? thx",
  tone: "more-formal",
  length: "as-is",
  onUpdate: (text) => console.log("partial", text),
});

console.log(result.output, result.cached);
```

`result.output` is the rewritten text (trimmed), or `null` when the input is empty.

## React

```tsx
import { useRewriter } from "@web-ai-sdk/rewriter/react";

export function Polish({ draft }: { draft: string }) {
  const { status, output } = useRewriter({ input: draft, tone: "more-formal" });

  if (status === "unavailable") return null;
  if (status === "loading") return <p>Rewriting…</p>;
  return <p>{output}</p>;
}
```

State machine: `idle | loading | streaming | done | unavailable`. `output` is the latest text (grows during streaming). `fromCache` is `true` when the result came back without invoking the model.

## API

### `rewrite(options): Promise<RewriteResult>`

```ts
interface RewriteOptions {
  input: string;                  // text to rewrite
  context?: string;               // per-call background info
  language?: string;              // BCP-47; drives input/output hints when supported
  supportedLanguages?: readonly string[]; // default ["en", "es", "ja"]
  tone?: "as-is" | "more-formal" | "more-casual";   // default "as-is"
  format?: "as-is" | "markdown" | "plain-text";     // default "as-is"
  length?: "as-is" | "shorter" | "longer";          // default "as-is"
  sharedContext?: string;
  monitor?: (m: CreateMonitor) => void;
  cache?: "session" | "local" | { get, set };
  cacheKey?: string;
  onUpdate?: (text: string) => void; // cumulative buffer, not deltas
  signal?: AbortSignal;
}

interface RewriteResult {
  output: string | null;
  cached: boolean;
}
```

### `isAvailable(): boolean`

Feature-detect helper.

### `checkAvailability(options?): Promise<RewriterAvailability | null>`

Forwards to the spec's `availability()` call. Returns `null` if the global is missing or the call throws.

### Cache controls

```ts
import {
  clearRewriterSessions,    // drop every cached rewriter session
  clearRewriterSession,     // drop one cached session by create-options
  configureRewriterCache,   // change the LRU cap (default 8)
} from "@web-ai-sdk/rewriter";
```

The internal session cache is LRU-bounded (default 8). Evicted sessions have their `destroy()` invoked when present.

## Output normalization

The wrapper trims leading/trailing whitespace only, so internal markdown formatting and line breaks the model produces stay intact.

## License

MIT © Beto Muniz
