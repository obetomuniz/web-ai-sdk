---
title: "@web-ai-sdk/all"
description: "Install all eight wrappers through one package: prompt, summarizer, translator, detector, writer, rewriter, proofreader, and webmcp."
editUrl: https://github.com/obetomuniz/web-ai-sdk/edit/main/packages/sdk/README.md
---

:::note
This page is synced from [`packages/sdk/README.md`](https://github.com/obetomuniz/web-ai-sdk/blob/main/packages/sdk/README.md) by `pnpm --filter @web-ai-sdk-apps/site docs:sync`. Edits should go to the README.
:::

Install all eight wrappers through one package: `prompt`, `summarizer`, `translator`, `detector`, `writer`, `rewriter`, `proofreader`, and `webmcp`.


## Status

Browser support differs by capability. See the [browser-support matrix](https://web-ai-sdk.dev/docs/browser-support/) and package READMEs for current status:

- [`@web-ai-sdk/prompt`](https://github.com/obetomuniz/web-ai-sdk/tree/main/packages/prompt)
- [`@web-ai-sdk/summarizer`](https://github.com/obetomuniz/web-ai-sdk/tree/main/packages/summarizer)
- [`@web-ai-sdk/translator`](https://github.com/obetomuniz/web-ai-sdk/tree/main/packages/translator)
- [`@web-ai-sdk/detector`](https://github.com/obetomuniz/web-ai-sdk/tree/main/packages/detector)
- [`@web-ai-sdk/writer`](https://github.com/obetomuniz/web-ai-sdk/tree/main/packages/writer)
- [`@web-ai-sdk/rewriter`](https://github.com/obetomuniz/web-ai-sdk/tree/main/packages/rewriter)
- [`@web-ai-sdk/proofreader`](https://github.com/obetomuniz/web-ai-sdk/tree/main/packages/proofreader)
- [`@web-ai-sdk/webmcp`](https://github.com/obetomuniz/web-ai-sdk/tree/main/packages/webmcp)

## Install

```sh
pnpm add @web-ai-sdk/all
# or: npm i @web-ai-sdk/all / bun add @web-ai-sdk/all
```

`react` is a peer dependency only when you import any `/react` subpath.

## Two equivalent import shapes

### Subpath imports (recommended for production)

Tree-shakes cleanly; the bundler only pulls in the building blocks you actually use.

```ts
import { ask, createSession } from "@web-ai-sdk/all/prompt";
import { summarize } from "@web-ai-sdk/all/summarizer";
import { translate } from "@web-ai-sdk/all/translator";
import { detect } from "@web-ai-sdk/all/detector";
import { write } from "@web-ai-sdk/all/writer";
import { rewrite } from "@web-ai-sdk/all/rewriter";
import { proofread } from "@web-ai-sdk/all/proofreader";
import { executeTool, getTools, registerTool } from "@web-ai-sdk/all/webmcp";
```

```tsx
import { usePrompt, useSession } from "@web-ai-sdk/all/prompt/react";
import { useSummarizer } from "@web-ai-sdk/all/summarizer/react";
```

### Namespaced root (handy for prototyping)

```ts
import { prompt, summarizer, translator, detector, writer, rewriter, proofreader, webmcp } from "@web-ai-sdk/all";

await prompt.ask({ input: "Hello" });
await summarizer.summarize({ language: "en", input: document.body.innerText });
const tools = await webmcp.getTools();
```

The root entry namespaces each scoped package because several exports (e.g. `checkAvailability`, `isAvailable`, `DEFAULT_CACHE_TTL_MS`) appear in more than one package and would collide on a flat re-export.

## Why a meta-package?

The scoped packages are deliberately small lifecycle wrappers; a meta-package just spares consumers from tracking eight separate installs and version pins. The aggregator is a thin re-export shell with no behaviour of its own; all logic, tests, and version history live in the scoped packages.

## Versioning

The scoped packages are independently versioned, so a Prompt-only API change can ship without bumping Translator, WebMCP, or the other wrappers. The `@web-ai-sdk/all` version is the suite anchor: it is bumped whenever one of the packages it re-exports changes, so `@web-ai-sdk/all@latest` always pulls the current bundle.

## License

[MIT](./LICENSE).
