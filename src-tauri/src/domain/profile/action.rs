use serde::{Deserialize, Serialize};

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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum MacroStep {
    KeyStroke { keys: Vec<String> },
    Delay { ms: u64 },
    MouseClick { button: MouseClickButton },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MouseClickButton {
    Left,
    Right,
    Middle,
    Back,
    Forward,
    /// Extra mouse buttons (Karabiner `buttonN`, CGEvent button number).
    Other {
        number: u8,
    },
}

impl MouseClickButton {
    /// CGEvent `MOUSE_EVENT_BUTTON_NUMBER` when applicable.
    pub fn event_number(&self) -> Option<u8> {
        Some(match self {
            MouseClickButton::Left => 0,
            MouseClickButton::Right => 1,
            MouseClickButton::Middle => 2,
            MouseClickButton::Back => 3,
            MouseClickButton::Forward => 4,
            MouseClickButton::Other { number } => *number,
        })
    }

    pub fn matches_event_number(&self, number: i64) -> bool {
        self.event_number().is_some_and(|n| i64::from(n) == number)
    }
}

impl PartialEq for MouseClickButton {
    fn eq(&self, other: &Self) -> bool {
        self.event_number() == other.event_number()
    }
}

impl Eq for MouseClickButton {}

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
