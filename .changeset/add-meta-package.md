---
"@web-ai-sdk/all": minor
---

Introduce `@web-ai-sdk/all`, a meta-package that re-exports the five `@web-ai-sdk/*` building blocks (`prompt`, `summarizer`, `translator`, `detector`, `webmcp`) behind a single install. Two import shapes are supported:

```ts
// Namespaced root (handy for prototyping):
import { prompt, summarizer } from "@web-ai-sdk/all";
await prompt.prompt({ prompt: "Hello" });

// Per-package subpaths (cleanest tree-shaking):
import { prompt } from "@web-ai-sdk/all/prompt";
import { useSummarizer } from "@web-ai-sdk/all/summarizer/react";
```

The aggregator and the five scoped packages release together via a Changesets `fixed` group; every release ships all six packages at the same version.
