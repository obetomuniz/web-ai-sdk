---
"@web-ai-sdk/prompt": patch
"@web-ai-sdk/webmcp": patch
"@web-ai-sdk/summarizer": patch
"@web-ai-sdk/translator": patch
"@web-ai-sdk/detector": patch
---

Patch release validating the npm Trusted Publishing (OIDC) release path end-to-end. Each package now ships with SLSA provenance attestations. Also corrects the stale `web-ai-sdk-kit` `homepage` and `bugs.url` fields in `@web-ai-sdk/webmcp`, `@web-ai-sdk/summarizer`, and `@web-ai-sdk/translator` left over from the rebrand.
