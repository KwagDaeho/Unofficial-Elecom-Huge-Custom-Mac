//! Action press/release dispatch (mouse, keys, macros, system commands).

use core_graphics::event::CGEventFlags;

use crate::domain::device::ButtonId;
use crate::domain::profile::{Action, MacroStep, MouseClickButton, SystemCommand};

use super::keyboard::{
    keystroke, keystroke_isolated, media_mute, media_next, media_play_pause, media_previous,
    media_volume_down, media_volume_up, post_key,
};
use super::mouse::{click_once, double_click, mouse_down, mouse_up};
use super::pointer::{scroll_by_units_ex, shared_pointer_mode};
use super::{chord_action_inject, source};

// Private Dock SPI — toggles Launchpad / Tahoe “Apps” view (same action as
// System Settings → 앱 보기), independent of the user’s chosen hotkey.
#[link(name = "ApplicationServices", kind = "framework")]
extern "C" {
    fn CoreDockSendNotification(notification: core_foundation::string::CFStringRef);
}

fn open_app(bundle_id: &str) {
    // Prefer exact bundle, then known aliases (System Settings renamed across macOS).
    let aliases: &[&str] = match bundle_id {
        "com.apple.SystemSettings" | "com.apple.systempreferences" => &[
            "com.apple.systempreferences",
            "com.apple.SystemSettings",
        ],
        other => &[other],
    };
    for id in aliases {
        match std::process::Command::new("open").args(["-b", id]).status() {
            Ok(status) if status.success() => return,
            Ok(status) => log::warn!("open -b {id} failed: {status}"),
            Err(err) => log::warn!("open -b {id} spawn failed: {err}"),
        }
    }
    if bundle_id.to_ascii_lowercase().contains("system")
        || bundle_id.to_ascii_lowercase().contains("preference")
    {
        if open_named_app("System Settings") {
            return;
        }
        let _ = open_named_app("System Preferences");
        let _ = std::process::Command::new("open")
            .args(["x-apple.systempreferences:"])
            .spawn();
    }
}

fn app_switcher() {
    if run_osascript(
        r#"tell application "System Events" to keystroke tab using command down"#,
    ) {
        return;
    }
    // Hold ⌘ briefly so the switcher can appear.
    let Some(src) = source() else {
        return;
    };
    post_key(&src, 0x37, true, CGEventFlags::CGEventFlagCommand);
    std::thread::sleep(std::time::Duration::from_millis(20));
    post_key(&src, 0x30, true, CGEventFlags::CGEventFlagCommand);
    post_key(&src, 0x30, false, CGEventFlags::CGEventFlagCommand);
    std::thread::sleep(std::time::Duration::from_millis(120));
    post_key(&src, 0x37, false, CGEventFlags::empty());
}

fn launchpad() {
    // System “앱 보기” / Apps (Launchpad’s successor). Use Dock’s notification
    // SPI — the same action System Settings binds a hotkey to — not whatever
    // chord the current user happened to assign (e.g. ⌃⇧5).
    use core_foundation::base::TCFType;
    use core_foundation::string::CFString;
    let name = CFString::new("com.apple.launchpad.toggle");
    unsafe {
        CoreDockSendNotification(name.as_concrete_TypeRef());
    }
}

fn chord_safe_keystroke(keys: &[String]) {
    if chord_action_inject() {
        keystroke_isolated(keys);
    } else {
        keystroke(keys);
    }
}

fn system_command(cmd: &SystemCommand) {
    log::info!("system_command: {cmd:?}");
    match cmd {
        SystemCommand::MissionControl => mission_control(),
        SystemCommand::AppExpose => app_expose(),
        SystemCommand::ShowDesktop => show_desktop(),
        SystemCommand::Launchpad => launchpad(),
        SystemCommand::Spotlight => {
            if chord_action_inject() {
                chord_safe_keystroke(&["Meta".into(), "Space".into()]);
            } else if !run_osascript(
                "tell application \"System Events\" to keystroke space using command down",
            ) {
                keystroke(&["Meta".into(), "Space".into()]);
            }
        }
        SystemCommand::AppSwitcher => app_switcher(),
        SystemCommand::CloseWindow => keystroke(&["Meta".into(), "W".into()]),
        SystemCommand::Save => keystroke(&["Meta".into(), "S".into()]),
        SystemCommand::Cut => keystroke(&["Meta".into(), "X".into()]),
        SystemCommand::Copy => keystroke(&["Meta".into(), "C".into()]),
        SystemCommand::Paste => keystroke(&["Meta".into(), "V".into()]),
        SystemCommand::Undo => keystroke(&["Meta".into(), "Z".into()]),
        SystemCommand::Redo => keystroke(&["Meta".into(), "Shift".into(), "Z".into()]),
        SystemCommand::VolumeUp => media_volume_up(),
        SystemCommand::VolumeDown => media_volume_down(),
        SystemCommand::Mute => media_mute(),
        SystemCommand::PreviousTrack => media_previous(),
        SystemCommand::NextTrack => media_next(),
        SystemCommand::PlayPause => media_play_pause(),
        SystemCommand::MoveSpaceLeft => move_space(true),
        SystemCommand::MoveSpaceRight => move_space(false),
    }
}

fn run_macro(steps: &[MacroStep]) {
    for step in steps {
        match step {
            MacroStep::KeyStroke { keys } => keystroke(keys),
            MacroStep::Delay { ms } => {
                std::thread::sleep(std::time::Duration::from_millis((*ms).min(5_000)));
            }
            MacroStep::MouseClick { button } => {
                click_once(button, 1);
            }
        }
    }
}

/// Mission Control Spaces ignore many synthetic CGEvent chords.
/// System Events (Accessibility) is the reliable path on modern macOS.
fn move_space(left: bool) {
    let key_code = if left { 123 } else { 124 }; // Left / Right arrow
    let script = format!(
        "tell application \"System Events\" to key code {key_code} using control down"
    );
    match std::process::Command::new("/usr/bin/osascript")
        .args(["-e", &script])
        .output()
    {
        Ok(out) if out.status.success() => return,
        Ok(out) => {
            log::warn!(
                "move_space osascript failed: {}",
                String::from_utf8_lossy(&out.stderr)
            );
        }
        Err(err) => log::warn!("move_space osascript spawn failed: {err}"),
    }

    // Fallback: CGEvent with Control (+ Function bit, as Spaces hotkeys often expect).
    let code: u16 = if left { 0x7b } else { 0x7c };
    let Some(src) = source() else {
        return;
    };
    let ctrl = CGEventFlags::CGEventFlagControl;
    let flags = ctrl | CGEventFlags::CGEventFlagSecondaryFn;
    post_key(&src, 0x3b, true, ctrl);
    std::thread::sleep(std::time::Duration::from_millis(10));
    post_key(&src, code, true, flags);
    post_key(&src, code, false, flags);
    post_key(&src, 0x3b, false, CGEventFlags::empty());
}

/// Mission Control / Launchpad / Exposé ignore many synthetic CGEvent chords.
/// Prefer launching the apps or driving System Events (same path as Spaces).
fn run_osascript(script: &str) -> bool {
    match std::process::Command::new("/usr/bin/osascript")
        .args(["-e", script])
        .output()
    {
        Ok(out) if out.status.success() => true,
        Ok(out) => {
            log::warn!(
                "osascript failed: {}",
                String::from_utf8_lossy(&out.stderr)
            );
            false
        }
        Err(err) => {
            log::warn!("osascript spawn failed: {err}");
            false
        }
    }
}

fn open_named_app(name: &str) -> bool {
    match std::process::Command::new("open")
        .args(["-a", name])
        .status()
    {
        Ok(status) if status.success() => true,
        Ok(status) => {
            log::warn!("open -a {name} failed: {status}");
            false
        }
        Err(err) => {
            log::warn!("open -a {name} spawn failed: {err}");
            false
        }
    }
}

fn mission_control() {
    if open_named_app("Mission Control") {
        return;
    }
    let _ = run_osascript(
        "tell application \"System Events\" to key code 126 using control down",
    );
}

fn app_expose() {
    if run_osascript(
        "tell application \"System Events\" to key code 125 using control down",
    ) {
        return;
    }
    keystroke(&["Control".into(), "Down".into()]);
}

fn show_desktop() {
    // F11 / Fn+F11 — System Events + function key bit is more reliable than CGEvent alone.
    if run_osascript(
        "tell application \"System Events\" to key code 103 using function down",
    ) {
        return;
    }
    if run_osascript("tell application \"System Events\" to key code 103") {
        return;
    }
    // CGEvent fallback with SecondaryFn (laptop F-keys).
    let Some(src) = source() else {
        return;
    };
    let flags = CGEventFlags::CGEventFlagSecondaryFn;
    post_key(&src, 0x3f, true, flags);
    std::thread::sleep(std::time::Duration::from_millis(10));
    post_key(&src, 0x67, true, flags);
    post_key(&src, 0x67, false, flags);
    post_key(&src, 0x3f, false, CGEventFlags::empty());
}

pub fn default_mouse_button(id: ButtonId) -> Option<MouseClickButton> {
    match id {
        ButtonId::Left => Some(MouseClickButton::Left),
        ButtonId::Right => Some(MouseClickButton::Right),
        ButtonId::Middle => Some(MouseClickButton::Middle),
        ButtonId::Back => Some(MouseClickButton::Back),
        ButtonId::Forward => Some(MouseClickButton::Forward),
        _ => None,
    }
}

/// True when WindowServer already owns this physical button's native click.
/// `force_synth` is for deferred pulses after we already ate the OS down
/// (long-press wait): suppress is off on release, but we still must inject.
fn os_owns_native_click(id: ButtonId, force_synth: bool) -> bool {
    if force_synth {
        return false;
    }
    shared_pointer_mode()
        && !id.is_hidden_from_macos()
        && !crate::platform::suppress::os_button_suppressed(id)
}

fn skip_native_mouse_click(
    id: ButtonId,
    button: &MouseClickButton,
    force_synth: bool,
) -> bool {
    if force_synth {
        return false;
    }
    if !shared_pointer_mode() {
        return false;
    }
    match default_mouse_button(id) {
        Some(native)
            if &native == button && !crate::platform::suppress::os_button_suppressed(id) =>
        {
            true
        }
        _ => false,
    }
}

pub fn press_action(
    id: ButtonId,
    action: &Action,
    pointer: &crate::domain::profile::PointerSettings,
) {
    press_action_with(id, action, pointer, false);
}

pub fn press_action_forced(
    id: ButtonId,
    action: &Action,
    pointer: &crate::domain::profile::PointerSettings,
) {
    press_action_with(id, action, pointer, true);
}

fn press_action_with(
    id: ButtonId,
    action: &Action,
    pointer: &crate::domain::profile::PointerSettings,
    force_synth: bool,
) {
    match action {
        Action::Disabled => {}
        Action::Default => {
            // Shared: OS delivers L/R/M/… unless we suppress that button
            // (auto-click / long-press / remap) — then we must synthesize.
            if let Some(btn) = default_mouse_button(id) {
                if !os_owns_native_click(id, force_synth) {
                    mouse_down(&btn);
                }
            }
        }
        Action::MouseClick { button } => {
            // Same-as-native on L/R/…: OS owns it unless that stream is suppressed.
            if skip_native_mouse_click(id, button, force_synth) {
                return;
            }
            mouse_down(button);
        }
        Action::DoubleClick => double_click(),
        Action::KeyStroke { keys } => keystroke(keys),
        Action::System { command } => system_command(command),
        Action::OpenApp { bundle_id, .. } => open_app(bundle_id),
        Action::Scroll { dx, dy } => scroll_by_units_ex(*dx, *dy, pointer, true),
        Action::Macro { steps } => run_macro(steps),
    }
}

pub fn release_action(id: ButtonId, action: &Action) {
    release_action_with(id, action, false);
}

pub fn release_action_forced(id: ButtonId, action: &Action) {
    release_action_with(id, action, true);
}

fn release_action_with(id: ButtonId, action: &Action, force_synth: bool) {
    match action {
        Action::Disabled
        | Action::KeyStroke { .. }
        | Action::System { .. }
        | Action::DoubleClick
        | Action::OpenApp { .. }
        | Action::Scroll { .. }
        | Action::Macro { .. } => {}
        Action::Default => {
            if let Some(btn) = default_mouse_button(id) {
                if !os_owns_native_click(id, force_synth) {
                    mouse_up(&btn);
                }
            }
        }
        Action::MouseClick { button } => {
            if skip_native_mouse_click(id, button, force_synth) {
                return;
            }
            mouse_up(button);
        }
    }
}
