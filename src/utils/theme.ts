import type { Theme, Lang } from "../types";
import { LANG_KEY, THEME_KEY } from "../constants/storage";
export const applyTheme = (theme: Theme) => {
  document.documentElement.setAttribute("data-theme", theme);
};
export const loadTheme = (): Theme => {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};
export const loadLang = (): Lang => {
  const saved = localStorage.getItem(LANG_KEY);
  return saved === "en" ? "en" : "ko";
};
