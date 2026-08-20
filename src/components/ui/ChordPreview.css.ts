import { style } from "@vanilla-extract/css";

export const root = style({
  minHeight: "2.2rem",
  display: "grid",
  placeItems: "center",
  borderRadius: 8,
  border: "1px dashed var(--line)",
  background: "var(--accent-soft)",
  fontSize: "1.1rem",
  fontWeight: 600,
  letterSpacing: "0.03em",
  color: "var(--ink)",
});

export const error = style({
  margin: "0.35rem 0 0",
  fontSize: "0.85rem",
  color: "var(--danger, #c0392b)",
});
