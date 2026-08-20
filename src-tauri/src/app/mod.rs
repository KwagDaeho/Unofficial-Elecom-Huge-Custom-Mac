pub mod setup;
pub mod state;

use crate::app::state::AppState;
use crate::commands;
use crate::constants::BUNDLE_ID;
use crate::domain::ball_scroll;
use crate::domain::engine::Engine;
use crate::platform::suppress;
use crate::persistence::{instance_lock, profile_store};
use crate::platform::capture;
use std::sync::Arc;
use std::sync::Once;
use tauri::{Manager, WindowEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = env_logger::try_init();

    let Some(instance_lock) = instance_lock::acquire_instance_lock() else {
        log::warn!("another Elecom Huge Custom instance is already running — exiting");
        // Best-effort: focus the existing app if present.
        let _ = std::process::Command::new("open")
            .args(["-b", BUNDLE_ID])
            .status();
        return;
    };

    let profile = profile_store::load_profile();
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
            commands::list_devices,
            commands::get_connected,
            commands::get_profile,
            commands::save_profile,
            commands::get_last_report,
            commands::accessibility_status,
            commands::permission_status,
            commands::request_accessibility,
            commands::open_accessibility_settings,
            commands::open_privacy_security_settings,
            commands::reset_tcc_permissions,
            commands::relaunch_app,
            commands::button_catalog,
            commands::set_key_capture,
            commands::apply_capture_session,
            commands::set_activator_capture,
            commands::set_combo_activator_capture,
            commands::set_combo_trigger_capture,
            commands::set_ui_modal,
            commands::set_gesture_canvas_drawing,
            commands::clear_gesture_canvas_stroke,
            commands::list_installed_apps,
            commands::get_app_icon,
        ])
        .setup(|app| setup::setup_app(app))
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
            if matches!(event, tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit) {
                static ONCE: Once = Once::new();
                ONCE.call_once(|| {
                    if let Some(state) = app_handle.try_state::<AppState>() {
                        state.engine.request_stop();
                    }
                    ball_scroll::shutdown();
                    capture::apply_capture_session(capture::CaptureSession::OFF);
                    suppress::clear_suppress();
                    if let Some(state) = app_handle.try_state::<AppState>() {
                        state.engine.join_worker();
                    }
                });
            }
        });
}
