import { globalStyle, style } from "@vanilla-extract/css";

export const row = style({
  display: "grid",
  gridTemplateColumns:
    "minmax(7.5rem, 10.5rem) 5.5rem 7rem minmax(0, 1fr) minmax(0, 1fr) 3.5rem",
  alignItems: "center",
  gap: 10,
  minHeight: 32,
  padding: "3px 8px 3px 10px",
  border: "1px solid var(--line)",
  borderRadius: 8,
  background: "var(--accent-soft)",
});

export const comboTrigger = style({
  justifySelf: "start",
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
});

export const remove = style({
  justifySelf: "end",
});

globalStyle(`${row} select`, {
  minWidth: 0,
  width: "100%",
});

globalStyle(`${row} select:disabled`, {
  opacity: 0.45,
  cursor: "not-allowed",
});
