# Contributing to web-ai-sdk

Thanks for considering a contribution. This file is the human-facing entry point. For deeper conventions and the rules every change should follow, see [`.agents/agents.md`](./.agents/agents.md); the same rules apply whether you or an AI agent wrote the patch.

## TL;DR

```sh
git clone https://github.com/obetomuniz/web-ai-sdk.git
cd web-ai-sdk
pnpm install     # Node 24 from .nvmrc + pnpm 10.34.3 from Corepack
pnpm gate        # lint + build + typecheck + test
```

If `pnpm gate` passes, your local environment matches CI.

Install Node with a version manager or package manager. This repository uses the version in `.nvmrc`. Corepack reads the pnpm version from `package.json`.

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

## Writing documentation

Use the documentation rules in [`.agents/agents.md`](./.agents/agents.md#documentation-style). They apply to public docs, READMEs, demos, home copy, and maintainer guidance.

The style is inspired by Simplified Technical English, but the project does not claim formal compliance. Prefer short sentences, direct verbs, consistent terms, and concrete behavior.

## Governance

These rules define what belongs in `@web-ai-sdk/*` and what doesn't. They're the load-bearing constraints behind the [Architecture](./apps/site/src/content/docs/architecture.mdx) page; if you're proposing a change to the SDK surface, read both.

1. **No runtime dependencies in any `@web-ai-sdk/*` package.** `package.json` `dependencies` must be empty or absent. The one explicit exception is the meta-package `@web-ai-sdk/all`, which depends on the eight wrapper packages as workspace deps so a single install ships the suite.
2. **No `peerDependencies` except an optional `react` peer.** The `/react` subpath adapter is the only published surface allowed to peer on a framework. No Vue / Svelte / Solid / etc. peers; those would each be a new subpath on the same package, not a new package.
3. **One package = one cohesive capability.** If you can't describe a package in one sentence without "and," it's two packages. The capability can originate from an official Built-in AI API (`LanguageModel`, `Summarizer`, `Translator`, `Detector`), an adjacent web standard (`WebMCP`, and likely `WebGPU` / `WebNN` in the future), or, rarely, a zero-dep SDK-authored primitive with no platform equivalent yet.
4. **No SDK package may import from another published `@web-ai-sdk/*` package.** Composition across capabilities is the future kit's job by definition, not the SDK's. The meta-package is exempt because re-exporting is its only job.
5. **Vanilla trunk + `/react` adapter as subpath.** A package's `src/index.ts` is the source of truth. `src/react/index.ts` is a thin wrapper. There is no `@web-ai-sdk/*-react` package and there shouldn't be.
6. **Ergonomic defaults are allowed inside a package** (warm session pools, opt-in result caches, stream normalization), as long as they're scoped to that one capability and the user can override or disable them.

For the time being these rules are enforced by review, not by CI. If you open a PR that adds `dependencies` or non-`react` `peerDependencies` to a `@web-ai-sdk/*` wrapper, expect to be asked to remove them or to land the work in the future kit instead. Shared infrastructure across packages (feature detection, stream normalization, error classes) will live in a private `@web-ai-sdk/internal` package the first time it's actually needed; until then, copy small helpers between packages rather than designing the shared layer upfront.

## Capability adoption policy

New browser capabilities enter the SDK according to evidence, not a target date. Classify a proposal before scaffolding a package:

| Stage | Evidence | Repository treatment |
| --- | --- | --- |
| **Tracked** | An authoritative public proposal exists, but there is no publicly documentable implementation or the API shape is too incomplete to wrap responsibly. | Track the capability in an issue. Do not scaffold or publish a package. |
| **Preview** | Maintainers can run the capability from public instructions, the execution and lifecycle shape is coherent, and a wrapper adds material value. Flags and preview browsers are acceptable. | An experimental `0.x` package may ship with a prominent status notice and exact public setup requirements. |
| **Trial** | The capability is available through a public developer or origin trial. | Keep the package `0.x`, expand real-browser coverage and demos, and document trial constraints. |
| **Stable** | At least one stable browser exposes the capability without an opt-in flag or trial token. | Mark browser support stable. A `1.0` package release remains a separate decision based on the wrapper's own API stability. |
| **Retired** | The proposal is withdrawn, replaced, or no longer implementable. | Deprecate instead of silently repurposing the package, and publish migration guidance when a successor exists. |

### Admission gates

A capability must satisfy every gate before it moves from Tracked to Preview:

1. **Public evidence:** an authoritative explainer, specification, or browser-vendor document describes the capability, and public instructions are sufficient to test and document it.
2. **Cohesive boundary:** it maps to one browser capability and fits the one-package rule.
3. **Material wrapper value:** the package owns a real lifecycle or ergonomics gap such as feature detection, availability, session reuse, cleanup, abort handling, error normalization, or stream normalization. Types alone are not enough.
4. **Contract fit:** it can remain framework-agnostic, zero-runtime-dependency, testable without the real browser implementation, and independently usable without importing another SDK package.
5. **Progressive enhancement:** unsupported environments have a deliberate, documented behavior.
6. **Honest scope:** result caching, persistence, DOM traversal, cross-capability composition, and helper algorithms are included only when they independently satisfy the SDK's scope rules.

Published artifacts must stand entirely on public sources. Confidential, restricted, or private-preview material may inform an internal go/no-go discussion, but it must never be linked, quoted, paraphrased, or used to disclose non-public versions, flags, behavior, or timelines in issues, PRs, READMEs, docs, demos, changelogs, or release notes. If public evidence is insufficient, the capability remains Tracked.

### Integration contract

An admitted wrapper normally includes:

- `src/api.ts`: native types, global lookup, `isAvailable()`, `checkAvailability()`, and native instance ownership.
- `src/index.ts`: the vanilla high-level operation, public result types, and package-specific errors.
- `src/react/index.ts`: a thin hook over the vanilla operation with honest effect dependencies.
- Vanilla and React lifecycle tests, a package README, site guides and demo, browser-support documentation, meta-package exports, and a changeset.

Unavailability behavior is consistent by entry-point role:

- Detection and probe helpers do not throw: `isAvailable()` returns `false`, and `checkAvailability()` returns `null`, when the native API cannot be used.
- High-level vanilla execution may throw a package-specific typed unavailability error so callers can branch explicitly.
- React hooks absorb that error and expose an `"unavailable"` state.
- Registration-style APIs may instead return an idempotent no-op cleanup when that preserves their natural call shape.

Capability-specific ergonomics are not copied mechanically from the nearest package:

- Cache native sessions only when reuse is safe. Bound or explicitly clear the cache, destroy evicted instances, and remove rejected creation promises so later calls can retry.
- Add result caching only when every output-shaping input can be keyed, the output has a lossless serialization, and serving a stored result remains semantically valid. Include a version or compatibility discriminator when the capability's outputs depend on one.
- Preserve structured native results when their metadata carries compatibility or lifecycle meaning.
- Add download monitoring, streaming, or abort forwarding only when the native capability supports it or the wrapper can describe its weaker semantics precisely.

Promotion between stages is a documentation and support decision, not automatically a breaking release. Breaking wrapper changes still follow Changesets and the package's current semantic-versioning contract.

## Adding a new package

1. Confirm the capability has reached Preview, Trial, or Stable under the adoption policy above. A Tracked capability stays as an issue.
2. Copy an existing package whose shape matches what you need (`prompt` if you want streaming + session cache + opt-in result cache, `webmcp` if you want an AbortSignal registry, `translator` if you want DOM-walking).
3. Mirror the file layout: `src/api.ts` (adapter over the global, feature-detected), `src/index.ts` (public API + typed unavailability error), `src/react/index.ts` (thin hook adapter), `src/*.test.ts` (vanilla tests), `src/react/index.test.tsx` (React hook tests). Optional: `src/cache.ts` only when the capability meets the result-cache gate above.
4. Add the package to the Pages docs (`apps/site/src/content/docs/guides/<name>.mdx`, `apps/site/src/content/docs/react/use-<name>.mdx`, plus a demo component) and to the home page's package row.
5. Add a changeset.
6. Run `pnpm gate`.
7. **Publish the first version locally.** A brand-new package can't be created by CI (OIDC Trusted Publishing needs the package to already exist, and a CI token can't create new `@web-ai-sdk` packages — npm returns a masked `404`). Do the initial publish by hand: `npm login`, `pnpm build:packages`, then `cd packages/<new> && npm publish --access public --provenance=false`. After that, set up a Trusted Publisher for it on npm and CI handles every later version.

See [`.agents/agents.md` § "Add a new tool / wrapper package"](./.agents/agents.md#add-a-new-tool--wrapper-package) and [§ "Cut a release"](./.agents/agents.md#cut-a-release) for the full conventions.

## Reporting bugs

[Open an issue](https://github.com/obetomuniz/web-ai-sdk/issues) with:

- A short repro (StackBlitz, CodeSandbox, or a minimal repo).
- Browser + version (`chrome://version` or `edge://version`).
- Which package + which API surface (`@web-ai-sdk/summarizer`, the vanilla `summarize()` call, etc).
- For unavailability errors: paste the relevant `chrome://on-device-internals` or `edge://on-device-internals` state.

## License

Contributions are licensed under [MIT](./LICENSE), the same as the project.
