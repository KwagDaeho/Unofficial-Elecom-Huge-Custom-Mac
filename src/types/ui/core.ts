import type { MacroStep } from "../action";
import type { InstalledAppWithIcon } from "../device";
import type { ButtonId } from "../profile";

export type PermissionStatus = {
  accessibility: boolean;
  inputMonitoring: boolean;
  postEvent: boolean;
  ready: boolean;
};

export type ActionSlot = "click" | "long_press";

export type MappingTarget =
  | { kind: "button"; id: ButtonId }
  | { kind: "custom"; id: string }
  | { kind: "gesture"; id: string };

export type EditorMode =
  | {
      kind: "custom_key";
      target: MappingTarget;
      slot: ActionSlot;
      draft: string[];
    }
  | {
      kind: "macro";
      target: MappingTarget;
      slot: ActionSlot;
      steps: MacroStep[];
      keyPrompt: { mode: "add" } | { mode: "edit"; index: number } | null;
    }
  | {
      kind: "open_app";
      target: MappingTarget;
      slot: ActionSlot;
      query: string;
      selected: { name: string; bundleId: string } | null;
      apps: InstalledAppWithIcon[];
      loading: boolean;
      error: string | null;
    }
  | {
      kind: "ball_scroll_activator";
      slot: "toggle" | "hold";
      rejected: string | null;
    }
  | {
      kind: "gesture_hold_activator";
      entryId: string;
      rejected: string | null;
    }
  | {
      kind: "gesture_path_recorder";
      entryId: string;
    }
  | {
      kind: "custom_combo_activator";
      entryId: string;
      phase: "capture" | "confirm";
      draftChord: string[];
      draftButton: ButtonId | null;
      rejected: string | null;
    };

export type TabId = "info" | "custom";
export type Theme = "light" | "dark";
