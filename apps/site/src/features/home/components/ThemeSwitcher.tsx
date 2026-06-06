import { useEffect, useState } from "react";
import {
  applyTheme,
  clearTheme,
  DEFAULT_MODE,
  DEFAULT_THEME_ID,
  type Mode,
  resolveTheme,
  THEMES,
} from "../../../shared/themes.js";

const LS_THEME = "wais-theme";
const LS_MODE = "wais-mode";

/**
 * Tone Lab: a runtime theme selector. Test-only affordance to prove the
 * token-driven design language — every preset recomputes the `--color-*` tokens
 * and the whole page (shader included) follows. No component knows the theme.
 */
export function ThemeSwitcher() {
  const [themeId, setThemeId] = useState(DEFAULT_THEME_ID);
  const [mode, setMode] = useState<Mode>(DEFAULT_MODE);

  // Restore the last choice after mount (avoids SSR/hydration mismatch).
  useEffect(() => {
    const savedTheme = localStorage.getItem(LS_THEME);
    const savedMode = localStorage.getItem(LS_MODE) as Mode | null;
    if (savedTheme) setThemeId(savedTheme);
    if (savedMode === "dark" || savedMode === "light") setMode(savedMode);
  }, []);

  useEffect(() => {
    // Default theme + mode: clear overrides so the baked, hand-tuned @theme
    // shows (dev == prod). Anything else: apply derived tokens.
    if (themeId === DEFAULT_THEME_ID && mode === DEFAULT_MODE) clearTheme();
    else applyTheme(resolveTheme(themeId), mode);
    localStorage.setItem(LS_THEME, themeId);
    localStorage.setItem(LS_MODE, mode);
  }, [themeId, mode]);

  return (
    <div className="fixed top-[4.5rem] right-3 z-40 flex items-center gap-1 rounded-pill border border-hairline-2 bg-surface px-1.5 py-1 font-mono text-[11px] text-fg-4 transition-colors hover:bg-surface-2 hover:text-fg-2">
      <select
        value={themeId}
        onChange={(e) => setThemeId(e.target.value)}
        aria-label="Tone Lab theme selector"
        className="cursor-pointer rounded-pill bg-transparent px-1.5 py-0.5 text-fg-2 outline-none transition-colors hover:text-fg"
      >
        {THEMES.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => setMode((m) => (m === "dark" ? "light" : "dark"))}
        className="cursor-pointer rounded-pill px-1.5 py-0.5 text-fg-4 transition-colors hover:text-accent-bright"
        aria-pressed={mode === "light"}
        title="Toggle light / dark"
      >
        {mode === "dark" ? "☾" : "☀"}
      </button>
    </div>
  );
}
