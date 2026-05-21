---
"@web-ai-sdk/prompt": patch
---

Correct browser-support claims across docs, per-package READMEs, the landing support table, and demo unavailability messages so they line up with the official Chrome and Edge documentation as of May 2026.

What changed in the matrix:

- **Prompt API on Chrome**: `138+ · flag` → `148+ · stable`. Per [Chrome at I/O 2026](https://developer.chrome.com/blog/chrome-at-io26) the API graduated to stable in Chrome 148. Chrome 138–147 still works behind `chrome://flags/#prompt-api-for-gemini-nano`.
- **Prompt API on Edge**: clarified as `138+ · Canary/Dev · partial · flag` — Microsoft's [Edge Prompt API docs](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/prompt-api) ship this only as a developer preview behind `edge://flags/#prompt-api-for-phi-mini`.
- **Translator API on Edge**: `138+ · stable` → `143+ · Canary/Dev · flag`. Per the [Edge Translator API docs](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/translator-api) it only exists in Canary/Dev behind `edge://flags/#edge-translation-api`.
- **Language Detector on Edge**: `138+ · stable` → `147+ · Canary/Dev · flag`. Per the [Edge Language Detector docs](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/languagedetector-api) it only exists in Canary/Dev behind `edge://flags/#edge-language-detection-api`.
- **Summarizer on Edge**: `138+ · partial` → `138+ · stable · partial` (default-on since Edge 138 per the [Edge Writing Assistance APIs docs](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/writing-assistance-apis); the "partial" caveat is about model output quality, not API availability).
- **WebMCP on Chrome**: `146+ · stable` → `146+ · flag · OT 149+`. Per the [WebMCP docs](https://developer.chrome.com/docs/ai/webmcp) and the Chrome 149 origin trial announcement it is still behind `chrome://flags/#enable-webmcp-testing`; a public origin trial opens in Chrome 149.
- **WebMCP on Edge**: `146+ · stable` → `147+ · flag`.

No API or behavior change. Updates the browser-support matrix, every published package's README "Status" section, the landing-page support table, the prompt session/concurrency JSDoc that referenced "Chrome 138" instead of 148, and the demo "open in …" unavailability messages so they cite the correct Edge channel + version for each API.
