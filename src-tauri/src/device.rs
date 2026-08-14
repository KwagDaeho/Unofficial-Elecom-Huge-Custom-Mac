//! Known ELECOM HUGE hardware IDs and button layout.

pub const ELECOM_VID: u16 = 0x056e;

/// Wired / wireless HUGE (and close revisions). Huge Plus is intentionally excluded for now.
pub const HUGE_PIDS: &[u16] = &[
    0x010c, // M-HT1URBK (wired)
    0x010d, // M-HT1DRBK (wireless)
    0x011c, // M-HT1DRBK revision
    0x019b, // M-HT1URBK revision
];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ButtonId {
    Left,
    Right,
    Middle,
    Back,
    Forward,
    Fn1,
    Fn2,
    Fn3,
    WheelTiltLeft,
    WheelTiltRight,
}

impl ButtonId {
    pub const ALL: [ButtonId; 10] = [
        ButtonId::Left,
        ButtonId::Right,
        ButtonId::Middle,
        ButtonId::Back,
        ButtonId::Forward,
        ButtonId::Fn1,
        ButtonId::Fn2,
        ButtonId::Fn3,
        ButtonId::WheelTiltLeft,
        ButtonId::WheelTiltRight,
    ];

    pub fn id_str(self) -> &'static str {
        match self {
            ButtonId::Left => "left",
            ButtonId::Right => "right",
            ButtonId::Middle => "middle",
            ButtonId::Back => "back",
            ButtonId::Forward => "forward",
            ButtonId::Fn1 => "fn1",
            ButtonId::Fn2 => "fn2",
            ButtonId::Fn3 => "fn3",
            ButtonId::WheelTiltLeft => "wheel_tilt_left",
            ButtonId::WheelTiltRight => "wheel_tilt_right",
        }
    }

    pub fn label(self) -> &'static str {
        // Default (Korean) — UI localizes via id_str when possible.
        match self {
            ButtonId::Left => "L",
            ButtonId::Right => "R",
            ButtonId::Middle => "휠 버튼",
            ButtonId::Back => "◀(뒤로 가기)",
            ButtonId::Forward => "▶(앞으로 가기)",
            ButtonId::Fn1 => "Fn1",
            ButtonId::Fn2 => "Fn2",
            ButtonId::Fn3 => "Fn3",
            ButtonId::WheelTiltLeft => "스크롤 기울이기(왼쪽)",
            ButtonId::WheelTiltRight => "스크롤 기울이기(오른쪽)",
        }
    }

    pub fn is_hidden_from_macos(self) -> bool {
        matches!(self, ButtonId::Fn1 | ButtonId::Fn2 | ButtonId::Fn3)
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceInfo {
    pub vendor_id: u16,
    pub product_id: u16,
    pub product_name: String,
    pub manufacturer: String,
    pub path: String,
    pub is_huge: bool,
}

pub fn is_huge(vendor_id: u16, product_id: u16) -> bool {
    vendor_id == ELECOM_VID && HUGE_PIDS.contains(&product_id)
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct ButtonState {
    pub left: bool,
    pub right: bool,
    pub middle: bool,
    pub back: bool,
    pub forward: bool,
    pub fn1: bool,
    pub fn2: bool,
    pub fn3: bool,
    pub tilt_left: bool,
    pub tilt_right: bool,
}

/// HUGE mouse report (observed / LinearMouse):
/// ```text
/// 01 | buttons | x_lo x_hi | y_lo y_hi | wheel | pan
/// ```
/// 8-bit XY was wrong: Y low landed in the "wheel" field → ball motion scrolled.
#[derive(Debug, Clone, Copy, Default)]
pub struct ParsedReport {
    pub buttons: ButtonState,
    pub dx: i16,
    pub dy: i16,
    pub wheel: i8,
    pub pan: i8,
}

fn i16_le(lo: u8, hi: u8) -> i16 {
    i16::from_le_bytes([lo, hi])
}

impl ParsedReport {
    pub fn from_bytes(data: &[u8]) -> Option<Self> {
        // Only mouse collection report id 0x01.
        if data.is_empty() || data[0] != 0x01 {
            return None;
        }

        // Need buttons + at least something after.
        if data.len() < 4 {
            return None;
        }

        let b0 = data[1];
        let (dx, dy, wheel, pan) = if data.len() >= 8 {
            // 16-bit relative X/Y (little-endian), then wheel + AC Pan.
            (
                i16_le(data[2], data[3]),
                i16_le(data[4], data[5]),
                data[6] as i8,
                data[7] as i8,
            )
        } else if data.len() >= 6 {
            // Fallback: 8-bit X/Y (short reports).
            (
                data[2] as i8 as i16,
                data[3] as i8 as i16,
                data[4] as i8,
                data[5] as i8,
            )
        } else {
            return None;
        };

        let buttons = ButtonState {
            left: b0 & 0x01 != 0,
            right: b0 & 0x02 != 0,
            middle: b0 & 0x04 != 0,
            back: b0 & 0x08 != 0,
            forward: b0 & 0x10 != 0,
            fn1: b0 & 0x20 != 0,
            fn2: b0 & 0x40 != 0,
            fn3: b0 & 0x80 != 0,
            tilt_left: pan < 0, // raw pan hint — engine gates sticky hold
            tilt_right: pan > 0,
        };

        Some(Self {
            buttons,
            dx,
            dy,
            wheel,
            pan,
        })
    }
}

impl ButtonState {
    pub fn is_down(&self, id: ButtonId) -> bool {
        match id {
            ButtonId::Left => self.left,
            ButtonId::Right => self.right,
            ButtonId::Middle => self.middle,
            ButtonId::Back => self.back,
            ButtonId::Forward => self.forward,
            ButtonId::Fn1 => self.fn1,
            ButtonId::Fn2 => self.fn2,
            ButtonId::Fn3 => self.fn3,
            ButtonId::WheelTiltLeft => self.tilt_left,
            ButtonId::WheelTiltRight => self.tilt_right,
        }
    }

    pub fn pressed_edges(self, prev: Self) -> Vec<ButtonId> {
        ButtonId::ALL
            .into_iter()
            .filter(|&id| self.is_down(id) && !prev.is_down(id))
            .collect()
    }

    pub fn released_edges(self, prev: Self) -> Vec<ButtonId> {
        ButtonId::ALL
            .into_iter()
            .filter(|&id| !self.is_down(id) && prev.is_down(id))
            .collect()
    }
}
