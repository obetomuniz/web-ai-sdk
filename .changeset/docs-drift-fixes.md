---
"@web-ai-sdk/prompt": patch
"@web-ai-sdk/summarizer": patch
---

Docs fixes: remove the phantom "Cache controls" section from the prompt README (it advertised `clearSessions` / `clearSession` / `configurePromptCache` exports that were never part of the public surface — copying the snippet fails to import), and correct the `summarizer` `cacheKey` default documented as `${pathname}:${lang}` to the real default (a JSON array of pathname, trimmed input, language, hints, and output-shaping options). Runtime behavior is unchanged.
