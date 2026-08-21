import { style } from "@vanilla-extract/css";

export const pathModal = style({
  pointerEvents: "auto",
});

export const pathDone = style({
  transform: "translateZ(0)",
});

export const canvas = style({
  width: "100%",
  maxWidth: 320,
  height: "auto",
  aspectRatio: "320 / 220",
  borderRadius: 8,
  outline: "2px solid #c07bc4",
  outlineOffset: 0,
  background: "#ffffff",
  touchAction: "none",
  cursor: "crosshair",
  display: "block",
});

export const canvasLocked = style({
  cursor: "default",
  pointerEvents: "none",
});

export const recordStatus = style({
  margin: 0,
  fontSize: "0.8rem",
});

export const redrawRow = style({
  minHeight: "2rem",
  opacity: 0,
  pointerEvents: "none",
  transition: "opacity 0.15s ease",
});

export const redrawRowVisible = style({
  opacity: 1,
  pointerEvents: "auto",
});
