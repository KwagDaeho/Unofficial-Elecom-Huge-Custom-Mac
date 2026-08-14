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

export type ButtonBinding = {
  click: Action;
  longPress: Action;
  /** Hold → fire longPress once. Exclusive with autoClick. */
  longPressEnabled?: boolean;
  /** Hold → repeat click. Exclusive with longPressEnabled. */
  autoClick?: boolean;
};

/** Tilt sides whose OS-default / L-R scroll use continuous HID pan streaming. */
export function isTiltButton(id: ButtonId): boolean {
  return id === "wheel_tilt_left" || id === "wheel_tilt_right";
}

/** Matches engine `tilt_uses_pan_stream` action check (OS default or horiz scroll). */
export function isTiltPanStreamAction(action: Action): boolean {
  if (action.type === "default") return true;
  return action.type === "scroll" && action.dy === 0 && action.dx !== 0;
}

/** UI/profile: force continuous-click ON for tilt pan-stream bindings. */
export function tiltForcesAutoClick(id: ButtonId, click: Action): boolean {
  return isTiltButton(id) && isTiltPanStreamAction(click);
}

/** Ensure tilt OS-default / L-R scroll bindings persist autoClick=true. */
export function normalizeTiltPanStreamFlags(profile: Profile): Profile {
  let changed = false;
  const buttons = { ...profile.buttons };
  for (const id of ["wheel_tilt_left", "wheel_tilt_right"] as ButtonId[]) {
    const current = asBinding(buttons[id]);
    if (!tiltForcesAutoClick(id, current.click)) continue;
    if (current.autoClick && !current.longPressEnabled) continue;
    buttons[id] = {
      ...current,
      autoClick: true,
      longPressEnabled: false,
    };
    changed = true;
  }
  return changed ? { ...profile, buttons } : profile;
}

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
  enabled: boolean;
  /** Launch with window closed; stay in menu bar (like Cmd+W). */
  startMinimized?: boolean;
  /** Hold duration before long-press fires (ms). */
  longPressMs?: number;
};

export const DEFAULT_LONG_PRESS_MS = 450;

export function longPressMs(p: Profile): number {
  const n = p.longPressMs ?? DEFAULT_LONG_PRESS_MS;
  return Math.min(2000, Math.max(150, n));
}

export function asBinding(
  value: Action | ButtonBinding | undefined,
): ButtonBinding {
  if (!value) {
    return {
      click: { type: "default" },
      longPress: { type: "disabled" },
      longPressEnabled: false,
      autoClick: false,
    };
  }
  if ("click" in value) {
    let longPressEnabled = value.longPressEnabled ?? false;
    let autoClick = value.autoClick ?? false;
    if (longPressEnabled && autoClick) autoClick = false;
    return {
      click: value.click,
      longPress: value.longPress ?? { type: "disabled" },
      longPressEnabled,
      autoClick,
    };
  }
  return {
    click: value,
    longPress: { type: "disabled" },
    longPressEnabled: false,
    autoClick: false,
  };
}

export function pointerSpeedX(p: Profile["pointer"]): number {
  return Math.max(1, p.speedX ?? p.speed);
}

export function pointerSpeedY(p: Profile["pointer"]): number {
  return Math.max(1, p.speedY ?? p.speed);
}

export function scrollSpeedVertical(p: Profile["pointer"]): number {
  return p.scrollSpeedVertical ?? p.scrollSpeed;
}

export function scrollSpeedHorizontal(p: Profile["pointer"]): number {
  return p.scrollSpeedHorizontal ?? p.scrollSpeed;
}

/** Reference DPI at 1.0× pointer multiplier (display-only). */
export const POINTER_REF_DPI = 1000;
/** px per notch at 1.0× — keep in sync with inject::SCROLL_BASE_*_PX */
export const SCROLL_BASE_VERTICAL_PX = 36;
export const SCROLL_BASE_HORIZONTAL_PX = 36;

/** `(1.00×, 1000)` style label for speed sliders. */
export function formatSpeedPair(mult: number, base: number): string {
  return `(${mult.toFixed(2)}×, ${Math.round(base * mult)})`;
}

export type DeviceInfo = {
  vendorId: number;
  productId: number;
  productName: string;
  manufacturer: string;
  path: string;
  isHuge: boolean;
};

export type ButtonMeta = {
  id: ButtonId;
  label: string;
  hiddenFromMacos: boolean;
};

export type LastReport = {
  hex: string;
  buttons: string[];
  dx: number;
  dy: number;
  wheel: number;
  pan: number;
  ignored: boolean;
  tsMs: number;
};

export function actionKey(action: Action | undefined): string {
  if (!action) return JSON.stringify({ type: "default" });
  return JSON.stringify(action);
}

export function actionFromKey(key: string): Action {
  try {
    return JSON.parse(key) as Action;
  } catch {
    return { type: "default" };
  }
}
