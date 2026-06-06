# .agents/agents.md

This file is the single source of truth for **any AI agent** (Cursor, Claude Code, Copilot, Devin, etc.) working on this repository. Read it once at the start of a session, then keep it open as a reference.

The root `AGENTS.md` is a compatibility symlink to this file for tools that still discover only the older AGENTS.md convention.

For human-facing context see the root [`README.md`](../README.md) and [`CONTRIBUTING.md`](../CONTRIBUTING.md), plus one README per package under `packages/<name>/README.md`.

---

## 1. What this is

**`web-ai-sdk`** is a small monorepo of building blocks for the Web's Built-in AI APIs. Each package is framework-agnostic by default and ships a React subpath adapter; future Vue / Svelte adapters slot in the same way.

| Package                 | Wraps                                                  | Status     |
| ----------------------- | ------------------------------------------------------ | ---------- |
| `@web-ai-sdk/webmcp`    | `document.modelContext` (W3C WebMCP)                   | Ported     |
| `@web-ai-sdk/translator`| `Translator` (Web Built-in AI Translator API)       | Ported     |
| `@web-ai-sdk/summarizer`| `Summarizer` (Web Built-in AI Summarizer API)       | Ported     |
| `@web-ai-sdk/prompt`    | `LanguageModel` (Web Built-in AI Prompt API)        | New        |
| `@web-ai-sdk/detector`  | `LanguageDetector` (Web Built-in AI Language Detection API) | New |
| `@web-ai-sdk/writer`    | `Writer` (Web Built-in AI Writer API)               | New        |
| `@web-ai-sdk/rewriter`  | `Rewriter` (Web Built-in AI Rewriter API)           | New        |
| `@web-ai-sdk/proofreader`| `Proofreader` (Web Built-in AI Proofreader API)    | New        |
| `@web-ai-sdk/all`       | meta-package; re-exports the others above under one install | New     |

One private workspace app lives under `apps/site`: an Astro marketing site with Starlight docs mounted at `/docs/` and live React demos. Run `pnpm dev` after `pnpm build:packages`.

Each package exposes:

- **Vanilla** (`@web-ai-sdk/<pkg>`); TS/DOM only, zero framework deps.
- **React** (`@web-ai-sdk/<pkg>/react`); small hook adapter that wraps the vanilla core. `react` is an optional peer dep.

Lifecycle layer on purpose. Each package only manages session lifetime, cleanup, feature detection, and the gnarly bits (safe register/unregister in webmcp, delta-vs-cumulative chunk smoothing in prompt/summarizer, etc.). Framework adapters, polyfills, and UI primitives are opt-in subpaths, not bundled into the core packages.

### Scope rule

Decision heuristic for new code: *if it bonds two SDK packages, walks the DOM, or needs a third-party runtime, it doesn't belong in an SDK wrapper.* Higher-level compositions (block-level DOM translation, article skeleton extraction, detect-then-summarize chains) are consumer-code territory; the SDK ships primitives only.

The bias is toward *less* code over time, not more. This is the same trajectory mature utility libraries follow as the platform catches up (lodash → native methods, moment/date-fns → `Temporal`): own only the lifecycle and ergonomics the raw API leaves rough, and let the wrapper thin out as the Built-in AI APIs stabilize. When in doubt about whether something belongs, default to leaving it out.

Full rules in [`CONTRIBUTING.md` § Governance](../CONTRIBUTING.md#governance); user-facing version at [`apps/site/src/content/docs/architecture.mdx`](../apps/site/src/content/docs/architecture.mdx) ([web-ai-sdk.dev/docs/architecture/](https://web-ai-sdk.dev/docs/architecture/)).

---

## 2. Stack & runtime

- **TypeScript** strict, ESM (`"type": "module"`), `verbatimModuleSyntax`.
- **pnpm 9** workspaces (declared in `pnpm-workspace.yaml`).
- **tsup** for builds; emits ESM + CJS + `.d.ts` from `src/index.ts` and `src/react/index.ts`.
- **Vitest + happy-dom** for tests.
- **Biome** for lint + format (one tool, scoped to `packages/**` and `apps/**` `.ts`/`.tsx`). No ESLint, no Prettier.
- **Changesets** for versioning + publishing.
- **Node** `>= 20.19.1` (declared in `engines`; `.nvmrc` pins Node 24 for local dev).
- **Corepack** provisions the right pnpm version automatically from `package.json#packageManager`. No extra tooling required.

---

## 3. Folder map

```
.
├── packages/
│   ├── webmcp/
│   │   ├── src/
│   │   │   ├── index.ts          # vanilla core
│   │   │   ├── index.test.ts
│   │   │   └── react/
│   │   │       ├── index.ts      # React hook
│   │   │       └── index.test.tsx
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── tsup.config.ts
│   │   ├── vitest.config.ts
│   │   └── README.md
│   ├── translator/               # same shape; adds serialize.ts for DOM block walking
│   ├── summarizer/               # same shape; adds skeleton.ts + cache.ts
│   ├── prompt/                   # same shape; adds api.ts + cache.ts
│   ├── detector/                 # same shape; adds api.ts + cache.ts
│   ├── writer/                   # same shape; adds api.ts + cache.ts
│   ├── rewriter/                 # same shape; adds api.ts + cache.ts
│   ├── proofreader/              # same shape; adds api.ts + cache.ts
│   └── sdk/                      # @web-ai-sdk/all meta-package; re-exports the eight above
├── apps/
│   └── site/                     # Astro site + Starlight docs
├── .changeset/
├── .github/workflows/            # CI gate + release + Pages deploy
├── .nvmrc                        # pins Node 24 for local dev
├── biome.json                    # lint + format
├── package.json                  # workspace root + every pnpm script (incl. "packageManager" → pnpm 9.15.0)
├── pnpm-workspace.yaml
├── tsconfig.base.json            # shared compiler options
├── README.md                     # human onboarding entry point
├── CONTRIBUTING.md               # contribution flow
├── .agents/
│   └── agents.md                 # ← you are here
└── AGENTS.md                     # compatibility symlink
```

Package layout is intentionally uniform; open one package, you've seen them all.

---

## 4. Commands

All workflow commands are pnpm scripts in `package.json`.

| Task                              | Command                    |
| --------------------------------- | -------------------------- |
| Watch site + docs                | `pnpm dev`                 |
| Watch wrapper packages            | `pnpm dev:packages`        |
| Watch meta-package                | `pnpm dev:sdk`             |
| Boot unified app (`:5173`)        | `pnpm site`                |
| Build everything                  | `pnpm build`               |
| Build every package               | `pnpm build:packages`      |
| Build the app                     | `pnpm build:apps`          |
| Lint + format audit               | `pnpm lint`                |
| Auto-fix lint + format            | `pnpm lint:fix`            |
| Format only (write)               | `pnpm format`              |
| Format audit only                 | `pnpm format:check`        |
| `tsc --noEmit` everywhere         | `pnpm typecheck`           |
| Vitest across packages            | `pnpm test`                |
| Full quality gate                 | `pnpm gate`                |
| Create a changeset                | `pnpm changeset`           |
| Apply pending changesets          | `pnpm version-packages`    |
| Publish via Changesets            | `pnpm release`             |
| Build Pages artifact              | `pnpm pages:build`         |
| Preview combined Pages locally    | `pnpm pages:preview`       |
| Remove the local `_site/`         | `pnpm pages:clean`         |

**Run before any commit:** `pnpm gate`.

---

## 5. Conventions (the rules to follow)

### TypeScript

- **No `any`.** Reintroducing it should be intentional and commented.
- **Type-only imports** with `import type { ... }`.
- **`verbatimModuleSyntax`**; write the imports the way they'll compile; no implicit elision.
- **`noUncheckedIndexedAccess`** is on; array/index access is `T | undefined`.
- **No relative imports across package boundaries.** Each package is self-contained; cross-package usage goes through `@web-ai-sdk/*` published exports.
- **Subpath imports inside a package** use `.js` suffix (`from "../index.js"`); required by ESM resolution under `moduleResolution: "Bundler"` for the published shape.

### Core package contract

These rules apply to the API-wrapper packages (`@web-ai-sdk/prompt`, `webmcp`, `summarizer`, `translator`, `detector`, `writer`, `rewriter`, `proofreader`). Future packages with a different role (UI primitives, polyfills, etc.) sit at different layers and get their own rules.

- **No UI components in the core wrappers.** A core package may never render DOM. The React adapter is a hook, not a component. UI primitives would ship as a separate `@web-ai-sdk/ui` package, not bolted into a wrapper.
- **Feature detect, never throw.** If the underlying browser API is missing, the package is a no-op (return a no-op cleanup, return `undefined`, etc.) so consumers can ship the same code to all browsers.
- **Configurable selectors / roots.** Don't hardcode page-specific assumptions. The translator's `[data-translate-root]` is a default, not a requirement; every selector / root element must be overridable via the API.
- **Cleanup must be idempotent.** Returning a cleanup function from `register*` / `start*` is the universal lifecycle. Calling it twice must not throw.

### React adapter shape

- Hook-only. Consumers render the button / tooltip / card themselves.
- The hook wraps the vanilla core; do not duplicate logic.
- Effect deps must be honest. If the hook accepts an array, document that callers should memoize it.

### Annotations

- WebMCP exposes shorthand flags (`readOnly`, `destructive`) that translate to spec annotations (`readOnlyHint`, `destructiveHint`) under the hood. Raw `annotations` passthrough merges on top, so consumers can still set `idempotentHint` / `openWorldHint` directly.

### Files & docs

- **One package = one job.** Don't add cross-package helpers in this monorepo without a clear reason; copy small utilities instead.
- **READMEs are user-facing.** Show install, the smallest possible vanilla example, the smallest possible React example, then the API surface.
- Don't write design docs unless the user asks. Conventions live here; package-specific decisions live in the package README.

### Docs reliability

- Treat docs examples as part of the public API. When editing or reviewing docs, verify option names, result shapes, hook return values, and helper export names against the actual exported TypeScript interfaces and runtime tests.
- After API renames, audit stale docs terms across READMEs and docs pages. Common drift patterns in this repo include `prompt()` vs `ask()`, `prompt` vs `input`, `onChunk` vs `onUpdate`, `response` / `summary` vs `output`, top-level detector `language` vs `output.language`, `is*Available()` aliases vs `isAvailable()`, and removed cache factories vs `cache: "session" | "local"`.
- Package READMEs are the source for generated package docs under `apps/site/src/content/docs/packages/*.md`, but those pages are checked in. If you fix a README drift, update the matching checked-in package docs page in the same change or regenerate it.
- Changelog migration snippets are historical; don't "fix" old before/after examples unless they are inaccurate for the release they describe.
- After docs changes, run `pnpm --filter @web-ai-sdk-apps/site typecheck`. Biome may intentionally ignore Markdown docs, so don't treat "no files processed" as validation.

### Home page styling (`apps/site`)

The marketing site uses **Tailwind CSS v4**. Full guardrails: [`apps/site/README.md`](../apps/site/README.md).

- **Tailwind first.** New UI goes through `src/shared/ui.ts` (composed utilities), not new `.css` files or raw CSS in components.
- **`src/styles/home.css` is bootstrap only** — `@theme` tokens, layout CSS variables, keyframes, and minimal `@layer base` resets. No component-level rules.
- **No inline CSS in React** except dynamic values (e.g. progress bar width). Static `<style>` / inline `style=` belongs only in standalone static files such as `public/404.html`.
- **State classes must be mutually exclusive** when Tailwind utilities conflict (tabs, chips, buttons).
- The codebase is still **partially mixed** (some inline Tailwind in components not yet in `ui.ts`); consolidate when editing, don't add more one-offs.

---

## 6. Common tasks (cookbook)

### Add a new tool / wrapper package

1. `cp -r packages/<closest-template> packages/<new>` and rename in `package.json`, `tsup.config.ts`, `tsconfig.json`.
2. Replace `src/index.ts` / `src/api.ts` / `src/react/index.ts` with the real wrapper. Keep the core package contract (§ 5).
3. Add Vitest tests next to each source file.
4. Write `README.md` matching the existing structure (status / install / vanilla / React / API / errors / license).
5. Add the new package's docs MDX pages under `apps/site/src/content/docs/guides/<name>.mdx` and `apps/site/src/content/docs/react/use-<name>.mdx`, plus a docs demo component under `apps/site/src/features/docs/components/`, plus a sidebar entry in `apps/site/astro.config.mjs`. Add a corresponding static row and React demo island to `apps/site/src/pages/index.astro`.
6. `pnpm install` at the repo root (picks up the new workspace package).
7. `pnpm changeset` to record the new package for the next release.
8. `pnpm gate` to verify everything is wired up.

Note: a brand-new package's **first** publish must be done locally; CI can't create it. See [Cut a release](#cut-a-release).

### Add a React-only feature to an existing package

1. Land the logic in `src/index.ts` first. The vanilla core is the source of truth.
2. Add the hook in `src/react/index.ts` as a thin wrapper.
3. Add tests for both layers; vanilla covers behavior, React covers lifecycle.

### Add a new dev dep to a single package

`cd packages/<pkg> && pnpm add -D <pkg>`; pnpm hoists shared deps automatically. Don't add per-package devDependencies that already exist at the root.

### Cut a release

Releases are automated by the [`changesets/action`](.github/workflows/release.yml) and publish through **npm Trusted Publishing (OIDC)** — there is intentionally no `NPM_TOKEN` secret in the workflow.

1. `pnpm changeset` and pick the bump kind for each touched package; commit the generated markdown.
2. Open a PR. When it merges to `main`, the release workflow opens (or updates) a **"chore: version packages"** PR that runs `pnpm version-packages` (bumps versions, writes CHANGELOGs, consumes the changesets).
3. Merge the "Version Packages" PR. That triggers `pnpm release` (`pnpm build:packages && changeset publish`), publishing every package whose version isn't yet on npm. `changeset publish` is idempotent, so re-runs are safe.

**The first publish of a brand-new package must be done locally — CI cannot create it.** OIDC Trusted Publishing can't authenticate a package that doesn't exist yet (you can't configure a Trusted Publisher before the package exists), and a CI npm token can't *create* a new package in the `@web-ai-sdk` org either (npm returns a masked `404 Not Found` on the initial `PUT`). So the very first publish of each new package is manual:

```sh
npm login                 # as a @web-ai-sdk org member (handles 2FA)
pnpm build:packages
cd packages/<new> && npm publish --access public --provenance=false
```

Provenance is disabled for that first manual publish because it requires CI/OIDC; subsequent CI releases generate it. Once the package exists, set up a Trusted Publisher for it at `npmjs.com/package/@web-ai-sdk/<new>/access` (point it at this repo + `release.yml`), and every future version publishes automatically via the workflow above. This is why pre-existing packages release through CI with no token, while a new package's `0.x.0` debut is hand-published.

---

## 7. Don't-touch zones

| Path / file       | Why                                                                            |
| ----------------- | ------------------------------------------------------------------------------ |
| `pnpm-lock.yaml`  | Only update via `pnpm install` / `pnpm add`. Don't hand-edit.                  |
| `dist/`           | Build output. Never commit.                                                    |
| `node_modules/`   | Obvious.                                                                       |
| `.changeset/*.md` | Generated by `pnpm changeset`; keep, but don't hand-curate after the fact.    |

---

## 8. Quality gates

A change is "ready" when **all four** of these pass:

```bash
pnpm lint        # 0 errors  (Biome; lint + format audit across packages and apps)
pnpm build       # ✓ Complete (packages + apps); must run before typecheck because apps consume the built dist
pnpm typecheck   # 0 errors  (per-package tsc --noEmit, apps included)
pnpm test        # all green (Vitest + happy-dom)
```

Or in one shot: `pnpm gate`.

---

## 9. Glossary

- **Tool**; In WebMCP, a named, agent-callable function with a description, optional JSON Schema input, and an `execute` handler. Registered with `document.modelContext.registerTool`.
- **Core package / lifecycle layer**; A package that ships logic, types, and session lifecycle but no DOM / no styles / no rendering primitives. The eight API-wrapper packages are all core packages. Future packages with a different role (UI primitives, polyfills) sit at different layers.
- **Subpath export**; A package entry exposed under a path like `@web-ai-sdk/webmcp/react`. Configured via `package.json#exports`. Lets one install ship multiple framework adapters that tree-shake independently.
- **Feature-detected no-op**; The pattern this monorepo uses everywhere: if the underlying browser API is absent, the wrapper returns a no-op cleanup / `undefined` / similar, so consumer code can ship without polyfills or branching.
