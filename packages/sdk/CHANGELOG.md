# @web-ai-sdk/all

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
