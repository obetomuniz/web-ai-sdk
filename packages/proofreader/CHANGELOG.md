# @web-ai-sdk/proofreader

## 0.6.1

### Patch Changes

- bd4c75a: Align public docs with safer result cache keys and availability ordering, isolated prompt one-shot/session readiness semantics, bounded warm session cache controls, and synced package reference pages.

## 0.6.0

### Patch Changes

- 2b03874: summarizer: default `preference` to `"auto"` instead of `"speed"`, matching the platform default.

  `summarize()` previously forced `preference: "speed"` whenever the option was omitted, biasing every consumer toward the low-latency/lower-capability path and risking surprising unavailability for configurations a faster model can't serve (e.g. non-English languages). The default is now `"auto"`, letting the browser balance speed and capability; opt into `"speed"` or `"capability"` explicitly. The `preference` hint is also forwarded into the `availability()` probe so it stays consistent with the session `create()` actually makes.

  Also rewrites the package README, which had drifted to a pre-0.4 API shape (`article`/`text`/`summary`, `isSummarizerAvailable`, `createSessionStorageCache`, skeleton helpers), to match the current `summarize({ input, language, … }) -> { output, cached }` surface.

  proofreader: document that the API is English-only today (`expectedInputLanguages` accepts an array, but unsupported languages reject and surface as `ProofreaderUnavailableError`).

## 0.5.2

## 0.5.1

## 0.5.0

### Minor Changes

- 6e5e40f: Add three new building blocks for the Web's Built-in Writing Assistance APIs:
  - `@web-ai-sdk/writer` wraps the `Writer` API: generates new content from a writing task with tone / format / length options, session reuse, streaming, and opt-in result caching.
  - `@web-ai-sdk/rewriter` wraps the `Rewriter` API: revises existing text with tone / length adjustments, session reuse, streaming, and opt-in result caching.
  - `@web-ai-sdk/proofreader` wraps the `Proofreader` API: corrects grammar, spelling, and punctuation, returning the corrected text plus per-issue corrections with offsets.

  All three are re-exported from `@web-ai-sdk/all` (namespaced root and per-package subpaths) and ship a vanilla core plus a React hook subpath (`useWriter`, `useRewriter`, `useProofreader`).
