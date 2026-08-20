import { style } from "@vanilla-extract/css";

export const row = style({
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  columnGap: 10,
  rowGap: 6,
  fontSize: "0.86rem",
  fontWeight: 600,
});

export const key = style({
  display: "flex",
  alignItems: "center",
  gap: 10,
  minWidth: 0,
});

export const help = style({
  flexBasis: "100%",
  width: "100%",
  fontSize: "0.78rem",
});
