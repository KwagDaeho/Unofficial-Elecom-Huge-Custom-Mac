import { globalStyle, style } from "@vanilla-extract/css";

export const backdrop = style({
  position: "fixed",
  inset: 0,
  zIndex: 100,
  display: "grid",
  placeItems: "center",
  padding: 20,
  background: "rgba(20, 12, 24, 0.5)",
  backdropFilter: "blur(4px)",
});

export const backdropPlain = style([
  backdrop,
  {
    backdropFilter: "none",
    background: "rgba(20, 12, 24, 0.62)",
  },
]);

export const nestedBackdrop = style({
  position: "fixed",
  inset: 0,
  zIndex: 110,
  display: "grid",
  placeItems: "center",
  padding: 20,
  background: "rgba(20, 12, 24, 0.45)",
  backdropFilter: "blur(3px)",
});

export const dialog = style({
  width: "min(100%, 400px)",
  padding: "14px 16px 12px",
  borderRadius: 10,
  border: "1px solid var(--line)",
  background: "var(--panel-solid)",
  boxShadow: "0 14px 36px var(--shadow)",
  display: "grid",
  gap: 10,
});

export const dialogHeading = style({
  margin: 0,
  fontSize: "1rem",
});

globalStyle(`${dialog} h2`, {
  margin: 0,
  fontSize: "1rem",
});

export const dialogWide = style({
  width: "min(100%, 480px)",
});

export const dialogCompact = style({
  width: "min(100%, 320px)",
});
