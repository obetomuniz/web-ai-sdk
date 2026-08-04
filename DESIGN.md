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

This file defines the production visual system. Humans and agents must follow
it for UI changes.

Production uses **Noir / Dark**. The dev-only Tone Lab in
`apps/site/src/shared/themes.ts` may test other tokens. Do not ship those tokens
without a design-system change.

## Principles

- Use neutral surfaces and white interaction signals.
- Reserve color for success, warning, and error.
- Create hierarchy with type, spacing, and surface depth.
- Keep motion subtle and functional.
- Prefer clear controls over decoration.

## Color

- `bg` is the page background.
- `surface`, `surface2`, and `surface3` create depth.
- `hairline` and `hairline2` define recessed controls and internal structure.
- `fg` through `fg4` define text hierarchy.
- `accent` tokens define the white interaction ramp.
- `ok`, `warn`, and `err` are status colors. Do not use them as decoration.

Avoid colored brand glows and large ambient color fields. Use only a subtle
neutral page glow.

## Type

- Use Space Grotesk for headings.
- Use Geist for prose and controls.
- Use IBM Plex Mono for code, labels, eyebrows, and the wordmark.
- Use tight heading line height and small negative tracking.
- Keep syntax highlighting colorful enough to scan.

## Surfaces and interaction

- Use elevation instead of outer borders on cards and panels.
- Never use inner shadows.
- Recess inputs, code pills, and output boxes with a darker fill and hairline.
- Use a light surface change or small arrow movement on hover.
- Use crisp rings or border changes for focus and active states.
- Avoid blurry interaction halos.

Primary actions use a white fill, dark text, and pill radius. Ghost actions use
a transparent fill, muted border, and foreground text. Small demo controls may
use a smaller radius but must keep the same focus treatment.

## Motion

- Use the underscore caret as the brand signature.
- Use motion for state changes, streaming, reveal, and direct feedback.
- Respect `prefers-reduced-motion`.
- Make unsupported WebGL effects no-op. Pause them off-screen and cap DPR.

## Layout and components

- Section anchors use `id` and `sectionAnchor`. Outer sections use
  `data-section` for scroll spy.
- Use mutually exclusive classes for state variants.
- Do not combine active and inactive utilities when they conflict.
- Keep visible structure aligned to the page grid.

## Accessibility

- Text and surface combinations must pass WCAG AA.
- Keep `fg4` readable on deep surfaces.
- Hide decorative controls and shortcuts from the accessibility tree.
- Preserve heading order, landmarks, keyboard access, and visible focus.

## Files

- Tokens and base styles: `apps/site/src/styles/home.css`
- Shared Tailwind compositions: `apps/site/src/shared/ui.ts`
- Dev-only token derivation: `apps/site/src/shared/themes.ts`
- Home components: `apps/site/src/features/home/components/`
- Docs styles: `apps/site/src/features/docs/styles/`
- Brand assets: `apps/site/public/favicon.svg` and
  `apps/site/public/og-image.png`
- OG image generator: `apps/site/scripts/build-og-image.mjs`

## Copy and comments

Follow the [documentation style](./.agents/agents.md#documentation-and-copy).
Do not use em dashes. Comments should explain intent, constraints, or
non-obvious behavior instead of restating code.
