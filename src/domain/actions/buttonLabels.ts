import type { Lang } from "../../i18n/types";

export const BUTTON_LABELS: Record<Lang, Record<string, string>> = {
  ko: {
    left: "L",
    right: "R",
    middle: "휠 버튼",
    back: "◀(뒤로 가기)",
    forward: "▶(앞으로 가기)",
    fn1: "Fn1",
    fn2: "Fn2",
    fn3: "Fn3",
    wheel_tilt_left: "스크롤 기울이기(왼쪽)",
    wheel_tilt_right: "스크롤 기울이기(오른쪽)",
  },
  en: {
    left: "L",
    right: "R",
    middle: "Wheel button",
    back: "◀ (Back)",
    forward: "▶ (Forward)",
    fn1: "Fn1",
    fn2: "Fn2",
    fn3: "Fn3",
    wheel_tilt_left: "Scroll tilt (left)",
    wheel_tilt_right: "Scroll tilt (right)",
  },
};

export function buttonLabel(id: string, lang: Lang): string {
  return BUTTON_LABELS[lang][id] ?? id;
}
