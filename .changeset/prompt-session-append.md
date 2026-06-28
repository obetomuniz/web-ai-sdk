---
"@web-ai-sdk/prompt": minor
---

Add `Session.append()`: push messages into a session's conversation history without running a model turn, for agent loops that need to inject tool results or other context between turns. Forwards to the native `LanguageModel.append()`; throws `PromptUnavailableError` when unsupported, `SessionDestroyedError` after destroy, and `PromptAbortError` on abort, consistent with `send()` / `clone()`.
