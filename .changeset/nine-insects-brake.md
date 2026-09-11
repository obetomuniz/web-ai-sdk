---
"@web-ai-sdk/webmcp": patch
---

Accept native object-valued discovery schemas from Chrome 155.0.8051.0 while retaining legacy trial strings. RegisteredTool.inputSchema is now optional object | string in vanilla and React. Discovery preserves schemas and metadata unchanged; use a typeof guard before consuming mixed trial values.
