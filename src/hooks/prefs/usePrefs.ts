import { createContext, useContext, useEffect, useState } from "react";
import { LANG_KEY, THEME_KEY } from "@/constants/storage";
import { t } from "@/i18n";
import { applyTheme, loadLang, loadTheme } from "@/utils/theme";
import type { Lang, PrefsContextValue, Theme } from "@/types";

export const PrefsContext = createContext<PrefsContextValue | null>(null);

export function usePrefs(): PrefsContextValue {
  const context = useContext(PrefsContext);
  if (context === null) {
    throw new Error("usePrefs must be used within PrefsProvider");
  }
  return context;
}

export function usePrefsState(): PrefsContextValue {
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
