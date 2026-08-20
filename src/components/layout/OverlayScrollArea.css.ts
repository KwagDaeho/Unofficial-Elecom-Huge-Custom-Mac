import { globalStyle, style } from "@vanilla-extract/css";

export const root = style({
  position: "relative",
});

export const viewport = style({
  overflow: "auto",
  scrollbarWidth: "none",
});

globalStyle(`${viewport}::-webkit-scrollbar`, {
  width: 0,
  height: 0,
  display: "none",
});
