---
"@web-ai-sdk/translator": minor
---

Add streaming and native operation cancellation to the Translator wrapper.

`translate()` accepts an `onUpdate` callback and consumes the native `translateStreaming()` method when the implementation provides it. Updates deliver the cumulative translation so far, not raw deltas. Implementations without streaming deliver the one-shot result as a single final update.

The caller's `AbortSignal` is now forwarded to the native translation operation. Aborting rejects with `AbortError`, keeps shared sessions reusable for other callers, and never writes partial output to the result cache.

`useTranslator()` reports a new `"streaming"` status and exposes the cumulative partial output while chunks arrive.
