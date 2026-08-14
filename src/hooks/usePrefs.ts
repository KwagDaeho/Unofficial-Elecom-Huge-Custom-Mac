import { useEffect, useState } from "react";
import { LANG_KEY, THEME_KEY } from "../constants/storage";
import { t } from "../i18n";
import type { Lang, Theme } from "../types";
import { applyTheme, loadLang, loadTheme } from "../utils/theme";

export function usePrefsState() {
  const [lang, setLangState] = useState<Lang>(() => loadLang());
  const [theme, setThemeState] = useState<Theme>(() => loadTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function setLang(next: Lang) {
    setLangState(next);
    localStorage.setItem(LANG_KEY, next);
  }

  function setTheme(next: Theme) {
    setThemeState(next);
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  }

  return {
    lang,
    setLang,
    theme,
    setTheme,
    i18n: t(lang),
  };
}
