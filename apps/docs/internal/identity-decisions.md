# Visual identity: decisions log

Single source of truth for the identity in `apps/landing` (mirrored in
`apps/docs`). The full theming system (18 tones, light/dark) now lives in code as
a **dev-only Tone Lab**: `apps/landing/src/lib/themes.ts` +
`components/ThemeSwitcher.tsx`, rendered only under `import.meta.env.DEV`.
Production ships **one static** skin: **Noir / Dark** (the baked `@theme`).

Status keys: **[done]** applied to the landing, **[confirm]** needs a call before
applying, **[later]** agreed but not done yet.

---

## 0. Scope

- Production ships **one static skin**: **Noir, Dark**. The deployed site has no
  runtime theming; the Tone Lab (18 tones + light/dark) is **dev-only** and
  tree-shaken from the build. Selecting Noir/Dark in the Lab clears the inline
  overrides so dev matches the baked `@theme` exactly.
- **Token-driven, not theme-specific.** Every visual reads a design token; a theme
  is just a set of token values (derived in `themes.ts`). Nothing hardcodes a
  colour outside the tokens — the hero shader reads `--color-*` and re-reads on a
  `themechange` event.
- Writing style: **never use the em dash (—)** in copy, comments, or commits. Use
  periods, colons, parentheses, or a spaced hyphen.

## 1. Colour tokens [done]

Noir / Dark, set in `apps/landing/src/index.css` `@theme` (token names kept, values
swapped, so it cascades to every component).

| Token | Value | Role |
| --- | --- | --- |
| `--color-bg` | `#0a0a0a` | page background |
| `--color-surface` | `#111111` | card |
| `--color-surface-2` | `#1b1b1b` | elevated |
| `--color-surface-3` | `#252525` | deep |
| `--color-hairline` | `rgba(255,255,255,0.07)` | hairline |
| `--color-hairline-2` | `rgba(255,255,255,0.13)` | stronger hairline |
| `--color-fg` | `#ececee` | text |
| `--color-fg-2` | `#bcbcc4` | secondary text |
| `--color-fg-3` | `#a2a2aa` | meta |
| `--color-fg-4` | `#93939c` | faint (tuned for WCAG AA on deep surfaces) |
| `--color-accent` | `#fafafa` | **primary = white** (buttons, active, live, caret) |
| `--color-accent-bright` | `#ffffff` | hover |
| `--color-accent-dim` | `#c8c8ce` | pressed / dim |
| `--color-accent-soft` | `rgba(255,255,255,0.10)` | tint fill |
| `--color-accent-line` | `rgba(255,255,255,0.30)` | accent border / focus |
| `--color-brand-dark` | `#0a0a0a` | text on the white primary |
| `--color-ok` | `#57d9a3` | success / supported (semantic, fixed) |
| `--color-warn` | `#ffc861` | warning (semantic, fixed) |
| `--color-err` | `#ff6b7a` | destructive / error (semantic, fixed) |

Principle: white carries primary/interactive/active/live. `ok/warn/err` are the
only chroma and keep fixed semantic meaning.

## 2. Typography [done]

| Token | Family | Used for |
| --- | --- | --- |
| `--font-display` | **Space Grotesk** | all headings (`h1`-`h4`) |
| `--font-sans` | **Geist** | body, UI, prose |
| `--font-mono` | **IBM Plex Mono** | code, eyebrows, the wordmark |

Loaded via the Google Fonts link in `apps/landing/index.html`. The big hero
wordmark stays mono (IBM Plex Mono).

## 3. Depth [done]

- **No inner shadows, ever.** `--shadow-card` is outer-only, soft, neutral
  dual-tone (faint white rim up-left, soft dark drop down-right).
- Recessed surfaces (inputs, code) read via a **darker fill + a hairline**, not an
  inset shadow. The landing's inputs already follow this.
- Background: removed the warm orange radial; now one faint neutral top glow. No
  ambient glows elsewhere.

## 4. Motion + signatures

- **Underscore caret** `_` (was `|`), blinking, accent colour. Nav brand, hero
  wordmark, footer. [done]
- **Self-writing hero**: the subhead streams in on load, trailing caret that
  vanishes when finished. `prefers-reduced-motion` shows it instantly. [done]
- **Shader backdrop**: a shared engine `ShaderBackdrop.tsx` renders a full-bleed
  hero backdrop from a fragment shader passed in; the look lives in swappable
  wrappers. **`MeshShader`** (default) draws composable square *module* nodes
  wired by faint links with dots streaming along them (composition + streaming,
  the SDK story). **`StreamShader`** keeps the original glyph-ticker as a drop-in
  alternative (swap the import in `App.tsx`). Colours are read from `--color-*`
  (no hardcoding) and re-read on `themechange`. A readability scrim (left column
  on desktop, full veil on mobile) plus a prose text-halo keep hero copy legible.
  Pointer-reactive, pauses off-screen, DPR-capped, density scales with width,
  no-ops on no-WebGL / reduced-motion. [done]
- **Micro-interactions (hover):** arrow links nudge right on hover; nav + footer
  links get an underline that wipes in from the left (nav also underlines the
  active link); buttons drop 1px on press. Kept subtle and meaningful.
- **Reduced motion:** a global `prefers-reduced-motion` reset neutralizes
  animations/transitions, so every micro-interaction is opt-out safe.
- **Scroll:** native + `scroll-behavior: smooth` for anchor jumps (no JS scroll
  lib). Sections use `content-visibility: auto` with `contain-intrinsic-size:
  auto 700px` to keep scroll FPS high without scrollbar jumps after first render.
- **No big glows / halos.** Focus + active use crisp rings, not blurry bloom.
- Live capability probe (feature-detects the built-in AI globals). [later]

## 5. Component decisions [done]

### 5a. Borders vs elevation: **elevation only**

Card/panel **outer borders dropped**; separation is `shadow-card` + surface
colour. Applied to `card`, `stackDiagram`, `supportTable` (outer), `ctaBlock`.
Card hover lightens the surface (`hover:bg-surface-2`) instead of a border swap.
Exceptions that keep a hairline on purpose (not "card borders"):
- **Inputs / recessed boxes** (input, textarea, select, code pills, output boxes):
  darker fill + hairline is the recessed treatment (see §3).
- **Internal structure**: card headers, tabs, and table cell rules.

### 5b. Corners / radii: **softened**

`--radius-sm 8px / --radius-md 12px / --radius-lg 16px / pill 999px`.

### 5c. Button system: **lab press, pill CTAs**

- Tiers: **primary** (white fill + `#0a0a0a` text) and **ghost** (`fg-4` border on
  `bg`). No separate secondary tier for now.
- Press: drop any lift and nudge down 1px (`active:translate-y-px`), never an
  inset.
- Radius: **CTAs are pill** (`btnBase`). Small demo buttons stay `sm`.

### 5d. Syntax highlight: **kept the original colourful theme**

We tried mono / muted / brightness-hierarchy variants, but they all read as
hard-to-parse. Decision: keep the original multi-colour syntax (purple keywords,
gold functions, green strings, blue numbers, teal types, dim italic comments).
Readability wins over strict Noir purity for code blocks.

### 5e. Highlight text: **theme-aware gradient + glow** [done]

`gradientText` utility (`ui.ts`) fills emphasized text with `--gradient-text` (a
sheen across the accent ramp) and adds a `--glow-text` neon glow. Both derive from
the accent tokens, so it reads as a metallic glow in Noir and coloured neon in
tinted themes. Used sparingly: hero eyebrow tagline, the on-device stat, the final
CTA heading.

## 6. Brand assets [done]

- `public/favicon.svg`: monochrome Noir mark; i-tittle is a white spark on dark,
  near-black on light. No orange.
- `public/404.html`: reskinned to the Noir palette (light + dark schemes).
- `scripts/build-og-image.mjs`: Noir template (white mark + spark, underscore
  caret, white `$ npm install`, neutral glow); `public/og-image.png` regenerated.
- Removed the unused `BrandMark.tsx` (the page watermark it powered was dropped
  earlier in favour of the hero shader).

## 7. Accessibility [done]

- Lighthouse: landing (desktop + mobile) and docs all score **100** with zero
  failed audits.
- Contrast: every text/surface token pair passes WCAG AA; `--color-fg-4` was
  nudged to `#93939c` for headroom on the deepest surface.
- Structure: hero + sections wrapped in `<main>`; footer column titles are `h3`
  (no skipped heading levels).
- Docs: a head script hides Starlight's decorative `⌘K` search shortcut from the
  a11y tree (clears axe's `label-content-name-mismatch`).
