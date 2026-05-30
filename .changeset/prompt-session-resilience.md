---
"@web-ai-sdk/prompt": minor
---

Add session-resilience primitives to `@web-ai-sdk/prompt` so consumers can build a stable on-device agent without reaching into the native API.

- **`Session.clone()`**: surface the native `LanguageModel` clone on the `Session` wrapper. Keep one warm base session (system prompt only) and fork a fresh-history clone per task, the spec's recommended pattern. This avoids both the cross-run "caching" of reusing a single long-lived session and the cold-instance degradation of repeated `create()` / `destroy()`. The clone is wrapped with the same delta-smoothing / abort / typed-error behavior, and its lifecycle is fully independent of the parent. Throws `PromptUnavailableError` if the browser instance lacks `clone()`.
- **Export `PromptAbortError`**: it was thrown but not exported, forcing brittle `err.name` string matching. `ask()` and sessions now throw the same exported class, so consumers can `instanceof PromptAbortError`.
- **`omitResponseConstraintInput`** on `SessionSendOptions` and `AskOptions`: forwards to the native prompt call to drop the inlined JSON Schema from the model's context (saves tokens) while the `responseConstraint` still shapes the output.
