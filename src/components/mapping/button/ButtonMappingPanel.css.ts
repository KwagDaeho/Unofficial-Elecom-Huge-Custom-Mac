import { globalStyle, style } from "@vanilla-extract/css";

export const buttonGrid = style({
  marginTop: 8,
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 6,
});

export const buttonHead = style({
  display: "grid",
  gridTemplateColumns:
    "minmax(7.5rem, 10.5rem) 5.5rem 7rem minmax(0, 1fr) minmax(0, 1fr)",
  gap: 10,
  padding: "0 8px 2px 10px",
  color: "var(--muted)",
  fontSize: "0.68rem",
  fontWeight: 700,
  letterSpacing: "0.03em",
  alignItems: "end",
});

globalStyle(`${buttonHead} > span`, {
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
});

globalStyle(`${buttonHead} > span:nth-child(2), ${buttonHead} > span:nth-child(3)`, {
  textAlign: "left",
  paddingLeft: 1,
});
