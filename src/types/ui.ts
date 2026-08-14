import type { ButtonId } from "./profile";
import type { MacroStep } from "./action";

export type PermissionStatus = {
  accessibility: boolean;
  inputMonitoring: boolean;
  postEvent: boolean;
  ready: boolean;
};

export type ActionSlot = "click" | "long_press";

export type EditorMode =
  | {
      kind: "custom_key";
      buttonId: ButtonId;
      slot: ActionSlot;
      draft: string[];
    }
  | {
      kind: "macro";
      buttonId: ButtonId;
      slot: ActionSlot;
      steps: MacroStep[];
      capturing: boolean;
    }
  | {
      kind: "open_app";
      buttonId: ButtonId;
      slot: ActionSlot;
      query: string;
      selected: { name: string; bundleId: string } | null;
      apps: { name: string; bundleId: string; path: string; icon?: string }[];
      loading: boolean;
      error: string | null;
    };

export type TabId = "info" | "custom";
export type Theme = "light" | "dark";
