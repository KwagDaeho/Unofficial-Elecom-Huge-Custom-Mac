mod device;
mod engine;
mod inject;
mod profile;
mod capture;
mod suppress;
mod apps;

use engine::Engine;
use profile::Profile;
use std::fs::File;
use std::os::fd::AsRawFd;
use std::sync::Arc;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, State, WindowEvent,
};

struct AppState {
    engine: Arc<Engine>,
    /// Held for process lifetime so a second copy cannot start another HID engine.
    _instance_lock: File,
}

/// Non-blocking exclusive lock under Application Support.
/// Prevents LaunchAgent + "reopen windows" from running two remappers after login.
fn acquire_instance_lock() -> Option<File> {
    let dir = dirs::config_dir()?.join("elecom-huge");
    std::fs::create_dir_all(&dir).ok()?;
    let file = std::fs::OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(false)
        .open(dir.join("instance.lock"))
        .ok()?;
    let rc = unsafe { libc::flock(file.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) };
    if rc != 0 {
        return None;
    }
    Some(file)
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
fn open_privacy_security_settings() -> Result<(), String> {
    inject::open_privacy_security_settings()
}

#[tauri::command]
fn reset_tcc_permissions() -> Result<(), String> {
    inject::reset_tcc_permissions()
}

/// Exit after scheduling a delayed relaunch so the instance flock is released first.
#[tauri::command]
fn relaunch_app(app: tauri::AppHandle) {
    let _ = std::process::Command::new("/bin/sh")
        .args([
            "-c",
            "sleep 0.7; /usr/bin/open -b com.kwagdaeho.elecom-huge",
        ])
        .spawn();
    app.exit(0);
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

    let Some(instance_lock) = acquire_instance_lock() else {
        log::warn!("another Elecom Huge Custom instance is already running — exiting");
        // Best-effort: focus the existing app if present.
        let _ = std::process::Command::new("open")
            .args(["-b", "com.kwagdaeho.elecom-huge"])
            .status();
        return;
    };

    let profile = profile::load_profile();
    let engine = Arc::new(Engine::new(profile));
    // Start HID remapper only after we own the instance lock (not before),
    // so a duplicate launch cannot attach a second engine.

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .manage(AppState {
            engine: Arc::clone(&engine),
            _instance_lock: instance_lock,
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
            open_privacy_security_settings,
            reset_tcc_permissions,
            relaunch_app,
            button_catalog,
            set_key_capture,
            list_installed_apps,
            get_app_icon,
        ])
        .setup(|app| {
            app.state::<AppState>().engine.start();

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
