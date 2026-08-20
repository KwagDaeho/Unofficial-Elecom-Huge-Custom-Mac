import { style } from "@vanilla-extract/css";

export const list = style({
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gap: 4,
  maxHeight: 280,
  overflow: "auto",
  border: "1px solid var(--line)",
  borderRadius: 8,
  background: "var(--accent-soft)",
});
