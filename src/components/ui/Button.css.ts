import { style } from "@vanilla-extract/css";

export const ghost = style({
  background: "transparent",
  color: "var(--ink)",
  border: "1px solid var(--line)",
});

export const tiny = style({
  padding: "0.18rem 0.45rem",
  fontSize: "0.74rem",
});
