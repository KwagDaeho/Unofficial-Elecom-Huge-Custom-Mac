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
