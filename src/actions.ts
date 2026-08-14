import type { Action } from "./types";
import type { Lang as I18nLang } from "./i18n";

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

export const BUTTON_LABELS: Record<I18nLang, Record<string, string>> = {
  ko: {
    left: "L",
    right: "R",
    middle: "휠 버튼",
    back: "◀(뒤로 가기)",
    forward: "▶(앞으로 가기)",
    fn1: "Fn1",
    fn2: "Fn2",
    fn3: "Fn3",
    wheel_tilt_left: "스크롤 기울이기(왼쪽)",
    wheel_tilt_right: "스크롤 기울이기(오른쪽)",
  },
  en: {
    left: "L",
    right: "R",
    middle: "Wheel button",
    back: "◀ (Back)",
    forward: "▶ (Forward)",
    fn1: "Fn1",
    fn2: "Fn2",
    fn3: "Fn3",
    wheel_tilt_left: "Scroll tilt (left)",
    wheel_tilt_right: "Scroll tilt (right)",
  },
};

export function buttonLabel(id: string, lang: I18nLang): string {
  return BUTTON_LABELS[lang][id] ?? id;
}

export const CATEGORY_ORDER: ActionCategoryId[] = [
  "basic",
  "mouse",
  "browser",
  "edit",
  "keys",
  "system",
  "media",
  "launch",
  "custom",
];

export const CATEGORY_LABELS: Record<I18nLang, Record<ActionCategoryId, string>> = {
  ko: {
    basic: "기본",
    mouse: "마우스",
    browser: "브라우저",
    edit: "편집",
    keys: "키",
    system: "창 · 시스템",
    media: "미디어",
    launch: "실행",
    custom: "커스텀",
  },
  en: {
    basic: "Basic",
    mouse: "Mouse",
    browser: "Browser",
    edit: "Edit",
    keys: "Keys",
    system: "Window · System",
    media: "Media",
    launch: "Launch",
    custom: "Custom",
  },
};

/** Sentinel values used in <select> for opening editors. */
export const CUSTOM_KEY_SENTINEL = "__custom_key__";
export const MACRO_SENTINEL = "__macro__";
export const OPEN_APP_SENTINEL = "__open_app__";

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

export const ENTRY_LABELS: Record<I18nLang, Record<string, string>> = {
  ko: {
    default: "OS 기본",
    disabled: "끄기",
    mouse_left: "왼쪽 클릭",
    mouse_right: "오른쪽 클릭",
    mouse_middle: "가운데 클릭",
    mouse_back: "뒤로 (마우스)",
    mouse_forward: "앞으로 (마우스)",
    double_click: "두 번 클릭",
    scroll_left: "왼쪽 스크롤",
    scroll_right: "오른쪽 스크롤",
    safari_back: "Safari: 뒤로",
    safari_forward: "Safari: 앞으로",
    safari_zoom_in: "Safari: 확대",
    safari_zoom_out: "Safari: 축소",
    copy: "복사 (⌘C)",
    cut: "잘라내기 (⌘X)",
    paste: "붙여넣기 (⌘V)",
    undo: "실행 취소 (⌘Z)",
    redo: "다시 실행 (⇧⌘Z)",
    save: "저장 (⌘S)",
    return: "Enter/Return",
    esc: "Esc",
    tab: "Tab",
    delete: "Delete",
    mission_control: "Mission Control",
    move_space_left: "이전 데스크탑",
    move_space_right: "다음 데스크탑",
    app_expose: "App Exposé",
    show_desktop: "데스크탑 보기",
    launchpad: "앱 보기",
    spotlight: "Spotlight",
    app_switcher: "응용 프로그램 전환",
    close_window: "창 닫기",
    volume_up: "음량 높이기",
    volume_down: "음량 낮추기",
    mute: "음소거",
    previous_track: "이전 트랙",
    next_track: "다음 트랙",
    play_pause: "재생/일시정지",
    open_safari: "Safari 열기",
    open_finder: "Finder",
    open_settings: "시스템 설정",
    open_app_pick: "앱 열기…",
    custom_key: "커스텀",
    macro: "매크로 입력",
  },
  en: {
    default: "OS default",
    disabled: "Off",
    mouse_left: "Left click",
    mouse_right: "Right click",
    mouse_middle: "Middle click",
    mouse_back: "Back (mouse)",
    mouse_forward: "Forward (mouse)",
    double_click: "Double click",
    scroll_left: "Scroll left",
    scroll_right: "Scroll right",
    safari_back: "Safari: Back",
    safari_forward: "Safari: Forward",
    safari_zoom_in: "Safari: Zoom in",
    safari_zoom_out: "Safari: Zoom out",
    copy: "Copy (⌘C)",
    cut: "Cut (⌘X)",
    paste: "Paste (⌘V)",
    undo: "Undo (⌘Z)",
    redo: "Redo (⇧⌘Z)",
    save: "Save (⌘S)",
    return: "Enter/Return",
    esc: "Esc",
    tab: "Tab",
    delete: "Delete",
    mission_control: "Mission Control",
    move_space_left: "Previous desktop",
    move_space_right: "Next desktop",
    app_expose: "App Exposé",
    show_desktop: "Show Desktop",
    launchpad: "Apps",
    spotlight: "Spotlight",
    app_switcher: "App switcher",
    close_window: "Close window",
    volume_up: "Volume up",
    volume_down: "Volume down",
    mute: "Mute",
    previous_track: "Previous track",
    next_track: "Next track",
    play_pause: "Play/Pause",
    open_safari: "Open Safari",
    open_finder: "Finder",
    open_settings: "System Settings",
    open_app_pick: "Open app…",
    custom_key: "Custom",
    macro: "Macro input",
  },
};

function normalizeKeys(keys: string[]): string[] {
  return keys.map((k) => {
    const lower = k.toLowerCase();
    if (["meta", "cmd", "command"].includes(lower)) return "Meta";
    if (["alt", "option"].includes(lower)) return "Option";
    if (["ctrl", "control"].includes(lower)) return "Control";
    if (lower === "shift") return "Shift";
    if (["esc", "escape"].includes(lower)) return "Escape";
    if (["return", "enter"].includes(lower)) return "Return";
    if (["left", "arrow_left", "arrowleft"].includes(lower)) return "Left";
    if (["right", "arrow_right", "arrowright"].includes(lower)) return "Right";
    if (["up", "arrow_up", "arrowup"].includes(lower)) return "Up";
    if (["down", "arrow_down", "arrowdown"].includes(lower)) return "Down";
    if (lower === "space") return "Space";
    if (lower === "tab") return "Tab";
    if (["delete", "backspace"].includes(lower)) return "Delete";
    if (k.length === 1) return k.toUpperCase();
    return k;
  });
}

export function actionsEqual(a: Action, b: Action): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "key_stroke" && b.type === "key_stroke") {
    const ak = normalizeKeys(a.keys).join("+");
    const bk = normalizeKeys(b.keys).join("+");
    return ak === bk;
  }
  if (a.type === "open_app" && b.type === "open_app") {
    return a.bundle_id === b.bundle_id && !!a.bundle_id;
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

export function findCatalogEntry(action: Action): CatalogEntry | undefined {
  return ACTION_CATALOG.find(
    (e) => !e.special && actionsEqual(e.action, action),
  );
}

export function formatKeyChord(keys: string[], lang: I18nLang): string {
  const parts = normalizeKeys(keys).map((k) => {
    switch (k) {
      case "Meta":
        return "⌘";
      case "Option":
        return "⌥";
      case "Control":
        return "⌃";
      case "Shift":
        return "⇧";
      case "Left":
        return "←";
      case "Right":
        return "→";
      case "Up":
        return "↑";
      case "Down":
        return "↓";
      case "Escape":
        return "Esc";
      case "Return":
        return "Enter/Return";
      case "Space":
        return lang === "ko" ? "스페이스" : "Space";
      default:
        return k;
    }
  });
  return parts.join("");
}

export function describeAction(action: Action, lang: I18nLang): string {
  const entry = findCatalogEntry(action);
  if (entry) {
    return ENTRY_LABELS[lang][entry.id] ?? entry.id;
  }
  if (action.type === "key_stroke") {
    const chord = formatKeyChord(action.keys, lang);
    return lang === "ko" ? `커스텀[${chord}]` : `Custom[${chord}]`;
  }
  if (action.type === "macro") {
    const n = action.steps.length;
    return lang === "ko" ? `매크로 (${n}단계)` : `Macro (${n} steps)`;
  }
  if (action.type === "open_app") {
    const label = action.name?.trim() || action.bundle_id;
    return lang === "ko" ? `앱 열기 · ${label}` : `Open app · ${label}`;
  }
  return JSON.stringify(action);
}

/** Map a KeyboardEvent to our key name tokens. */
export function eventToKeyName(e: KeyboardEvent): string | null {
  const modMap: Record<string, string> = {
    Meta: "Meta",
    Control: "Control",
    Alt: "Option",
    Shift: "Shift",
  };
  if (e.key in modMap) return modMap[e.key];

  switch (e.code) {
    case "ArrowLeft":
      return "Left";
    case "ArrowRight":
      return "Right";
    case "ArrowUp":
      return "Up";
    case "ArrowDown":
      return "Down";
    case "Escape":
      return "Escape";
    case "Enter":
    case "NumpadEnter":
      return "Return";
    case "Tab":
      return "Tab";
    case "Space":
      return "Space";
    case "Backspace":
    case "Delete":
      return "Delete";
    case "BracketLeft":
      return "[";
    case "BracketRight":
      return "]";
    case "Equal":
    case "NumpadAdd":
      return "=";
    case "Minus":
    case "NumpadSubtract":
      return "-";
    default:
      break;
  }

  if (/^Key[A-Z]$/.test(e.code)) return e.code.slice(3);
  if (/^Digit[0-9]$/.test(e.code)) return e.code.slice(5);
  if (/^F([1-9]|1[0-2])$/.test(e.code)) return e.code;

  if (e.key.length === 1) return e.key.toUpperCase();
  return null;
}

export function chordFromEvent(e: KeyboardEvent): string[] {
  const keys: string[] = [];
  if (e.ctrlKey) keys.push("Control");
  if (e.altKey) keys.push("Option");
  if (e.shiftKey) keys.push("Shift");
  if (e.metaKey) keys.push("Meta");

  const main = eventToKeyName(e);
  if (
    main &&
    !["Control", "Option", "Shift", "Meta"].includes(main) &&
    !keys.includes(main)
  ) {
    keys.push(main);
  }
  return keys;
}
