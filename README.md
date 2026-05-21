# web-ai-sdk

Building blocks for the Web's Built-in AI APIs.

A small, focused monorepo of framework-agnostic packages that smooth over the gnarly bits of the new `navigator.modelContext`, `Translator`, `Summarizer`, `LanguageModel`, and `LanguageDetector` browser APIs (feature detection, session caching, streaming, lifecycle, safe DOM rebuild) without bringing any UI along.

| Package                                          | Wraps                                          | Highlights                                                                |
| ------------------------------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------- |
| [`@web-ai-sdk/webmcp`](./packages/webmcp)            | `navigator.modelContext` (W3C WebMCP)          | Safe register/unregister, shorthand annotations, `useWebMCP` hook         |
| [`@web-ai-sdk/translator`](./packages/translator)    | Web Built-in `Translator`                   | Block serialization, casing restoration, snapshot-based restore           |
| [`@web-ai-sdk/summarizer`](./packages/summarizer)    | Web Built-in `Summarizer`                   | Skeleton extraction, sessionStorage caching, streaming chunks             |
| [`@web-ai-sdk/prompt`](./packages/prompt)            | Web Built-in `LanguageModel` (Prompt API)   | System prompt + sampling, session reuse, streaming, result cache          |
| [`@web-ai-sdk/detector`](./packages/detector)        | Web Built-in `LanguageDetector`             | Confidence thresholds, bias hints, session reuse, `useDetector` hook      |

Each package ships:

- **Vanilla** entry (`@web-ai-sdk/<pkg>`): TypeScript / DOM only, zero framework deps.
- **React** entry (`@web-ai-sdk/<pkg>/react`): small hook adapter wrapping the vanilla core. `react` is an optional peer dep.

## Why composable

Browsers are shipping built-in AI APIs behind flags. The shape changes; the lifecycle is similar across them: feature-detect, lazily create a session, stream chunks, cache results, clean up. Those concerns are framework-agnostic and worth sharing.

**We ship that lifecycle layer.** Framework adapters, polyfills, UI primitives stay optional subpaths so they don't constrain your design system, framework, or styling stack. Pick the layers you need; skip the rest.

## Install

Pick the building blocks you need, or grab the whole suite in one install:

```sh
pnpm add @web-ai-sdk/webmcp        # one block
pnpm add @web-ai-sdk/all           # all five blocks under one install
```

Each package has its own README with install + usage:

- [`@web-ai-sdk/all`](./packages/sdk/README.md) (meta-package; re-exports all five)
- [`@web-ai-sdk/webmcp`](./packages/webmcp/README.md)
- [`@web-ai-sdk/translator`](./packages/translator/README.md)
- [`@web-ai-sdk/summarizer`](./packages/summarizer/README.md)
- [`@web-ai-sdk/prompt`](./packages/prompt/README.md)
- [`@web-ai-sdk/detector`](./packages/detector/README.md)

## Try it locally

Two workspace apps ship under `apps/`: a marketing landing (`apps/landing`) and a Starlight-powered docs site with live demos (`apps/docs`).

```sh
git clone https://github.com/obetomuniz/web-ai-sdk.git
cd web-ai-sdk

# Node 24 (or any version-manager that respects .nvmrc) + Corepack picks up
# pnpm 9.15.0 automatically from package.json's "packageManager" field.
pnpm install
pnpm build           # build packages so workspace consumers can resolve them
pnpm docs            # docs site on http://localhost:6006
pnpm landing         # marketing landing on http://localhost:5173
```

For the AI APIs to actually run, open a supporting browser. On Chrome, Summarizer/Translator/Detector are stable in 138+ and Prompt is stable in 148+ (no flags); WebMCP needs `chrome://flags/#enable-webmcp-testing` through Chrome 148 and joins a public origin trial in Chrome 149. On Edge, only Summarizer is in stable (138+ default-on); Prompt, Translator, Detector, and WebMCP are developer previews in Canary/Dev behind their respective `edge://flags/` toggles. See [Browser support](./apps/docs/src/content/docs/browser-support.mdx) for the per-package matrix and exact flag names.

## Repo layout

```
.
├── packages/
│   ├── webmcp/         # @web-ai-sdk/webmcp
│   ├── translator/     # @web-ai-sdk/translator
│   ├── summarizer/     # @web-ai-sdk/summarizer
│   ├── prompt/         # @web-ai-sdk/prompt
│   ├── detector/       # @web-ai-sdk/detector
│   └── sdk/            # @web-ai-sdk/all (meta-package; re-exports the five above)
├── apps/
│   ├── docs/           # @web-ai-sdk-apps/docs (private; Astro Starlight)
│   └── landing/        # @web-ai-sdk-apps/landing (private; marketing site)
├── AGENTS.md           # source of truth for AI agents on this repo
├── README.md           # ← you are here
└── …
```

## Workflow

| Task                            | Command               |
| ------------------------------- | --------------------- |
| Build every package             | `pnpm build`          |
| Watch + rebuild packages        | `pnpm dev`            |
| Boot the docs site (`:6006`)    | `pnpm docs`           |
| Boot the landing site (`:5173`) | `pnpm landing`        |
| Typecheck everything            | `pnpm typecheck`      |
| Run tests                       | `pnpm test`           |
| Lint + format audit             | `pnpm lint`           |
| Auto-fix lint + format          | `pnpm lint:fix`       |
| Full quality gate               | `pnpm gate`           |
| Build combined Pages artifact   | `pnpm pages:build`    |
| Preview combined Pages locally  | `pnpm pages:preview`  |

Toolchain: Node 24 (pinned in `.nvmrc`) + pnpm 9.15.0 (pinned via `package.json#packageManager` and provisioned automatically by Corepack on Node 16.13+).

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the human-facing onboarding, and [`AGENTS.md`](./AGENTS.md) for the deeper conventions (same rules apply to humans and AI agents).

## License

MIT © Beto Muniz
