---
"@web-ai-sdk/prompt": minor
---

Widen `Session.send` / `sendStreaming` to accept `string | LanguageModelMessage[]`. Add optional `prefix?: boolean` to `LanguageModelMessage` for assistant prefill (spec-canonical on the trailing assistant message). The empty-input guard now handles both shapes. Backward-compatible: existing string calls and the React hook are unchanged.
