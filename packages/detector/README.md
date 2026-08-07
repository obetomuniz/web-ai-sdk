# @web-ai-sdk/detector

This package wraps the Web's Built-in [Language Detector API](https://developer.chrome.com/docs/ai/language-detection). It returns confidence scores and sorted alternatives. It also supports session reuse, optional result caching, and abort signals.

**Docs:** <https://web-ai-sdk.dev/docs/guides/detector/> · **React:** [`useDetector`](https://web-ai-sdk.dev/docs/react/use-detector/) · **Production:** [Checklist](https://web-ai-sdk.dev/docs/production-checklist/)

## Status

Language Detector is stable in Chrome 138+ and shipped in Edge 148. It does not require a flag. See the [Chrome status table](https://developer.chrome.com/docs/ai/built-in-apis) and [Edge 148 release notes](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/release-notes/148).

Without `LanguageDetector`, React reports `"unavailable"` and `detect()` throws `DetectorUnavailableError`.

## Install

```sh
pnpm add @web-ai-sdk/detector
# or: npm i @web-ai-sdk/detector / bun add @web-ai-sdk/detector
```

The React adapter uses the `/react` subpath. `react` is an optional peer dependency.

## Vanilla TypeScript / DOM

```ts
import { detect } from "@web-ai-sdk/detector";

const result = await detect({ input: "Olá, mundo" });
console.log(result.output?.language);   // result: "pt"
console.log(result.output?.confidence); // result: 0.98
console.log(result.output?.all);        // result: full sorted list of candidates
```

## React

```tsx
import { useDetector } from "@web-ai-sdk/detector/react";

export function LangBadge({ text }: { text: string }) {
  const { status, output } = useDetector({ input: text });

  if (status !== "done" || !output) return null;
  return (
    <span>
      {output.language} · {Math.round(output.confidence * 100)}%
    </span>
  );
}
```

State machine: `idle | loading | done | unavailable`. The hook auto-runs on mount and re-runs whenever `input` changes. Stays in `"idle"` while the input is empty or whitespace-only.

## API

### `detect(options): Promise<DetectResult>`

```ts
interface DetectOptions {
  input: string;
  expectedInputLanguages?: readonly string[];  // bias hint
  minConfidence?: number;                      // default 0
  monitor?: (m: CreateMonitor) => void;
  cache?: "session" | "local" | { get, set };
  cacheKey?: string;
  cacheTtl?: number;      // built-in shortcut TTL in ms; default 1 hour
  cacheRefresh?: boolean; // skip the cache read, write the fresh result
  signal?: AbortSignal;
}

interface DetectResult {
  output: {
    language: string;
    confidence: number;
    all: DetectionResult[];
  } | null;
  cached: boolean;
}
```

### `isAvailable(): boolean`

Feature-detect helper.

### `checkAvailability(opts?): Promise<LanguageDetectorAvailability | null>`

Forwards to `LanguageDetector.availability()`. Returns `null` if the global is missing or the call throws.

### Lower-level helpers (advanced)

`getLanguageDetectorApi`, `getOrCreateLanguageDetector`, `defaultCacheKey`; exported so you can compose your own pipeline (e.g. share a session across multiple call sites, or roll your own retry).

## Caching

Two layers, same as the other packages:

- **Session cache** (internal, in-memory, always on): a `Map<stringifiedOptions, LanguageDetector>` so consecutive calls with the same `expectedInputLanguages` shape reuse the warm session. Cold-start is fast on this model (~100-300ms) but warm is still sub-50ms.
- **Result cache** (opt-in): pass a `cache` (anything matching `{ get, set }`) to memoize the full sorted list by trimmed text. Omit it for a fresh model call every time.

Use `configureLanguageDetectorCache({ max })` to bound the warm session cache (default `8`). `clearLanguageDetectorSessions()` drops every warm session, and `clearLanguageDetectorSession({ expectedInputLanguages })` drops one matching detector configuration.

```ts
// Off by default; every call hits the model.
detect({ input: "hello" });

// Opt in for sessionStorage-backed caching.
detect({ input: "hello", cache: "session" });
```

### Expiry and refresh

The built-in `"session"` / `"local"` shortcuts store each entry in a versioned envelope with an expiry time. Entries expire after one hour (`DEFAULT_CACHE_TTL_MS`) by default. Pass `cacheTtl` (milliseconds) to override the TTL per call. Expired entries, legacy raw strings, and malformed envelopes count as misses and are removed.

Pass `cacheRefresh: true` to force a fresh inference. The call skips the cache read, runs the model, and replaces the cached value after a successful run. Failed, aborted, or empty runs leave the cached value in place.

Custom `{ get, set }` caches own their expiry policy. `cacheTtl` does not apply to them; `cacheRefresh` still bypasses their read and updates them after success.

```ts
// Cache for five minutes instead of one hour.
detect({ input: "hello", cache: "local", cacheTtl: 5 * 60 * 1000 });

// Force a fresh inference; later calls reuse the new value.
detect({ input: "hello", cache: "local", cacheRefresh: true });
```

## Composing with the other packages

Pair detector with summarizer / translator / prompt to skip the manual `language: "en"` argument when you don't know the input language ahead of time:

```ts
import { detect } from "@web-ai-sdk/detector";
import { summarize } from "@web-ai-sdk/summarizer";

const { output } = await detect({ input: articleText });
await summarize({ language: output?.language ?? "en", input: articleText });
```

A first-class `language: "auto"` shortcut isn't planned for this package. Multi-package compositions like detect-then-summarize, detect-then-translate, or detect-then-prompt are written in consumer code.

## Errors and unavailability

The vanilla `detect()` throws `DetectorUnavailableError` when the API is missing or reports `availability: "unavailable"`. The React hook absorbs this and returns `status: "unavailable"` instead.

`AbortSignal` is supported on both surfaces. The result cache is not written for aborted runs.

## License

MIT © Beto Muniz
