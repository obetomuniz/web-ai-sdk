---
"@web-ai-sdk/webmcp": patch
---

Stop the `registerTool` microtask retry from throwing uncaught exceptions on non-duplicate failures. The retry path now logs via `console.error` and gives up, matching the duplicate-error branch and the package's "feature detect, never throw" contract, instead of re-throwing from inside `queueMicrotask` — a throw that was uncatchable (the call had already returned) and could surface as an uncaught `window.error` in browsers or terminate Node SSR/SSG builds.
