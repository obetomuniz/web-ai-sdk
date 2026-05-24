---
"@web-ai-sdk/webmcp": patch
---

Deprecate `registerTools` — to be removed in 0.4. It was a thin wrapper over `registerTool` (mostly atomic-rollback sugar) and didn't earn its place alongside the primitive. The export still works and is unchanged; the JSDoc and docs now point at the `tools.map(registerTool)` pattern instead. The actual removal will be the 0.4 minor bump.
