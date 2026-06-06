---
name: web-ai-sdk
version: 1
theme: Noir / Dark
colors:
  bg: "#0a0a0a"
  surface: "#111111"
  surface2: "#1b1b1b"
  surface3: "#252525"
  hairline: "rgba(255, 255, 255, 0.07)"
  hairline2: "rgba(255, 255, 255, 0.13)"
  fg: "#ececee"
  fg2: "#bcbcc4"
  fg3: "#a2a2aa"
  fg4: "#93939c"
  accent: "#fafafa"
  accentBright: "#ffffff"
  accentDim: "#c8c8ce"
  accentSoft: "rgba(255, 255, 255, 0.10)"
  accentLine: "rgba(255, 255, 255, 0.30)"
  brandDark: "#0a0a0a"
  ok: "#57d9a3"
  warn: "#ffc861"
  err: "#ff6b7a"
typography:
  display:
    fontFamily: "Space Grotesk, Geist, ui-sans-serif, system-ui, sans-serif"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  sans:
    fontFamily: "Geist, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontWeight: 400
    lineHeight: 1.55
  mono:
    fontFamily: "IBM Plex Mono, JetBrains Mono, ui-monospace, SF Mono, Menlo, monospace"
radius:
  sm: "8px"
  md: "12px"
  lg: "16px"
  pill: "999px"
shadows:
  card: "-1px -1px 2px rgba(255, 255, 255, 0.03), 3px 5px 14px rgba(0, 0, 0, 0.55)"
---

# DESIGN.md

This is the source of truth for the web-ai-sdk visual identity. It is written
for humans and AI agents making UI changes in this repository.

Production ships one static skin: **Noir / Dark**. The dev-only Tone Lab in
`apps/site/src/shared/themes.ts` can test alternate token sets, but production
must keep the baked Noir / Dark defaults unless the design system changes.

## Identity

web-ai-sdk should feel precise, quiet, local-first, and technical. The product
wraps native browser AI primitives, so the interface should read as a thin
instrument panel rather than a heavy SaaS dashboard.

Use white as the primary signal. Colour is reserved for semantic status:
success, warning, and error.

## Color Semantics

- `bg` is the page background.
- `surface`, `surface2`, and `surface3` create depth through fills.
- `hairline` and `hairline2` are for recessed controls and internal structure.
- `fg`, `fg2`, `fg3`, and `fg4` are text hierarchy.
- `accent`, `accentBright`, `accentDim`, `accentSoft`, and `accentLine` are the
  white interaction ramp.
- `ok`, `warn`, and `err` are semantic and should not be repurposed for brand
  decoration.

Avoid orange, blue brand glows, and large ambient colour fields. The only page
glow should be a subtle neutral background glow.

## Typography

- Display: Space Grotesk for headings.
- Body: Geist for prose and UI.
- Mono: IBM Plex Mono for code, labels, eyebrows, and the wordmark.
- Headings should be tight and calm, with small negative tracking.
- Code and terminal-inspired UI should prioritize readability over strict
  monochrome styling.

## Surfaces And Elevation

- Cards and panels use elevation, not outer borders.
- Never use inner shadows.
- Inputs, textareas, selects, code pills, and output boxes are recessed:
  darker fill plus hairline.
- Hover should lighten surfaces or move arrows subtly. Avoid blurry halos.
- Focus and active states should be crisp rings or crisp border changes.

## Motion

- Use an underscore caret as the brand signature.
- Motion should be subtle and functional: streaming text, small arrow nudges,
  scroll reveal, button press, shader movement.
- Respect `prefers-reduced-motion`.
- WebGL effects must no-op when unsupported, pause off-screen, and cap DPR.

## Components

- Primary CTA: white fill, dark text, pill radius.
- Ghost CTA: transparent or background fill, muted border, foreground text.
- Small demo controls may use smaller radius, but should keep the same recessed
  and focus language.
- Section anchors use `id`, `sectionAnchor`, and `data-section` for scroll spy.
- Use mutually exclusive classes for stateful variants. Do not compose active
  and inactive utility sets if they conflict.
- Keep syntax highlighting colourful enough to parse quickly. Noir does not
  require monochrome code.

## Accessibility

- Text and surface pairings must pass WCAG AA.
- `fg4` is intentionally brighter than a purely decorative grey so metadata
  remains readable on deep surfaces.
- Decorative controls and shortcuts should be hidden from the accessibility
  tree when they do not add information.
- Maintain heading order and landmark structure.

## Implementation Map

- Home page tokens: `apps/site/src/styles/home.css`
- Shared Tailwind compositions: `apps/site/src/shared/ui.ts`
- Dev-only token derivation: `apps/site/src/shared/themes.ts`
- Home page React islands: `apps/site/src/features/home/components/`
- Docs styling: `apps/site/src/features/docs/styles/`
- Brand assets: `apps/site/public/favicon.svg`, `apps/site/public/og-image.png`
- OG image generator: `apps/site/scripts/build-og-image.mjs`

## Writing Rules

- Do not use em dashes in copy, comments, or docs.
- Prefer short, direct technical prose.
- Comments should explain intent, constraints, or non-obvious behavior, not
  restate the code.
