use crate::platform::capture;

#[tauri::command]
pub fn apply_capture_session(session: capture::CaptureSession) {
    capture::apply_capture_session(session);
}

#[tauri::command]
pub fn set_key_capture(active: bool) {
    capture::set_key_capture(active);
}

#[tauri::command]
pub fn set_activator_capture(active: bool) {
    capture::set_activator_capture(active);
}

#[tauri::command]
pub fn set_combo_activator_capture(active: bool) {
    capture::set_combo_activator_capture(active);
}

#[tauri::command]
pub fn set_combo_trigger_capture(active: bool) {
    capture::set_combo_trigger_capture(active);
}

#[tauri::command]
pub fn set_ui_modal(active: bool) {
    capture::set_ui_modal(active);
}
