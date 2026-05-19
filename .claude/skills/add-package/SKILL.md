---
name: add-package
description: Add a new building block package to the web-ai-sdk monorepo. Mirrors the conventions established by webmcp / translator / summarizer / prompt / detector; vanilla TypeScript core + optional React subpath adapter + Astro Starlight MDX guides. Use when the user asks to add a new package, wrap a new browser AI API, or extend the kit with another module.
---

# Add a new package to web-ai-sdk

Use this when the user wants a new `@web-ai-sdk/<name>` package wrapping a browser AI API. The existing packages (`webmcp`, `translator`, `summarizer`, `prompt`) are the canonical shape; mirror whichever is closest.

## 1. Pick the closest template

- **Streaming + session reuse + result cache** → mirror `summarizer` or `prompt`. Most browser AI surfaces fit here.
- **AbortSignal-based registry / lifecycle** (no streaming) → mirror `webmcp`.
- **DOM transformation / block walking** → mirror `translator`.

Don't generalize across packages; copy the small utilities (cache, defaultCacheKey, abort patterns). The monorepo intentionally has no shared internals. See AGENTS.md § 5.

## 2. Audit the underlying API first

Before any code:
- Read the spec (e.g. `https://github.com/webmachinelearning/...` or Chrome dev docs).
- Probe the actual shape in real Chrome with `chrome-devtools` MCP if the user has it. The W3C spec and Chrome's implementation drift; `WebMCP` spec describes `unregisterTool`; Chrome ships AbortSignal-only. Always confirm against the live surface.
- Note the global object name (`Summarizer`, `Translator`, `LanguageModel`, `navigator.modelContext`), method signatures, error modes, availability semantics.

## 3. Scaffold

```bash
mkdir -p packages/<name>/src/react
cp LICENSE packages/<name>/LICENSE
```

Create each file by mirroring summarizer (or whichever template), changing scope/name:

- `package.json`; name `@web-ai-sdk/<name>`, version `0.0.0`, `publishConfig.access: "public"`, `files: ["dist", "LICENSE", "README.md"]`, `repository.directory: "packages/<name>"`, both subpath exports for `.` and `./react`, peer dep on `react` (optional)
- `tsconfig.json`; extends `../../tsconfig.base.json`
- `tsup.config.ts`; same shape as summarizer (ESM + CJS + dts, treeshake, `external: ["react"]`)
- `vitest.config.ts`; `environment: "happy-dom"`

## 4. Implement core

Per the core package contract (AGENTS.md § 5):

- **`src/api.ts`**; adapter over the global. Export `getXxxApi()` (feature-detect, returns `null` if missing), `isXxxAvailable()`, `checkAvailability()` (catches throws, returns `null` on failure), `getOrCreateXxx()` (session cache, deletes slot on failure), `__clearSessionCacheForTests()`.
- **`src/cache.ts`** (if result-cacheable); `createSessionStorageCache({ storage?, prefix? })` returning `{ get, set }`. `defaultCacheKey(input)` derives a stable key from the inputs that affect the model output (NOT from `Date.now()` or random values).
- **`src/index.ts`**; vanilla entrypoint:
  - Throws a typed `XxxUnavailableError` when the API is missing or availability is `"unavailable"`.
  - Accepts `AbortSignal` (check at every yield point: before session start, between chunks, after each await).
  - Streams via `onChunk` callback when the underlying instance supports streaming, falls back to one-shot otherwise.
  - Writes to the result cache **only on success** (never on abort).
  - Re-exports types via `export type { ... } from "./api.js"`.
- **`src/react/index.ts`**; thin hook. State machine: `idle | loading | streaming | done | unavailable`. Use a `useRef` for stable options if the hook is callable (e.g. `ask(input)` style). Auto-run if the trigger is data (Summarizer; `article` change re-runs). Imperative if the trigger is user action (Prompt; call `ask()`).

## 5. Tests

Vanilla (`src/index.test.ts`):
- `isXxxAvailable()` true / false on global presence
- Throws `XxxUnavailableError` when global is missing
- Returns null when input is empty
- Reads from result cache before invoking the model
- One-shot path when `xxxStreaming` is absent
- Streams chunks via `onChunk`, concatenates final
- Forwards each significant option to the underlying `create()`
- Reuses sessions across same-shape calls, creates new ones for different shapes
- Throws `XxxUnavailableError` when availability is `"unavailable"`
- Honors custom `cacheKey`
- Aborts via `AbortSignal`

React (`src/react/index.test.tsx`):
- Starts in `"unavailable"` when API is missing, `"idle"` otherwise
- Transitions through state machine on trigger
- Sets `fromCache: true` for cached results
- `reset()` clears response and returns to `"idle"`
- (If imperative) cancels in-flight on subsequent calls / `abort()`

Use `happy-dom` + `vi.fn()` for the global; never import the real Chrome surface in tests.

## 6. README

Mirror the existing per-package READMEs:

1. One-line description starting "Building block for ..." + Chrome flag note
2. `## Status`; Chrome version + flag name + no-op fallback note
3. `## Install`; pnpm/npm/bun lines + peer dep note
4. `## Vanilla TypeScript / DOM`; smallest possible working example
5. `## React`; smallest possible working example
6. State machine description
7. `## API`; type signatures + brief prose for each export
8. (If applicable) `## Caching`, `## Errors and unavailability`, `## Troubleshooting`
9. `## License`; MIT © Beto Muniz

No em dashes (`—`). Period-or-semicolon prose.

## 7. Docs integration

Three files in `apps/docs/`:

- **`src/components/XxxDemo.tsx`**; standalone React component. Uses the React hook, polished card chrome (matches the others: `1px solid #e5e7eb`, `borderRadius: 12`, soft shadow, `marginTop: 24`, `padding: 28`, `maxWidth: 560-640`). **No internal `<h2>X demo</h2>`**; the MDX "Live demo" heading is the label.
- **`src/content/docs/guides/<name>.mdx`**; YAML frontmatter (`title`, `description`). Conceptual / vanilla guide. Includes a `## Usage` code block. Cross-link at the bottom: "See [useX](/react/use-<name>/)".
- **`src/content/docs/react/use-<name>.mdx`**; YAML frontmatter. Imports the demo component and renders it under `## Live demo` with `client:only="react"` so it hydrates client-side. Includes a `## Usage` code block with the hook.

Then add the two new sidebar entries to `apps/docs/astro.config.mjs` (under "Guides" and "React Hooks").

## 8. Update workspace + meta

- `apps/docs/package.json`; add `"@web-ai-sdk/<name>": "workspace:*"` to `dependencies`
- Root `README.md`; add row to the package table, add to the per-package list, add the Chrome flag to the "open in Chrome" note, add to the folder layout
- `AGENTS.md`; add row to the package table, add to the folder map
- `.changeset/initial-release.md`; add `"@web-ai-sdk/<name>": minor` if pre-publish; otherwise create a new changeset

## 9. Verify

```bash
pnpm install                # picks up the new workspace package
pnpm gate                   # lint + build + typecheck + tests (must be 0 errors)
pnpm --filter @web-ai-sdk/<name> test   # focused test run
npm pack --dry-run          # in the package dir; confirm only dist + LICENSE + README + package.json
pnpm docs                   # boots the Starlight docs site; check both new pages render
```

Open `http://localhost:6006/guides/<name>/` and `http://localhost:6006/react/use-<name>/`. Verify the embedded demo works end-to-end against the real Chrome API if the flag is enabled.

## 10. Don'ts

- Don't generalize utilities across packages. Copy `cache.ts` and `defaultCacheKey` per package.
- Don't add UI components (cards, buttons) to the library. Demos in `apps/docs/` are consumer UI, not library API.
- Don't auto-create accounts or organizations. The user owns scope/repo creation.
- Don't write em dashes in docs or examples; period or semicolon instead.
- Don't add a `.npmignore`; the `files` whitelist in `package.json` is the right mechanism.
- Don't hand-edit `pnpm-lock.yaml` or `dist/`.
- Don't bump versions manually; let changesets do it via `pnpm version-packages`.

## 11. Document the decision

After landing, update the memory note (`~/.claude/projects/-Users-obetomuniz-Workspace-me-projects-web-ai/memory/project_web_ai_oss_extraction.md`) with the new package row and any spec-vs-implementation drift you discovered (Chrome shipping AbortSignal-only instead of `unregisterTool`, native testing surface returning records-not-strings, etc.). These are the things that bite the next session if they aren't captured.
