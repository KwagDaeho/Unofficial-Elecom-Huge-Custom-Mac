use crate::platform::capture;

#[tauri::command]
pub fn set_key_capture(active: bool) {
    capture::set_key_capture(active);
}
