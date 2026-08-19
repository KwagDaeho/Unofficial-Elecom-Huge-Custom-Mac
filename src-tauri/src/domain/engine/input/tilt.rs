use std::time::{Duration, Instant};

use crate::domain::device::ButtonState;

/// HUGE tilt is an AC Pan axis that often sticks until the next HID frame
/// (or until the wheel/ball is nudged). Gate converts sticky pan into one virtual
/// press per gesture; continuous-click ON sustains until pan returns to 0.
/// Continuous-click OFF: short TTL pulse, then after HID goes quiet allow re-arm
/// without waiting for pan==0 (so consecutive tilts work).
const TILT_HOLD_TTL: Duration = Duration::from_millis(70);

/// Debounced tilt-down derived from sticky pan reports.
#[derive(Debug, Default, Clone, Copy)]
pub(crate) struct TiltHoldGate {
    left_until: Option<Instant>,
    right_until: Option<Instant>,
    /// Seen pan≠0; for sustain, cleared only when pan returns to 0.
    /// For pulse (AC off), also cleared after TTL once HID goes idle.
    left_latched: bool,
    right_latched: bool,
    /// Continuous-click / long-press: stay down until pan==0 (no short TTL).
    left_sustain: bool,
    right_sustain: bool,
}

impl TiltHoldGate {
    pub fn note_pan(
        &mut self,
        pan: i8,
        now: Instant,
        left_sustain: bool,
        right_sustain: bool,
    ) {
        if pan == 0 {
            self.left_until = None;
            self.right_until = None;
            self.left_latched = false;
            self.right_latched = false;
            self.left_sustain = false;
            self.right_sustain = false;
            return;
        }

        if pan < 0 {
            self.right_until = None;
            self.right_latched = false;
            self.right_sustain = false;
            self.left_sustain = left_sustain;
            if !self.left_latched {
                // One press edge per physical tilt until re-armed.
                self.left_latched = true;
                self.left_until = Some(Self::hold_deadline(now, left_sustain));
            } else if left_sustain && self.left_until.is_none() {
                self.left_until = Some(Self::hold_deadline(now, true));
            }
        } else {
            self.left_until = None;
            self.left_latched = false;
            self.left_sustain = false;
            self.right_sustain = right_sustain;
            if !self.right_latched {
                self.right_latched = true;
                self.right_until = Some(Self::hold_deadline(now, right_sustain));
            } else if right_sustain && self.right_until.is_none() {
                self.right_until = Some(Self::hold_deadline(now, true));
            }
        }
    }

    fn hold_deadline(now: Instant, sustain: bool) -> Instant {
        if sustain {
            now + Duration::from_secs(60 * 60)
        } else {
            now + TILT_HOLD_TTL
        }
    }

    pub fn expire(&mut self, now: Instant) {
        if !self.left_sustain {
            if self.left_until.is_some_and(|t| now >= t) {
                self.left_until = None;
            }
        }
        if !self.right_sustain {
            if self.right_until.is_some_and(|t| now >= t) {
                self.right_until = None;
            }
        }
    }

    /// Call only on HID idle (`read` timeout). Pulse mode: after the short
    /// press ends and reports stop, allow the next physical tilt even if pan
    /// never returned 0 (HUGE sticky pan). Do **not** call this on live pan
    /// reports — that would re-arm every frame and feel like auto-click.
    pub fn clear_pulse_latches_when_idle(&mut self) {
        if !self.left_sustain && self.left_until.is_none() {
            self.left_latched = false;
        }
        if !self.right_sustain && self.right_until.is_none() {
            self.right_latched = false;
        }
    }

    pub fn apply(self, state: &mut ButtonState) {
        state.tilt_left = self.left_until.is_some();
        state.tilt_right = self.right_until.is_some();
    }
}
