# @web-ai-sdk-apps/site

Marketing site and live demos for **web-ai-sdk**. Astro static output with Starlight docs mounted at `/docs/`, deployed at the GitHub Pages root (`web-ai-sdk.dev`).

```sh
pnpm build:packages # build packages first (demos import SDK dist)
pnpm site        # http://localhost:5173 and /docs/
```

Brand tokens and type stack (Noir / Dark): [`DESIGN.md`](../../DESIGN.md).

---

## Styling guardrails

The site is on **Tailwind CSS v4** (`@tailwindcss/vite` through Astro). Treat utility classes as the default styling surface; avoid growing new hand-written CSS.

### Do

| Layer | Role |
| ----- | ---- |
| `src/shared/ui.ts` | Composed Tailwind class strings shared across sections and demos. **Add new UI patterns here first.** |
| `src/styles/home.css` | Tailwind entry only: `@theme` design tokens, layout CSS variables (`--nav-height`, `--section-py`, `--gutter`), `@keyframes`, and minimal `@layer base` resets via `@apply`. |
| `src/pages/index.astro` | Static marketing HTML and React island placement. Keep copy, layout, and SEO metadata here. |
| React components | Import from `ui.ts`. One-off layout tweaks may use inline Tailwind utilities in JSX when they are truly local. |

**Patterns**

- Prefer **mutually exclusive** class sets for state (e.g. `chipActive : chip`, `tabActive : tab`). Do not merge a shared base with an active variant when utilities conflict in CSS order.
- Section nav anchors: `id` + `sectionAnchor` on headings; `data-section` on the outer `<section>` for scroll spy.
- Dynamic values only: `style={{ width: \`${pct}%\` }}` (or similar) when the value cannot be a static utility.

### Don't

- **No new `.css` files** under `src/` (no `components.css`, no page-level stylesheets).
- **No raw CSS in React** (`style={{ color: '…' }}`, `<style>` tags in components).
- **No `innerHTML` styling hooks** — use Tailwind utilities or `ui.ts` exports.
- **Don't reintroduce** legacy token aliases (`--bg`, `--surface`, …) unless a standalone static file needs them.

### Allowed exceptions (outside the React bundle)

These files intentionally stay plain HTML/CSS because they run without JavaScript or outside the bundled React islands:

- `public/404.html` — standalone error page

Do not copy patterns from those files into `src/`.

### Current state (mixed)

The Tailwind migration removed `styles.css` (~1,500 lines). Some components still carry **inline Tailwind strings** not yet moved into `ui.ts` (`StarWidget`, notice bars in `shared.tsx`, `InstallPill`, etc.). That is acceptable short-term; **new work should go through `ui.ts`**, and drive-by edits should consolidate nearby inline utilities when touching a file.

Docs styles live separately under `src/features/docs/styles`; these site guardrails apply to the marketing page and home React islands.

---

## Layout files

| File | Purpose |
| ---- | ------- |
| `src/shared/ui.ts` | Shared Tailwind compositions |
| `src/styles/home.css` | Theme + base layer |
| `src/pages/index.astro` | Static page sections, nav, metadata, and island hydration |
| `src/features/home/components/ScrollSpy.tsx` | Nav highlight + reveal animations |

Run `pnpm gate` before committing site changes.
