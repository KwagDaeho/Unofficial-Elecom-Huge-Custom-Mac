use serde::{Deserialize, Deserializer, Serialize};
use std::collections::HashMap;

use crate::domain::device::ButtonId;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Action {
    /// Keep OS default (or no-op for hidden Fn buttons).
    Default,
    Disabled,
    MouseClick { button: MouseClickButton },
    DoubleClick,
    KeyStroke { keys: Vec<String> },
    System { command: SystemCommand },
    OpenApp {
        bundle_id: String,
        /// Display name from the picker (optional for older profiles).
        #[serde(default, skip_serializing_if = "Option::is_none")]
        name: Option<String>,
    },
    Scroll { dx: i32, dy: i32 },
    Macro { steps: Vec<MacroStep> },
}

impl Action {
    pub fn is_noop(&self) -> bool {
        matches!(self, Action::Disabled | Action::Default)
    }
}

fn disabled_action() -> Action {
    Action::Disabled
}

fn default_false() -> bool {
    false
}

/// Per-button click + optional long-press / auto-click.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ButtonBinding {
    pub click: Action,
    #[serde(default = "disabled_action")]
    pub long_press: Action,
    /// Hold → fire `long_press` once after threshold. Mutually exclusive with `auto_click`.
    #[serde(default = "default_false")]
    pub long_press_enabled: bool,
    /// Hold → repeat `click` (득-드드드득). Mutually exclusive with `long_press_enabled`.
    #[serde(default = "default_false")]
    pub auto_click: bool,
}

impl ButtonBinding {
    pub fn from_click(click: Action) -> Self {
        Self {
            click,
            long_press: Action::Disabled,
            long_press_enabled: false,
            auto_click: false,
        }
    }

    pub fn uses_long_press(&self) -> bool {
        self.long_press_enabled && !self.auto_click && !self.long_press.is_noop()
    }

    pub fn uses_auto_click(&self) -> bool {
        self.auto_click && !self.long_press_enabled
    }
}

impl<'de> Deserialize<'de> for ButtonBinding {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let value = serde_json::Value::deserialize(deserializer)?;
        if value.get("click").is_some() {
            #[derive(Deserialize)]
            #[serde(rename_all = "camelCase")]
            struct Raw {
                click: Action,
                #[serde(default = "disabled_action")]
                long_press: Action,
                #[serde(default = "default_false")]
                long_press_enabled: bool,
                #[serde(default = "default_false")]
                auto_click: bool,
            }
            let mut raw: Raw =
                serde_json::from_value(value).map_err(serde::de::Error::custom)?;
            // Mutual exclusivity — prefer long-press if both somehow set.
            if raw.long_press_enabled && raw.auto_click {
                raw.auto_click = false;
            }
            Ok(Self {
                click: raw.click,
                long_press: raw.long_press,
                long_press_enabled: raw.long_press_enabled,
                auto_click: raw.auto_click,
            })
        } else {
            let click: Action =
                serde_json::from_value(value).map_err(serde::de::Error::custom)?;
            Ok(Self::from_click(click))
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum MacroStep {
    KeyStroke { keys: Vec<String> },
    Delay { ms: u64 },
    MouseClick { button: MouseClickButton },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MouseClickButton {
    Left,
    Right,
    Middle,
    Back,
    Forward,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SystemCommand {
    MissionControl,
    AppExpose,
    ShowDesktop,
    Launchpad,
    Spotlight,
    AppSwitcher,
    CloseWindow,
    Save,
    Cut,
    Copy,
    Paste,
    Undo,
    Redo,
    VolumeUp,
    VolumeDown,
    Mute,
    PreviousTrack,
    NextTrack,
    PlayPause,
    /// Mission Control: move left a Space (default ⌃←).
    MoveSpaceLeft,
    /// Mission Control: move right a Space (default ⌃→).
    MoveSpaceRight,
}

fn default_one() -> f64 {
    1.0
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PointerSettings {
    /// Legacy unified pointer multiplier (used when speedX/Y are absent).
    #[serde(default = "default_one")]
    pub speed: f64,
    #[serde(default)]
    pub speed_x: Option<f64>,
    #[serde(default)]
    pub speed_y: Option<f64>,
    pub acceleration: bool,
    /// Legacy unified scroll multiplier (used when axis-specific values are absent).
    #[serde(default = "default_one")]
    pub scroll_speed: f64,
    #[serde(default)]
    pub scroll_speed_vertical: Option<f64>,
    #[serde(default)]
    pub scroll_speed_horizontal: Option<f64>,
    /// Kept for older profiles; invert_* take precedence when present.
    #[serde(default = "default_false")]
    pub natural_scroll: bool,
    #[serde(default)]
    pub invert_vertical_scroll: Option<bool>,
    #[serde(default)]
    pub invert_horizontal_scroll: Option<bool>,
}

impl PointerSettings {
    pub fn speed_x(&self) -> f64 {
        self.speed_x.unwrap_or(self.speed).clamp(1.0, 10.0)
    }

    pub fn speed_y(&self) -> f64 {
        self.speed_y.unwrap_or(self.speed).clamp(1.0, 10.0)
    }

    pub fn scroll_vertical(&self) -> f64 {
        self.scroll_speed_vertical
            .unwrap_or(self.scroll_speed)
            .clamp(0.05, 10.0)
    }

    pub fn scroll_horizontal(&self) -> f64 {
        self.scroll_speed_horizontal
            .unwrap_or(self.scroll_speed)
            .clamp(0.05, 10.0)
    }

    pub fn invert_vertical(&self) -> bool {
        self.invert_vertical_scroll.unwrap_or(false)
    }

    pub fn invert_horizontal(&self) -> bool {
        self.invert_horizontal_scroll.unwrap_or(false)
    }
}

impl Default for PointerSettings {
    fn default() -> Self {
        Self {
            speed: 1.0,
            speed_x: Some(1.0),
            speed_y: Some(1.0),
            acceleration: true,
            scroll_speed: 1.0,
            scroll_speed_vertical: Some(1.0),
            scroll_speed_horizontal: Some(1.0),
            natural_scroll: false,
            invert_vertical_scroll: Some(false),
            invert_horizontal_scroll: Some(false),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    pub name: String,
    pub buttons: HashMap<ButtonId, ButtonBinding>,
    pub pointer: PointerSettings,
    /// When true, remap engine is active.
    pub enabled: bool,
    /// Launch with the main window hidden (menu bar / tray only).
    #[serde(default)]
    pub start_minimized: bool,
    /// Hold duration before long-press fires (ms).
    #[serde(default = "default_long_press_ms")]
    pub long_press_ms: u64,
}

fn default_long_press_ms() -> u64 {
    450
}

impl Profile {
    pub fn long_press_threshold(&self) -> std::time::Duration {
        std::time::Duration::from_millis(self.long_press_ms.clamp(150, 2000))
    }
}

impl Default for Profile {
    fn default() -> Self {
        let mut buttons = HashMap::new();
        for id in ButtonId::ALL {
            let action = match id {
                ButtonId::Fn1 => Action::MouseClick {
                    button: MouseClickButton::Middle,
                },
                _ => Action::Default,
            };
            buttons.insert(id, ButtonBinding::from_click(action));
        }

        Self {
            name: "Default".into(),
            buttons,
            pointer: PointerSettings::default(),
            enabled: true,
            start_minimized: false,
            long_press_ms: default_long_press_ms(),
        }
    }
}
