//! Keyboard / mouse capture for custom chords and ball-scroll activators.

mod emit;
mod session;
mod types;
mod macos;

use crate::platform::app_bus;

pub use emit::{emit_activator_from_hid, emit_combo_trigger_huge};
pub use session::{
    activator_capture_active, apply_capture_session, combo_trigger_capture_active,
    input_capture_active, key_capture_active, set_activator_capture, set_combo_activator_capture,
    set_combo_trigger_capture, set_key_capture, set_ui_modal, ui_modal_active,
};
pub use types::{ActivatorCapture, CaptureChord, CaptureSession, ComboTriggerCapture};

pub fn register_app_handle(app: tauri::AppHandle) {
    app_bus::register(app);
}

pub fn ensure_watch_tap() {
    macos::ensure_tap_thread();
}
