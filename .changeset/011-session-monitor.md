---
"@web-ai-sdk/prompt": minor
---

Add `monitor` option to `createSession()` and `useSession()`, forwarding the
first-call download-progress callback to `LanguageModel.create()` — the same
parity `ask()` already has. When both top-level `monitor` and
`createOptions.monitor` are set, the top-level one wins.
