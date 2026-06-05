// Generate apps/landing/public/og-image.png from an SVG template.
//
// One-shot script — run with `node apps/landing/scripts/build-og-image.mjs`
// whenever the OG card needs a refresh. The output PNG is committed
// alongside the favicon and shipped via og:image / twitter:image meta tags
// on both the landing and docs sites.
//
// 1200×630 is the spec'd Twitter "summary_large_image" and OpenGraph card
// size; LinkedIn, Slack, Discord, iMessage all crop from the same source.

import { Resvg } from "@resvg/resvg-js";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const OUT = resolve(ROOT, "public/og-image.png");

const W = 1200;
const H = 630;

// Colors: Noir / Dark identity (apps/docs/internal/identity-decisions.md).
const INK = "#0A0A0A";
const INK_2 = "#111111";
const RULE_2 = "#2A2A2E";
const PAPER = "#ECECEE";
const PAPER_2 = "#B4B4BA";
const MUTED = "#A2A2AA";
const ACCENT = "#FAFAFA"; // white is primary in Noir
const ACCENT_HI = "#FFFFFF";

// Fonts: IBM Plex Mono for the wordmark/code, Geist for body. Fall back to
// system fonts so resvg renders something legible without bundled font files.
const MONO = "'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace";
const SANS = "'Geist', ui-sans-serif, system-ui, -apple-system, sans-serif";

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <!-- Faint neutral top glow, matching the landing's body::before radial. -->
    <radialGradient id="glow-top" cx="50%" cy="0%" r="60%">
      <stop offset="0%" stop-color="${ACCENT}" stop-opacity="0.05"/>
      <stop offset="60%" stop-color="${ACCENT}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow-corner" cx="90%" cy="10%" r="40%">
      <stop offset="0%" stop-color="${ACCENT}" stop-opacity="0.03"/>
      <stop offset="60%" stop-color="${ACCENT}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Page surface -->
  <rect width="${W}" height="${H}" fill="${INK}"/>
  <rect width="${W}" height="${H}" fill="url(#glow-top)"/>
  <rect width="${W}" height="${H}" fill="url(#glow-corner)"/>

  <!-- Brand mark, top-left signature. Canonical 96×64 geometry scaled to
       ~144×96 (×1.5) so the brackets, ring, stem and spark dot all stay
       legible. Pulled tight into the top-left corner so the whole card
       reads as a compact composition instead of floating in dead space. -->
  <g transform="translate(70, 56) scale(1.5)">
    <g fill="none" stroke="${PAPER}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M22 27 L14 38 L22 49"/>
      <circle cx="45" cy="38" r="11"/>
      <line x1="56" y1="27" x2="56" y2="49"/>
      <path d="M68 27 L76 38 L68 49"/>
    </g>
    <circle cx="56" cy="18" r="3.8" fill="${ACCENT_HI}"/>
  </g>

  <!-- Eyebrow pill: white spark bullet + "Built-in AI, the right way" -->
  <g transform="translate(70, 220)">
    <circle cx="8" cy="12" r="5" fill="${ACCENT}"/>
    <text x="24" y="18" font-family="${MONO}" font-size="20" fill="${PAPER_2}" letter-spacing="0">Built-in AI, the right way</text>
  </g>

  <!-- Wordmark, the hero. "web-ai-sdk" with the "ai" in bright accent, plus an
       underscore caret right after "sdk" (matching the landing's "_" caret). The
       x-coordinate is hand-tuned to sit just after the wordmark at 120px. -->
  <text x="70" y="355" font-family="${MONO}" font-weight="500" font-size="120" fill="${PAPER}">web-<tspan fill="${ACCENT_HI}">ai</tspan>-sdk</text>
  <rect x="828" y="349" width="66" height="11" rx="2" fill="${ACCENT}"/>

  <!-- Tagline -->
  <text x="70" y="425" font-family="${SANS}" font-weight="600" font-size="32" fill="${PAPER}">Building blocks <tspan font-weight="400" fill="${PAPER_2}">for the Web's built-in AI APIs.</tspan></text>
  <text x="70" y="462" font-family="${SANS}" font-weight="400" font-size="22" fill="${MUTED}">Composable. No runtime deps. Streaming and AbortSignals built in.</text>

  <!-- Install pill. One text element (not two) so the space between
       "install" and "@web-ai-sdk/all" is a literal character at the
       monospace advance — no manual x-positioning, no accidental gap. -->
  <g transform="translate(70, 504)">
    <rect x="0" y="0" width="448" height="56" rx="10" fill="${INK_2}" stroke="${RULE_2}" stroke-width="1"/>
    <text x="22" y="38" font-family="${MONO}" font-size="24" fill="${PAPER}"><tspan fill="${ACCENT}">$ npm install</tspan> @web-ai-sdk/all</text>
  </g>

  <!-- Domain stamp, bottom-right -->
  <text x="${W - 70}" y="${H - 50}" font-family="${MONO}" font-size="18" fill="${MUTED}" text-anchor="end">web-ai-sdk.dev</text>
</svg>`;

mkdirSync(dirname(OUT), { recursive: true });

const resvg = new Resvg(svg, {
  background: INK,
  fitTo: { mode: "width", value: W },
  font: {
    // Use whatever monospace + sans the renderer can find on the host.
    // The SVG's font-family chain falls back gracefully (Geist Mono →
    // ui-monospace → SF Mono → Menlo → monospace).
    loadSystemFonts: true,
  },
});

const pngData = resvg.render().asPng();
writeFileSync(OUT, pngData);
console.log(`✓ wrote ${OUT} (${pngData.length} bytes, ${W}×${H})`);
