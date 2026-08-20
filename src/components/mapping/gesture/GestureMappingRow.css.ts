import { globalStyle, style } from "@vanilla-extract/css";

import { row as customMappingRow, comboTrigger } from "../custom/CustomMappingRow.css";

export { comboTrigger };

export const row = style([
  customMappingRow,
  {
    gridTemplateColumns:
      "max-content 8px 2.75rem 12px minmax(0, 1fr) 8px auto",
    gap: 0,
    overflow: "visible",
  },
]);

globalStyle(`${row} ${comboTrigger}`, {
  justifySelf: "start",
});

export const actions = style({
  justifySelf: "end",
  display: "inline-flex",
  alignItems: "center",
  gap: 2,
});
