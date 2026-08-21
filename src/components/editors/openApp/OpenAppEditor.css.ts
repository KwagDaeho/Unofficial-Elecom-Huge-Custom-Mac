import { globalStyle, style } from "@vanilla-extract/css";

export const search = style({
  display: "grid",
  gap: 4,
  margin: 0,
});

globalStyle(`${search} input`, {
  width: "100%",
});
