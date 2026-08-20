import { style } from "@vanilla-extract/css";

export const root = style({
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
});

export const wrap = style({
  flexWrap: "wrap",
});
