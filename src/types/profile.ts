import type { Action, MouseClickButton } from "./action";

export type ButtonId =
  | "left"
  | "right"
  | "middle"
  | "back"
  | "forward"
  | "fn1"
  | "fn2"
  | "fn3"
  | "wheel_tilt_left"
  | "wheel_tilt_right";

export type ButtonBinding = {
  click: Action;
  longPress: Action;
  /** Hold → fire longPress once. Exclusive with autoClick. */
  longPressEnabled?: boolean;
  /** Hold → repeat click. Exclusive with longPressEnabled. */
  autoClick?: boolean;
};

export type Activator =
  | { type: "key"; name: string }
  | { type: "mouse"; button: MouseClickButton }
  | { type: "huge"; button: ButtonId };

export type BallScrollSlot = "toggle" | "hold";

export type BallScrollSettings = {
  toggleEnabled: boolean;
  toggleActivator: Activator | null;
  holdEnabled: boolean;
  holdActivator: Activator | null;
  invertVertical?: boolean;
  invertHorizontal?: boolean;
  /** Dedicated ball→scroll multiplier. Default 1.0. */
  speed?: number;
};

export type ResolvedBallScrollSettings = {
  toggleEnabled: boolean;
  toggleActivator: Activator | null;
  holdEnabled: boolean;
  holdActivator: Activator | null;
  invertVertical: boolean;
  invertHorizontal: boolean;
  speed: number;
};

export type ComboActivator = {
  modifiers: string[];
  keys: string[];
  button: ButtonId;
};

export type CustomMappingEntry = {
  id: string;
  activator: ComboActivator;
} & ButtonBinding;

export type Profile = {
  name: string;
  buttons: Partial<Record<ButtonId, Action | ButtonBinding>>;
  pointer: {
    speed: number;
    speedX?: number;
    speedY?: number;
    acceleration: boolean;
    scrollSpeed: number;
    scrollSpeedVertical?: number;
    scrollSpeedHorizontal?: number;
    naturalScroll: boolean;
    invertVerticalScroll?: boolean;
    invertHorizontalScroll?: boolean;
  };
  ballScroll?: BallScrollSettings;
  customMappings?: CustomMappingEntry[];
  enabled: boolean;
  /** Launch with window closed; stay in menu bar (like Cmd+W). */
  startMinimized?: boolean;
  /** Hold duration before long-press fires (ms). */
  longPressMs?: number;
};
