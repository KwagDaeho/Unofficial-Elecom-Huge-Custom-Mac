use serde::{Deserialize, Serialize};

use super::activator::Activator;
use super::binding::ButtonBinding;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GesturePoint {
    pub x: f64,
    pub y: f64,
}

fn default_gesture_min_score() -> f64 {
    0.85
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GestureMappingEntry {
    pub id: String,
    pub hold_activator: Option<Activator>,
    #[serde(default)]
    pub template: Vec<GesturePoint>,
    #[serde(default)]
    pub template_path_length: f64,
    #[serde(default)]
    pub template_preview: Vec<GesturePoint>,
    #[serde(default = "default_gesture_min_score")]
    pub min_score: f64,
    #[serde(flatten)]
    pub binding: ButtonBinding,
}

impl GestureMappingEntry {
    pub fn is_valid(&self) -> bool {
        self.hold_activator.is_some() && self.template.len() >= 8
    }
}
