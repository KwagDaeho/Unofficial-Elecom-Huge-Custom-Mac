use serde::{Deserialize, Deserializer, Serialize};

use super::action::Action;

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

    /// Hold past threshold before firing click on release.
    pub fn waits_for_long_press(&self) -> bool {
        self.long_press_enabled && !self.auto_click
    }

    pub fn uses_long_press(&self) -> bool {
        self.waits_for_long_press() && !self.long_press.is_noop()
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
