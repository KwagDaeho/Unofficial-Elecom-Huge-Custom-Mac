import { globalStyle, style } from "@vanilla-extract/css";

export const footer = style({
  display: "grid",
  gap: 6,
  color: "var(--muted)",
  fontSize: "0.86rem",
  padding: "14px 4px 10px",
  borderTop: "1px solid var(--line)",
  marginTop: 12,
});

export const credit = style({
  margin: 0,
  color: "var(--ink)",
  fontWeight: 600,
  fontSize: "0.98rem",
  lineHeight: 1.4,
});

export const creditBy = style({
  color: "var(--muted)",
  fontWeight: 500,
});

export const contactBlock = style({
  display: "grid",
  gap: 5,
  marginTop: 4,
});

globalStyle(`${contactBlock} strong`, {
  color: "var(--ink)",
  fontSize: "0.94rem",
});

globalStyle(`${contactBlock} p`, {
  margin: 0,
});

globalStyle(`${footer} a`, {
  color: "var(--accent)",
  fontWeight: 600,
  textDecoration: "none",
});

globalStyle(`${footer} a:hover`, {
  textDecoration: "underline",
});
