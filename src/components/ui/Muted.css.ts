import { style } from "@vanilla-extract/css";

export const root = style({
  color: "var(--muted)",
  margin: 0,
});

export const inModal = style({
  fontSize: "0.8rem",
});

export const tiny = style({
  fontSize: "0.82rem",
  marginTop: "10px",
});

export const help = style({
  margin: "4px 0 0",
  fontSize: "0.78rem",
});

export const inList = style({
  padding: 12,
  margin: 0,
});
