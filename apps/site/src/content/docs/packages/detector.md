---
title: "@web-ai-sdk/detector"
description: "Building block for the Web's Built-in Language Detector API. Detect the language of any text on-device, with confidence scores and a sorted list of alternates. Session reuse, pluggable result caching, AbortSignal-driven cleanup."
editUrl: https://github.com/obetomuniz/web-ai-sdk/edit/main/packages/detector/README.md
---

:::note
This page is generated from [`packages/detector/README.md`](https://github.com/obetomuniz/web-ai-sdk/blob/main/packages/detector/README.md) on every build. Edits should go to the README.
:::
Building block for [the Web's Built-in Language Detector API](https://developer.chrome.com/docs/ai/language-detection). Detect the language of any text on-device, with confidence scores and a sorted list of alternates. Session reuse, pluggable result caching, AbortSignal-driven cleanup.

## Status

Language Detector ships in Chrome 138+ and Edge 138+. On any other browser this library is a no-op for the React hook (it stays in `"unavailable"`). The vanilla `detect()` throws `DetectorUnavailableError` so callers can branch explicitly.

## Install

```sh
pnpm add @web-ai-sdk/detector
# or: npm i @web-ai-sdk/detector / bun add @web-ai-sdk/detector
```

The React adapter ships as a subpath export, with no extra install. `react` is a peer dependency only when you import the `/react` entry.

## Vanilla TypeScript / DOM

```ts
import { detect } from "@web-ai-sdk/detector";

const result = await detect({ text: "Olá, mundo" });
console.log(result.language);   // → "pt"
console.log(result.confidence); // → 0.98
console.log(result.all);        // → full sorted list of candidates
```

## React

```tsx
import { useDetector } from "@web-ai-sdk/detector/react";

export function LangBadge({ text }: { text: string }) {
  const { status, language, confidence } = useDetector({ text });

  if (status !== "done" || !language) return null;
  return (
    <span>
      {language} · {Math.round(confidence * 100)}%
    </span>
  );
}
```

State machine: `pending | loading | done | unavailable`. The hook auto-runs on mount and re-runs whenever `text` changes. Stays in `"pending"` while the input is empty or whitespace-only.

## API

### `detect(options): Promise<DetectResult>`

```ts
interface DetectOptions {
  text: string;
  expectedInputLanguages?: readonly string[];  // bias hint
  minConfidence?: number;                      // default 0
  createOptions?: Partial<LanguageDetectorCreateOptions>;
  cache?: DetectionCache;
  cacheKey?: string;
  signal?: AbortSignal;
}

interface DetectResult {
  language: string | null;          // top BCP-47 code, or null below minConfidence
  confidence: number;               // 0..1 for the top result
  all: DetectionResult[];           // [{ detectedLanguage, confidence }, ...]
  cached: boolean;
}
```

### `isDetectorAvailable(): boolean`

Feature-detect helper.

### `checkAvailability(opts?): Promise<LanguageDetectorAvailability | null>`

Forwards to `LanguageDetector.availability()`. Returns `null` if the global is missing or the call throws.

### `createSessionStorageCache({ storage?, prefix? }): DetectionCache`

Optional cache backend. Pass it to `detect({ cache })` to enable result caching, with an optional custom `storage` (e.g. `localStorage`, an in-memory polyfill).

### Lower-level helpers (advanced)

`getLanguageDetectorApi`, `getOrCreateLanguageDetector`, `defaultCacheKey`; exported so you can compose your own pipeline (e.g. share a session across multiple call sites, or roll your own retry).

## Caching

Two layers, same as the other packages:

- **Session cache** (internal, in-memory, always on): a `Map<stringifiedOptions, LanguageDetector>` so consecutive calls with the same `expectedInputLanguages` shape reuse the warm session. Cold-start is fast on this model (~100-300ms) but warm is still sub-50ms.
- **Result cache** (opt-in): pass a `cache` (anything matching `{ get, set }`) to memoize the full sorted list by trimmed text. Omit it for a fresh model call every time.

```ts
// Off by default; every call hits the model.
detect({ text: "hello" });

// Opt in for sessionStorage-backed caching.
detect({ text: "hello", cache: createSessionStorageCache() });
```

## Composing with the other packages

Pair detector with summarizer / translator / prompt to skip the manual `language: "en"` argument when you don't know the input language ahead of time:

```ts
import { detect } from "@web-ai-sdk/detector";
import { summarize } from "@web-ai-sdk/summarizer";

const { language } = await detect({ text: articleText });
await summarize({ language: language ?? "en", text: articleText });
```

A first-class `language: "auto"` shortcut may land in a future release.

## Errors and unavailability

The vanilla `detect()` throws `DetectorUnavailableError` when the API is missing or reports `availability: "unavailable"`. The React hook absorbs this and returns `status: "unavailable"` instead.

`AbortSignal` is supported on both surfaces. The result cache is not written for aborted runs.

## License

MIT © Beto Muniz
