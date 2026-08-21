import { globalStyle, style } from "@vanilla-extract/css";

export const delayField = style({
  display: "grid",
  gap: 4,
  fontSize: "0.84rem",
  fontWeight: 600,
});

globalStyle(`${delayField} input`, {
  width: "100%",
  padding: "6px 8px",
  borderRadius: 7,
  border: "1px solid var(--line)",
  background: "var(--panel)",
});
