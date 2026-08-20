import { style } from "@vanilla-extract/css";

import { buttonHead } from "../button/ButtonMappingPanel.css";

export const sectionHeadRow = style({
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 8,
});

export const customMappingHead = style([
  buttonHead,
  {
    gridTemplateColumns:
      "minmax(7.5rem, 10.5rem) 5.5rem 7rem minmax(0, 1fr) minmax(0, 1fr) 3.5rem",
  },
]);
