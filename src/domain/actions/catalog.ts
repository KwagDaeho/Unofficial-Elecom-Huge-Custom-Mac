import type { CatalogEntry } from "../../types/index";

export const ACTION_CATALOG: CatalogEntry[] = [
  { id: "default", category: "basic", action: { type: "default" } },
  { id: "disabled", category: "basic", action: { type: "disabled" } },

  {
    id: "mouse_left",
    category: "mouse",
    action: { type: "mouse_click", button: "left" },
  },
  {
    id: "mouse_right",
    category: "mouse",
    action: { type: "mouse_click", button: "right" },
  },
  {
    id: "mouse_middle",
    category: "mouse",
    action: { type: "mouse_click", button: "middle" },
  },
  {
    id: "mouse_back",
    category: "mouse",
    action: { type: "mouse_click", button: "back" },
  },
  {
    id: "mouse_forward",
    category: "mouse",
    action: { type: "mouse_click", button: "forward" },
  },
  { id: "double_click", category: "mouse", action: { type: "double_click" } },
  {
    id: "scroll_left",
    category: "mouse",
    action: { type: "scroll", dx: -3, dy: 0 },
  },
  {
    id: "scroll_right",
    category: "mouse",
    action: { type: "scroll", dx: 3, dy: 0 },
  },

  {
    id: "safari_back",
    category: "browser",
    action: { type: "key_stroke", keys: ["Meta", "["] },
  },
  {
    id: "safari_forward",
    category: "browser",
    action: { type: "key_stroke", keys: ["Meta", "]"] },
  },
  {
    id: "safari_zoom_in",
    category: "browser",
    action: { type: "key_stroke", keys: ["Meta", "="] },
  },
  {
    id: "safari_zoom_out",
    category: "browser",
    action: { type: "key_stroke", keys: ["Meta", "-"] },
  },

  {
    id: "copy",
    category: "edit",
    action: { type: "system", command: "copy" },
  },
  {
    id: "cut",
    category: "edit",
    action: { type: "system", command: "cut" },
  },
  {
    id: "paste",
    category: "edit",
    action: { type: "system", command: "paste" },
  },
  {
    id: "undo",
    category: "edit",
    action: { type: "system", command: "undo" },
  },
  {
    id: "redo",
    category: "edit",
    action: { type: "system", command: "redo" },
  },
  {
    id: "save",
    category: "edit",
    action: { type: "system", command: "save" },
  },
  {
    id: "return",
    category: "keys",
    action: { type: "key_stroke", keys: ["Return"] },
  },
  {
    id: "esc",
    category: "keys",
    action: { type: "key_stroke", keys: ["Escape"] },
  },
  {
    id: "tab",
    category: "keys",
    action: { type: "key_stroke", keys: ["Tab"] },
  },
  {
    id: "delete",
    category: "keys",
    action: { type: "key_stroke", keys: ["Delete"] },
  },

  {
    id: "mission_control",
    category: "system",
    action: { type: "system", command: "mission_control" },
  },
  {
    id: "move_space_left",
    category: "system",
    action: { type: "system", command: "move_space_left" },
  },
  {
    id: "move_space_right",
    category: "system",
    action: { type: "system", command: "move_space_right" },
  },
  {
    id: "app_expose",
    category: "system",
    action: { type: "system", command: "app_expose" },
  },
  {
    id: "show_desktop",
    category: "system",
    action: { type: "system", command: "show_desktop" },
  },
  {
    id: "launchpad",
    category: "system",
    action: { type: "system", command: "launchpad" },
  },
  {
    id: "spotlight",
    category: "system",
    action: { type: "system", command: "spotlight" },
  },
  {
    id: "app_switcher",
    category: "system",
    action: { type: "system", command: "app_switcher" },
  },
  {
    id: "close_window",
    category: "system",
    action: { type: "system", command: "close_window" },
  },

  {
    id: "volume_up",
    category: "media",
    action: { type: "system", command: "volume_up" },
  },
  {
    id: "volume_down",
    category: "media",
    action: { type: "system", command: "volume_down" },
  },
  {
    id: "mute",
    category: "media",
    action: { type: "system", command: "mute" },
  },
  {
    id: "previous_track",
    category: "media",
    action: { type: "system", command: "previous_track" },
  },
  {
    id: "next_track",
    category: "media",
    action: { type: "system", command: "next_track" },
  },
  {
    id: "play_pause",
    category: "media",
    action: { type: "system", command: "play_pause" },
  },

  {
    id: "open_safari",
    category: "launch",
    action: { type: "open_app", bundle_id: "com.apple.Safari" },
  },
  {
    id: "open_finder",
    category: "launch",
    action: { type: "open_app", bundle_id: "com.apple.finder" },
  },
  {
    id: "open_settings",
    category: "launch",
    action: {
      type: "open_app",
      bundle_id: "com.apple.systempreferences",
    },
  },
  {
    id: "open_app_pick",
    category: "launch",
    action: { type: "open_app", bundle_id: "" },
    special: "open_app",
  },

  {
    id: "custom_key",
    category: "custom",
    action: { type: "key_stroke", keys: [] },
    special: "custom_key",
  },
  {
    id: "macro",
    category: "custom",
    action: { type: "macro", steps: [] },
    special: "macro",
  },
];
