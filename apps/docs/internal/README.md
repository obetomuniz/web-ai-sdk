# Internal — Visual identity reference

The current identity is **Noir / Dark**. Canonical reference:

- **`identity-decisions.md`** — the decisions log: colour tokens, type stack,
  depth, motion/signatures, components, highlight text, brand assets, and the
  accessibility pass. Read this first when implementing identity in
  `apps/landing/` or `apps/docs/`.

The full theming system (18 tones, light/dark, the shader) now lives in code as a
**dev-only Tone Lab**: `apps/landing/src/lib/themes.ts` plus
`apps/landing/src/components/ThemeSwitcher.tsx`, rendered only under
`import.meta.env.DEV` and tree-shaken from the production build. The old
standalone `visual-identity-tones.html` prototype was removed in favour of it.

Nothing here is part of the published docs site. Astro / Starlight builds from
`src/content/docs/` only, so anything in this folder stays local —
`apps/docs/internal/` is off the deploy path on purpose.
