# Contributing to web-ai-sdk

Thanks for considering a contribution. This file is the human-facing entry point. For deeper conventions and the rules every change should follow, see [`AGENTS.md`](./AGENTS.md); the same rules apply whether you or an AI agent wrote the patch.

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
- `apps/docs/`: the Astro Starlight docs site. MDX content under `src/content/docs/`, React demo components under `src/components/`.
- `apps/landing/`: the marketing landing page (Vite + React). Lives at the GitHub Pages root.
- `package.json` scripts: every workflow command (build, test, lint, docs, landing, gate, pages, release) is a pnpm script. `pnpm run` lists them.

See the [README "Repo layout" section](./README.md#repo-layout) for the full tree.

## Making a change

1. **Pick a package or app.** Library bugs live under `packages/<name>/src/`. Docs improvements live under `apps/docs/src/content/docs/`. Landing tweaks live under `apps/landing/src/`.
2. **Add or update tests** when you touch package source. Tests live next to source as `*.test.ts` / `*.test.tsx`. Use `pnpm --filter @web-ai-sdk/<name> test` to focus on one package.
3. **Run `pnpm gate`.** It runs Biome, builds every package, typechecks every workspace, and runs every test. CI runs the same gate, so a clean local gate equals a passing PR.
4. **Add a changeset** if you're shipping a user-facing change. `pnpm changeset` opens an interactive picker. Skip this for docs-only or internal changes.
5. **Open a PR** against `main`. The CI workflow will rerun the gate; the release workflow opens a "Version Packages" PR when there are pending changesets to publish.

## Adding a new package

1. Copy an existing package whose shape matches what you need (`prompt` if you want streaming + session cache + opt-in result cache, `webmcp` if you want an AbortSignal registry, `translator` if you want DOM-walking).
2. Mirror the file layout: `src/api.ts` (adapter over the global, feature-detected), `src/index.ts` (public API + typed unavailability error), `src/react/index.ts` (thin hook adapter), `src/*.test.ts` (vanilla tests), `src/react/index.test.tsx` (React hook tests). Optional: `src/cache.ts` if the package has a result cache.
3. Add the package to the Pages docs (`apps/docs/src/content/docs/guides/<name>.mdx`, `apps/docs/src/content/docs/react/use-<name>.mdx`, plus a demo component) and to the landing's package row.
4. Add a changeset.
5. Run `pnpm gate`.

See [`AGENTS.md` § "Add a new tool / wrapper package"](./AGENTS.md#add-a-new-tool--wrapper-package) for the full conventions.

## Reporting bugs

[Open an issue](https://github.com/obetomuniz/web-ai-sdk/issues) with:

- A short repro (StackBlitz, CodeSandbox, or a minimal repo).
- Browser + version (`chrome://version` or `edge://version`).
- Which package + which API surface (`@web-ai-sdk/summarizer`, the vanilla `summarize()` call, etc).
- For unavailability errors: paste the relevant `chrome://on-device-internals` or `edge://on-device-internals` state.

## License

Contributions are licensed under [MIT](./LICENSE), the same as the project.
