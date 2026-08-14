use crate::platform::permissions;

#[tauri::command]
pub fn accessibility_status() -> bool {
    permissions::accessibility_granted()
}

#[tauri::command]
pub fn permission_status() -> permissions::PermissionStatus {
    permissions::permission_status()
}

#[tauri::command]
pub fn request_accessibility() -> bool {
    permissions::prompt_accessibility()
}

#[tauri::command]
pub fn open_accessibility_settings() -> Result<(), String> {
    permissions::open_permission_settings()
}

#[tauri::command]
pub fn open_privacy_security_settings() -> Result<(), String> {
    permissions::open_privacy_security_settings()
}

#[tauri::command]
pub fn reset_tcc_permissions() -> Result<(), String> {
    permissions::reset_tcc_permissions()
}
