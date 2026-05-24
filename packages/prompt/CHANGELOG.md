# @web-ai-sdk/prompt

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
