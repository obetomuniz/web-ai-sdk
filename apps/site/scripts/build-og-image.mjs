// Generate apps/site/public/og-image.png (the home card) from the shared OG
// template in src/shared/og-card.mjs.
//
// One-shot script — run with `node apps/site/scripts/build-og-image.mjs`
// whenever the OG card needs a refresh. The output PNG is committed
// alongside the favicon and shipped via og:image / twitter:image meta tags
// on the home page. Docs and playground cards are rendered from the same
// template at build time by src/pages/og/[...slug].png.ts.

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderOgCardPng, OG_WIDTH, OG_HEIGHT } from "../src/shared/og-card.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const OUT = resolve(ROOT, "public/og-image.png");

const pngData = renderOgCardPng({
  eyebrow: "Web AI, the right way",
  title: "web-ai-sdk",
  taglineStrong: "The TypeScript SDK ",
  tagline: "for the Web AI surface.",
  subline:
    "Composable building blocks, no runtime deps, just lifecycle, streaming, and AbortSignals.",
  install: "@web-ai-sdk/all",
});

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, pngData);
console.log(`✓ wrote ${OUT} (${pngData.length} bytes, ${OG_WIDTH}×${OG_HEIGHT})`);
