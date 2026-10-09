---
"@web-ai-sdk/prompt": patch
---

Accept every documented `samplingMode` value. `LanguageModelSamplingMode` now includes `slightly-predictable` and `slightly-creative`. `ask()`, `createSession()`, `prepareLanguageModel()`, and the React hooks forward each value unchanged. `checkAvailability()` now accepts `samplingMode`. `ask()` and `checkAvailability()` forward it to `LanguageModel.availability()`. Chrome documents `samplingMode` for web pages under an origin trial; the browser decides whether the option is available.
