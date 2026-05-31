# @web-ai-sdk/prompt

## 0.5.2

### Patch Changes

- cb386ff: Expose context-window introspection on `Session` so consumers can size work to the real model context instead of hardcoding, without reaching past the SDK to `globalThis.LanguageModel`.
  - **`Session.contextWindow` / `Session.contextUsage`**: readonly passthroughs of the native instance's token budget (the context window and tokens used so far). These match the Prompt API's current canonical names (the renamed successors of `inputQuota` / `inputUsage`); the wrapper reads the new names and falls back to the deprecated ones on older Chrome builds. Both are `undefined` until the lazily-created instance exists; on a session from `clone()` they are readable the moment `clone()` resolves, which is exactly when a consumer wants to budget a per-run turn against the inherited system prompt.
  - **`Session.onContextOverflow(listener)`**: subscribe to the native `contextoverflow` event (fired when a turn pushes usage past the window and the oldest history is dropped) so consumers can compact or fork a fresh `clone()` before `QuotaExceededError`. Returns an idempotent cleanup function and is a feature-detected no-op when the underlying instance doesn't expose the event.

## 0.5.1

### Patch Changes

- b7afed6: Add experimental native tool-calling passthrough. `ask()`, `createSession()`, and `useSession()` now accept a `tools` array (`LanguageModelTool[]`) that is forwarded verbatim to the browser's `LanguageModel.create()`. This is pass-through only: the SDK does not execute the tools, and current stable Chrome accepts the option but no-ops it (the model may surface its call as `tool_code` text). It begins working automatically on browsers that ship native execution. The `expectedInputs` / `expectedOutputs` unions also widen to allow the `tool-response` / `tool-call` modalities.

## 0.5.0

### Minor Changes

- b09365e: Add session-resilience primitives to `@web-ai-sdk/prompt` so consumers can build a stable on-device agent without reaching into the native API.
  - **`Session.clone()`**: surface the native `LanguageModel` clone on the `Session` wrapper. Keep one warm base session (system prompt only) and fork a fresh-history clone per task, the spec's recommended pattern. This avoids both the cross-run "caching" of reusing a single long-lived session and the cold-instance degradation of repeated `create()` / `destroy()`. The clone is wrapped with the same delta-smoothing / abort / typed-error behavior, and its lifecycle is fully independent of the parent. Throws `PromptUnavailableError` if the browser instance lacks `clone()`.
  - **Export `PromptAbortError`**: it was thrown but not exported, forcing brittle `err.name` string matching. `ask()` and sessions now throw the same exported class, so consumers can `instanceof PromptAbortError`.
  - **`omitResponseConstraintInput`** on `SessionSendOptions` and `AskOptions`: forwards to the native prompt call to drop the inlined JSON Schema from the model's context (saves tokens) while the `responseConstraint` still shapes the output.

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

### Patch Changes

- f52a98a: Correct browser-support claims across docs, per-package READMEs, the landing support table, and demo unavailability messages so they line up with the official Chrome and Edge documentation as of May 2026.

  What changed in the matrix:
  - **Prompt API on Chrome**: `138+ · flag` → `148+ · stable`. Per [Chrome at I/O 2026](https://developer.chrome.com/blog/chrome-at-io26) the API graduated to stable in Chrome 148. Chrome 138–147 still works behind `chrome://flags/#prompt-api-for-gemini-nano`.
  - **Prompt API on Edge**: clarified as `138+ · Canary/Dev · partial · flag` — Microsoft's [Edge Prompt API docs](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/prompt-api) ship this only as a developer preview behind `edge://flags/#prompt-api-for-phi-mini`.
  - **Translator API on Edge**: `138+ · stable` → `143+ · Canary/Dev · flag`. Per the [Edge Translator API docs](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/translator-api) it only exists in Canary/Dev behind `edge://flags/#edge-translation-api`.
  - **Language Detector on Edge**: `138+ · stable` → `147+ · Canary/Dev · flag`. Per the [Edge Language Detector docs](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/languagedetector-api) it only exists in Canary/Dev behind `edge://flags/#edge-language-detection-api`.
  - **Summarizer on Edge**: `138+ · partial` → `138+ · stable · partial` (default-on since Edge 138 per the [Edge Writing Assistance APIs docs](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/writing-assistance-apis); the "partial" caveat is about model output quality, not API availability).
  - **WebMCP on Chrome**: `146+ · stable` → `146+ · flag · OT 149+`. Per the [WebMCP docs](https://developer.chrome.com/docs/ai/webmcp) and the Chrome 149 origin trial announcement it is still behind `chrome://flags/#enable-webmcp-testing`; a public origin trial opens in Chrome 149.
  - **WebMCP on Edge**: `146+ · stable` → `147+ · flag`.

  No API or behavior change. Updates the browser-support matrix, every published package's README "Status" section, the landing-page support table, the prompt session/concurrency JSDoc that referenced "Chrome 138" instead of 148, and the demo "open in …" unavailability messages so they cite the correct Edge channel + version for each API.

## 0.3.1

### Patch Changes

- 59943e3: Amends the `createSession()` / `useSession()` docs to match the empirical behavior of Chrome 138 / Edge 138. The 0.3 release notes (and README, JSDoc, and the Prompt API guide on the docs site) leaned on "N parallel chats stream concurrently" or close paraphrases. Token-level interleaving across independent sessions is not actually delivered by the runtime today: the on-device model is single-instance, so the browser drains one `sendStreaming` call fully before starting the next, even across separate `createSession()` instances.

  No API change, no behavior change. `createSession()` / `useSession()` still solve the bugs they shipped to solve — isolated history per session, isolated system prompt and sampling, scoped `abort()` and `destroy()` — and the API stays forward-compatible the day a runtime exposes parallel inference. The docs now make the runtime constraint explicit (a new "Concurrency note" in the prompt README and Prompt API guide) and the README / JSDoc copy emphasizes independence-of-state rather than concurrent streaming.

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
