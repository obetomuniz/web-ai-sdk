# @web-ai-sdk/all

One-install meta-package for every `@web-ai-sdk/*` building block: `prompt`, `summarizer`, `translator`, `detector`, and `webmcp`. Pulls each scoped package in as a regular dependency so consumers don't have to track them individually.

**Docs:** <https://web-ai-sdk.dev/docs/guides/meta-package/> · **All packages & links:** <https://web-ai-sdk.dev/llms.txt>

## Status

Each underlying scoped package is independently supported in Chrome / Edge with the corresponding Built-in AI flag enabled. See the per-package READMEs for browser support details:

- [`@web-ai-sdk/prompt`](https://github.com/obetomuniz/web-ai-sdk/tree/main/packages/prompt)
- [`@web-ai-sdk/summarizer`](https://github.com/obetomuniz/web-ai-sdk/tree/main/packages/summarizer)
- [`@web-ai-sdk/translator`](https://github.com/obetomuniz/web-ai-sdk/tree/main/packages/translator)
- [`@web-ai-sdk/detector`](https://github.com/obetomuniz/web-ai-sdk/tree/main/packages/detector)
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
import { registerTool, defineTool } from "@web-ai-sdk/all/webmcp";
```

```tsx
import { usePrompt, useSession } from "@web-ai-sdk/all/prompt/react";
import { useSummarizer } from "@web-ai-sdk/all/summarizer/react";
```

### Namespaced root (handy for prototyping)

```ts
import { prompt, summarizer, translator, detector, webmcp } from "@web-ai-sdk/all";

await prompt.ask({ input: "Hello" });
await summarizer.summarize({ language: "en", article: document.body });
```

The root entry namespaces each scoped package because several exports (e.g. `checkAvailability`, `defaultCacheKey`, `createSessionStorageCache`) appear in more than one package and would collide on a flat re-export.

## Why a meta-package?

The scoped packages are deliberately small lifecycle wrappers; a meta-package just spares consumers from tracking five separate installs and version pins. The aggregator is a thin re-export shell with no behaviour of its own; all logic, tests, and version history live in the scoped packages.

## Versioning

The aggregator and the five scoped packages release together via a Changesets `fixed` group: every release ships all six at the same version. Pin a single number, get the whole suite.

## License

[MIT](./LICENSE).
