import type { ButtonId } from "./profile";
import type { MacroStep } from "./action";

export type PermissionStatus = {
  accessibility: boolean;
  inputMonitoring: boolean;
  postEvent: boolean;
  ready: boolean;
};

export type ActionSlot = "click" | "long_press";

export type MappingTarget =
  | { kind: "button"; id: ButtonId }
  | { kind: "custom"; id: string };

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
      capturing: boolean;
    }
  | {
      kind: "open_app";
      target: MappingTarget;
      slot: ActionSlot;
      query: string;
      selected: { name: string; bundleId: string } | null;
      apps: { name: string; bundleId: string; path: string; icon?: string }[];
      loading: boolean;
      error: string | null;
    }
  | {
      kind: "ball_scroll_activator";
      slot: "toggle" | "hold";
      rejected: string | null;
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
