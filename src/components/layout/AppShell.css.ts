import { style } from "@vanilla-extract/css";

export const shell = style({
  width: "min(780px, calc(100% - 32px))",
  margin: "0 auto",
  padding: "16px 0 28px",
  display: "grid",
  gap: 8,
  "@media": {
    "(max-width: 720px)": {
      width: "min(100% - 24px, 920px)",
      paddingTop: 24,
    },
  },
});

export const tabs = style({
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 3,
  padding: 3,
  border: "1px solid var(--line)",
  borderRadius: 8,
  background: "var(--panel)",
});

export const tab = style({
  border: 0,
  borderRadius: 6,
  padding: "0.38rem 0.7rem",
  background: "transparent",
  color: "var(--muted)",
  fontWeight: 700,
  fontSize: "0.88rem",
  cursor: "pointer",
});

export const tabActive = style({
  background: "var(--accent)",
  color: "var(--accent-ink)",
});
