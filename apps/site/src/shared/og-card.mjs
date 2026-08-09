// Shared OG card template (1200×630). One template, parameterized slots:
// the committed home card (scripts/build-og-image.mjs) and the per-page
// docs/playground cards (src/pages/og/[...slug].png.ts) both render through
// renderOgCardPng so every social card shares the same composition.
//
// 1200×630 is the spec'd Twitter "summary_large_image" and OpenGraph card
// size; LinkedIn, Slack, Discord, iMessage all crop from the same source.

import { Resvg } from "@resvg/resvg-js";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const W = OG_WIDTH;
const H = OG_HEIGHT;

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

const MARGIN_X = 70;
const CONTENT_W = W - MARGIN_X * 2;

const escapeXml = (text) =>
  String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

// Measure the natural rendered width of a string in the font the final card
// uses. resvg's getBBox reflects the resolved fallback font, so layout fits
// whatever actually paints. Falls back to a per-family advance estimate if
// the bbox is unavailable for any reason.
function measureWidth(text, fontSize, fontFamily = MONO) {
  try {
    const probe = new Resvg(
      `<svg xmlns="http://www.w3.org/2000/svg" width="6000" height="${fontSize * 2}"><text x="0" y="${fontSize}" font-family="${fontFamily}" font-size="${fontSize}">${escapeXml(text)}</text></svg>`,
      { background: INK, font: { loadSystemFonts: true } },
    );
    const bbox = probe.getBBox();
    if (bbox && bbox.width > 0) return Math.ceil(bbox.width);
  } catch {
    // fall through to the estimate
  }
  const advance = fontFamily === MONO ? 0.6 : 0.52;
  return Math.round(text.length * fontSize * advance);
}

// The home wordmark paints the "ai" inside "web-ai-sdk" in bright accent.
// Any title carrying the brand string (the wordmark itself, package names
// like "@web-ai-sdk/prompt") keeps that detail; other titles render plain.
function titleMarkup(title) {
  const brand = "web-ai-sdk";
  const at = title.indexOf(brand);
  if (at === -1) return escapeXml(title);
  return (
    escapeXml(title.slice(0, at)) +
    `web-<tspan fill="${ACCENT_HI}">ai</tspan>-sdk` +
    escapeXml(title.slice(at + brand.length))
  );
}

// Greedy word-wrap against measured widths. Returns at most maxLines lines,
// ellipsizing the final line when the text doesn't fit.
function wrapToWidth(text, fontSize, fontFamily, maxWidth, maxLines) {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (let i = 0; i < words.length; i++) {
    const candidate = line ? `${line} ${words[i]}` : words[i];
    if (measureWidth(candidate, fontSize, fontFamily) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = words[i];
    if (lines.length === maxLines - 1) {
      // Last allowed line: keep the rest verbatim when it fits, otherwise
      // drop trailing words until it fits with an ellipsis.
      let rest = words.slice(i).join(" ");
      if (measureWidth(rest, fontSize, fontFamily) <= maxWidth) {
        lines.push(rest);
        return lines;
      }
      while (rest && measureWidth(`${rest}…`, fontSize, fontFamily) > maxWidth) {
        rest = rest.replace(/\s*\S+$/, "");
      }
      lines.push(rest ? `${rest}…` : "…");
      return lines;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Render the shared OG card to a PNG buffer.
 *
 * @param {object} slots
 * @param {string} slots.eyebrow      Mono kicker next to the spark bullet.
 * @param {string} slots.title        Hero line; auto-fit, brand "ai" highlighted,
 *                                    trailing caret matches the site wordmark.
 * @param {string} [slots.taglineStrong] Leading bold run of the 31px line.
 * @param {string} [slots.tagline]    Regular run of the 31px line. When there is
 *                                    no strong run the text may wrap onto the
 *                                    21px subline slot.
 * @param {string} [slots.subline]    Muted 21px line under the tagline.
 * @param {string} [slots.install]    Command rendered in the install pill;
 *                                    pass null/undefined to omit the pill.
 * @param {boolean} [slots.caret]     Trailing "_" caret after the title. The
 *                                    home wordmark keeps it; page cards omit it.
 */
export function renderOgCardPng({
  eyebrow,
  title,
  taglineStrong = "",
  tagline = "",
  subline = "",
  install,
  caret = true,
}) {
  // Hero title: start at the home wordmark size and shrink to fit one line,
  // reserving room for the trailing caret when present.
  const CARET_GAP_EM = 0.1;
  const CARET_W_EM = 0.55;
  let titleFs = 120;
  const titleBudget = CONTENT_W;
  let titleW = measureWidth(title, titleFs);
  const caretSpace = (fs) =>
    caret ? Math.round(fs * (CARET_GAP_EM + CARET_W_EM)) : 0;
  while (titleFs > 44 && titleW + caretSpace(titleFs) > titleBudget) {
    titleFs -= 4;
    titleW = measureWidth(title, titleFs);
  }
  const caretX = MARGIN_X + titleW + Math.round(titleFs * CARET_GAP_EM);
  const caretW = Math.round(titleFs * CARET_W_EM);
  const caretH = Math.round(titleFs * 0.09) + 1;
  // Keep the wordmark baseline; the caret hugs it like the home hero.
  const titleY = 355;
  const caretY = titleY - caretH + Math.round(titleFs * 0.04);

  // Tagline slots. With a strong run (home card) the 31px line is a single
  // composed line; without one, long text wraps once into the 21px subline.
  let taglineLine = "";
  let sublineLine = subline;
  if (taglineStrong) {
    taglineLine = tagline;
  } else if (tagline) {
    const wrapped = wrapToWidth(tagline, 31, SANS, CONTENT_W, 2);
    taglineLine = wrapped[0] ?? "";
    if (wrapped.length > 1 && !subline) sublineLine = wrapped[1];
  }
  if (sublineLine) {
    sublineLine = wrapToWidth(sublineLine, 21, SANS, CONTENT_W, 1)[0] ?? "";
  }

  // Install pill geometry. The pill width is derived from the *actually
  // rendered* text width rather than hardcoded, so the left/right padding
  // stays symmetric no matter which monospace font the host renderer falls
  // back to.
  const INSTALL_FS = 24;
  const INSTALL_PAD = 24;
  const installText = install ? `$ npm install ${install}` : "";
  const installPillW = install
    ? measureWidth(installText, INSTALL_FS) + INSTALL_PAD * 2
    : 0;

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

  <!-- Eyebrow: white spark bullet + context line -->
  <g transform="translate(70, 220)">
    <circle cx="8" cy="12" r="5" fill="${ACCENT}"/>
    <text x="24" y="18" font-family="${MONO}" font-size="20" fill="${PAPER_2}" letter-spacing="0">${escapeXml(eyebrow)}</text>
  </g>

  <!-- Hero title with the trailing underscore caret (matching the home
       page's "_" caret). Auto-fit so long page titles stay on one line. -->
  <text x="${MARGIN_X}" y="${titleY}" font-family="${MONO}" font-weight="500" font-size="${titleFs}" fill="${PAPER}">${titleMarkup(title)}</text>
  ${caret ? `<rect x="${caretX}" y="${caretY}" width="${caretW}" height="${caretH}" rx="2" fill="${ACCENT}"/>` : ""}

  <!-- Tagline -->
  ${
    taglineLine || taglineStrong
      ? `<text x="70" y="425" font-family="${SANS}" font-weight="600" font-size="31" fill="${PAPER}">${
          taglineStrong ? escapeXml(taglineStrong) : ""
        }<tspan font-weight="400" fill="${PAPER_2}">${escapeXml(taglineLine)}</tspan></text>`
      : ""
  }
  ${
    sublineLine
      ? `<text x="70" y="462" font-family="${SANS}" font-weight="400" font-size="21" fill="${MUTED}">${escapeXml(sublineLine)}</text>`
      : ""
  }

  ${
    install
      ? `<!-- Install pill. One text element (not two) so the space between
       "install" and the package is a literal character at the monospace
       advance — no manual x-positioning, no accidental gap. -->
  <g transform="translate(70, 504)">
    <rect x="0" y="0" width="${installPillW}" height="56" rx="10" fill="${INK_2}" stroke="${RULE_2}" stroke-width="1"/>
    <text x="${INSTALL_PAD}" y="38" font-family="${MONO}" font-size="${INSTALL_FS}" fill="${PAPER}"><tspan fill="${ACCENT}">$ npm install</tspan> ${escapeXml(install)}</text>
  </g>`
      : ""
  }

  <!-- Domain stamp, bottom-right -->
  <text x="${W - 70}" y="${H - 50}" font-family="${MONO}" font-size="18" fill="${MUTED}" text-anchor="end">web-ai-sdk.dev</text>
</svg>`;

  const resvg = new Resvg(svg, {
    background: INK,
    fitTo: { mode: "width", value: W },
    font: {
      // Use whatever monospace + sans the renderer can find on the host.
      // The SVG's font-family chain falls back gracefully.
      loadSystemFonts: true,
    },
  });

  return resvg.render().asPng();
}
