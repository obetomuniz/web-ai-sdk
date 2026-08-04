# Contributing to web-ai-sdk

This guide covers setup, change workflow, and SDK governance. Repository rules
in [`.agents/agents.md`](./.agents/agents.md) apply to human and agent-authored
changes.

## Setup

```sh
git clone https://github.com/obetomuniz/web-ai-sdk.git
cd web-ai-sdk
pnpm install
pnpm gate
```

Use the Node version in `.nvmrc`. Corepack reads the pnpm version from
`package.json`. `pnpm gate` runs the same checks as CI.

Published packages live in `packages/`. The Astro site and Starlight docs live
in `apps/site/`. Run `pnpm run` to list all workflows.

## Change workflow

1. Change one package or app at a time when possible.
2. Add tests beside package source as `*.test.ts` or `*.test.tsx`.
3. Follow the [documentation style](./.agents/agents.md#documentation-and-copy)
   for docs, READMEs, demos, home copy, and maintainer guidance.
4. Run focused checks while iterating.
5. Add a changeset for a user-facing package change. Skip changesets for docs
   and internal-only changes.
6. Run `pnpm gate` before committing.
7. Open a PR against `main`.

## SDK rules

- One package wraps one browser capability.
- Core wrappers have no runtime dependencies. `@web-ai-sdk/all` may depend on
  the wrapper packages it re-exports.
- `react` is the only allowed optional peer dependency.
- Published wrapper packages do not import from each other. Application code
  composes capabilities.
- The framework-agnostic entry is the source of truth. `/react` is a thin hook
  adapter in the same package.
- Defaults may manage sessions, caches, streams, and cleanup within one
  capability. Users must be able to disable or replace optional behavior.
- Do not break public behavior without migration guidance and an appropriate
  changeset.

See [Architecture](./apps/site/src/content/docs/architecture.mdx) for the public
description of these boundaries.

## Capability adoption policy

Classify a capability before creating a package.

| Stage | Repository treatment |
| --- | --- |
| **Tracked** | Keep it as an issue. Public information is not sufficient for a package. |
| **Preview** | An experimental `0.x` package may ship from runnable public instructions. Document required flags or preview browsers. |
| **Trial** | Keep the package `0.x`. Document public trial limits and expand browser coverage. |
| **Stable** | Mark stable browser support. Package `1.0` remains a separate API decision. |
| **Retired** | Deprecate the package and document migration. Do not silently repurpose it. |

A capability must pass every gate before moving from Tracked to Preview:

1. An authoritative public source provides enough information to run and
   document it.
2. The capability has one cohesive package boundary.
3. The wrapper adds lifecycle value beyond types.
4. It remains framework-agnostic, deterministic in tests, and free of runtime
   dependencies.
5. Unsupported environments have explicit behavior.
6. Persistence, DOM traversal, cross-capability workflows, and unrelated
   algorithms stay outside the wrapper.

Published issues, PRs, docs, demos, changelogs, and releases must rely on public
sources. Never disclose details from confidential or restricted previews. Keep
the capability Tracked when public evidence is insufficient.

An admitted package normally includes:

- native lookup, types, availability checks, and instance ownership;
- a public vanilla API with package-specific errors;
- a thin React hook;
- vanilla and React lifecycle tests;
- a package README, site guides, a demo, and browser-support details;
- meta-package exports and a changeset.

Do not copy ergonomics mechanically from another package. Reuse sessions only
when it is safe. Evict rejected creation promises. Cache results only with a
complete key and lossless serialization. Preserve native result metadata when
it affects compatibility or lifecycle.

## First package release

CI can update an existing npm package but cannot create a new one. Publish the
first version locally as an npm organization member:

```sh
npm login
pnpm build:packages
cd packages/<new>
npm publish --access public --provenance=false
```

Then configure npm Trusted Publishing for the package and `release.yml`.
Changesets handles later releases.

## Reporting bugs

[Open an issue](https://github.com/obetomuniz/web-ai-sdk/issues) with:

- a minimal reproduction;
- browser and version;
- package and API entry;
- relevant `chrome://on-device-internals` or
  `edge://on-device-internals` state for availability problems.

## License

Contributions use the project [MIT license](./LICENSE).
