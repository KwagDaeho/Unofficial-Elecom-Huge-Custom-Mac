import { globalStyle } from "@vanilla-extract/css";

globalStyle(":root, [data-theme='light']", {
  vars: {
    "--bg0": "#f3eef6",
    "--bg1": "#faf7fc",
    "--ink": "#1f1a22",
    "--muted": "#6b6270",
    "--line": "#ddd0e2",
    "--panel": "rgba(255, 255, 255, 0.78)",
    "--panel-solid": "#ffffff",
    "--accent": "#c07bc4",
    "--accent-ink": "#ffffff",
    "--accent-soft": "rgba(192, 123, 196, 0.16)",
    "--ok": "#2f8a55",
    "--ok-glow": "rgba(47, 138, 85, 0.18)",
    "--warn-bg": "#f8e8ff",
    "--warn-ink": "#5a3a62",
    "--probe-bg": "#1c1720",
    "--probe-fg": "#e8d6ef",
    "--shadow": "rgba(40, 20, 50, 0.12)",
    "--radius": "10px",
  },
  colorScheme: "light",
});

globalStyle("[data-theme='dark']", {
  vars: {
    "--bg0": "#161218",
    "--bg1": "#1e1822",
    "--ink": "#f3eaf6",
    "--muted": "#a898b0",
    "--line": "#3a3142",
    "--panel": "rgba(36, 30, 42, 0.88)",
    "--panel-solid": "#2a2330",
    "--accent": "#c07bc4",
    "--accent-ink": "#1a121c",
    "--accent-soft": "rgba(192, 123, 196, 0.22)",
    "--ok": "#5dcb87",
    "--ok-glow": "rgba(93, 203, 135, 0.2)",
    "--warn-bg": "#3a2a42",
    "--warn-ink": "#f0d8f5",
    "--probe-bg": "#0e0b11",
    "--probe-fg": "#e0cce8",
    "--shadow": "rgba(0, 0, 0, 0.45)",
  },
  colorScheme: "dark",
});

globalStyle(":root", {
  fontFamily: '"Avenir Next", "Gill Sans", "Futura", sans-serif',
  color: "var(--ink)",
  background: "var(--bg0)",
  fontSynthesis: "none",
  textRendering: "optimizeLegibility",
  WebkitFontSmoothing: "antialiased",
});

globalStyle("*, *::before, *::after", {
  boxSizing: "border-box",
});

globalStyle("html, body, #root", {
  margin: 0,
  height: "100%",
});

globalStyle("html, body", {
  overflow: "hidden",
  width: "100%",
  background: "var(--bg0)",
  userSelect: "none",
  WebkitUserSelect: "none",
});

globalStyle("#root, #root *", {
  userSelect: "none",
  WebkitUserSelect: "none",
});

globalStyle(
  '#root input, #root textarea, #root select, #root [contenteditable="true"]',
  {
    userSelect: "text",
    WebkitUserSelect: "text",
  },
);

globalStyle("#root", {
  width: "100%",
  overflowX: "hidden",
  overflowY: "auto",
  scrollbarWidth: "none",
  color: "var(--ink)",
  background:
    "radial-gradient(820px 420px at 8% -12%, var(--accent-soft) 0%, transparent 55%), radial-gradient(640px 360px at 100% 0%, rgba(192, 123, 196, 0.1) 0%, transparent 50%), linear-gradient(165deg, var(--bg1), var(--bg0))",
});

globalStyle("#root::-webkit-scrollbar", {
  width: 0,
  height: 0,
  display: "none",
});

globalStyle("button, input, select", {
  font: "inherit",
  color: "inherit",
});

globalStyle("button", {
  border: 0,
  borderRadius: 7,
  padding: "0.38rem 0.85rem",
  background: "var(--accent)",
  color: "var(--accent-ink)",
  fontWeight: 600,
  fontSize: "0.86rem",
  cursor: "pointer",
});

globalStyle("button:disabled", {
  opacity: 0.45,
  cursor: "not-allowed",
});

globalStyle("button:active:not(:disabled)", {
  transform: "translateY(1px)",
});

globalStyle("select, input[type='number']", {
  width: "100%",
  borderRadius: 7,
  border: "1px solid var(--line)",
  background: "var(--panel-solid)",
  padding: "0.32rem 0.55rem",
  color: "var(--ink)",
  fontSize: "0.84rem",
  transition: "border-color 0.15s ease, box-shadow 0.15s ease",
});

globalStyle("select", {
  appearance: "none",
  WebkitAppearance: "none",
  paddingRight: "1.8rem",
  backgroundImage:
    "linear-gradient(45deg, transparent 50%, var(--accent) 50%), linear-gradient(135deg, var(--accent) 50%, transparent 50%)",
  backgroundPosition:
    "calc(100% - 12px) calc(50% - 2px), calc(100% - 7px) calc(50% - 2px)",
  backgroundSize: "5px 5px, 5px 5px",
  backgroundRepeat: "no-repeat",
  cursor: "pointer",
});

globalStyle("select:hover:not(:disabled)", {
  borderColor: "var(--accent)",
});

globalStyle("select:disabled", {
  opacity: 0.45,
  cursor: "not-allowed",
  borderColor: "var(--line)",
  boxShadow: "none",
});

globalStyle("select:focus, input[type='number']:focus", {
  outline: "none",
  borderColor: "var(--accent)",
  boxShadow: "0 0 0 3px var(--accent-soft)",
});

globalStyle("input[type='range']", {
  width: "100%",
  accentColor: "var(--accent)",
});
