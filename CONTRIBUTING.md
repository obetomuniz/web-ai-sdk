# Contributing to web-ai-sdk

Thanks for considering a contribution. This file is the human-facing entry point. For deeper conventions and the rules every change should follow, see [`.agents/agents.md`](./.agents/agents.md); the same rules apply whether you or an AI agent wrote the patch.

## TL;DR

```sh
git clone https://github.com/obetomuniz/web-ai-sdk.git
cd web-ai-sdk
pnpm install     # Node 24 from .nvmrc + pnpm 9.15.0 from Corepack
pnpm gate        # lint + build + typecheck + test
```

If `pnpm gate` passes, your local environment matches CI.

If you don't already have Node, install it once (via [nvm](https://github.com/nvm-sh/nvm), [fnm](https://github.com/Schniz/fnm), [Volta](https://volta.sh/), `brew`, or whatever you prefer); it'll respect `.nvmrc`. Corepack ships with Node 16.13+ and provisions the right `pnpm` version from `package.json` automatically.

## Project shape

- `packages/<name>/`: the published packages. Each is independently versioned (Changesets) and has its own `README.md`, tests, and per-package `package.json`.
- `apps/site/`: the Astro marketing site with Starlight docs mounted at `/docs/`. Home page code lives under `src/pages/`, docs content under `src/content/docs/`, and docs demo components under `src/features/docs/components/`. Styling guardrails: [`apps/site/README.md`](./apps/site/README.md).
- `package.json` scripts: every workflow command (build, test, lint, docs, site, gate, pages, release) is a pnpm script. `pnpm run` lists them.

See the [README "Repo layout" section](./README.md#repo-layout) for the full tree.

## Making a change

1. **Pick a package or app.** Library bugs live under `packages/<name>/src/`. Docs improvements live under `apps/site/src/content/docs/`. Marketing tweaks live under `apps/site/src/`.
2. **Add or update tests** when you touch package source. Tests live next to source as `*.test.ts` / `*.test.tsx`. Use `pnpm --filter @web-ai-sdk/<name> test` to focus on one package.
3. **Run `pnpm gate`.** It runs Biome, builds packages and apps, typechecks every workspace, and runs every test. CI runs the same gate, so a clean local gate equals a passing PR.
4. **Add a changeset** if you're shipping a user-facing change. `pnpm changeset` opens an interactive picker. Skip this for docs-only or internal changes.
5. **Open a PR** against `main`. The CI workflow will rerun the gate; the release workflow opens a "Version Packages" PR when there are pending changesets to publish.

## Governance

These rules define what belongs in `@web-ai-sdk/*` and what doesn't. They're the load-bearing constraints behind the [Architecture](./apps/site/src/content/docs/architecture.mdx) page; if you're proposing a change to the SDK surface, read both.

1. **No runtime dependencies in any `@web-ai-sdk/*` package.** `package.json` `dependencies` must be empty or absent. The one explicit exception is the meta-package `@web-ai-sdk/all`, which depends on the five wrapper packages as workspace deps so a single install ships the suite.
2. **No `peerDependencies` except an optional `react` peer.** The `/react` subpath adapter is the only published surface allowed to peer on a framework. No Vue / Svelte / Solid / etc. peers; those would each be a new subpath on the same package, not a new package.
3. **One package = one cohesive capability.** If you can't describe a package in one sentence without "and," it's two packages. The capability can originate from an official Built-in AI API (`LanguageModel`, `Summarizer`, `Translator`, `Detector`), an adjacent web standard (`WebMCP`, and likely `WebGPU` / `WebNN` in the future), or, rarely, a zero-dep SDK-authored primitive with no platform equivalent yet.
4. **No SDK package may import from another published `@web-ai-sdk/*` package.** Composition across capabilities is the future kit's job by definition, not the SDK's. The meta-package is exempt because re-exporting is its only job.
5. **Vanilla trunk + `/react` adapter as subpath.** A package's `src/index.ts` is the source of truth. `src/react/index.ts` is a thin wrapper. There is no `@web-ai-sdk/*-react` package and there shouldn't be.
6. **Ergonomic defaults are allowed inside a package** (warm session pools, opt-in result caches, stream normalization), as long as they're scoped to that one capability and the user can override or disable them.

For the time being these rules are enforced by review, not by CI. If you open a PR that adds `dependencies` or non-`react` `peerDependencies` to a `@web-ai-sdk/*` wrapper, expect to be asked to remove them or to land the work in the future kit instead. Shared infrastructure across packages (feature detection, stream normalization, error classes) will live in a private `@web-ai-sdk/internal` package the first time it's actually needed; until then, copy small helpers between packages rather than designing the shared layer upfront.

## Adding a new package

1. Copy an existing package whose shape matches what you need (`prompt` if you want streaming + session cache + opt-in result cache, `webmcp` if you want an AbortSignal registry, `translator` if you want DOM-walking).
2. Mirror the file layout: `src/api.ts` (adapter over the global, feature-detected), `src/index.ts` (public API + typed unavailability error), `src/react/index.ts` (thin hook adapter), `src/*.test.ts` (vanilla tests), `src/react/index.test.tsx` (React hook tests). Optional: `src/cache.ts` if the package has a result cache.
3. Add the package to the Pages docs (`apps/site/src/content/docs/guides/<name>.mdx`, `apps/site/src/content/docs/react/use-<name>.mdx`, plus a demo component) and to the home page's package row.
4. Add a changeset.
5. Run `pnpm gate`.
6. **Publish the first version locally.** A brand-new package can't be created by CI (OIDC Trusted Publishing needs the package to already exist, and a CI token can't create new `@web-ai-sdk` packages — npm returns a masked `404`). Do the initial publish by hand: `npm login`, `pnpm build:packages`, then `cd packages/<new> && npm publish --access public --provenance=false`. After that, set up a Trusted Publisher for it on npm and CI handles every later version.

See [`.agents/agents.md` § "Add a new tool / wrapper package"](./.agents/agents.md#add-a-new-tool--wrapper-package) and [§ "Cut a release"](./.agents/agents.md#cut-a-release) for the full conventions.

## Reporting bugs

[Open an issue](https://github.com/obetomuniz/web-ai-sdk/issues) with:

- A short repro (StackBlitz, CodeSandbox, or a minimal repo).
- Browser + version (`chrome://version` or `edge://version`).
- Which package + which API surface (`@web-ai-sdk/summarizer`, the vanilla `summarize()` call, etc).
- For unavailability errors: paste the relevant `chrome://on-device-internals` or `edge://on-device-internals` state.

## License

Contributions are licensed under [MIT](./LICENSE), the same as the project.
