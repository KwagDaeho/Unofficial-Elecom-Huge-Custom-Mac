use serde::{Deserialize, Serialize};

fn default_one() -> f64 {
    1.0
}

fn default_false() -> bool {
    false
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
