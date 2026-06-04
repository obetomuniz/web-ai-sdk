---
"@web-ai-sdk/webmcp": patch
---

Read WebMCP from `document.modelContext` (the spec entry point) instead of only `navigator.modelContext`.

`document.modelContext` is the location the spec defines today; `navigator.modelContext` is the previous shape of the API. The wrapper now reads from `document.modelContext` first and falls back to `navigator.modelContext` so apps keep working against implementations that still expose the older binding. No public API change — `registerTool`, `isAvailable`, and the `useWebMCP` hook all behave identically; only the underlying global lookup is broader.
