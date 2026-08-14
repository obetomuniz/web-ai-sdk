# AGENTS.md

Repository-specific rules for coding agents. The root `AGENTS.md` symlinks to
this file.

## Read first

- [`README.md`](../README.md): product and package overview.
- [`CONTRIBUTING.md`](../CONTRIBUTING.md): governance, capability adoption,
  changesets, and releases.
- [`DESIGN.md`](../DESIGN.md): visual identity for every UI change.
- `packages/<name>/README.md`: public contract for one package.

Keep this file focused on agent constraints. Put human guidance in the files
above.

## Principles

- Choose the smallest implementation that fully meets the current requirement.
- Keep one package responsible for one browser capability.
- Keep core wrappers thin. They own lifecycle and ergonomics, not product policy.
- Use project dependencies before adding code or packages. Core wrappers must
  keep zero runtime dependencies.
- Preserve public API behavior unless the task explicitly changes it. Document
  breaking changes and migrations.
- Use only public sources for published capability claims, flags, versions, and
  timelines.

## Architecture

This is a strict TypeScript and pnpm monorepo. Wrapper packages live in
`packages/`. The Astro site, Starlight docs, Playground, and demos live in
`apps/site/`. The read-only documentation MCP Worker lives in `apps/mcp/`.

Each wrapper exposes:

- `@web-ai-sdk/<name>`: framework-agnostic core.
- `@web-ai-sdk/<name>/react`: optional React hook adapter.

### Core wrappers

- Wrap one native capability. Do not compose SDK packages in a wrapper.
- Do not render UI, walk application DOM, or add third-party runtimes.
- Keep selectors and root elements configurable when an API accepts them.
- Make cleanup functions idempotent.
- Make feature detection safe. `isAvailable()` returns `false`, and
  `checkAvailability()` returns `null`, when the API cannot run.
- High-level vanilla functions may throw a typed unavailability error. React
  hooks expose an `"unavailable"` state instead.
- Preserve structured native results when their metadata matters.
- Make session reuse safe and clearable. Evict rejected creation promises.
- Cache only with complete, lossless keys and semantically valid reuse.

The vanilla core is the source of truth. React adapters are hooks, not
components, and must not duplicate core logic. Keep effect dependencies honest.

Before adding a capability, apply the adoption policy in
[`CONTRIBUTING.md`](../CONTRIBUTING.md#capability-adoption-policy). Tracked
capabilities stay as issues. Preview, Trial, and Stable capabilities may become
packages when public evidence is sufficient.

## Code

- Do not introduce `any` without an explicit reason in a comment.
- Use `import type` for type-only imports.
- Respect strict mode, `verbatimModuleSyntax`, and `noUncheckedIndexedAccess`.
- Do not use relative imports across package boundaries. Import published
  `@web-ai-sdk/*` exports.
- Use `.js` suffixes for relative subpath imports inside packages.
- Add tests beside the source. Cover core behavior before React lifecycle.
- Do not hand-edit `pnpm-lock.yaml`, generated `dist/`, or `node_modules/`.
- Create changesets through `pnpm changeset`. Do not hand-curate generated
  changeset files.

## Documentation and copy

Apply these rules to public docs, package READMEs, home copy, demos, Playground
guidance, user-facing help and errors, and maintainer documentation.

Use a house style inspired by Simplified Technical English. Do not claim formal
STE compliance.

- Aim for 25 words or fewer per prose sentence.
- Use active voice, direct verbs, and imperative instructions.
- Use one term for one concept.
- State behavior before rationale. Keep conditions next to the behavior.
- Replace hype, metaphors, and rhetorical claims with concrete behavior.
- Do not use em dashes.
- Keep paragraphs short. Use lists and tables only when they improve scanning.
- Preserve exact API names. Define uncommon technical terms once.

Treat examples as public API:

- Verify names, options, results, and hook returns against TypeScript exports and
  tests.
- Update a package README and its checked-in page under
  `apps/site/src/content/docs/packages/` together.
- Do not rewrite historical changelog migration examples unless they were wrong
  for that release.
- Run `pnpm --filter @web-ai-sdk-apps/site typecheck` after docs changes.

## Site UI

- Follow [`DESIGN.md`](../DESIGN.md) for color, type, surfaces, and motion.
- Use Tailwind first on the home page. Reuse utilities from
  `apps/site/src/shared/ui.ts`.
- Keep `apps/site/src/styles/home.css` limited to tokens, resets, variables, and
  keyframes.
- Do not add static inline styles to React components. Inline styles are only
  for dynamic values.
- Keep conflicting state classes mutually exclusive.
- Consolidate nearby one-off utilities when editing mixed legacy components.

See [`apps/site/README.md`](../apps/site/README.md) for complete site rules.

## Commands

Use scripts from [`package.json`](../package.json). Common commands:

- `pnpm dev`: watch the site and docs.
- `pnpm mcp`: run the documentation MCP Worker locally.
- `pnpm build`: build packages and apps.
- `pnpm build:mcp`: build the documentation MCP Worker.
- `pnpm gate`: run lint, build, typecheck, and tests.

Run focused checks while iterating. Build before typecheck because the site
consumes package output. Run `pnpm gate` before any commit.

## Git and workspace safety

- Work only in the session's current working tree. Never create a worktree,
  including through a skill, subagent, temporary directory, or `.worktrees/`.
- Do not overwrite or hide existing changes. If unexpected changes exist before
  work starts, stop and ask the user to commit or stash them.
- Use a dedicated branch. Never commit, merge, or push directly to `main`.
- Before branch creation or another non-read-only git action, show the intended
  commit message and get approval.
- Never commit until the user approves the exact commit message.
- Never push without explicit approval in the same message.
- Never create or merge a PR unless the user asks in that turn. Show the PR
  title and description for approval first.
- Never rebase, delete branches, or amend commits without explicit approval.
- Force-push only with explicit approval to update an existing PR.
- Do not add agent attribution or `Co-authored-by:` trailers.
- If parallel work needs another branch, stop and ask the user to create the
  workspace through their tool.
