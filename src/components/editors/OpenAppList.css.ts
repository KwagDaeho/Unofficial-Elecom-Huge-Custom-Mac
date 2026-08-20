import { globalStyle, style } from "@vanilla-extract/css";

export const meta = style({
  minWidth: 0,
  display: "grid",
  gap: 2,
});

export const metaTitle = style({
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

export const metaSubtitle = style({
  color: "var(--muted)",
  fontWeight: 400,
  fontSize: "0.72rem",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

export const row = style({
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: 10,
  textAlign: "left",
  border: 0,
  borderRadius: 0,
  padding: "7px 10px",
  background: "transparent",
  color: "var(--ink)",
  fontWeight: 600,
  fontSize: "0.86rem",
  cursor: "pointer",
  selectors: {
    "&:hover": {
      background: "color-mix(in srgb, var(--accent) 18%, transparent)",
    },
  },
});

export const rowSelected = style([
  row,
  {
    background: "var(--accent)",
    color: "var(--accent-ink)",
    selectors: {
      "&:hover": {
        background: "var(--accent)",
      },
    },
  },
]);

globalStyle(`${rowSelected} ${metaSubtitle}`, {
  color: "color-mix(in srgb, var(--accent-ink) 75%, transparent)",
});

export const icon = style({
  width: 28,
  height: 28,
  flexShrink: 0,
  borderRadius: 6,
  objectFit: "contain",
  background: "color-mix(in srgb, var(--panel-solid) 80%, transparent)",
});

export const iconFallback = style([
  icon,
  {
    display: "inline-block",
    background: "color-mix(in srgb, var(--muted) 28%, transparent)",
  },
]);
