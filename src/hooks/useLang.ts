import { useState } from "react";
import { LANG_KEY } from "../constants/storage";
import type { Lang } from "../i18n/types";
import { loadLang } from "../utils/theme";

export function useLang() {
  const [lang, setLangState] = useState<Lang>(() => loadLang());

  function setLang(next: Lang) {
    setLangState(next);
    localStorage.setItem(LANG_KEY, next);
  }

  return { lang, setLang };
}
