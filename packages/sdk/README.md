# web-ai-sdk

One-install meta-package for every `@web-ai-sdk/*` building block: `prompt`, `summarizer`, `translator`, `detector`, and `webmcp`. Pulls each scoped package in as a regular dependency so consumers don't have to track them individually.

## Status

Each underlying scoped package is independently supported in Chrome / Edge with the corresponding Built-in AI flag enabled. See the per-package READMEs for browser support details:

- [`@web-ai-sdk/prompt`](https://github.com/obetomuniz/web-ai-sdk/tree/main/packages/prompt)
- [`@web-ai-sdk/summarizer`](https://github.com/obetomuniz/web-ai-sdk/tree/main/packages/summarizer)
- [`@web-ai-sdk/translator`](https://github.com/obetomuniz/web-ai-sdk/tree/main/packages/translator)
- [`@web-ai-sdk/detector`](https://github.com/obetomuniz/web-ai-sdk/tree/main/packages/detector)
- [`@web-ai-sdk/webmcp`](https://github.com/obetomuniz/web-ai-sdk/tree/main/packages/webmcp)

## Install

```sh
pnpm add web-ai-sdk
# or: npm i web-ai-sdk / bun add web-ai-sdk
```

`react` is a peer dependency only when you import any `/react` subpath.

## Two equivalent import shapes

### Subpath imports (recommended for production)

Tree-shakes cleanly; the bundler only pulls in the building blocks you actually use.

```ts
import { prompt } from "web-ai-sdk/prompt";
import { summarize } from "web-ai-sdk/summarizer";
import { translate } from "web-ai-sdk/translator";
import { detect } from "web-ai-sdk/detector";
import { registerTool } from "web-ai-sdk/webmcp";
```

```tsx
import { usePrompt } from "web-ai-sdk/prompt/react";
import { useSummarizer } from "web-ai-sdk/summarizer/react";
```

### Namespaced root (handy for prototyping)

```ts
import { prompt, summarizer, translator, detector, webmcp } from "web-ai-sdk";

await prompt.prompt({ prompt: "Hello" });
await summarizer.summarize({ language: "en", article: document.body });
```

The root entry namespaces each scoped package because several exports (e.g. `checkAvailability`, `defaultCacheKey`, `createSessionStorageCache`) appear in more than one package and would collide on a flat re-export.

## Why a meta-package?

The scoped packages are deliberately small lifecycle wrappers; a meta-package just spares consumers from tracking five separate installs and version pins. The aggregator is a thin re-export shell with no behaviour of its own; all logic, tests, and version history live in the scoped packages.

## Versioning

The aggregator and the five scoped packages release together via a Changesets `fixed` group: every release ships all six at the same version. Pin a single number, get the whole suite.

## License

[MIT](./LICENSE).
