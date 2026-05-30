# web-ai-sdk

Building blocks for the Web's Built-in AI APIs.

A small, focused monorepo of framework-agnostic packages that smooth over the gnarly bits of the new `navigator.modelContext`, `Translator`, `Summarizer`, `LanguageModel`, `LanguageDetector`, `Writer`, `Rewriter`, and `Proofreader` browser APIs (feature detection, session caching, streaming, lifecycle, safe DOM rebuild) without bringing any UI along.

## What it is

**`web-ai-sdk`** ships one package per browser capability. Zero runtime dependencies. Vanilla TypeScript by default, with optional React hooks. That's it. The SDK tracks a moving browser spec and intentionally stays out of the way of *how* you build an app.

Compositions that bond multiple primitives (block-level DOM translation,
article-aware summarization, detect-then-summarize chains) are
deliberately out of scope — the SDK wraps one capability per package;
composition is your code.

See [`apps/docs/src/content/docs/architecture.mdx`](./apps/docs/src/content/docs/architecture.mdx) (rendered at [`web-ai-sdk.dev/docs/architecture/`](https://web-ai-sdk.dev/docs/architecture/)) for the full model.

| Package                                          | Wraps                                          | Highlights                                                                |
| ------------------------------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------- |
| [`@web-ai-sdk/webmcp`](./packages/webmcp)            | `navigator.modelContext` (W3C WebMCP)          | Safe register/unregister, shorthand annotations, `useWebMCP` hook         |
| [`@web-ai-sdk/translator`](./packages/translator)    | Web Built-in `Translator`                   | Block serialization, casing restoration, snapshot-based restore           |
| [`@web-ai-sdk/summarizer`](./packages/summarizer)    | Web Built-in `Summarizer`                   | Skeleton extraction, sessionStorage caching, streaming chunks             |
| [`@web-ai-sdk/prompt`](./packages/prompt)            | Web Built-in `LanguageModel` (Prompt API)   | System prompt + sampling, session reuse, streaming, result cache          |
| [`@web-ai-sdk/detector`](./packages/detector)        | Web Built-in `LanguageDetector`             | Confidence thresholds, bias hints, session reuse, `useDetector` hook      |
| [`@web-ai-sdk/writer`](./packages/writer)            | Web Built-in `Writer`                       | Tone/format/length, session reuse, streaming, `useWriter` hook            |
| [`@web-ai-sdk/rewriter`](./packages/rewriter)        | Web Built-in `Rewriter`                     | Relative tone/length shifts, streaming, `useRewriter` hook                |
| [`@web-ai-sdk/proofreader`](./packages/proofreader)  | Web Built-in `Proofreader`                  | Corrected text + per-issue offsets, session reuse, `useProofreader` hook  |

Each package ships:

- **Vanilla** entry (`@web-ai-sdk/<pkg>`): TypeScript / DOM only, zero framework deps.
- **React** entry (`@web-ai-sdk/<pkg>/react`): small hook adapter wrapping the vanilla core. `react` is an optional peer dep.

## Why composable

Browsers are shipping built-in AI APIs behind flags. The shape changes; the lifecycle is similar across them: feature-detect, lazily create a session, stream chunks, cache results, clean up. Those concerns are framework-agnostic and worth sharing.

**We ship that lifecycle layer.** Framework adapters, polyfills, UI primitives stay optional subpaths so they don't constrain your design system, framework, or styling stack. Pick the layers you need; skip the rest.

This is the same shape mature utility libraries converge on as the platform catches up (lodash → native methods, moment/date-fns → `Temporal`): a thin shim over a native primitive that gets *thinner* as the primitive stabilizes. See [Architecture § Lineage](./apps/docs/src/content/docs/architecture.mdx) for the full reasoning.

## Install

Pick the building blocks you need, or grab the whole suite in one install:

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

For the AI APIs to actually run, open a supporting browser. On Chrome, Summarizer/Translator/Detector are stable in 138+ and Prompt is stable in 148+ (no flags); the Writing Assistance APIs (Writer, Rewriter, Proofreader) are developer/origin trials behind their own `chrome://flags/` toggles; WebMCP needs `chrome://flags/#enable-webmcp-testing` through Chrome 148 and joins a public origin trial in Chrome 149. On Edge, only Summarizer is in stable (138+ default-on); Prompt, Translator, Detector, and WebMCP are developer previews in Canary/Dev behind their respective `edge://flags/` toggles. On Windows the four Built-in AI APIs (Prompt, Summarizer, Translator, Detector) work reliably once flagged; macOS sees higher refusal rates from the Phi-4-mini safety pipeline for Prompt and Summarizer. WebMCP on Edge remains rough on both platforms. See [Browser support](./apps/docs/src/content/docs/browser-support.mdx) for the per-package matrix and exact flag names.

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
