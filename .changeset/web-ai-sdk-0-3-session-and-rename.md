---
"@web-ai-sdk/all": minor
"@web-ai-sdk/prompt": minor
"@web-ai-sdk/webmcp": minor
"@web-ai-sdk/summarizer": minor
"@web-ai-sdk/translator": minor
"@web-ai-sdk/detector": minor
---

0.3 surfaces the chat-shaped APIs the lifecycle layer was missing, plus a handful of ergonomic renames. Pre-1.0, semver-loose: renames land without aliases.

### Highlights

**`createSession()` + `useSession()` in `@web-ai-sdk/prompt`**

A thin primitive for chat-shaped apps. Each call returns an independent `LanguageModel` session — never shared via the one-shot cache — so N parallel chats stream concurrently. `session.sendStreaming()` yields **deltas** (one element per new chunk, not cumulative). The wrapper handles cross-browser smoothing (delta-vs-cumulative detection, output sanitization, abort wiring, typed unavailability) and forwards everything else to the native instance. It deliberately does NOT track conversation history, queue concurrent sends, or wrap `clone()` — those are consumer data model and UI concerns.

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
