---
"@web-ai-sdk/prompt": minor
"@web-ai-sdk/all": minor
---

Add `samplingMode` support for the Prompt API while keeping raw `temperature` and `topK` as deprecated legacy passthroughs.

`samplingMode` is forwarded to `LanguageModel.create()` and rejected when mixed with raw sampling parameters.
