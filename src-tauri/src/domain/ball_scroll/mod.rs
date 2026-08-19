//! Ball-as-scroll mode: hold and/or latched toggle, driven by a single activator.

mod activator;
mod state;

use std::sync::atomic::Ordering;
use std::time::Instant;

pub use activator::{
    arm_app_quit, mouse_from_event, note_huge_edges, on_os_down, on_os_up,
    yield_modifier_hold_for_chord,
};
pub use state::{
    ignore_ball_pointer_motion, is_active, is_reserved_huge, latch_on, needs_event_watch,
    shutdown, sync_from_profile,
};

use state::{apply_active, logical_armed, DEACTIVATE_AT, FORCE_DEACTIVATE, QUIT_ARMED, WAS_ACTIVE};

/// Commit a pending off after bounce grace, and keep tray/UI in sync.
pub fn tick() {
    if FORCE_DEACTIVATE.swap(false, Ordering::SeqCst) {
        apply_active(false);
        return;
    }
    let due = DEACTIVATE_AT
        .lock()
        .map(|t| Instant::now() >= t)
        .unwrap_or(false);
    if due {
        *DEACTIVATE_AT.lock() = None;
        if !logical_armed() {
            apply_active(false);
        }
    } else if logical_armed()
        && !WAS_ACTIVE.load(Ordering::SeqCst)
        && !QUIT_ARMED.load(Ordering::SeqCst)
    {
        // Pin on the HID worker — never from the CGEvent tap callback (deadlock on ⌘Q).
        apply_active(true);
    }
}
