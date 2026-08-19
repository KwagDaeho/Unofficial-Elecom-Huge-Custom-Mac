//! Shared Tauri app handle for HID / event-tap threads.

use serde::Serialize;
use std::sync::OnceLock;
use tauri::{AppHandle, Emitter};

static APP: OnceLock<AppHandle> = OnceLock::new();

pub fn register(app: AppHandle) {
    let _ = APP.set(app);
}

pub fn emit<S: Serialize + Clone>(event: &str, payload: S) {
    if let Some(app) = APP.get() {
        let _ = app.emit(event, payload);
    }
}

pub fn set_tray_tooltip(text: &str) {
    if let Some(app) = APP.get() {
        if let Some(tray) = app.tray_by_id("main") {
            let _ = tray.set_tooltip(Some(text));
        }
    }
}

pub fn run_on_main<F>(f: F)
where
    F: FnOnce() + Send + 'static,
{
    if let Some(app) = APP.get() {
        let _ = app.run_on_main_thread(f);
    }
}
