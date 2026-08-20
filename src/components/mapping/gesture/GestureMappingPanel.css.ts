import { globalStyle, style } from "@vanilla-extract/css";

import { root as panelRoot } from "@/components/ui/Panel.css";

import { buttonGrid, buttonHead } from "../button/ButtonMappingPanel.css";
import { row as gestureMappingRow } from "./GestureMappingRow.css";
import { thumbOpen } from "./GestureTemplateThumbnail.css";

export const sectionHeadRow = style({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
});

export const gestureMappingGrid = style([
  buttonGrid,
  {
    overflow: "visible",
  },
]);

export const gestureMappingHead = style([
  buttonHead,
  {
    gridTemplateColumns:
      "max-content 8px 2.75rem 12px minmax(0, 1fr) 8px auto",
    gap: 0,
    padding: "0 8px 2px 10px",
    overflow: "visible",
  },
]);

export const colGap = style({
  display: "block",
  width: "100%",
  height: 1,
  padding: 0,
  margin: 0,
  pointerEvents: "none",
  visibility: "hidden",
});

globalStyle(`${gestureMappingHead} > span:nth-child(3)`, {
  justifySelf: "start",
});

globalStyle(`${gestureMappingGrid} ${gestureMappingHead}`, {
  overflow: "visible",
});

globalStyle(`${gestureMappingGrid} ${gestureMappingRow}`, {
  overflow: "visible",
});

globalStyle(`${panelRoot}:has(.${thumbOpen})`, {
  position: "relative",
  zIndex: 50,
});
