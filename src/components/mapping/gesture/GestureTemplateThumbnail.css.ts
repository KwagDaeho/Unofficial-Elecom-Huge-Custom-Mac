import { style } from "@vanilla-extract/css";

export const thumb = style({
  position: "relative",
  justifySelf: "start",
  width: "2.75rem",
  height: "2.75rem",
  border: "1px solid var(--line)",
  borderRadius: 6,
  background: "#ffffff",
  cursor: "zoom-in",
});

export const thumbOpen = style({
  zIndex: 51,
});

export const thumbEmpty = style([
  thumb,
  {
    display: "grid",
    placeItems: "center",
    cursor: "default",
    background: "color-mix(in srgb, var(--accent-soft) 70%, #ffffff)",
  },
]);

export const thumbEmptyMark = style({
  color: "var(--muted)",
  fontSize: "0.9rem",
  lineHeight: 1,
});

export const thumbCanvas = style({
  display: "block",
  width: "100%",
  height: "100%",
  borderRadius: "inherit",
});

export const thumbPopover = style({
  position: "absolute",
  zIndex: 52,
  left: "calc(100% + 6px)",
  top: "50%",
  transform: "translateY(-50%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 172,
  height: 172,
  aspectRatio: "1 / 1",
  padding: 6,
  border: "1px solid var(--line)",
  borderRadius: 8,
  background: "var(--panel, #1a171c)",
  boxShadow: "0 8px 24px rgb(0 0 0 / 0.28)",
  pointerEvents: "none",
  boxSizing: "border-box",
  overflow: "hidden",
});

export const thumbPopoverCanvas = style({
  display: "block",
  flex: "0 0 auto",
  width: 160,
  height: 160,
  aspectRatio: "1 / 1",
  borderRadius: 6,
  border: "1px solid var(--line)",
  background: "#ffffff",
  boxSizing: "border-box",
});
