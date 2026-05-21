# @web-ai-sdk/detector

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
