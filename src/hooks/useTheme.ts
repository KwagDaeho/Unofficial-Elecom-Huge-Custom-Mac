import { useEffect, useState } from "react";
import { THEME_KEY } from "../constants/storage";
import type { Theme } from "../types";
import { applyTheme, loadTheme } from "../utils/theme";

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => loadTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function setTheme(next: Theme) {
    setThemeState(next);
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  }

  return { theme, setTheme };
}
