# @web-ai-sdk/rewriter

This package wraps the Web's Built-in [Rewriter API](https://developer.chrome.com/docs/ai/rewriter-api). It changes the tone or length of text. It also provides session reuse, streaming, and optional result caching.

**Docs:** <https://web-ai-sdk.dev/docs/guides/rewriter/> · **React:** [`useRewriter`](https://web-ai-sdk.dev/docs/react/use-rewriter/) · **Production:** [Checklist](https://web-ai-sdk.dev/docs/production-checklist/)

## Status

Chrome labels Rewriter a **Developer trial** in its [status table](https://developer.chrome.com/docs/ai/built-in-apis). The public origin trial for Chrome 137–148 has ended. See the [Rewriter guide](https://developer.chrome.com/docs/ai/rewriter-api) for current localhost flags.

Edge provides a [Canary/Dev preview](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/writing-assistance-apis) from 138.0.3309.2. Enable "Rewriter API for on-device language model."

Without `Rewriter`, React reports `"unavailable"` and `rewrite()` throws `RewriterUnavailableError`.

## Install

```sh
pnpm add @web-ai-sdk/rewriter
# or: npm i @web-ai-sdk/rewriter / bun add @web-ai-sdk/rewriter
```

The React adapter uses the `/react` subpath. `react` is an optional peer dependency.

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
