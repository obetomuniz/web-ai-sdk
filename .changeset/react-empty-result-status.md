---
"@web-ai-sdk/summarizer": patch
"@web-ai-sdk/writer": patch
"@web-ai-sdk/rewriter": patch
---

Fix `useSummarizer` / `useWriter` / `useRewriter` treating a successful empty or `null` result as "unavailable": a resolved call now resolves to status `"done"`, matching `useProofreader` / `useDetector`. Previously a legitimately empty output (no-op rewrite, same-language skip, or safety soft-block trimmed to empty) silently set the hook to an unavailable state with `error` left `null`.
