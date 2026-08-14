import { MoonIcon, SunIcon } from "../icons/ThemeIcons";
import type { Dict, Lang } from "../../i18n";
import type { Theme } from "../../types";

export function AppHeader({
  lang,
  theme,
  i18n,
  onLang,
  onTheme,
}: {
  lang: Lang;
  theme: Theme;
  i18n: Dict;
  onLang: (next: Lang) => void;
  onTheme: (next: Theme) => void;
}) {
  return (
    <header className="hero">
      <div className="hero-top">
        <p className="eyebrow">ELECOM</p>
        <div className="toolbar">
          <div className="theme-toggle" role="group" aria-label="Theme">
            <button
              type="button"
              className={theme === "light" ? "theme on" : "theme"}
              aria-label={i18n.themeLight}
              title={i18n.themeLight}
              onClick={() => onTheme("light")}>
              <SunIcon />
            </button>
            <button
              type="button"
              className={theme === "dark" ? "theme on" : "theme"}
              aria-label={i18n.themeDark}
              title={i18n.themeDark}
              onClick={() => onTheme("dark")}>
              <MoonIcon />
            </button>
          </div>
          <div className="lang-switch" role="group" aria-label="Language">
            <button type="button" className={lang === "ko" ? "lang on" : "lang"} onClick={() => onLang("ko")}>
              KR
            </button>
            <button type="button" className={lang === "en" ? "lang on" : "lang"} onClick={() => onLang("en")}>
              EN
            </button>
          </div>
        </div>
      </div>
      <h1>HUGE</h1>
    </header>
  );
}
