import type { EditorMode } from "./ui";

export type CustomKeyEditorState = Extract<EditorMode, { kind: "custom_key" }>;
export type MacroEditorState = Extract<EditorMode, { kind: "macro" }>;
export type OpenAppEditorState = Extract<EditorMode, { kind: "open_app" }>;
export type ActivatorEditorState = Extract<
  EditorMode,
  { kind: "ball_scroll_activator" }
>;
export type ComboEditorState = Extract<
  EditorMode,
  { kind: "custom_combo_activator" }
>;
