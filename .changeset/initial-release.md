---
"@web-ai-sdk/webmcp": minor
"@web-ai-sdk/translator": minor
"@web-ai-sdk/summarizer": minor
"@web-ai-sdk/prompt": minor
"@web-ai-sdk/detector": minor
---

Initial public release.

- `@web-ai-sdk/webmcp`: building block for `navigator.modelContext` with `registerTool` / `registerTools` and a `useWebMCP` React hook. AbortSignal-based cleanup, last-writer-wins eviction on duplicate names, no-op fallback on browsers without WebMCP.
- `@web-ai-sdk/translator`: building block for the Web's Built-in `Translator` with block serialization, casing restoration, snapshot-based restore, and a `useTranslator` React hook.
- `@web-ai-sdk/summarizer`: building block for the Web's Built-in `Summarizer` with skeleton extraction, sentence-boundary trim, session reuse, pluggable result caching, streaming, and a `useSummarizer` React hook.
- `@web-ai-sdk/prompt`: building block for the Web's Built-in `LanguageModel` (Prompt API) with system prompt, sampling controls (`temperature` / `topK`), language hints, session reuse, streaming, structured-output passthrough, pluggable result caching, and a `usePrompt` React hook.
- `@web-ai-sdk/detector`: building block for the Web's Built-in `LanguageDetector` with confidence thresholds, bias hints, session reuse, pluggable result caching, and a `useDetector` React hook. Pairs with the other packages to skip the manual `language: "en"` argument when the input language isn't known ahead of time.
