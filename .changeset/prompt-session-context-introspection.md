---
"@web-ai-sdk/prompt": patch
---

Expose context-window introspection on `Session` so consumers can size work to the real model context instead of hardcoding, without reaching past the SDK to `globalThis.LanguageModel`.

- **`Session.contextWindow` / `Session.contextUsage`**: readonly passthroughs of the native instance's token budget (the context window and tokens used so far). These match the Prompt API's current canonical names (the renamed successors of `inputQuota` / `inputUsage`); the wrapper reads the new names and falls back to the deprecated ones on older Chrome builds. Both are `undefined` until the lazily-created instance exists; on a session from `clone()` they are readable the moment `clone()` resolves, which is exactly when a consumer wants to budget a per-run turn against the inherited system prompt.
- **`Session.onContextOverflow(listener)`**: subscribe to the native `contextoverflow` event (fired when a turn pushes usage past the window and the oldest history is dropped) so consumers can compact or fork a fresh `clone()` before `QuotaExceededError`. Returns an idempotent cleanup function and is a feature-detected no-op when the underlying instance doesn't expose the event.
