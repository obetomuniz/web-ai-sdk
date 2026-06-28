---
name: web-ai-sdk-docs
description: Use web-ai-sdk documentation and package references to build with the Web AI surface.
---

# web-ai-sdk Docs

Use this skill when helping someone build with `@web-ai-sdk/*`, compare wrapper packages, or find examples for the Web AI surface.

## Canonical Sources

Start with the LLM-friendly index:

- `https://web-ai-sdk.dev/llms.txt`
- `https://web-ai-sdk.dev/llms-full.txt`
- `https://web-ai-sdk.dev/docs/`

Then use the package READMEs as the API source of truth:

- `https://github.com/obetomuniz/web-ai-sdk/tree/main/packages/sdk#readme`
- `https://github.com/obetomuniz/web-ai-sdk/tree/main/packages/prompt#readme`
- `https://github.com/obetomuniz/web-ai-sdk/tree/main/packages/webmcp#readme`
- `https://github.com/obetomuniz/web-ai-sdk/tree/main/packages/summarizer#readme`
- `https://github.com/obetomuniz/web-ai-sdk/tree/main/packages/translator#readme`
- `https://github.com/obetomuniz/web-ai-sdk/tree/main/packages/detector#readme`
- `https://github.com/obetomuniz/web-ai-sdk/tree/main/packages/writer#readme`
- `https://github.com/obetomuniz/web-ai-sdk/tree/main/packages/rewriter#readme`
- `https://github.com/obetomuniz/web-ai-sdk/tree/main/packages/proofreader#readme`

## Rules

- Prefer vanilla package APIs unless the user is already using React.
- Treat browser support as feature-detected. Do not assume a Web AI API exists in every browser.
- Keep examples dependency-light and avoid UI components unless the user asks for a UI.
- For WebMCP, register tools from the top-level document and make cleanup idempotent.
