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

#[tauri::command]
pub fn set_gesture_canvas_drawing(active: bool) {
    capture::set_gesture_canvas_drawing(active);
}

#[tauri::command]
pub fn clear_gesture_canvas_stroke() {
    capture::set_gesture_canvas_drawing(false);
    capture::set_gesture_ball_stroke_active(false);
    #[cfg(target_os = "macos")]
    crate::platform::inject::clear_gesture_record_overlay_stroke();
}

#[tauri::command]
pub fn append_gesture_record_point(x: f64, y: f64) {
    #[cfg(target_os = "macos")]
    crate::platform::inject::append_gesture_record_screen_point(x, y);
}

#[tauri::command]
pub fn sync_gesture_record_cursor() {
    #[cfg(target_os = "macos")]
    crate::platform::inject::append_gesture_record_cursor_point();
}
