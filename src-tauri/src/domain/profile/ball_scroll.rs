use serde::{Deserialize, Serialize};

use crate::domain::device::ButtonId;

use super::activator::Activator;

fn default_one() -> f64 {
    1.0
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BallScrollSettings {
    #[serde(default)]
    pub toggle_enabled: bool,
    #[serde(default)]
    pub toggle_activator: Option<Activator>,
    #[serde(default)]
    pub hold_enabled: bool,
    #[serde(default)]
    pub hold_activator: Option<Activator>,
    #[serde(default)]
    pub invert_vertical: bool,
    #[serde(default)]
    pub invert_horizontal: bool,
    /// Dedicated ball→scroll multiplier (not wheel/tilt speed). 1.0 = default feel.
    #[serde(default = "default_one")]
    pub speed: f64,
}

impl Default for BallScrollSettings {
    fn default() -> Self {
        Self {
            toggle_enabled: false,
            toggle_activator: None,
            hold_enabled: false,
            hold_activator: None,
            invert_vertical: false,
            invert_horizontal: false,
            speed: 1.0,
        }
    }
}

impl BallScrollSettings {
    pub fn toggle_armed(&self) -> Option<&Activator> {
        if self.toggle_enabled {
            self.toggle_activator.as_ref()
        } else {
            None
        }
    }

    pub fn hold_armed(&self) -> Option<&Activator> {
        if self.hold_enabled {
            self.hold_activator.as_ref()
        } else {
            None
        }
    }

    pub fn is_reserved_huge(&self, id: ButtonId) -> bool {
        self.toggle_armed()
            .into_iter()
            .chain(self.hold_armed())
            .any(|a| matches!(a, Activator::Huge { button } if *button == id))
    }

    pub fn uses_os_watch(&self) -> bool {
        self.toggle_armed()
            .into_iter()
            .chain(self.hold_armed())
            .any(|a| matches!(a, Activator::Key { .. } | Activator::Mouse { .. }))
    }

    pub fn speed(&self) -> f64 {
        if self.speed <= 0.0 {
            1.0
        } else {
            self.speed.clamp(0.1, 5.0)
        }
    }
}
