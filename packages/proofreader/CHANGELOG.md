# @web-ai-sdk/proofreader

## 0.7.0

### Minor Changes

- de9b36b: Add TTL and forced refresh to result caches. Built-in "session" / "local" entries now use a versioned envelope and expire after one hour (DEFAULT_CACHE_TTL_MS). New cacheTtl option overrides the TTL per call; new cacheRefresh option skips the cache read and replaces the value after a successful run. Legacy raw entries and malformed envelopes count as misses and are replaced. Custom { get, set } caches keep their contract and own their expiry policy.
- 8644ed2: Add intent-driven prepare and release leases to every task package. New prepareLanguageModel / prepareSummarizer / prepareTranslator / prepareLanguageDetector / prepareWriter / prepareRewriter / prepareProofreader start native session creation when user intent is clear and return a lease ({ ready, release }). The matching operation reuses the prepared session without a second create. Leases pin sessions against LRU eviction; release is idempotent and the final release destroys the session once no other lease or in-flight call uses it. Session cache controls are now uniform: prompt gains configureLanguageModelCache / clearLanguageModelSession(s), and summarizer now exports its configureSummarizerCache / clearSummarizerSession(s). Clearing detaches leased sessions and destroys them when the last pin drops. Breaking: writer, rewriter, and proofreader no longer export getOrCreateWriter / getOrCreateRewriter / getOrCreateProofreader, getWriterApi / getRewriterApi / getProofreaderApi, defaultCacheKey, or resolveCache; use the prepare lease and cache controls instead.

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
