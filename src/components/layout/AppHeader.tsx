import { MoonIcon, SunIcon } from "@/components/icons";
import { usePrefs } from "@/hooks";
import { cx } from "@/utils/cx";

import * as styles from "./AppHeader.css";

export const AppHeader = () => {
  const { lang, theme, i18n, setLang, setTheme } = usePrefs();
  return (
    <header className={styles.hero}>
      <div className={styles.heroTop}>
        <p className={styles.eyebrow}>ELECOM</p>
        <div className={styles.toolbar}>
          <div className={styles.themeToggle} role="group" aria-label="Theme">
            <button
              type="button"
              className={cx(
                styles.themeButton,
                theme === "light" && styles.themeButtonActive,
              )}
              aria-label={i18n.themeLight}
              title={i18n.themeLight}
              onClick={() => setTheme("light")}
            >
              <SunIcon />
            </button>
            <button
              type="button"
              className={cx(
                styles.themeButton,
                theme === "dark" && styles.themeButtonActive,
              )}
              aria-label={i18n.themeDark}
              title={i18n.themeDark}
              onClick={() => setTheme("dark")}
            >
              <MoonIcon />
            </button>
          </div>
          <div className={styles.langSwitch} role="group" aria-label="Language">
            <button
              type="button"
              className={cx(
                styles.langButton,
                lang === "ko" && styles.langButtonActive,
              )}
              onClick={() => setLang("ko")}
            >
              KR
            </button>
            <button
              type="button"
              className={cx(
                styles.langButton,
                lang === "en" && styles.langButtonActive,
              )}
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
