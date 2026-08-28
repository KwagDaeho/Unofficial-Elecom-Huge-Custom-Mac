use serde::{Deserialize, Serialize};

use super::activator::Activator;
use super::binding::ButtonBinding;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GesturePoint {
    pub x: f64,
    pub y: f64,
}

fn default_gesture_min_score() -> f64 {
    0.72
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GestureMappingEntry {
    pub id: String,
    pub hold_activator: Option<Activator>,
    #[serde(default)]
    pub template_directions: Vec<u8>,
    #[serde(default)]
    pub template_segment_lengths: Vec<f64>,
    #[serde(default)]
    pub template_path_length: f64,
    #[serde(default)]
    pub template: Vec<GesturePoint>,
    #[serde(default)]
    pub template_preview: Vec<GesturePoint>,
    #[serde(default)]
    pub template_corner_count: usize,
    #[serde(default)]
    pub template_bend_signature: i64,
    #[serde(default = "default_gesture_min_score")]
    pub min_score: f64,
    #[serde(flatten)]
    pub binding: ButtonBinding,
}

impl GestureMappingEntry {
    pub fn is_valid(&self) -> bool {
        if self.hold_activator.is_none() {
            return false;
        }
        let points = crate::domain::gesture_mapping::recognizer::resolve_template_points(self);
        points.len() >= 2
            && crate::domain::gesture_mapping::recognizer::raw_path_length(&points)
                >= crate::domain::gesture_mapping::recognizer::MIN_RAW_PATH_LENGTH
    }
}
