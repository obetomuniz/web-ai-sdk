/**
 * Design-language theming. A *theme* is not a set of components; it's a set of
 * token values. Every visual in the app reads design tokens (`--color-*`), so
 * swapping a theme is purely a matter of recomputing those tokens from a single
 * base tone + tint and writing them onto `:root`. Noir is just the default
 * preset, not a hardcoded rule.
 *
 * This is a test/exploration surface (the "Tone Lab" on the home page). The
 * derivation follows DESIGN.md.
 */

export type Mode = "dark" | "light";

export interface Theme {
  id: string;
  label: string;
  /** Seed tone (hue/sat drive the whole skin; lightness seeds the accent). */
  base: string;
  /** 0–100: how much the base hue tints surfaces and text. 0 = neutral grey. */
  tint: number;
  /** Optional override for the success/status light (`--color-ok`). */
  ok?: string;
}

const NOIR: Theme = { id: "noir", label: "Noir", base: "#fafafa", tint: 0 };

export const THEMES: Theme[] = [
  NOIR,
  { id: "obscur", label: "Obscur", base: "#aab1c2", tint: 30, ok: "#74a890" },
  { id: "clair", label: "Clair", base: "#fafafa", tint: 0 },
  { id: "pure", label: "Pure", base: "#fafafa", tint: 0 },
  { id: "warm", label: "Warm", base: "#efe6d3", tint: 44 },
  { id: "cool", label: "Cool", base: "#dbe6ff", tint: 48 },
  { id: "mint", label: "Mint", base: "#d2f5e2", tint: 42 },
  { id: "orchid", label: "Orchid", base: "#f0d9f2", tint: 42 },
  { id: "amber", label: "Amber", base: "#ffe7bf", tint: 50 },
  { id: "rogue", label: "Rogue", base: "#bd93f4", tint: 56, ok: "#7fe63c" },
  { id: "coil", label: "Coil", base: "#9db9ff", tint: 50, ok: "#56d6ff" },
  { id: "matrix", label: "Matrix", base: "#74f0a0", tint: 58, ok: "#37e07c" },
  { id: "coffee", label: "Coffee", base: "#c89668", tint: 54, ok: "#a8c47e" },
  { id: "papiro", label: "Papiro", base: "#b08850", tint: 40, ok: "#6f8f3f" },
  {
    id: "midnight",
    label: "Midnight",
    base: "#b9c6ef",
    tint: 62,
    ok: "#5fd0b0",
  },
  { id: "frozen", label: "Frozen", base: "#c9f0f5", tint: 46, ok: "#9be8d0" },
  {
    id: "chiaroscuro",
    label: "Chiaroscuro",
    base: "#f0debb",
    tint: 58,
    ok: "#b6c98a",
  },
  { id: "nature", label: "Nature", base: "#aacb8e", tint: 52, ok: "#e0b955" },
];

export const DEFAULT_THEME_ID = "noir";
export const DEFAULT_MODE: Mode = "dark";

interface Hsl {
  h: number;
  s: number;
  l: number;
}

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));

function hexToHsl(hex: string): Hsl {
  let h = hex.replace("#", "").trim();
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  const r = Number.parseInt(h.slice(0, 2), 16) / 255;
  const g = Number.parseInt(h.slice(2, 4), 16) / 255;
  const b = Number.parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  let s = 0;
  let hue = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        hue = ((g - b) / d) % 6;
        break;
      case g:
        hue = (b - r) / d + 2;
        break;
      default:
        hue = (r - g) / d + 4;
    }
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  return { h: hue, s: s * 100, l: l * 100 };
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [r + m, g + m, b + m];
}

const HSL = (h: number, s: number, l: number) =>
  `hsl(${h.toFixed(1)}, ${clamp(s, 0, 100).toFixed(1)}%, ${clamp(l, 0, 100).toFixed(1)}%)`;

const HSLA = (h: number, s: number, l: number, a: number) =>
  `hsla(${h.toFixed(1)}, ${clamp(s, 0, 100).toFixed(1)}%, ${clamp(l, 0, 100).toFixed(1)}%, ${a})`;

export function resolveTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? NOIR;
}

/** Every token applyTheme manages; clearTheme removes exactly these. */
const MANAGED_TOKENS = [
  "--color-bg",
  "--color-surface",
  "--color-surface-2",
  "--color-surface-3",
  "--color-hairline",
  "--color-hairline-2",
  "--color-fg",
  "--color-fg-2",
  "--color-fg-3",
  "--color-fg-4",
  "--color-accent",
  "--color-accent-bright",
  "--color-accent-dim",
  "--color-accent-soft",
  "--color-accent-line",
  "--color-brand-dark",
  "--color-ok",
  "--color-warn",
  "--color-err",
] as const;

/**
 * Drop all inline token overrides so `:root` falls back to the baked `@theme`
 * defaults (the hand-tuned Noir). Used when the Lab selects the default
 * theme/mode, so dev matches production exactly instead of showing a derived
 * approximation.
 */
export function clearTheme(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement.style;
  for (const t of MANAGED_TOKENS) root.removeProperty(t);
  window.dispatchEvent(new CustomEvent("themechange"));
}

/**
 * Compute every `--color-*` token for the given theme + mode and write it onto
 * `document.documentElement`. Dispatches a `themechange` event so token-reading
 * canvases (the shader) can re-read their colors.
 */
export function applyTheme(theme: Theme, mode: Mode): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement.style;
  const set = (k: string, v: string) => root.setProperty(k, v);

  const base = hexToHsl(theme.base);
  const H = base.h;
  const tint = theme.tint / 100;
  const surfS = Math.min(base.s, 55) * tint;
  const textS = surfS * 0.7;
  const light = mode === "light";

  if (light) {
    set("--color-bg", HSL(H, surfS * 0.45, 96));
    set("--color-surface", HSL(H, surfS * 0.25, 100));
    set("--color-surface-2", HSL(H, surfS * 0.5, 93));
    set("--color-surface-3", HSL(H, surfS * 0.6, 88));
    set("--color-hairline", HSLA(H, Math.max(surfS, 10), 22, 0.12));
    set("--color-hairline-2", HSLA(H, Math.max(surfS, 10), 22, 0.2));
    set("--color-fg", HSL(H, textS, 11));
    set("--color-fg-2", HSL(H, textS, 30));
    set("--color-fg-3", HSL(H, textS, 45));
    set("--color-fg-4", HSL(H, textS, 60));
  } else {
    set("--color-bg", HSL(H, surfS, 4));
    set("--color-surface", HSL(H, surfS, 6.6));
    set("--color-surface-2", HSL(H, surfS * 0.9, 10.5));
    set("--color-surface-3", HSL(H, surfS * 0.9, 14.5));
    set("--color-hairline", HSLA(H, Math.max(surfS, 8), 78, 0.08));
    set("--color-hairline-2", HSLA(H, Math.max(surfS, 8), 78, 0.15));
    // Contrast-safe ramp (WCAG AA on the dark surfaces above).
    set("--color-fg", HSL(H, textS, 92.5));
    set("--color-fg-2", HSL(H, textS, 74));
    set("--color-fg-3", HSL(H, textS, 66));
    set("--color-fg-4", HSL(H, textS, 59));
  }

  const aS = base.s;
  const aL = light ? clamp(72 - base.l * 0.5, 22, 54) : clamp(base.l, 82, 98);
  set("--color-accent", HSL(H, aS, aL));
  set("--color-accent-bright", HSL(H, aS, aL + (light ? -6 : 4)));
  set("--color-accent-dim", HSL(H, aS, aL + (light ? 14 : -18)));
  set("--color-accent-soft", HSLA(H, aS, aL, 0.1));
  set("--color-accent-line", HSLA(H, aS, aL, 0.3));

  // Text drawn *on* the accent (filled buttons): pick by accent luminance.
  const [r, g, b] = hslToRgb(H, aS, aL);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  set("--color-brand-dark", lum > 0.55 ? "#0a0a0a" : "#ffffff");

  // Status lights stay semantic; only success may be retinted per theme.
  set("--color-ok", theme.ok ?? (light ? "#1f9d6b" : "#57d9a3"));
  set("--color-warn", light ? "#9a6b00" : "#ffc861");
  set("--color-err", light ? "#c2354a" : "#ff6b7a");

  window.dispatchEvent(new CustomEvent("themechange"));
}
