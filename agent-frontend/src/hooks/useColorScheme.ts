import {useCallback, useSyncExternalStore} from "react";

import {THEME_STORAGE_KEY} from "../lib/constants";

type ColorScheme = "light" | "dark";

// Module-level theme store so any component can read/toggle the color scheme
// without prop drilling, and every consumer (desktop sidebar, mobile sheet)
// stays in sync. Dark mode is activated by toggling `.dark` on <html>, which
// is how HeroUI v3 scopes its dark tokens.
const themeStore = (() => {
  const listeners = new Set<() => void>();

  function readStored(): ColorScheme | null {
    if (typeof window === "undefined") return null;
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  }

  function systemScheme(): ColorScheme {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function apply(scheme: ColorScheme) {
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", scheme === "dark");
    }
  }

  let current: ColorScheme = readStored() ?? systemScheme();
  apply(current);

  if (typeof window !== "undefined") {
    // Follow the OS preference until the user makes an explicit choice.
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (event) => {
      if (readStored()) return;
      current = event.matches ? "dark" : "light";
      apply(current);
      listeners.forEach((listener) => listener());
    });
  }

  return {
    get: () => current,
    set(scheme: ColorScheme) {
      current = scheme;
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, scheme);
      } catch {
        // ignore storage failures (private mode, quota, etc.)
      }
      apply(scheme);
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
})();

export function useColorScheme() {
  const scheme = useSyncExternalStore(themeStore.subscribe, themeStore.get, () => "light" as ColorScheme);
  const toggle = useCallback(() => themeStore.set(scheme === "dark" ? "light" : "dark"), [scheme]);
  return {scheme, isDark: scheme === "dark", toggle};
}
