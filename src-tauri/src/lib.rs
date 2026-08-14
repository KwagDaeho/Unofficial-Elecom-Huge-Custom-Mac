mod device;
mod engine;
mod inject;
mod profile;
mod capture;
mod suppress;
mod apps;

use engine::Engine;
use profile::Profile;
use std::sync::Arc;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, State, WindowEvent,
};

struct AppState {
    engine: Arc<Engine>,
}

#[tauri::command]
fn list_devices() -> Result<Vec<device::DeviceInfo>, String> {
    engine::list_elecom_devices()
}

#[tauri::command]
fn get_connected(state: State<'_, AppState>) -> Option<device::DeviceInfo> {
    state.engine.connected_device()
}

#[tauri::command]
fn get_profile(state: State<'_, AppState>) -> Profile {
    state.engine.profile()
}

#[tauri::command]
fn save_profile(state: State<'_, AppState>, profile: Profile) -> Result<(), String> {
    profile::save_profile(&profile)?;
    state.engine.set_profile(profile);
    Ok(())
}

#[tauri::command]
fn get_last_report(state: State<'_, AppState>) -> Option<engine::LastReport> {
    state.engine.last_report()
}

#[tauri::command]
fn accessibility_status() -> bool {
    inject::accessibility_granted()
}

#[tauri::command]
fn permission_status() -> inject::PermissionStatus {
    inject::permission_status()
}

#[tauri::command]
fn request_accessibility() -> bool {
    inject::prompt_accessibility()
}

#[tauri::command]
fn open_accessibility_settings() -> Result<(), String> {
    inject::open_permission_settings()
}

#[tauri::command]
fn button_catalog() -> Vec<serde_json::Value> {
    device::ButtonId::ALL
        .into_iter()
        .map(|id| {
            serde_json::json!({
                "id": id,
                "label": id.label(),
                "hiddenFromMacos": id.is_hidden_from_macos(),
            })
        })
        .collect()
}

#[tauri::command]
fn set_key_capture(active: bool) {
    capture::set_key_capture(active);
}

#[tauri::command]
fn list_installed_apps() -> Result<Vec<apps::InstalledApp>, String> {
    apps::list_installed_apps()
}

#[tauri::command]
fn get_app_icon(path: String) -> Option<String> {
    apps::app_icon_data_url(&path)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = env_logger::try_init();

    let profile = profile::load_profile();
    let engine = Arc::new(Engine::new(profile));
    engine.start();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .manage(AppState {
            engine: Arc::clone(&engine),
        })
        .invoke_handler(tauri::generate_handler![
            list_devices,
            get_connected,
            get_profile,
            save_profile,
            get_last_report,
            accessibility_status,
            permission_status,
            request_accessibility,
            open_accessibility_settings,
            button_catalog,
            set_key_capture,
            list_installed_apps,
            get_app_icon,
        ])
        .setup(|app| {
            capture::register_app_handle(app.handle().clone());
            let show_i = MenuItem::with_id(app, "show", "Open Elecom Huge Custom", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("Elecom Huge Custom")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        app.exit(0);
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            let start_minimized = app.state::<AppState>().engine.profile().start_minimized;
            if let Some(window) = app.get_webview_window("main") {
                if start_minimized {
                    let _ = window.hide();
                } else {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                // Keep running in tray.
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Exit = event {
                capture::set_key_capture(false);
                if let Some(state) = app_handle.try_state::<AppState>() {
                    state.engine.stop();
                }
            }
        });
}
