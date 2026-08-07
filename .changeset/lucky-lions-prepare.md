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

Add intent-driven prepare and release leases to every task package. New prepareLanguageModel / prepareSummarizer / prepareTranslator / prepareLanguageDetector / prepareWriter / prepareRewriter / prepareProofreader start native session creation when user intent is clear and return a lease ({ ready, release }). The matching operation reuses the prepared session without a second create. Leases pin sessions against LRU eviction; release is idempotent and the final release destroys the session once no other lease or in-flight call uses it. Session cache controls are now uniform: prompt gains configureLanguageModelCache / clearLanguageModelSession(s), and summarizer now exports its configureSummarizerCache / clearSummarizerSession(s). Clearing detaches leased sessions and destroys them when the last pin drops. Breaking: writer, rewriter, and proofreader no longer export getOrCreateWriter / getOrCreateRewriter / getOrCreateProofreader, getWriterApi / getRewriterApi / getProofreaderApi, defaultCacheKey, or resolveCache; use the prepare lease and cache controls instead.
