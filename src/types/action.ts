export type MouseClickButton = "left" | "right" | "middle" | "back" | "forward";

export type SystemCommand =
  | "mission_control"
  | "app_expose"
  | "show_desktop"
  | "launchpad"
  | "spotlight"
  | "app_switcher"
  | "close_window"
  | "save"
  | "cut"
  | "copy"
  | "paste"
  | "undo"
  | "redo"
  | "volume_up"
  | "volume_down"
  | "mute"
  | "previous_track"
  | "next_track"
  | "play_pause"
  | "move_space_left"
  | "move_space_right";

export type MacroStep =
  | { type: "key_stroke"; keys: string[] }
  | { type: "delay"; ms: number }
  | { type: "mouse_click"; button: MouseClickButton };

export type Action =
  | { type: "default" }
  | { type: "disabled" }
  | { type: "mouse_click"; button: MouseClickButton }
  | { type: "double_click" }
  | { type: "key_stroke"; keys: string[] }
  | { type: "system"; command: SystemCommand }
  | { type: "open_app"; bundle_id: string; name?: string }
  | { type: "scroll"; dx: number; dy: number }
  | { type: "macro"; steps: MacroStep[] };

export type ActionCategoryId =
  | "basic"
  | "mouse"
  | "browser"
  | "edit"
  | "keys"
  | "system"
  | "media"
  | "launch"
  | "custom";

export type CatalogEntry = {
  id: string;
  category: ActionCategoryId;
  action: Action;
  /** Special UI tokens — not real actions until confirmed in a modal. */
  special?: "custom_key" | "macro" | "open_app";
};
