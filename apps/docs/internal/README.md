# Internal — Visual identity reference

`visual-identity.html` is a self-contained design prototype documenting the brand canon: surface tones, the mark geometry, the type system, and a copy-paste kit (CSS tokens, font links, inline favicon SVG, standalone wordmark snippet).

It's **not part of the published docs site.** Astro / Starlight builds from `src/content/docs/` only, so anything in this folder stays local — `apps/docs/internal/` is off the deploy path on purpose.

To view it, just open the file directly in a browser — no build step.

The mark, palette, and type stack defined there are the canonical references when implementing identity in `apps/landing/` or `apps/docs/`.
