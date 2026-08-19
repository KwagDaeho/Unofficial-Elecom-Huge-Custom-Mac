export type Lang = "ko" | "en";

type WidenStrings<T> = {
  [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends Record<string, unknown>
      ? WidenStrings<T[K]>
      : T[K];
};

/** Shape of ko/en string tables (keys must match across langs). */
export type Dict = WidenStrings<typeof import("../../i18n/ko").ko>;
