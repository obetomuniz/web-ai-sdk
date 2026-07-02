---
"@web-ai-sdk/webmcp": patch
---

Adapt `registerTool` to the WebMCP spec update that makes `document.modelContext.registerTool()` return a Promise (cross-origin iframe tool sharing made registration asynchronous). The wrapper normalizes both the legacy synchronous-throw and the new async-promise shapes into one async pipeline; the public `registerTool(tool): () => void` signature is unchanged. As a forced side-effect, a first-call non-duplicate failure that previously threw synchronously now logs via `console.error` and gives up — matching the package's "feature detect, never throw" contract and the retry path's existing posture (the throw became uncatchable once registration went async).
