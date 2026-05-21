---
"@web-ai-sdk/all": patch
"@web-ai-sdk/prompt": patch
"@web-ai-sdk/webmcp": patch
"@web-ai-sdk/summarizer": patch
"@web-ai-sdk/translator": patch
"@web-ai-sdk/detector": patch
---

Adds a one-line `**Docs:**` pointer near the top of every package README linking to the canonical guide on web-ai-sdk.dev (and the matching React hook page where applicable). No API or behavior change — purely makes `npm view <pkg> README` self-routing so an agent or reader landing on a registry page can jump straight to the right docs without scanning for an external link.
