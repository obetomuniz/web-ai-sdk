---
"@web-ai-sdk/prompt": minor
"@web-ai-sdk/all": minor
---

Support multimodal message content in Prompt sessions. `LanguageModelMessage.content` now accepts an array of exported text / image / audio content parts, forwarded losslessly through `initialPrompts`, `send()`, `sendStreaming()`, and `append()`. Media-only messages are no longer treated as empty, and native `NotSupportedError` modality errors propagate unchanged. `ask()` stays text-only.
