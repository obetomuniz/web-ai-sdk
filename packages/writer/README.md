# @web-ai-sdk/writer

This package wraps the Web's Built-in [Writer API](https://developer.chrome.com/docs/ai/writer-api). It provides session reuse, streaming, and optional result caching.

**Docs:** <https://web-ai-sdk.dev/docs/guides/writer/> · **React:** [`useWriter`](https://web-ai-sdk.dev/docs/react/use-writer/) · **Production:** [Checklist](https://web-ai-sdk.dev/docs/production-checklist/)

## Status

Chrome labels Writer a **Developer trial** in its [status table](https://developer.chrome.com/docs/ai/built-in-apis). The public origin trial for Chrome 137–148 has ended. See the [Writer guide](https://developer.chrome.com/docs/ai/writer-api) for current localhost flags.

Edge provides a [Canary/Dev preview](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/writing-assistance-apis) from 138.0.3309.2. Enable "Writer API for on-device language model."

Without `Writer`, React reports `"unavailable"` and `write()` throws `WriterUnavailableError`.

## Install

```sh
pnpm add @web-ai-sdk/writer
# or: npm i @web-ai-sdk/writer / bun add @web-ai-sdk/writer
```

The React adapter uses the `/react` subpath. `react` is an optional peer dependency.

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
  cacheTtl?: number;      // built-in shortcut TTL in ms; default 1 hour
  cacheRefresh?: boolean; // skip the cache read, write the fresh result
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

The internal session cache is LRU-bounded (default 8). Evicted sessions have their `destroy()` invoked when present. Clearing detaches sessions pinned by a lease or an in-flight call and destroys them when the last pin drops.

### Prepare and release

`prepareWriter(options)` starts native session creation when user intent is clear, before the input exists. It returns a `WriterLease`:

```ts
interface WriterLease {
  ready: Promise<void>; // settles when native creation settles
  release(): void;      // idempotent
}
```

```ts
import { prepareWriter, write } from "@web-ai-sdk/writer";

// User opened the compose panel; warm the session now.
const writerModel = prepareWriter({ tone: "formal", length: "medium" });

// The matching call reuses the prepared session with no second create.
const result = await write({
  input: "An inquiry to my bank about how to enable wire transfers.",
  tone: "formal",
  length: "medium",
});

// User dismissed the panel.
writerModel.release();
```

- `prepareWriter` never throws synchronously. Unavailability and creation failure reject `ready` with `WriterUnavailableError`.
- `release()` is idempotent. The final release destroys the session once no other lease or in-flight call uses it.
- Releasing before creation settles destroys the session after creation succeeds.
- Failed creation evicts the entry, so a later prepare retries.
- Sessions with active leases never evict from the LRU cache.

Reuse requires the same session-affecting options as the `write` call. `PrepareWriterOptions` covers `language`, `supportedLanguages`, `tone`, `format`, `length`, and `sharedContext`. `monitor` observes creation only and never affects reuse.

## Result caching

Off by default; every call hits the model. Pass `cache: "session"` for `sessionStorage`, `cache: "local"` for `localStorage`, or any `{ get, set }`-shaped object for a custom backend.

### Expiry and refresh

The built-in `"session"` / `"local"` shortcuts store each entry in a versioned envelope with an expiry time. Entries expire after one hour (`DEFAULT_CACHE_TTL_MS`) by default. Pass `cacheTtl` (milliseconds) to override the TTL per call. Expired entries, legacy raw strings, and malformed envelopes count as misses and are removed.

Pass `cacheRefresh: true` to force a fresh inference. The call skips the cache read, runs the model, and replaces the cached value after a successful run. Failed, aborted, or empty runs leave the cached value in place.

Custom `{ get, set }` caches own their expiry policy. `cacheTtl` does not apply to them; `cacheRefresh` still bypasses their read and updates them after success.

```ts
// Cache for five minutes instead of one hour.
write({ input: task, cache: "local", cacheTtl: 5 * 60 * 1000 });

// Force a fresh inference; later calls reuse the new value.
write({ input: task, cache: "local", cacheRefresh: true });
```

## Output normalization

The wrapper trims leading/trailing whitespace only, so internal markdown formatting and line breaks the model produces stay intact. Anything beyond that is the consumer's concern.

## Language support beyond en/es/ja

The Writer accepts `expectedInputLanguages` / `expectedContextLanguages` / `outputLanguage` for `["en", "es", "ja"]` by default. Pass any other `language` and the library omits those hints; steer output via `sharedContext` instead, or pass your own `supportedLanguages` when more land.

## License

MIT © Beto Muniz
