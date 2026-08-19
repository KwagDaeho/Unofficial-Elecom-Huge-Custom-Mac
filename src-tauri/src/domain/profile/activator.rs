use serde::{Deserialize, Serialize};

use crate::domain::device::ButtonId;

use super::action::MouseClickButton;
use super::binding::ButtonBinding;

/// One physical control that arms ball-scroll: a key, a mouse button, or a HUGE button.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Activator {
    Key { name: String },
    Mouse { button: MouseClickButton },
    Huge { button: ButtonId },
}

/// Keyboard chord + HUGE button trigger for custom button mappings.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ComboActivator {
    #[serde(default)]
    pub modifiers: Vec<String>,
    #[serde(default)]
    pub keys: Vec<String>,
    pub button: ButtonId,
}

impl ComboActivator {
    pub fn is_valid(&self) -> bool {
        !self.modifiers.is_empty() || !self.keys.is_empty()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomMappingEntry {
    pub id: String,
    pub activator: ComboActivator,
    #[serde(flatten)]
    pub binding: ButtonBinding,
}

impl Activator {
    pub fn is_left_click(&self) -> bool {
        matches!(
            self,
            Activator::Mouse {
                button: MouseClickButton::Left
            } | Activator::Huge {
                button: ButtonId::Left
            }
        )
    }

    pub fn is_huge_tilt(&self) -> bool {
        matches!(
            self,
            Activator::Huge {
                button: ButtonId::WheelTiltLeft | ButtonId::WheelTiltRight
            }
        )
    }
}
