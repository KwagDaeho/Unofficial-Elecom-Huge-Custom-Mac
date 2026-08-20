import { globalStyle, style } from "@vanilla-extract/css";

export const stepsArea = style({
  maxHeight: 360,
});

export const listDragging = style({});

export const stepDragging = style({
  position: "relative",
  zIndex: 2,
  borderColor: "var(--accent)",
  boxShadow:
    "0 8px 22px color-mix(in srgb, var(--ink) 16%, transparent), 0 0 0 1px color-mix(in srgb, var(--accent) 40%, transparent)",
  transition: "none",
  willChange: "transform",
});

export const stepItem = style({
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "5px 8px",
  borderRadius: 7,
  border: "1px solid var(--line)",
  background: "var(--accent-soft)",
  fontWeight: 600,
  fontSize: "0.86rem",
});

export const list = style({
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "grid",
  gap: 5,
});

globalStyle(`${listDragging} li:not(.${stepDragging})`, {
  transition: "transform 260ms cubic-bezier(0.22, 1, 0.36, 1)",
});

export const dragZone = style({
  flex: "0 0 auto",
  display: "flex",
  alignItems: "center",
  gap: 4,
  margin: "-4px 0 -4px -6px",
  padding: "4px 8px 4px 6px",
  border: "none",
  borderRadius: 6,
  background: "transparent",
  font: "inherit",
  color: "inherit",
  cursor: "grab",
  touchAction: "none",
  userSelect: "none",
  selectors: {
    "&:active": {
      cursor: "grabbing",
    },
  },
});

export const handle = style({
  flex: "0 0 auto",
  color: "var(--muted)",
  fontSize: "0.72rem",
  lineHeight: 1,
  letterSpacing: "-0.08em",
  pointerEvents: "none",
});

export const order = style({
  flex: "0 0 auto",
  minWidth: "1.2rem",
  textAlign: "center",
  fontSize: "0.78rem",
  fontWeight: 700,
  color: "var(--muted)",
  pointerEvents: "none",
});

export const actions = style({
  flex: "0 0 auto",
  display: "flex",
  alignItems: "center",
  gap: 2,
});

export const label = style({
  flex: "1 1 auto",
  minWidth: 0,
});
