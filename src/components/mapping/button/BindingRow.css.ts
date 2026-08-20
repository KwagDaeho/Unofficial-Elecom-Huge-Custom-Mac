import { globalStyle, style } from "@vanilla-extract/css";

export const btnName = style({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  minWidth: 0,
  fontWeight: 600,
  fontSize: "0.82rem",
  lineHeight: 1.15,
  whiteSpace: "normal",
});

globalStyle(`${btnName} em`, {
  fontStyle: "normal",
  fontSize: "0.7rem",
  fontWeight: 500,
  color: "var(--accent)",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
});
