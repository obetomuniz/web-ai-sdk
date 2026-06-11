# @web-ai-sdk/detector

web-ai-sdk building block for [the Web's Built-in Language Detector API](https://developer.chrome.com/docs/ai/language-detection). Detect the language of any text on-device, with confidence scores and a sorted list of alternates. Session reuse, pluggable result caching, AbortSignal-driven cleanup.

**Docs:** <https://web-ai-sdk.dev/docs/guides/detector/> · **React:** [`useDetector`](https://web-ai-sdk.dev/docs/react/use-detector/)

## Status

Language Detector ships stable in Chrome 138+ and Edge 148+ on desktop, with no flag required (per the [Edge Language Detector API docs](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/languagedetector-api)). On any other browser this library is a no-op for the React hook (it stays in `"unavailable"`). The vanilla `detect()` throws `DetectorUnavailableError` so callers can branch explicitly.

## Install

```sh
pnpm add @web-ai-sdk/detector
# or: npm i @web-ai-sdk/detector / bun add @web-ai-sdk/detector
```

The React adapter ships as a subpath export, with no extra install. `react` is a peer dependency only when you import the `/react` entry.

## Vanilla TypeScript / DOM

```ts
import { detect } from "@web-ai-sdk/detector";

const result = await detect({ input: "Olá, mundo" });
console.log(result.output?.language);   // → "pt"
console.log(result.output?.confidence); // → 0.98
console.log(result.output?.all);        // → full sorted list of candidates
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

```ts
// Off by default; every call hits the model.
detect({ input: "hello" });

// Opt in for sessionStorage-backed caching.
detect({ input: "hello", cache: "session" });
```

## Composing with the other packages

Pair detector with summarizer / translator / prompt to skip the manual `language: "en"` argument when you don't know the input language ahead of time:

```ts
import { detect } from "@web-ai-sdk/detector";
import { summarize } from "@web-ai-sdk/summarizer";

const { output } = await detect({ input: articleText });
await summarize({ language: output?.language ?? "en", input: articleText });
```

A first-class `language: "auto"` shortcut may land in a future release.

## Errors and unavailability

The vanilla `detect()` throws `DetectorUnavailableError` when the API is missing or reports `availability: "unavailable"`. The React hook absorbs this and returns `status: "unavailable"` instead.

`AbortSignal` is supported on both surfaces. The result cache is not written for aborted runs.

## License

MIT © Beto Muniz
