import { style } from "@vanilla-extract/css";

export const root = style({});

export const title = style({
  margin: "0 0 2px",
  fontSize: "1rem",
});

export const headWithBadge = style({
  display: "flex",
  alignItems: "center",
  gap: 8,
});

export const badge = style({
  fontStyle: "normal",
  fontSize: "0.7rem",
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--accent)",
});
