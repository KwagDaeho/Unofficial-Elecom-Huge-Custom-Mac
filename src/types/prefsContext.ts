import type { Dict, Lang, Theme } from "./index";

export type PrefsContextValue = {
  lang: Lang;
  setLang: (next: Lang) => void;
  theme: Theme;
  setTheme: (next: Theme) => void;
  i18n: Dict;
};
