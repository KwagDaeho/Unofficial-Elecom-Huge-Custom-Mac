use crate::app::state::AppState;
use crate::domain::device;
use crate::domain::engine;
use tauri::State;

#[tauri::command]
pub fn list_devices() -> Result<Vec<device::DeviceInfo>, String> {
    crate::platform::hid::list_elecom_devices()
}

#[tauri::command]
pub fn get_connected(state: State<'_, AppState>) -> Option<device::DeviceInfo> {
    state.engine.connected_device()
}

#[tauri::command]
pub fn get_last_report(state: State<'_, AppState>) -> Option<engine::LastReport> {
    state.engine.last_report()
}

#[tauri::command]
pub fn button_catalog() -> Vec<serde_json::Value> {
    device::ButtonId::ALL
        .into_iter()
        .map(|id| {
            serde_json::json!({
                "id": id,
                "hiddenFromMacos": id.is_hidden_from_macos(),
            })
        })
        .collect()
}
