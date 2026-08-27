# web-ai-sdk

**web-ai-sdk is a TypeScript SDK for the Web AI surface.**

Use typed lifecycle wrappers for Prompt, Writer, Rewriter, Proofreader, Translator, Summarizer, Language Detector, and WebMCP.

```ts
import { ask } from "@web-ai-sdk/prompt";

const { output } = await ask({ input: "Summarize this page in one sentence." });
```

Each package wraps one browser capability. It handles feature detection, sessions, streaming, abort signals, and cleanup. It does not render UI.

## Why this exists

Browser AI APIs have similar lifecycle requirements. Applications must detect support, create sessions, stream results, abort work, and clean up resources.

`web-ai-sdk` handles that lifecycle. Each wrapper also exposes an unavailable state for fallback UI.

The SDK uses one package per capability. Each built-in has different options and result types. WebMCP exposes page tools instead of generating text.

## What it is

`web-ai-sdk` ships TypeScript packages with no runtime dependencies. Application code controls rendering, persistence, and cross-capability workflows.

Treat all model output as untrusted. Control-character cleanup does not make HTML or Markdown safe.

Use React interpolation or `textContent` for plain text. Sanitize complete formatted output before rendering it. Do not sanitize stream chunks separately.

Before shipping, use the [Production checklist](./apps/site/src/content/docs/production-checklist.mdx) for intent-driven preparation, task-relevant text extraction, session lifetime, progress, reversible edits, and expiring caches.

The SDK does not walk the DOM or compose capabilities. Application code owns article extraction and detect-then-summarize flows.

See [`apps/site/src/content/docs/architecture.mdx`](./apps/site/src/content/docs/architecture.mdx) (rendered at [`web-ai-sdk.dev/docs/architecture/`](https://web-ai-sdk.dev/docs/architecture/)) for the full model.

| Package                                          | Wraps                                          | Highlights                                                                |
| ------------------------------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------- |
| [`@web-ai-sdk/webmcp`](./packages/webmcp)            | `document.modelContext` (W3C WebMCP)           | Safe register/unregister, shorthand annotations, `useWebMCP` hook         |
| [`@web-ai-sdk/translator`](./packages/translator)    | Web Built-in `Translator`                   | String-mode translation, pair-cached sessions, opt-in result caching       |
| [`@web-ai-sdk/summarizer`](./packages/summarizer)    | Web Built-in `Summarizer`                   | Session reuse, opt-in result caching, streaming chunks                     |
| [`@web-ai-sdk/prompt`](./packages/prompt)            | Web Built-in `LanguageModel` (Prompt API)   | System prompt + sampling, session reuse, streaming, result cache          |
| [`@web-ai-sdk/detector`](./packages/detector)        | Web Built-in `LanguageDetector`             | Confidence thresholds, bias hints, session reuse, `useDetector` hook      |
| [`@web-ai-sdk/writer`](./packages/writer)            | Web Built-in `Writer`                       | Tone/format/length, session reuse, streaming, `useWriter` hook            |
| [`@web-ai-sdk/rewriter`](./packages/rewriter)        | Web Built-in `Rewriter`                     | Relative tone/length shifts, streaming, `useRewriter` hook                |
| [`@web-ai-sdk/proofreader`](./packages/proofreader)  | Web Built-in `Proofreader`                  | Corrected text + per-issue offsets, session reuse, `useProofreader` hook  |

Each package ships:

- **Vanilla** entry (`@web-ai-sdk/<pkg>`): TypeScript / DOM only, zero framework deps.
- **React** entry (`@web-ai-sdk/<pkg>/react`): small hook adapter wrapping the vanilla core. `react` is an optional peer dep.

## Browser AI and WebMCP

The Built-in AI packages wrap local browser capabilities. [`@web-ai-sdk/webmcp`](./packages/webmcp) registers page tools for compatible agents.

All packages use feature detection. See [Browser support](./apps/site/src/content/docs/browser-support.mdx) for current availability.

## web-ai-sdk MCP

The private [`apps/mcp`](./apps/mcp) workspace app hosts a public, read-only MCP
server. It currently provides documentation search, complete documents, and
browser support data. See the [MCP server guide](./apps/site/src/content/docs/mcp.mdx)
for connection instructions.

## Scope

The core packages handle browser API lifecycles. They do not include UI, polyfills, DOM traversal, or cross-capability orchestration.

React hooks ship as optional subpaths. See [Architecture](./apps/site/src/content/docs/architecture.mdx) for the complete boundaries.

## Install

Install one package or all eight:

```sh
pnpm add @web-ai-sdk/webmcp        # one block
pnpm add @web-ai-sdk/all           # all eight blocks under one install
```

Each package has its own README with install + usage:

- [`@web-ai-sdk/all`](./packages/sdk/README.md) (meta-package; re-exports all eight)
- [`@web-ai-sdk/webmcp`](./packages/webmcp/README.md)
- [`@web-ai-sdk/translator`](./packages/translator/README.md)
- [`@web-ai-sdk/summarizer`](./packages/summarizer/README.md)
- [`@web-ai-sdk/prompt`](./packages/prompt/README.md)
- [`@web-ai-sdk/detector`](./packages/detector/README.md)
- [`@web-ai-sdk/writer`](./packages/writer/README.md)
- [`@web-ai-sdk/rewriter`](./packages/rewriter/README.md)
- [`@web-ai-sdk/proofreader`](./packages/proofreader/README.md)

## Try it locally

The Astro site and web-ai-sdk MCP server ship as private workspace apps.

```sh
git clone https://github.com/obetomuniz/web-ai-sdk.git
cd web-ai-sdk

# Node 24 (or any version-manager that respects .nvmrc) + Corepack picks up
# pnpm 10.34.3 automatically from package.json's "packageManager" field.
pnpm install
pnpm build:packages  # build packages so workspace consumers can resolve them
pnpm dev             # site at http://localhost:5173/, docs at /docs/
```

The demos require a browser that supports the selected API. See [Browser support](./apps/site/src/content/docs/browser-support.mdx) for versions, flags, trials, and hardware requirements.

### Parallel development worktrees

Each linked worktree gets a stable development instance. The instance identity
uses the worktree directory name and a hash of its canonical path.

Set up any checkout or worktree with the same command:

```sh
pnpm dev:setup
pnpm dev:info
```

`pnpm dev:setup` installs locked dependencies and builds the packages.
`pnpm dev:info` prints the instance identity and local service URLs.

The primary checkout keeps the standard ports. Linked worktrees receive stable
ports and distinct `*.localhost` names:

| Service | Primary checkout | Linked worktree port range |
| --- | --- | --- |
| Site | `http://localhost:5173/` | `20000-24999` |
| Preview | `http://localhost:4173/` | `30000-34999` |
| MCP | `http://localhost:8787/` | `40000-44999` |
| MCP inspector | Wrangler default | `50000-54999` |

A linked site URL uses this form:

```text
http://site--<instance>.web-ai-sdk.localhost:<port>/
```

Use these environment variables when you need explicit values:

| Variable | Behavior |
| --- | --- |
| `WEB_AI_SDK_DEV_INSTANCE` | Overrides the derived development identity. |
| `WEB_AI_SDK_HOST` | Overrides the local bind address. |
| `WEB_AI_SDK_SITE_PORT` | Overrides the site port. |
| `WEB_AI_SDK_PREVIEW_PORT` | Overrides the preview port. |
| `WEB_AI_SDK_MCP_PORT` | Overrides the MCP server port. |
| `WEB_AI_SDK_MCP_INSPECTOR_PORT` | Overrides the MCP inspector port. |

The generated port can rarely conflict with another local process. Set the
matching port variable when that happens.

#### Optional Paseo integration

The checked-in [`paseo.json`](./paseo.json) automates setup and process
supervision. The project does not require Paseo for development isolation.

Paseo provides these workspace scripts:

| Script | Behavior |
| --- | --- |
| `site` | Runs the Astro site through a stable `*.localhost` proxy URL. |
| `mcp` | Runs the local MCP Worker through a separate proxy URL. |
| `packages` | Watches wrapper package builds during SDK changes. |
| `preview` | Builds and previews the complete Pages artifact. |
| `gate` | Runs the full quality gate without starting a service. |

List the URLs and service state from a workspace:

```sh
paseo script ls
paseo script start packages
paseo script start site
```

Paseo allocates backend ports and exposes each service through a proxy URL. A
small adapter passes each backend port through a generic variable listed above.

## Repo layout

```
.
├── packages/
│   ├── webmcp/         # @web-ai-sdk/webmcp
│   ├── translator/     # @web-ai-sdk/translator
│   ├── summarizer/     # @web-ai-sdk/summarizer
│   ├── prompt/         # @web-ai-sdk/prompt
│   ├── detector/       # @web-ai-sdk/detector
│   ├── writer/         # @web-ai-sdk/writer
│   ├── rewriter/       # @web-ai-sdk/rewriter
│   ├── proofreader/    # @web-ai-sdk/proofreader
│   └── sdk/            # @web-ai-sdk/all (meta-package; re-exports the eight above)
├── apps/
│   ├── site/           # @web-ai-sdk-apps/site (private; Astro site + Starlight docs)
│   └── mcp/            # @web-ai-sdk-apps/mcp (private; web-ai-sdk MCP Worker)
├── scripts/            # development instance and optional tool adapters
├── paseo.json          # optional worktree setup and managed local services
├── .agents/agents.md           # agent instructions (AGENTS.md symlink kept at root)
├── README.md           # ← you are here
└── …
```

## Workflow

| Task                            | Command               |
| ------------------------------- | --------------------- |
| Watch site + docs               | `pnpm dev`            |
| Watch web-ai-sdk MCP Worker      | `pnpm mcp`            |
| Watch wrapper packages          | `pnpm dev:packages`   |
| Watch meta-package              | `pnpm dev:sdk`        |
| Boot unified app (`:5173`)      | `pnpm site`           |
| Build everything                | `pnpm build`          |
| Build publishable packages only | `pnpm build:packages` |
| Build app only                  | `pnpm build:apps`     |
| Build web-ai-sdk MCP Worker      | `pnpm build:mcp`      |
| Typecheck everything            | `pnpm typecheck`      |
| Run tests                       | `pnpm test`           |
| Lint + format audit             | `pnpm lint`           |
| Auto-fix lint + format          | `pnpm lint:fix`       |
| Full quality gate               | `pnpm gate`           |
| Build Pages artifact            | `pnpm pages:build`    |
| Preview combined Pages locally  | `pnpm pages:preview`  |

Toolchain: Node 24 (pinned in `.nvmrc`) + pnpm 10.34.3 (pinned via `package.json#packageManager` and provisioned automatically by Corepack on Node 16.13+).

## Roadmap

This roadmap is not a release commitment. New work must stay within the lifecycle scope.

- Cloud / custom-provider fallback for unsupported browsers
- More browser compatibility helpers
- Broader browser adoption of the Writer / Rewriter / Proofreader APIs as they ship

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the human-facing onboarding, and [`.agents/agents.md`](./.agents/agents.md) for the deeper conventions (same rules apply to humans and AI agents).

## License

MIT © Beto Muniz
