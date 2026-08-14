import { ko } from "./ko";
import { en } from "./en";
import type { Lang } from "./types";

export type { Lang } from "./types";

const STRINGS = {
  ko,
  en,
} as const;

export type Dict = (typeof STRINGS)[Lang];

export function t(lang: Lang): Dict {
  return STRINGS[lang];
}
