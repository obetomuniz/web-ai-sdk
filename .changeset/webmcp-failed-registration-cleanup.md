---
"@web-ai-sdk/webmcp": patch
---

Isolate failed-registration cleanup from same-name replacement tools. Browser builds with the pre-WebMCP-PR-#240 ordering attach the signal's unregister algorithm before validating `exposedTo`, so aborting the signal of a rejected registration could unregister a later valid tool with the same name. Cleanup returned by `registerTool()` (and React unmount via `useWebMCP`) no longer aborts once the native registration has rejected; cancelling a pending registration and unregistering a successful one are unchanged, and cleanup stays idempotent.
