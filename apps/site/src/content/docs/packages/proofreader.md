---
title: "@web-ai-sdk/proofreader"
description: "This package wraps the Web's Built-in Proofreader API. It returns corrected text and an offset for each issue. It also provides session reuse and optional result caching."
editUrl: https://github.com/obetomuniz/web-ai-sdk/edit/main/packages/proofreader/README.md
---

:::note
This page is synced from [`packages/proofreader/README.md`](https://github.com/obetomuniz/web-ai-sdk/blob/main/packages/proofreader/README.md) by `pnpm --filter @web-ai-sdk-apps/site docs:sync`. Edits should go to the README.
:::

This package wraps the Web's Built-in [Proofreader API](https://developer.chrome.com/docs/ai/proofreader-api). It returns corrected text and an offset for each issue. It also provides session reuse and optional result caching.


## Status

Chrome labels Proofreader a **Developer trial** in its [status table](https://developer.chrome.com/docs/ai/built-in-apis). The public origin trial for Chrome 141–145 has ended. For localhost, enable `chrome://flags/#proofreader-api`.

Edge provides a [Canary/Dev preview](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/proofreader-api) from 142. Enable "Proofreader API for Phi mini." Edge requires a High device-performance class or greater.

Without `Proofreader`, React reports `"unavailable"` and `proofread()` throws `ProofreaderUnavailableError`.

## Install

```sh
pnpm add @web-ai-sdk/proofreader
# or: npm i @web-ai-sdk/proofreader / bun add @web-ai-sdk/proofreader
```

The React adapter uses the `/react` subpath. `react` is an optional peer dependency.

## Vanilla TypeScript / DOM

```ts
import { proofread } from "@web-ai-sdk/proofreader";

const result = await proofread({
  input: "I seen him yesterday at the store, and he bought two loafs of bread.",
  expectedInputLanguages: ["en"],
});

console.log(result.output?.correctedInput);
for (const c of result.output?.corrections ?? []) {
  console.log({
    startIndex: c.startIndex,
    endIndex: c.endIndex,
    correction: c.correction,
  });
}
```

`result.output` is `null` when the input is empty; otherwise `correctedInput` is the fully corrected text and `corrections` is the list of per-issue edits with offsets into the original input.

## React

```tsx
import { useProofreader } from "@web-ai-sdk/proofreader/react";

export function GrammarCheck({ text }: { text: string }) {
  const { status, output } = useProofreader({ input: text });

  if (status === "unavailable") return null;
  if (status === "loading") return <p>Checking…</p>;
  return <p>{output?.correctedInput}</p>;
}
```

State machine: `idle | loading | done | unavailable`. There is no streaming; `proofread()` resolves once. `fromCache` is `true` when the result came back without invoking the model.

## API

### `proofread(options): Promise<ProofreadResult>`

```ts
interface ProofreadOptions {
  input: string;
  expectedInputLanguages?: readonly string[];
  monitor?: (m: CreateMonitor) => void;
  cache?: "session" | "local" | { get, set };
  cacheKey?: string;
  cacheTtl?: number;      // built-in shortcut TTL in ms; default 1 hour
  cacheRefresh?: boolean; // skip the cache read, write the fresh result
  signal?: AbortSignal;
}

interface ProofreadCorrection {
  startIndex: number;     // inclusive offset into the original input
  endIndex: number;       // exclusive offset into the original input
  correction: string;     // suggested replacement
  type?: string;          // optional platform metadata
  explanation?: string;   // optional platform metadata
}

interface ProofreadOutput {
  correctedInput: string;
  corrections: ProofreadCorrection[];
}

interface ProofreadResult {
  output: ProofreadOutput | null;
  cached: boolean;
}
```

### `isAvailable(): boolean`

Feature-detect helper.

### `checkAvailability(options?): Promise<ProofreaderAvailability | null>`

Forwards to the spec's `availability()` call. Returns `null` if the global is missing or the call throws.

### `clearProofreaderSessions(): void`

Drop every cached proofreader session. Sessions live for the tab lifetime by default.

### Session cache controls

`configureProofreaderCache({ max })` bounds the internal warm `Proofreader` session cache (default `8`). `clearProofreaderSessions()` drops every warm session, and `clearProofreaderSession({ expectedInputLanguages })` drops one matching proofreader configuration.

## Result caching

Off by default; every call hits the model. Pass `cache: "session"` for `sessionStorage`, `cache: "local"` for `localStorage`, or any `{ get, set }`-shaped object for a custom backend. The cache stores the serialized `ProofreadOutput`.

### Expiry and refresh

The built-in `"session"` / `"local"` shortcuts store each entry in a versioned envelope with an expiry time. Entries expire after one hour (`DEFAULT_CACHE_TTL_MS`) by default. Pass `cacheTtl` (milliseconds) to override the TTL per call. Expired entries, legacy raw strings, and malformed envelopes count as misses and are removed.

Pass `cacheRefresh: true` to force a fresh inference. The call skips the cache read, runs the model, and replaces the cached value after a successful run. Failed and aborted runs leave the cached value in place.

Custom `{ get, set }` caches own their expiry policy. `cacheTtl` does not apply to them; `cacheRefresh` still bypasses their read and updates them after success.

```ts
// Cache for five minutes instead of one hour.
proofread({ input: text, cache: "local", cacheTtl: 5 * 60 * 1000 });

// Force a fresh inference; later calls reuse the new value.
proofread({ input: text, cache: "local", cacheRefresh: true });
```

## Rendering corrections

The `corrections` offsets index into the **original** input, so you can highlight each error in place by slicing between offsets:

```ts
let cursor = 0;
const spans: Array<{ text: string; error: boolean }> = [];
for (const c of output.corrections) {
  if (c.startIndex > cursor)
    spans.push({ text: input.slice(cursor, c.startIndex), error: false });
  spans.push({ text: input.slice(c.startIndex, c.endIndex), error: true });
  cursor = c.endIndex;
}
if (cursor < input.length)
  spans.push({ text: input.slice(cursor), error: false });
```

## License

MIT © Beto Muniz
