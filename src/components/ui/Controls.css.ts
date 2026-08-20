import { globalStyle, style } from "@vanilla-extract/css";

import { root as toggleRoot } from "./Toggle.css";

export const root = style({
  marginTop: 8,
  display: "grid",
  gap: 8,
});

export const tight = style({
  gap: 6,
});

export const tools = style({
  marginTop: 8,
});

globalStyle(`${root} label`, {
  display: "grid",
  gap: 4,
  fontWeight: 500,
  fontSize: "0.86rem",
});

globalStyle(`${root} ${toggleRoot}`, {
  width: "fit-content",
});
