# @web-ai-sdk-apps/landing

Marketing site and live demos for **web-ai-sdk**. Vite + React, deployed at the GitHub Pages root (`web-ai-sdk.dev`).

```sh
pnpm build          # build packages first (demos import SDK dist)
pnpm landing        # http://localhost:5173
```

Brand tokens and type stack (Noir / Dark): [`apps/docs/internal/identity-decisions.md`](../docs/internal/identity-decisions.md).

---

## Styling guardrails

The landing is on **Tailwind CSS v4** (`@tailwindcss/vite`). Treat utility classes as the default styling surface; avoid growing new hand-written CSS.

### Do

| Layer | Role |
| ----- | ---- |
| `src/lib/ui.ts` | Composed Tailwind class strings shared across sections and demos. **Add new UI patterns here first.** |
| `src/index.css` | Tailwind entry only: `@theme` design tokens, layout CSS variables (`--nav-height`, `--section-py`, `--gutter`), `@keyframes`, and minimal `@layer base` resets via `@apply`. |
| Components | Import from `ui.ts`. One-off layout tweaks may use inline Tailwind utilities in JSX when they are truly local. |

**Patterns**

- Prefer **mutually exclusive** class sets for state (e.g. `chipActive : chip`, `tabActive : tab`). Do not merge a shared base with an active variant when utilities conflict in CSS order.
- Section nav anchors: `id` + `sectionAnchor` on headings; `data-section` on the outer `<section>` for scroll spy.
- Dynamic values only: `style={{ width: \`${pct}%\` }}` (or similar) when the value cannot be a static utility.

### Don't

- **No new `.css` files** under `src/` (no `components.css`, no page-level stylesheets).
- **No raw CSS in React** (`style={{ color: '…' }}`, `<style>` tags in components).
- **No `innerHTML` styling hooks** — use Tailwind utilities or `ui.ts` exports.
- **Don't reintroduce** legacy token aliases (`--bg`, `--surface`, …) unless a static page outside the Vite bundle needs them.

### Allowed exceptions (outside the React bundle)

These files intentionally stay plain HTML/CSS because they run without JavaScript or outside Vite:

- `index.html` — `<noscript>` crawler fallback (inline styles)
- `public/404.html` — standalone error page

Do not copy patterns from those files into `src/`.

### Current state (mixed)

The Tailwind migration removed `styles.css` (~1,500 lines). Some components still carry **inline Tailwind strings** not yet moved into `ui.ts` (`StarWidget`, notice bars in `shared.tsx`, `InstallPill`, etc.). That is acceptable short-term; **new work should go through `ui.ts`**, and drive-by edits should consolidate nearby inline utilities when touching a file.

`apps/docs/` is still on Starlight/custom CSS — these guardrails apply to **`apps/landing` only** until docs are migrated.

---

## Layout files

| File | Purpose |
| ---- | ------- |
| `src/lib/ui.ts` | Shared Tailwind compositions |
| `src/index.css` | Theme + base layer |
| `src/App.tsx` | Page sections and nav |
| `src/components/ScrollSpy.tsx` | Nav highlight + reveal animations |

Run `pnpm gate` before committing landing changes.
