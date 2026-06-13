---
title: "@web-ai-sdk/proofreader"
description: "web-ai-sdk building block for the Web's Built-in Proofreader API. Corrects grammar, spelling, and punctuation and returns per-issue corrections with offsets, plus session reuse and opt-in result caching."
editUrl: https://github.com/obetomuniz/web-ai-sdk/edit/main/packages/proofreader/README.md
---

:::note
This page is synced from [`packages/proofreader/README.md`](https://github.com/obetomuniz/web-ai-sdk/blob/main/packages/proofreader/README.md) by `pnpm --filter @web-ai-sdk-apps/site docs:sync`. Edits should go to the README.
:::

web-ai-sdk building block for the Web's Built-in [Proofreader API](https://developer.chrome.com/docs/ai/proofreader-api). Corrects grammar, spelling, and punctuation and returns per-issue corrections with offsets, plus session reuse and opt-in result caching.


## Status

The Proofreader API is in an origin trial in Chrome 141 to 145, behind `chrome://flags/#proofreader-api-for-gemini-nano` on localhost (`chrome://flags/#optimization-guide-on-device-model` must also be enabled). In Edge it's a developer preview in Canary/Dev 142+ behind "Proofreader API for Phi mini". On any other browser this library is a no-op for the React hook (it stays in `"unavailable"`). The vanilla `proofread()` throws `ProofreaderUnavailableError` so callers can branch explicitly.

The API is **English-only** today. `expectedInputLanguages` accepts an array, but a request for an unsupported language causes the underlying `create()` to reject (surfaced here as `ProofreaderUnavailableError`); pass `["en"]` or omit it.

## Install

```sh
pnpm add @web-ai-sdk/proofreader
# or: npm i @web-ai-sdk/proofreader / bun add @web-ai-sdk/proofreader
```

The React adapter ships as a subpath export, with no extra install. `react` is a peer dependency only when you import the `/react` entry.

## Vanilla TypeScript / DOM

```ts
import { proofread } from "@web-ai-sdk/proofreader";

const result = await proofread({
  input: "I seen him yesterday at the store, and he bought two loafs of bread.",
  expectedInputLanguages: ["en"],
});

console.log(result.output?.correctedInput);
for (const c of result.output?.corrections ?? []) {
  console.log(c.startIndex, c.endIndex, "→", c.correction);
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
  signal?: AbortSignal;
}

interface ProofreadCorrection {
  startIndex: number;     // inclusive offset into the original input
  endIndex: number;       // exclusive offset into the original input
  correction: string;     // suggested replacement
  type?: string;          // not emitted by Chrome's current build
  explanation?: string;   // not emitted by Chrome's current build
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
