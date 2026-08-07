# @web-ai-sdk/translator

This package wraps the Web's Built-in [Translator API](https://developer.chrome.com/docs/ai/translator-api). It caches sessions by language pair and supports streaming, optional result caching, and abort signals.

**Docs:** <https://web-ai-sdk.dev/docs/guides/translator/> · **React:** [`useTranslator`](https://web-ai-sdk.dev/docs/react/use-translator/) · **Production:** [Checklist](https://web-ai-sdk.dev/docs/production-checklist/)

## Status

Translator is stable in Chrome 138+ and shipped in Edge 148. It does not require a flag. See the [Chrome status table](https://developer.chrome.com/docs/ai/built-in-apis) and [Edge 148 release notes](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/release-notes/148).

Without `Translator`, React reports `"unavailable"` and `translate()` throws `TranslatorUnavailableError`.

## Install

```sh
pnpm add @web-ai-sdk/translator
# or: npm i @web-ai-sdk/translator / bun add @web-ai-sdk/translator
```

The React adapter uses the `/react` subpath. `react` is an optional peer dependency.

## Vanilla TypeScript / DOM

```ts
import { translate } from "@web-ai-sdk/translator";

const result = await translate({
  input: "Hello, world.",
  sourceLanguage: "en",
  targetLanguage: "pt",
});

console.log(result.output); // result: "Olá, mundo."
console.log(result.cached); // result: false
```

`result.output` is the translated text, or `null` when the input is empty or when `sourceLanguage` and `targetLanguage` normalize to the same base language.

## Streaming

Pass `onUpdate` to receive partial output while the model translates. The wrapper consumes the native [`translateStreaming()`](https://developer.mozilla.org/en-US/docs/Web/API/Translator/translateStreaming) method when the implementation provides it.

```ts
const result = await translate({
  input: "Hello, world.",
  sourceLanguage: "en",
  targetLanguage: "pt",
  onUpdate: (text) => console.log("partial", text),
});
```

`onUpdate` receives the cumulative translation so far, not raw deltas. Each update contains every previous update as a prefix. On implementations without `translateStreaming()`, the wrapper runs the one-shot method and delivers the result as a single final update.

Only the final completed output enters the result cache. Partial, aborted, or failed output is never cached.

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

State machine: `idle | loading | streaming | done | unavailable`. The hook auto-runs when `input` is non-empty and the language pair differs, and it re-runs whenever its options change. `status` becomes `"streaming"` after the first partial update, and `output` grows as chunks land.

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
  cacheTtl?: number;      // built-in shortcut TTL in ms; default 1 hour
  cacheRefresh?: boolean; // skip the cache read, write the fresh result
  onUpdate?: (text: string) => void; // cumulative buffer, not deltas
  signal?: AbortSignal; // forwarded to the native operation
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

`configureTranslatorCache({ max })` bounds the internal warm `Translator` session cache (default `8`). `clearTranslatorSessions()` drops every warm session, and `clearTranslatorSession({ sourceLanguage, targetLanguage })` drops one matching language pair. Clearing detaches sessions pinned by a lease or an in-flight call and destroys them when the last pin drops.

### Prepare and release

`prepareTranslator(options)` starts native session creation when user intent is clear, before the input exists. It returns a `TranslatorLease`: `{ ready: Promise<void>; release(): void }`.

```ts
import { prepareTranslator, translate } from "@web-ai-sdk/translator";

// User opens the translation menu: warm the session now.
const translatorModel = prepareTranslator({ sourceLanguage: "en", targetLanguage: "pt" });

// The matching call reuses the prepared session; no second create.
const result = await translate({
  input: "Hello, world.",
  sourceLanguage: "en",
  targetLanguage: "pt",
});

// User dismisses the feature: let the session go.
translatorModel.release();
```

- `prepareTranslator` never throws synchronously. Unavailability and creation failure reject `ready` with `TranslatorUnavailableError`.
- `release()` is idempotent. The final release destroys the session once no other lease or in-flight call uses it.
- Releasing before creation settles destroys the session after creation succeeds.
- Failed creation evicts the entry, so a later prepare retries.
- Sessions with active leases never evict from the LRU cache.

Reuse requires the same session-affecting options as the `translate` call. For this package those are `sourceLanguage`, `targetLanguage`, and `monitor` (`PrepareTranslatorOptions`).

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

### Expiry and refresh

The built-in `"session"` / `"local"` shortcuts store each entry in a versioned envelope with an expiry time. Entries expire after one hour (`DEFAULT_CACHE_TTL_MS`) by default. Pass `cacheTtl` (milliseconds) to override the TTL per call. Expired entries, legacy raw strings, and malformed envelopes count as misses and are removed.

Pass `cacheRefresh: true` to force a fresh inference. The call skips the cache read, runs the model, and replaces the cached value after a successful run. Failed, aborted, or empty runs leave the cached value in place.

Custom `{ get, set }` caches own their expiry policy. `cacheTtl` does not apply to them; `cacheRefresh` still bypasses their read and updates them after success.

```ts
// Cache for five minutes instead of one hour.
translate({
  input: text,
  sourceLanguage: "en",
  targetLanguage: "pt",
  cache: "local",
  cacheTtl: 5 * 60 * 1000,
});

// Force a fresh inference; later calls reuse the new value.
translate({
  input: text,
  sourceLanguage: "en",
  targetLanguage: "pt",
  cache: "local",
  cacheRefresh: true,
});
```

## DOM composition

This package intentionally translates strings only. DOM walking, text extraction, placeholder preservation, and "show original" UI are consumer-code concerns layered on top of `translate()`.

## Errors and unavailability

The vanilla `translate()` throws `TranslatorUnavailableError` when the API is missing or reports `availability: "unavailable"`. The React hook absorbs this and returns `status: "unavailable"` instead.

`AbortSignal` is supported on both surfaces, and the wrapper forwards it to the native [`translate()` and `translateStreaming()` operations](https://webmachinelearning.github.io/translation-api/). Browsers that honor the operation signal stop native work promptly. Aborting rejects with an `AbortError` and keeps the shared session usable for other callers. The result cache is not written for aborted runs.

## License

MIT © Beto Muniz
