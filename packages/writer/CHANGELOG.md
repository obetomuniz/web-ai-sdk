# @web-ai-sdk/writer

## 0.7.0

### Minor Changes

- de9b36b: Add TTL and forced refresh to result caches. Built-in "session" / "local" entries now use a versioned envelope and expire after one hour (DEFAULT_CACHE_TTL_MS). New cacheTtl option overrides the TTL per call; new cacheRefresh option skips the cache read and replaces the value after a successful run. Legacy raw entries and malformed envelopes count as misses and are replaced. Custom { get, set } caches keep their contract and own their expiry policy.
- 8644ed2: Add intent-driven prepare and release leases to every task package. New prepareLanguageModel / prepareSummarizer / prepareTranslator / prepareLanguageDetector / prepareWriter / prepareRewriter / prepareProofreader start native session creation when user intent is clear and return a lease ({ ready, release }). The matching operation reuses the prepared session without a second create. Leases pin sessions against LRU eviction; release is idempotent and the final release destroys the session once no other lease or in-flight call uses it. Session cache controls are now uniform: prompt gains configureLanguageModelCache / clearLanguageModelSession(s), and summarizer now exports its configureSummarizerCache / clearSummarizerSession(s). Clearing detaches leased sessions and destroys them when the last pin drops. Breaking: writer, rewriter, and proofreader no longer export getOrCreateWriter / getOrCreateRewriter / getOrCreateProofreader, getWriterApi / getRewriterApi / getProofreaderApi, defaultCacheKey, or resolveCache; use the prepare lease and cache controls instead.

## 0.6.2

### Patch Changes

- 572d033: Fix `useSummarizer` / `useWriter` / `useRewriter` treating a successful empty or `null` result as "unavailable": a resolved call now resolves to status `"done"`, matching `useProofreader` / `useDetector`. Previously a legitimately empty output (no-op rewrite, same-language skip, or safety soft-block trimmed to empty) silently set the hook to an unavailable state with `error` left `null`.

## 0.6.1

### Patch Changes

- bd4c75a: Align public docs with safer result cache keys and availability ordering, isolated prompt one-shot/session readiness semantics, bounded warm session cache controls, and synced package reference pages.

## 0.6.0

## 0.5.2

## 0.5.1

## 0.5.0

### Minor Changes

- 6e5e40f: Add three new building blocks for the Web's Built-in Writing Assistance APIs:
  - `@web-ai-sdk/writer` wraps the `Writer` API: generates new content from a writing task with tone / format / length options, session reuse, streaming, and opt-in result caching.
  - `@web-ai-sdk/rewriter` wraps the `Rewriter` API: revises existing text with tone / length adjustments, session reuse, streaming, and opt-in result caching.
  - `@web-ai-sdk/proofreader` wraps the `Proofreader` API: corrects grammar, spelling, and punctuation, returning the corrected text plus per-issue corrections with offsets.

  All three are re-exported from `@web-ai-sdk/all` (namespaced root and per-package subpaths) and ship a vanilla core plus a React hook subpath (`useWriter`, `useRewriter`, `useProofreader`).
