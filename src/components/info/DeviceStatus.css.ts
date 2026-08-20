import { globalStyle, style } from "@vanilla-extract/css";

import { statusRow } from "@/components/ui/Panel.css";

export const statusDetail = style({
  display: "inline-flex",
  alignItems: "center",
  minWidth: 0,
  height: 18,
  lineHeight: 1,
  margin: 0,
  padding: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: "0.8rem",
});

globalStyle(`${statusRow} strong`, {
  display: "inline-flex",
  alignItems: "center",
  flexShrink: 0,
  height: 18,
  lineHeight: 1,
  margin: 0,
  padding: 0,
  fontSize: "0.92rem",
});

export const dot = style({
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: "var(--muted)",
  flexShrink: 0,
});

export const dotOn = style({
  background: "var(--ok)",
  boxShadow: "0 0 0 4px var(--ok-glow)",
});
