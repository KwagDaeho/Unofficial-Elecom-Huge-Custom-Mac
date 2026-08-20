import { globalStyle, style } from "@vanilla-extract/css";

export const hero = style({
  padding: "4px 2px 0",
  marginBottom: "0.35rem",
});

globalStyle(`${hero} h1`, {
  margin: "2px 0 1.85rem",
  fontFamily: '"Futura", "Avenir Next", "Gill Sans", sans-serif',
  fontWeight: 700,
  fontSize: "clamp(2.4rem, 6vw, 3.6rem)",
  lineHeight: 0.92,
  letterSpacing: "-0.04em",
});

export const heroTop = style({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
});

export const toolbar = style({
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
});

export const themeToggle = style({
  display: "inline-flex",
  border: "1px solid var(--line)",
  borderRadius: 999,
  overflow: "hidden",
  background: "var(--panel)",
});

export const langSwitch = style({
  display: "inline-flex",
  border: "1px solid var(--line)",
  borderRadius: 999,
  overflow: "hidden",
  background: "var(--panel)",
});

const toggleButtonBase = {
  border: 0,
  borderRadius: 0,
  background: "transparent",
  color: "var(--muted)",
  padding: "0.22rem 0.55rem",
  fontSize: "0.72rem",
  fontWeight: 700,
  letterSpacing: "0.04em",
  display: "inline-grid",
  placeItems: "center",
  minWidth: "1.9rem",
  minHeight: "1.55rem",
} as const;

export const langButton = style(toggleButtonBase);

export const langButtonActive = style({
  background: "var(--accent)",
  color: "var(--accent-ink)",
});

export const themeButton = style(toggleButtonBase);

globalStyle(`${themeButton} svg`, {
  width: 14,
  height: 14,
  display: "block",
});

export const themeButtonActive = style({
  background: "var(--accent)",
  color: "var(--accent-ink)",
});

export const eyebrow = style({
  margin: 0,
  letterSpacing: "0.28em",
  fontSize: "0.72rem",
  fontWeight: 600,
  color: "var(--muted)",
});
