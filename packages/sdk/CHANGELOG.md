# @web-ai-sdk/all

## 0.7.7

### Patch Changes

- b814342: Accept Standard Schema input and output definitions directly in registerTool and useWebMCP, with automatic input validation, transformed values, typed errors, and a deprecated defineTool compatibility wrapper.
- Updated dependencies [b814342]
  - @web-ai-sdk/webmcp@0.8.0

## 0.7.6

### Patch Changes

- Updated dependencies [d9ff528]
- Updated dependencies [d9ff528]
  - @web-ai-sdk/webmcp@0.7.0

## 0.7.5

### Patch Changes

- Updated dependencies [e04e6d9]
  - @web-ai-sdk/prompt@0.9.1

## 0.7.4

### Patch Changes

- Updated dependencies [f2e6695]
- Updated dependencies [e0d340e]
- Updated dependencies [4e9ac7d]
  - @web-ai-sdk/prompt@0.9.0
  - @web-ai-sdk/webmcp@0.6.2

## 0.7.3

### Patch Changes

- Updated dependencies [55d5c73]
- Updated dependencies [c859410]
  - @web-ai-sdk/prompt@0.8.0
  - @web-ai-sdk/webmcp@0.6.1

## 0.7.2

### Patch Changes

- Updated dependencies [572d033]
  - @web-ai-sdk/summarizer@0.6.2
  - @web-ai-sdk/writer@0.6.2
  - @web-ai-sdk/rewriter@0.6.2

## 0.7.1

### Patch Changes

- bd4c75a: Align public docs with safer result cache keys and availability ordering, isolated prompt one-shot/session readiness semantics, bounded warm session cache controls, and synced package reference pages.
- Updated dependencies [bd4c75a]
  - @web-ai-sdk/prompt@0.7.1
  - @web-ai-sdk/summarizer@0.6.1
  - @web-ai-sdk/writer@0.6.1
  - @web-ai-sdk/rewriter@0.6.1
  - @web-ai-sdk/translator@0.6.1
  - @web-ai-sdk/detector@0.6.1
  - @web-ai-sdk/proofreader@0.6.1

## 0.7.0

### Minor Changes

- 1ef1db3: Add `samplingMode` support for the Prompt API while keeping raw `temperature` and `topK` as deprecated legacy passthroughs.

  `samplingMode` is forwarded to `LanguageModel.create()` and rejected when mixed with raw sampling parameters.

### Patch Changes

- Updated dependencies [1ef1db3]
  - @web-ai-sdk/prompt@0.7.0

## 0.6.0

### Patch Changes

- Updated dependencies [2b03874]
- Updated dependencies [566c68f]
  - @web-ai-sdk/summarizer@0.6.0
  - @web-ai-sdk/proofreader@0.6.0
  - @web-ai-sdk/webmcp@0.6.0
  - @web-ai-sdk/prompt@0.6.0
  - @web-ai-sdk/translator@0.6.0
  - @web-ai-sdk/detector@0.6.0
  - @web-ai-sdk/writer@0.6.0
  - @web-ai-sdk/rewriter@0.6.0

## 0.5.2

### Patch Changes

- Updated dependencies [cb386ff]
  - @web-ai-sdk/prompt@0.5.2
  - @web-ai-sdk/webmcp@0.5.2
  - @web-ai-sdk/summarizer@0.5.2
  - @web-ai-sdk/translator@0.5.2
  - @web-ai-sdk/detector@0.5.2
  - @web-ai-sdk/writer@0.5.2
  - @web-ai-sdk/rewriter@0.5.2
  - @web-ai-sdk/proofreader@0.5.2

## 0.5.1

### Patch Changes

- Updated dependencies [b7afed6]
  - @web-ai-sdk/prompt@0.5.1
  - @web-ai-sdk/webmcp@0.5.1
  - @web-ai-sdk/summarizer@0.5.1
  - @web-ai-sdk/translator@0.5.1
  - @web-ai-sdk/detector@0.5.1
  - @web-ai-sdk/writer@0.5.1
  - @web-ai-sdk/rewriter@0.5.1
  - @web-ai-sdk/proofreader@0.5.1

## 0.5.0

### Minor Changes

- 6e5e40f: Add three new building blocks for the Web's Built-in Writing Assistance APIs:
  - `@web-ai-sdk/writer` wraps the `Writer` API: generates new content from a writing task with tone / format / length options, session reuse, streaming, and opt-in result caching.
  - `@web-ai-sdk/rewriter` wraps the `Rewriter` API: revises existing text with tone / length adjustments, session reuse, streaming, and opt-in result caching.
  - `@web-ai-sdk/proofreader` wraps the `Proofreader` API: corrects grammar, spelling, and punctuation, returning the corrected text plus per-issue corrections with offsets.

  All three are re-exported from `@web-ai-sdk/all` (namespaced root and per-package subpaths) and ship a vanilla core plus a React hook subpath (`useWriter`, `useRewriter`, `useProofreader`).

### Patch Changes

- Updated dependencies [6e5e40f]
- Updated dependencies [b09365e]
  - @web-ai-sdk/proofreader@0.5.0
  - @web-ai-sdk/rewriter@0.5.0
  - @web-ai-sdk/writer@0.5.0
  - @web-ai-sdk/prompt@0.5.0
  - @web-ai-sdk/webmcp@0.5.0
  - @web-ai-sdk/summarizer@0.5.0
  - @web-ai-sdk/translator@0.5.0
  - @web-ai-sdk/detector@0.5.0

## 0.4.0

### Minor Changes

- 925ae50: **0.4 — API normalization pass. Breaking changes; one-shot pre-1.0 cleanup.**

  The SDK now follows one consistent shape across every package:
  - Every primitive takes `{ input, ...config }`.
  - Every result-returning primitive returns `{ output, cached }`.
  - Every package exports `isAvailable()` / `checkAvailability()` (no more per-package `is<X>Available` names).
  - Every package accepts `cache: "session" | "local" | { get, set }` as a string shortcut or custom backend.
  - Every React hook exposes `{ status, output, error, fromCache, … }` with a unified `status` enum: `"idle" | "loading" | "streaming" | "done" | "unavailable"`.

  ### Migration guide

  #### Renamed inputs

  | Old                                              | New                                                                              |
  | ------------------------------------------------ | -------------------------------------------------------------------------------- |
  | `detect({ text })`                               | `detect({ input })`                                                              |
  | `summarize({ text })` / `summarize({ article })` | `summarize({ input: string })` — see _removed: article mode_                     |
  | `translate({ roots, ... })`                      | `translate({ input, sourceLanguage, targetLanguage })` — see _removed: DOM mode_ |
  | `useDetector({ text })`                          | `useDetector({ input })`                                                         |
  | `useSummarizer({ text, article })`               | `useSummarizer({ input })`                                                       |

  #### Renamed results

  | Old                                                  | New                                                         |
  | ---------------------------------------------------- | ----------------------------------------------------------- |
  | `{ summary: string \| null, cached }`                | `{ output: string \| null, cached }`                        |
  | `{ response: string \| null, cached }`               | `{ output: string \| null, cached }`                        |
  | `{ language, confidence, all, cached }`              | `{ output: { language, confidence, all } \| null, cached }` |
  | `useSummarizer() → { summary, ... }`                 | `useSummarizer() → { output, ... }`                         |
  | `usePrompt() → { response, ... }`                    | `usePrompt() → { output, ... }`                             |
  | `useDetector() → { language, confidence, all, ... }` | `useDetector() → { output, ... }`                           |

  #### Renamed availability

  | Old                       | New                                             |
  | ------------------------- | ----------------------------------------------- |
  | `isPromptAvailable()`     | `isAvailable()` (from `@web-ai-sdk/prompt`)     |
  | `isDetectorAvailable()`   | `isAvailable()` (from `@web-ai-sdk/detector`)   |
  | `isSummarizerAvailable()` | `isAvailable()` (from `@web-ai-sdk/summarizer`) |
  | `isTranslatorAvailable()` | `isAvailable()` (from `@web-ai-sdk/translator`) |
  | `isWebMCPAvailable()`     | `isAvailable()` (from `@web-ai-sdk/webmcp`)     |

  When importing several at once, alias them: `import { isAvailable as isPromptAvailable } from "@web-ai-sdk/prompt"`.

  #### Cache option shortcut

  `cache: createSessionStorageCache()` is no longer the preferred shape. Pass `cache: "session"` (sessionStorage) or `cache: "local"` (localStorage). Custom `{ get, set }` backends are unchanged. The factory function is no longer exported.

  ```diff
  - summarize({ input, language, cache: createSessionStorageCache() })
  + summarize({ input, language, cache: "session" })
  ```

  #### Removed: escape hatches

  These low-level exports leaked the session-cache plumbing and are deleted:
  - `getLanguageDetectorApi`, `getOrCreateLanguageDetector`
  - `getSummarizerApi`, `getOrCreateSummarizer`
  - `getTranslatorApi`, `getOrCreateTranslator`
  - `getLanguageModelApi`, `getOrCreateLanguageModel`
  - `getModelContext`
  - `clearSession`, `clearSessions`, `configurePromptCache`, `configureSummarizerCache`
  - `createSessionStorageCache`, `defaultCacheKey`
  - Summarizer: `buildSkeleton`, `cleanSummary`, `trimToSentenceBoundary`, `DEFAULT_MAX_INPUT_CHARS`, `DEFAULT_MIN_SKELETON_CHARS`
  - Translator: `serializeBlock`, `rebuildBlock`, `buildCasingMap`, `isUntranslatableToken`, `stripTokens`, `restoreOriginalCasing`, `DEFAULT_ROOT_SELECTOR`, `DEFAULT_BLOCK_SELECTOR`, `TranslateController`, `TranslateProgress`, `RootsOption`, `SkipReason`
  - WebMCP: `registerTools` (was already deprecated in 0.3)

  If you were reaching for any of these, the principle is: the SDK wraps one platform API per package. If you need to compose them, write the composition in your app.

  #### Removed: summarizer article mode

  `summarize({ article: Element })` is no longer supported. The SDK is string-mode only:

  ```diff
  - summarize({ language: "en", article: document.querySelector("article") })
  + const article = document.querySelector("article");
  + summarize({ language: "en", input: article?.innerText ?? "" })
  ```

  For the previous skeleton-extraction behavior (title + headings + bolds, sentence-boundary trimmed), extract the text yourself with `element.querySelectorAll("h1, h2, h3, h4, strong, b")` before calling `summarize({ input })`.

  #### Removed: translator DOM mode

  `translate({ roots, blockSelector, onProgress, ... })` is gone. The SDK is string-mode only:

  ```diff
  - const controller = translate({
  -   sourceLanguage: "en",
  -   targetLanguage: "pt",
  -   roots: "[data-translate-root]",
  - });
  - await controller.done;
  + const { output } = await translate({
  +   input: "Hello, world.",
  +   sourceLanguage: "en",
  +   targetLanguage: "pt",
  + });
  ```

  For the previous block-level DOM round-trip (placeholder serialization, casing restoration, snapshot-based restore, progress events), the pipeline is consumer code: walk your blocks, call `translate({ input })` per block, and rebuild the DOM yourself.

  #### Flattened: summarizer create options

  `type` / `length` / `format` / `preference` are now top-level on `SummarizeOptions`:

  ```diff
  - summarize({
  -   language: "en",
  -   input,
  -   createOptions: { type: "key-points", length: "short" },
  - })
  + summarize({
  +   language: "en",
  +   input,
  +   type: "key-points",
  +   length: "short",
  + })
  ```

  The `createOptions` passthrough on `summarize` and `ask` is removed. `createSession()` keeps it because the chat-session primitive is the explicit power-user entry point.

  #### Reshaped: `sharedContext`

  `summarize.sharedContext` is now a `string` (matching the platform API), not a `Record<string, string>`. If you were keying it by language, pick the right one per call:

  ```diff
  - summarize({ language: "pt", input, sharedContext: { pt: "...", en: "..." } })
  + summarize({ language: "pt", input, sharedContext: "..." })
  ```

  #### Removed: summarizer fallback knobs

  `maxInputChars` and `minSkeletonChars` are gone (they only mattered for article mode). If you're trimming long input, do it before calling `summarize()`.

  #### React hook status enum

  `useDetector` and `useSummarizer` previously used `"pending"` for the initial state. `useTranslator` used `state` instead of `status` and exposed `progress` / `restore`. All hooks now use `status: "idle" | "loading" | "streaming" | "done" | "unavailable"` and a unified return shape `{ status, output, error, fromCache, ... }`. `useTranslator` is now auto-running string-mode (no `progress`, no `restore`); for block-level DOM translation see the example.

### Patch Changes

- Updated dependencies [925ae50]
  - @web-ai-sdk/prompt@0.4.0
  - @web-ai-sdk/webmcp@0.4.0
  - @web-ai-sdk/summarizer@0.4.0
  - @web-ai-sdk/translator@0.4.0
  - @web-ai-sdk/detector@0.4.0

## 0.3.4

### Patch Changes

- Updated dependencies [0ac3a0c]
  - @web-ai-sdk/webmcp@0.3.4
  - @web-ai-sdk/prompt@0.3.4
  - @web-ai-sdk/summarizer@0.3.4
  - @web-ai-sdk/translator@0.3.4
  - @web-ai-sdk/detector@0.3.4

## 0.3.3

### Patch Changes

- 9cff7cb: Adds a one-line `**Docs:**` pointer near the top of every package README linking to the canonical guide on web-ai-sdk.dev (and the matching React hook page where applicable). No API or behavior change — purely makes `npm view <pkg> README` self-routing so an agent or reader landing on a registry page can jump straight to the right docs without scanning for an external link.
- Updated dependencies [9cff7cb]
  - @web-ai-sdk/prompt@0.3.3
  - @web-ai-sdk/webmcp@0.3.3
  - @web-ai-sdk/summarizer@0.3.3
  - @web-ai-sdk/translator@0.3.3
  - @web-ai-sdk/detector@0.3.3

## 0.3.2

### Patch Changes

- Updated dependencies [f52a98a]
  - @web-ai-sdk/prompt@0.3.2
  - @web-ai-sdk/webmcp@0.3.2
  - @web-ai-sdk/summarizer@0.3.2
  - @web-ai-sdk/translator@0.3.2
  - @web-ai-sdk/detector@0.3.2

## 0.3.1

### Patch Changes

- Updated dependencies [59943e3]
  - @web-ai-sdk/prompt@0.3.1
  - @web-ai-sdk/webmcp@0.3.1
  - @web-ai-sdk/summarizer@0.3.1
  - @web-ai-sdk/translator@0.3.1
  - @web-ai-sdk/detector@0.3.1

## 0.3.0

### Minor Changes

- d40f472: 0.3 surfaces the chat-shaped APIs the lifecycle layer was missing, plus a handful of ergonomic renames. Pre-1.0, semver-loose: renames land without aliases.

  ### Highlights

  **`createSession()` + `useSession()` in `@web-ai-sdk/prompt`**

  A thin primitive for chat-shaped apps. Each call returns an independent `LanguageModel` session — never shared via the one-shot cache — so per-conversation history, system prompt, sampling, and lifecycle stay isolated, and `abort()` / `destroy()` on one session never touch another. `session.sendStreaming()` yields **deltas** (one element per new chunk, not cumulative). The wrapper handles cross-browser smoothing (delta-vs-cumulative detection, output sanitization, abort wiring, typed unavailability) and forwards everything else to the native instance. It deliberately does NOT track conversation history, queue concurrent sends, or wrap `clone()` — those are consumer data model and UI concerns. Token-level interleaving across sessions is implementation-defined: Chrome 138 / Edge 138 currently serialize `sendStreaming` calls across sessions FIFO (the underlying on-device model is single-instance); the API is forward-compatible for runtimes that expose parallel inference.

  ```ts
  import { createSession } from "@web-ai-sdk/prompt";

  const session = createSession({ systemPrompt, temperature });
  for await (const delta of session.sendStreaming("Hi")) write(delta);
  session.destroy();
  ```

  `useSession` is lifecycle-only: it creates the session, destroys on unmount, recreates on option changes, and exposes `{ status, error, session }`. UI state lives in your component.

  For ask-and-display flows (embeds, widgets) keep using `ask()` / `usePrompt`.

  **`defineTool()` with Standard Schema in `@web-ai-sdk/webmcp`**

  A typed tool builder that accepts any [Standard Schema](https://standardschema.dev) V1 validator (Zod, Valibot, ArkType, Effect, …) without adding a dependency. The schema narrows `execute`'s input type; runtime validation is opt-in via `validate: true` (default `false`, since hosts already validate against `inputSchema`). `inputSchema` stays explicit JSON Schema for the host. Returns a plain `Tool` so it composes with `registerTool` / `registerTools` / `useWebMCP` unchanged.

  **Cache controls in `@web-ai-sdk/prompt` and `@web-ai-sdk/summarizer`**

  The internal session caches are now LRU-bounded (default 8). New exports:
  - `clearSessions()` / `clearSession(opts)` (prompt); `clearSummarizerSessions()` / `clearSummarizerSession(opts)` (summarizer).
  - `configurePromptCache({ max })` / `configureSummarizerCache({ max })`.

  Evicted sessions get their `destroy()` invoked when present. `createSession()` is never cached.

  ### Renames (no aliases)
  - **`prompt()` → `ask()`** in `@web-ai-sdk/prompt`. The function name no longer shadows `window.prompt` or collides with `prompt` as a common local variable. The option `prompt: string` is now `input: string`. `PromptOptions` → `AskOptions`, `PromptResult` → `AskResult`. The package name is unchanged; the React hook name `usePrompt` is unchanged.
  - **`onChunk` → `onUpdate`** in `@web-ai-sdk/prompt` and `@web-ai-sdk/summarizer`. The callback semantics (cumulative buffer, not deltas) didn't change; the new name is more truthful. For delta-shaped streaming use `createSession().sendStreaming()`.

  ### Other
  - `ask()` now emits a one-shot `console.warn` when `systemPrompt` is passed alongside `createOptions.initialPrompts` (the latter silently overrides the synthesized system prompt). This hardens to a typed error in 0.4.

  ### Migration

  ```diff
  - import { prompt } from "@web-ai-sdk/prompt";
  - await prompt({ prompt: "hi", onChunk: (t) => render(t) });
  + import { ask } from "@web-ai-sdk/prompt";
  + await ask({ input: "hi", onUpdate: (t) => render(t) });
  ```

  For chat apps that were holding their own `Map<agentId, LanguageModelInstance>`:

  ```diff
  - const session = api.create({ initialPrompts: [...] });
  - for await (const chunk of session.promptStreaming(input)) { /* … */ }
  + import { createSession } from "@web-ai-sdk/prompt";
  + const session = createSession({ systemPrompt });
  + for await (const delta of session.sendStreaming(input)) { /* … */ }
  ```

### Patch Changes

- Updated dependencies [d40f472]
  - @web-ai-sdk/prompt@0.3.0
  - @web-ai-sdk/webmcp@0.3.0
  - @web-ai-sdk/summarizer@0.3.0
  - @web-ai-sdk/translator@0.3.0
  - @web-ai-sdk/detector@0.3.0

## 0.2.0

### Minor Changes

- 78d99fc: Introduce `@web-ai-sdk/all`, a meta-package that re-exports the five `@web-ai-sdk/*` building blocks (`prompt`, `summarizer`, `translator`, `detector`, `webmcp`) behind a single install. Two import shapes are supported:

  ```ts
  // Namespaced root (handy for prototyping):
  import { prompt, summarizer } from "@web-ai-sdk/all";
  await prompt.prompt({ prompt: "Hello" });

  // Per-package subpaths (cleanest tree-shaking):
  import { prompt } from "@web-ai-sdk/all/prompt";
  import { useSummarizer } from "@web-ai-sdk/all/summarizer/react";
  ```

  The aggregator and the five scoped packages release together via a Changesets `fixed` group; every release ships all six packages at the same version.

### Patch Changes

- @web-ai-sdk/prompt@0.2.0
- @web-ai-sdk/webmcp@0.2.0
- @web-ai-sdk/summarizer@0.2.0
- @web-ai-sdk/translator@0.2.0
- @web-ai-sdk/detector@0.2.0
