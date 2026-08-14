import type { Theme } from "../types/index";
import type { Lang } from "../i18n/types";
import { LANG_KEY, THEME_KEY } from "../constants/storage";

export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

export function loadTheme(): Theme {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function loadLang(): Lang {
  const saved = localStorage.getItem(LANG_KEY);
  return saved === "en" ? "en" : "ko";
}
