# @web-ai-sdk/translator

## 0.5.2

## 0.5.1

## 0.5.0

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

## 0.3.4

## 0.3.3

### Patch Changes

- 9cff7cb: Adds a one-line `**Docs:**` pointer near the top of every package README linking to the canonical guide on web-ai-sdk.dev (and the matching React hook page where applicable). No API or behavior change — purely makes `npm view <pkg> README` self-routing so an agent or reader landing on a registry page can jump straight to the right docs without scanning for an external link.

## 0.3.2

## 0.3.1

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

## 0.2.0

## 0.1.1

### Patch Changes

- 0a02aa3: Patch release validating the npm Trusted Publishing (OIDC) release path end-to-end. Each package now ships with SLSA provenance attestations. Also corrects the stale `web-ai-sdk-kit` `homepage` and `bugs.url` fields in `@web-ai-sdk/webmcp`, `@web-ai-sdk/summarizer`, and `@web-ai-sdk/translator` left over from the rebrand.

## 0.1.0

### Minor Changes

- a2a4a7b: Initial public release.
  - `@web-ai-sdk/webmcp`: building block for `navigator.modelContext` with `registerTool` / `registerTools` and a `useWebMCP` React hook. AbortSignal-based cleanup, last-writer-wins eviction on duplicate names, no-op fallback on browsers without WebMCP.
  - `@web-ai-sdk/translator`: building block for the Web's Built-in `Translator` with block serialization, casing restoration, snapshot-based restore, and a `useTranslator` React hook.
  - `@web-ai-sdk/summarizer`: building block for the Web's Built-in `Summarizer` with skeleton extraction, sentence-boundary trim, session reuse, pluggable result caching, streaming, and a `useSummarizer` React hook.
  - `@web-ai-sdk/prompt`: building block for the Web's Built-in `LanguageModel` (Prompt API) with system prompt, sampling controls (`temperature` / `topK`), language hints, session reuse, streaming, structured-output passthrough, pluggable result caching, and a `usePrompt` React hook.
  - `@web-ai-sdk/detector`: building block for the Web's Built-in `LanguageDetector` with confidence thresholds, bias hints, session reuse, pluggable result caching, and a `useDetector` React hook. Pairs with the other packages to skip the manual `language: "en"` argument when the input language isn't known ahead of time.
