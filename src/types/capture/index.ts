import type { Activator, BallScrollSlot, ComboActivator } from "../profile";

export type CaptureMode =
  | "off"
  | "custom_key"
  | "combo_capture"
  | "combo_confirm"
  | "macro"
  | "ball_scroll"
  | "gesture_record";

export type CaptureSession = {
  keyCapture: boolean;
  comboTrigger: boolean;
  activatorCapture: boolean;
  uiModal: boolean;
  gestureRecord: boolean;
};

export type KeyCapturePayload = { keys: string[]; escape: boolean };

export type ActivatorCapturePayload = {
  escape: boolean;
  rejected: string | null;
  activator: Activator | null;
};

export type ComboTriggerCapturePayload = {
  escape: boolean;
  rejected: string | null;
  combo: ComboActivator | null;
};

export type ActivatorCaptureResult =
  | { kind: "close" }
  | { kind: "reject"; rejected: string }
  | { kind: "assign"; slot: BallScrollSlot; activator: Activator }
  | { kind: "assign_gesture"; entryId: string; activator: Activator };
