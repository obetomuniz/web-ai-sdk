---
"@web-ai-sdk/prompt": patch
"@web-ai-sdk/summarizer": patch
---

Docs fixes: remove the phantom "Cache controls" section and the "Lower-level helpers (advanced)" section from the prompt README and docs page (both advertised exports — `clearSessions` / `clearSession` / `configurePromptCache`, and `getLanguageModelApi` / `getOrCreateLanguageModel` / `defaultCacheKey` — that are no longer part of the public surface; copying the snippets fails to import), and clarify the `summarizer` `cacheKey` default documented as `${pathname}:${lang}` to the real default — `JSON.stringify([...])` of pathname, trimmed input, a normalized language (lowercase primary subtag, e.g. `pt-BR` → `pt`), a boolean `languageHints`, and output-shaping options. Runtime behavior is unchanged.
