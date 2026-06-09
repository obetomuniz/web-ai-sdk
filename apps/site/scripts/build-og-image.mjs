// Generate apps/site/public/og-image.png from an SVG template.
//
// One-shot script — run with `node apps/site/scripts/build-og-image.mjs`
// whenever the OG card needs a refresh. The output PNG is committed
// alongside the favicon and shipped via og:image / twitter:image meta tags
// across the unified site.
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

// Colors: Noir / Dark identity (DESIGN.md).
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

// Install pill geometry. The pill width is derived from the *actually rendered*
// text width (measured below) rather than hardcoded, so the left/right padding
// stays symmetric no matter which monospace font the host renderer falls back
// to. Hardcoding the width left a lopsided right gap whenever the fallback font
// advanced differently from the design assumption.
const INSTALL_TEXT = "$ npm install @web-ai-sdk/all";
const INSTALL_FS = 24;
const INSTALL_PAD = 24;

// Measure the natural rendered width of the install string in the same font
// the final card uses. resvg's getBBox reflects the resolved fallback font, so
// the pill fits whatever actually paints. Falls back to a 0.6em monospace
// estimate if the bbox is unavailable for any reason.
function measureWidth(text, fontSize) {
  try {
    const probe = new Resvg(
      `<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="${fontSize * 2}"><text x="0" y="${fontSize}" font-family="${MONO}" font-size="${fontSize}">${text}</text></svg>`,
      { background: INK, font: { loadSystemFonts: true } },
    );
    const bbox = probe.getBBox();
    if (bbox && bbox.width > 0) return Math.ceil(bbox.width);
  } catch {
    // fall through to the estimate
  }
  return Math.round(text.length * fontSize * 0.6);
}

const INSTALL_TEXT_W = measureWidth(INSTALL_TEXT, INSTALL_FS);
const INSTALL_PILL_W = INSTALL_TEXT_W + INSTALL_PAD * 2;

// Wordmark caret. The home page sits the "_" caret a hair after the wordmark
// (a ~0.1em gap). Measure the rendered "web-ai-sdk" width so the caret tracks
// the actual glyphs instead of a hardcoded x that floats when the fallback
// font advances differently.
const WORDMARK_TEXT = "web-ai-sdk";
const WORDMARK_FS = 120;
const WORDMARK_X = 70;
const WORDMARK_W = measureWidth(WORDMARK_TEXT, WORDMARK_FS);
const CARET_X = WORDMARK_X + WORDMARK_W + Math.round(WORDMARK_FS * 0.1);

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <!-- Faint neutral top glow, matching the home page's body::before radial. -->
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

  <!-- Node-mesh motif, echoing the home page's animated mesh background.
       Confined to the right column so it reads as texture behind the
       left-aligned wordmark and tagline. -->
  <g>
    <g stroke="${PAPER}" stroke-opacity="0.10" stroke-width="1">
      <line x1="965" y1="110" x2="1065" y2="95"/>
      <line x1="1065" y1="95" x2="1135" y2="160"/>
      <line x1="965" y1="110" x2="985" y2="205"/>
      <line x1="1065" y1="95" x2="1085" y2="215"/>
      <line x1="985" y1="205" x2="1085" y2="215"/>
      <line x1="1135" y1="160" x2="1085" y2="215"/>
      <line x1="985" y1="205" x2="940" y2="300"/>
      <line x1="1085" y1="215" x2="1050" y2="300"/>
      <line x1="1135" y1="160" x2="1140" y2="270"/>
      <line x1="1050" y1="300" x2="1140" y2="270"/>
      <line x1="940" y1="300" x2="1050" y2="300"/>
      <line x1="940" y1="300" x2="985" y2="390"/>
      <line x1="1050" y1="300" x2="1095" y2="380"/>
      <line x1="985" y1="390" x2="1095" y2="380"/>
      <line x1="1140" y1="270" x2="1095" y2="380"/>
      <line x1="985" y1="390" x2="1040" y2="455"/>
      <line x1="1095" y1="380" x2="1040" y2="455"/>
      <line x1="1095" y1="380" x2="1140" y2="430"/>
      <line x1="1140" y1="270" x2="1140" y2="430"/>
      <line x1="1050" y1="300" x2="985" y2="390"/>
    </g>
    <g fill="${MUTED}" fill-opacity="0.55">
      <rect x="963" y="108" width="4" height="4"/>
      <rect x="1133" y="158" width="4" height="4"/>
      <rect x="983" y="203" width="4" height="4"/>
      <rect x="1083" y="213" width="4" height="4"/>
      <rect x="938" y="298" width="4" height="4"/>
      <rect x="1138" y="268" width="4" height="4"/>
      <rect x="983" y="388" width="4" height="4"/>
      <rect x="1038" y="453" width="4" height="4"/>
      <rect x="1138" y="428" width="4" height="4"/>
    </g>
    <g fill="${ACCENT_HI}" fill-opacity="0.9">
      <rect x="1062" y="92" width="6" height="6"/>
      <rect x="1047" y="297" width="6" height="6"/>
      <rect x="1092" y="377" width="6" height="6"/>
    </g>
  </g>

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
       underscore caret right after "sdk" (matching the home page's "_" caret). The
       x-coordinate is hand-tuned to sit just after the wordmark at 120px. -->
  <text x="${WORDMARK_X}" y="355" font-family="${MONO}" font-weight="500" font-size="${WORDMARK_FS}" fill="${PAPER}">web-<tspan fill="${ACCENT_HI}">ai</tspan>-sdk</text>
  <rect x="${CARET_X}" y="349" width="66" height="11" rx="2" fill="${ACCENT}"/>

  <!-- Tagline -->
  <text x="70" y="425" font-family="${SANS}" font-weight="600" font-size="31" fill="${PAPER}">The TypeScript SDK <tspan font-weight="400" fill="${PAPER_2}">for the Web's Built-in AI APIs.</tspan></text>
  <text x="70" y="462" font-family="${SANS}" font-weight="400" font-size="21" fill="${MUTED}">Composable building blocks, no runtime deps, just lifecycle, streaming, and AbortSignals.</text>

  <!-- Install pill. One text element (not two) so the space between
       "install" and "@web-ai-sdk/all" is a literal character at the
       monospace advance — no manual x-positioning, no accidental gap. -->
  <g transform="translate(70, 504)">
    <rect x="0" y="0" width="${INSTALL_PILL_W}" height="56" rx="10" fill="${INK_2}" stroke="${RULE_2}" stroke-width="1"/>
    <text x="${INSTALL_PAD}" y="38" font-family="${MONO}" font-size="${INSTALL_FS}" fill="${PAPER}"><tspan fill="${ACCENT}">$ npm install</tspan> @web-ai-sdk/all</text>
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
