# web-ai-sdk

**web-ai-sdk is a TypeScript SDK for the Web's Built-in AI APIs.**

Use Prompt, Writer, Rewriter, Proofreader, Translator, Summarizer, Language Detector, and WebMCP with a stable, typed, composable interface, instead of wiring up each experimental browser API by hand.

```ts
import { ask } from "@web-ai-sdk/prompt";

const { output } = await ask({ input: "Summarize this page in one sentence." });
```

A small, focused monorepo of framework-agnostic packages that smooth over the gnarly bits of the new `document.modelContext`, `Translator`, `Summarizer`, `LanguageModel`, `LanguageDetector`, `Writer`, `Rewriter`, and `Proofreader` browser APIs (feature detection, session caching, streaming, lifecycle, safe DOM rebuild) without bringing any UI along.

> If you're exploring AI in the browser, a [star on GitHub](https://github.com/obetomuniz/web-ai-sdk) helps others find web-ai-sdk.

## Why this exists

The Web's Built-in AI APIs are promising but still early and shifting. Every app that touches them re-implements the same lifecycle: feature-detect, wait for model availability, create and reuse sessions, stream chunks, abort cleanly, and fall back when the capability is missing. web-ai-sdk owns that layer so you build against one stable, typed surface rather than coupling your whole app to today's experimental API shape. The wrappers feature-detect and no-op when a browser lacks the API, so the same code ships everywhere.

The SDK is per-capability because the Web ships more than one AI surface. Six specialized built-ins (Translator, Summarizer, Writer, Rewriter, Proofreader, Language Detector) each carry option spaces a single text-model abstraction cannot express, and WebMCP (`document.modelContext`) is an agent surface rather than a model at all. That breadth is the point, not an accident. One package per capability, and the model abstraction is one of them rather than the whole product.

## What it is

**`web-ai-sdk`** ships one package per browser capability. Zero runtime dependencies. Written in TypeScript. That's it. The SDK tracks a moving browser spec and intentionally stays out of the way of *how* you build an app.

Compositions that bond multiple primitives (block-level DOM translation,
article-aware summarization, detect-then-summarize chains) are
deliberately out of scope — the SDK wraps one capability per package;
composition is your code.

See [`apps/site/src/content/docs/architecture.mdx`](./apps/site/src/content/docs/architecture.mdx) (rendered at [`web-ai-sdk.dev/docs/architecture/`](https://web-ai-sdk.dev/docs/architecture/)) for the full model.

| Package                                          | Wraps                                          | Highlights                                                                |
| ------------------------------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------- |
| [`@web-ai-sdk/webmcp`](./packages/webmcp)            | `document.modelContext` (W3C WebMCP)           | Safe register/unregister, shorthand annotations, `useWebMCP` hook         |
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

## Build for the agentic web

The browser is becoming both an AI runtime and an agent surface. The Built-in AI wrappers (Prompt, Summarizer, Translator, and friends) cover the runtime half: local model capabilities behind one typed interface. [`@web-ai-sdk/webmcp`](./packages/webmcp) covers the agent half: structured, agent-callable tools your page exposes to visiting agents. Feature detection and no-op fallbacks keep the same code shipping everywhere, so neither half is a hard requirement — see [Browser support](./apps/site/src/content/docs/browser-support.mdx) for what's available where.

## Why composable

Browsers are shipping built-in AI APIs behind flags. The shape changes; the lifecycle is similar across them: feature-detect, lazily create a session, stream chunks, cache results, clean up. Those concerns are framework-agnostic and worth sharing.

**We ship that lifecycle layer.** Framework adapters, polyfills, UI primitives stay optional subpaths so they don't constrain your design system, framework, or styling stack. Pick the layers you need; skip the rest.

This is the same shape mature utility libraries converge on as the platform catches up (lodash → native methods, moment/date-fns → `Temporal`): a thin shim over a native primitive that gets *thinner* as the primitive stabilizes. See [Architecture § Lineage](./apps/site/src/content/docs/architecture.mdx) for the full reasoning.

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

One workspace app ships under `apps/site`: an Astro marketing site with Starlight docs mounted at `/docs/`.

```sh
git clone https://github.com/obetomuniz/web-ai-sdk.git
cd web-ai-sdk

# Node 24 (or any version-manager that respects .nvmrc) + Corepack picks up
# pnpm 9.15.0 automatically from package.json's "packageManager" field.
pnpm install
pnpm build:packages  # build packages so workspace consumers can resolve them
pnpm dev             # site at http://localhost:5173/, docs at /docs/
```

For the AI APIs to actually run, open a supporting browser. On Chrome, Summarizer/Translator/Detector are stable in 138+ and Prompt is stable in 148+ (no flags); the Writing Assistance APIs (Writer, Rewriter, Proofreader) are developer/origin trials behind their own `chrome://flags/` toggles; WebMCP needs `chrome://flags/#enable-webmcp-testing` through Chrome 148 and joins a public origin trial in Chrome 149. On Edge, only Summarizer is in stable (138+ default-on); Prompt, Translator, Detector, and WebMCP are developer previews in Canary/Dev behind their respective `edge://flags/` toggles. On Windows the four Built-in AI APIs (Prompt, Summarizer, Translator, Detector) work reliably once flagged; macOS sees higher refusal rates from the Phi-4-mini safety pipeline for Prompt and Summarizer. WebMCP on Edge remains rough on both platforms. See [Browser support](./apps/site/src/content/docs/browser-support.mdx) for the per-package matrix and exact flag names.

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
│   └── site/           # @web-ai-sdk-apps/site (private; Astro site + Starlight docs)
├── .agents/agents.md           # agent instructions (AGENTS.md symlink kept at root)
├── README.md           # ← you are here
└── …
```

## Workflow

| Task                            | Command               |
| ------------------------------- | --------------------- |
| Watch site + docs               | `pnpm dev`            |
| Watch wrapper packages          | `pnpm dev:packages`   |
| Watch meta-package              | `pnpm dev:sdk`        |
| Boot unified app (`:5173`)      | `pnpm site`           |
| Build everything                | `pnpm build`          |
| Build publishable packages only | `pnpm build:packages` |
| Build app only                  | `pnpm build:apps`     |
| Typecheck everything            | `pnpm typecheck`      |
| Run tests                       | `pnpm test`           |
| Lint + format audit             | `pnpm lint`           |
| Auto-fix lint + format          | `pnpm lint:fix`       |
| Full quality gate               | `pnpm gate`           |
| Build Pages artifact            | `pnpm pages:build`    |
| Preview combined Pages locally  | `pnpm pages:preview`  |

Toolchain: Node 24 (pinned in `.nvmrc`) + pnpm 9.15.0 (pinned via `package.json#packageManager` and provisioned automatically by Corepack on Node 16.13+).

## Roadmap

Directional, not a commitment. The bias is toward owning only the lifecycle and ergonomics the raw APIs leave rough, and thinning out as the Built-in AI APIs stabilize.

- Native tool calling for the Prompt API
- Session resilience (auto-retry on session loss)
- IndexedDB cache backend for result caches
- Cloud / custom-provider fallback for unsupported browsers
- More browser compatibility helpers

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the human-facing onboarding, and [`.agents/agents.md`](./.agents/agents.md) for the deeper conventions (same rules apply to humans and AI agents).

## License

MIT © Beto Muniz
