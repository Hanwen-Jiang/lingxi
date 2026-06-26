export type ThemeMode = "light" | "dark";

export const THEME_STORAGE_KEY = "lingxi-theme";

/** Resolve the boot theme: ?theme= override (DESIGN.md §9.3) → stored → system. */
export function resolveInitialTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  try {
    const param = new URLSearchParams(window.location.search).get("theme");
    if (param === "dark" || param === "light") return param;
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    /* ignore */
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Apply the theme to <html>: `.dark` class + `data-theme` (HeroUI reads both). */
export function applyTheme(mode: ThemeMode): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  root.dataset.theme = mode;
}

export function persistTheme(mode: ThemeMode): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}
