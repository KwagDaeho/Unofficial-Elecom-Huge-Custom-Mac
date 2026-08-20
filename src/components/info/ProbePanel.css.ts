import { style } from "@vanilla-extract/css";

export const probe = style({
  margin: "4px 0 0",
  padding: "8px 10px",
  borderRadius: 8,
  background: "var(--probe-bg)",
  color: "var(--probe-fg)",
  fontFamily: '"Menlo", "SF Mono", "Andale Mono", monospace',
  fontSize: "0.76rem",
  minHeight: "2.8rem",
  whiteSpace: "pre-wrap",
});
