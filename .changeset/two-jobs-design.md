---
"@web-ai-sdk/webmcp": minor
---

Support object and array executeTool input across Chrome trial generations. Select the native input contract before invocation and never retry execution. Serialize once for legacy hosts and pass the original object to current hosts. Preserve native results and cancellation. Migration: remove caller-side JSON.stringify(), replace primitive input with an object matching the tool schema, and use input?: object. Omitted input defaults to {}. Null and primitives now reject before invocation.
