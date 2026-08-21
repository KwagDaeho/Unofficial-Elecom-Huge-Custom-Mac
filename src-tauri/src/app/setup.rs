use crate::app::state::AppState;
use crate::domain::watch;
use crate::platform::capture;
use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    App, Manager,
};

/// Embedded so `tauri:dev` always uses our artwork (not a stale default icon).
const APP_ICON_PNG: &[u8] = include_bytes!("../../icons/icon.png");

fn app_icon() -> Image<'static> {
    Image::from_bytes(APP_ICON_PNG).expect("app icon png")
}

/// macOS dock icon for naked `cargo run` / `tauri:dev` binaries.
#[cfg(target_os = "macos")]
fn apply_dock_icon(png_bytes: &[u8]) {
    use cocoa::appkit::NSImage;
    use cocoa::base::{id, nil};
    use cocoa::foundation::NSData;
    use objc::{msg_send, sel, sel_impl};

    unsafe {
        let data = NSData::dataWithBytes_length_(
            nil,
            png_bytes.as_ptr() as *const std::os::raw::c_void,
            png_bytes.len() as u64,
        );
        let image = NSImage::initWithData_(NSImage::alloc(nil), data);
        if image == nil {
            return;
        }
        let app: id = msg_send![objc::class!(NSApplication), sharedApplication];
        let _: () = msg_send![app, setApplicationIconImage: image];
    }
}

pub fn setup_app(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    app.state::<AppState>().engine.start();

    capture::register_app_handle(app.handle().clone());
    let profile = app.state::<AppState>().engine.profile();
    if watch::needs_os_event_watch(&profile) {
        capture::ensure_watch_tap();
    }
    let show_i = MenuItem::with_id(app, "show", "Open Elecom Huge Custom", true, None::<&str>)?;
    let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

    let icon = app_icon();
    #[cfg(target_os = "macos")]
    apply_dock_icon(APP_ICON_PNG);

    let _tray = TrayIconBuilder::with_id("main")
        .icon(icon.clone())
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
        let _ = window.set_icon(icon);
        if start_minimized {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }

    Ok(())
}
