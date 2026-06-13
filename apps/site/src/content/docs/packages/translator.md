---
title: "@web-ai-sdk/translator"
description: "web-ai-sdk building block for the Web's Built-in Translator API. String-mode translation with pair-cached sessions, opt-in result caching, and AbortSignal-driven cleanup."
editUrl: https://github.com/obetomuniz/web-ai-sdk/edit/main/packages/translator/README.md
---

:::note
This page is synced from [`packages/translator/README.md`](https://github.com/obetomuniz/web-ai-sdk/blob/main/packages/translator/README.md) by `pnpm --filter @web-ai-sdk-apps/site docs:sync`. Edits should go to the README.
:::

web-ai-sdk building block for the Web's Built-in [Translator API](https://developer.chrome.com/docs/ai/translator-api). String-mode translation with pair-cached sessions, opt-in result caching, and AbortSignal-driven cleanup.


## Status

Translator API is stable in Chrome 138+ and Edge 148+ on desktop, with no flag required (per the [Edge Translator API docs](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/translator-api)). On any other browser this library is a no-op for the React hook (it stays in `"unavailable"`). The vanilla `translate()` throws `TranslatorUnavailableError` so callers can branch explicitly.

## Install

```sh
pnpm add @web-ai-sdk/translator
# or: npm i @web-ai-sdk/translator / bun add @web-ai-sdk/translator
```

The React adapter ships as a subpath export, with no extra install. `react` is a peer dependency only when you import the `/react` entry.

## Vanilla TypeScript / DOM

```ts
import { translate } from "@web-ai-sdk/translator";

const result = await translate({
  input: "Hello, world.",
  sourceLanguage: "en",
  targetLanguage: "pt",
});

console.log(result.output); // -> "Olá, mundo."
console.log(result.cached); // -> false
```

`result.output` is the translated text, or `null` when the input is empty or when `sourceLanguage` and `targetLanguage` normalize to the same base language.

## React

```tsx
import { useTranslator } from "@web-ai-sdk/translator/react";

export function ReadInEnglish({
  text,
  sourceLanguage,
}: {
  text: string;
  sourceLanguage: string;
}) {
  const { status, output, error } = useTranslator({
    input: text,
    sourceLanguage,
    targetLanguage: "en",
  });

  if (status === "unavailable") return null;
  if (status === "loading") return <p>Translating...</p>;
  if (error) return <p>{error.message}</p>;
  return <p>{output}</p>;
}
```

State machine: `idle | loading | done | unavailable`. The hook auto-runs when `input` is non-empty and the language pair differs, and it re-runs whenever its options change.

## API

### `translate(options): Promise<TranslateResult>`

Translate a string from `sourceLanguage` to `targetLanguage`.

```ts
interface TranslateOptions {
  input: string;
  sourceLanguage: string;
  targetLanguage?: string; // default "en"
  monitor?: (m: TranslatorMonitor) => void;
  cache?: "session" | "local" | { get, set };
  cacheKey?: string;
  signal?: AbortSignal;
}

interface TranslateResult {
  output: string | null;
  cached: boolean;
}
```

### `isAvailable(): boolean`

Feature-detect helper.

### `checkAvailability({ sourceLanguage, targetLanguage }): Promise<TranslatorAvailability | null>`

Forwards to the spec's `availability()` call. Returns `null` if the global is missing or the call throws.

### Session cache controls

`configureTranslatorCache({ max })` bounds the internal warm `Translator` session cache (default `8`). `clearTranslatorSessions()` drops every warm session, and `clearTranslatorSession({ sourceLanguage, targetLanguage })` drops one matching language pair.

### Lower-level helpers (advanced)

`getTranslatorApi`, `getOrCreateTranslator`, and `defaultCacheKey` are exported so you can compose your own pipeline or cache policy.

## Caching

Two layers, same as the other packages:

- **Session cache** (internal, in-memory, always on): a bounded LRU of warm `Translator` sessions keyed by `{ sourceLanguage, targetLanguage }`.
- **Result cache** (opt-in): pass `cache: "session"` to memoize translations in `sessionStorage`, `cache: "local"` for `localStorage`, or any `{ get, set }`-shaped object for a custom backend.

```ts
// Off by default; every call hits the model.
translate({ input: text, sourceLanguage: "en", targetLanguage: "pt" });

// Opt in for sessionStorage-backed caching.
translate({
  input: text,
  sourceLanguage: "en",
  targetLanguage: "pt",
  cache: "session",
});
```

The default result cache key is a JSON array string of normalized `[sourceLanguage, targetLanguage, input]`. Pass `cacheKey` explicitly for finer-grained invalidation.

## DOM composition

This package intentionally translates strings only. DOM walking, text extraction, placeholder preservation, and "show original" UI are consumer-code concerns layered on top of `translate()`.

## Errors and unavailability

The vanilla `translate()` throws `TranslatorUnavailableError` when the API is missing or reports `availability: "unavailable"`. The React hook absorbs this and returns `status: "unavailable"` instead.

`AbortSignal` is supported on both surfaces. The result cache is not written for aborted runs.

## License

MIT © Beto Muniz
