import { MoonIcon, SunIcon } from "@/components/icons";
import { usePrefs } from "@/hooks";
export const AppHeader = () => {
  const { lang, theme, i18n, setLang, setTheme } = usePrefs();
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
              onClick={() => setTheme("light")}
            >
              <SunIcon />
            </button>
            <button
              type="button"
              className={theme === "dark" ? "theme on" : "theme"}
              aria-label={i18n.themeDark}
              title={i18n.themeDark}
              onClick={() => setTheme("dark")}
            >
              <MoonIcon />
            </button>
          </div>
          <div className="lang-switch" role="group" aria-label="Language">
            <button
              type="button"
              className={lang === "ko" ? "lang on" : "lang"}
              onClick={() => setLang("ko")}
            >
              KR
            </button>
            <button
              type="button"
              className={lang === "en" ? "lang on" : "lang"}
              onClick={() => setLang("en")}
            >
              EN
            </button>
          </div>
        </div>
      </div>
      <h1>HUGE</h1>
    </header>
  );
};
