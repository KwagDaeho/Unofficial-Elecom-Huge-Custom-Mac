use crate::platform::apps;

#[tauri::command]
pub fn list_installed_apps() -> Result<Vec<apps::InstalledApp>, String> {
    apps::list_installed_apps()
}

#[tauri::command]
pub fn get_app_icon(path: String) -> Option<String> {
    apps::app_icon_data_url(&path)
}
