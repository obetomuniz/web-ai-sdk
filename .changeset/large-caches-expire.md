---
"@web-ai-sdk/prompt": minor
"@web-ai-sdk/summarizer": minor
"@web-ai-sdk/translator": minor
"@web-ai-sdk/detector": minor
"@web-ai-sdk/writer": minor
"@web-ai-sdk/rewriter": minor
"@web-ai-sdk/proofreader": minor
"@web-ai-sdk/all": minor
---

Add TTL and forced refresh to result caches. Built-in "session" / "local" entries now use a versioned envelope and expire after one hour (DEFAULT_CACHE_TTL_MS). New cacheTtl option overrides the TTL per call; new cacheRefresh option skips the cache read and replaces the value after a successful run. Legacy raw entries and malformed envelopes count as misses and are replaced. Custom { get, set } caches keep their contract and own their expiry policy.
