import { globalStyle, style } from "@vanilla-extract/css";

export const root = style({
  position: "fixed",
  top: 0,
  right: 0,
  bottom: 0,
  width: 14,
  zIndex: 60,
  pointerEvents: "none",
  opacity: 0,
  transition: "opacity var(--overlay-scrollbar-fade-out, 640ms) ease",
});

export const embedded = style([
  root,
  {
    position: "absolute",
    zIndex: 2,
  },
]);

export const visible = style({
  opacity: 1,
  pointerEvents: "auto",
  transition: "none",
});

export const thumb = style({
  position: "absolute",
  top: 0,
  right: 3,
  width: 8,
  borderRadius: 999,
  background: "color-mix(in srgb, var(--accent) 70%, var(--muted))",
  boxShadow: "0 0 0 1px color-mix(in srgb, var(--ink) 12%, transparent)",
  cursor: "default",
  pointerEvents: "auto",
});

globalStyle(`${thumb}:hover, ${thumb}:active`, {
  background: "var(--accent)",
});
