---
"@web-ai-sdk/summarizer": minor
"@web-ai-sdk/proofreader": patch
---

summarizer: default `preference` to `"auto"` instead of `"speed"`, matching the platform default.

`summarize()` previously forced `preference: "speed"` whenever the option was omitted, biasing every consumer toward the low-latency/lower-capability path and risking surprising unavailability for configurations a faster model can't serve (e.g. non-English languages). The default is now `"auto"`, letting the browser balance speed and capability; opt into `"speed"` or `"capability"` explicitly. The `preference` hint is also forwarded into the `availability()` probe so it stays consistent with the session `create()` actually makes.

proofreader: document that the API is English-only today (`expectedInputLanguages` accepts an array, but unsupported languages reject and surface as `ProofreaderUnavailableError`).
