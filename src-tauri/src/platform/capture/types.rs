use serde::{Deserialize, Serialize};

use crate::domain::profile::{Activator, ComboActivator};

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureSession {
    pub key_capture: bool,
    pub combo_trigger: bool,
    pub activator_capture: bool,
    pub ui_modal: bool,
}

impl CaptureSession {
    pub const OFF: Self = Self {
        key_capture: false,
        combo_trigger: false,
        activator_capture: false,
        ui_modal: false,
    };
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureChord {
    pub keys: Vec<String>,
    pub escape: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivatorCapture {
    pub escape: bool,
    pub rejected: Option<String>,
    pub activator: Option<Activator>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ComboTriggerCapture {
    pub escape: bool,
    pub rejected: Option<String>,
    pub combo: Option<ComboActivator>,
}
