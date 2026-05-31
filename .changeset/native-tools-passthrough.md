---
"@web-ai-sdk/prompt": patch
---

Add experimental native tool-calling passthrough. `ask()`, `createSession()`, and `useSession()` now accept a `tools` array (`LanguageModelTool[]`) that is forwarded verbatim to the browser's `LanguageModel.create()`. This is pass-through only: the SDK does not execute the tools, and current stable Chrome accepts the option but no-ops it (the model may surface its call as `tool_code` text). It begins working automatically on browsers that ship native execution. The `expectedInputs` / `expectedOutputs` unions also widen to allow the `tool-response` / `tool-call` modalities.
