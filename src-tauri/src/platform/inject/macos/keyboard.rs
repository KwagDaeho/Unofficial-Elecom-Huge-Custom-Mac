//! Keyboard keystroke and media-key injection.

use core_graphics::event::{CGEvent, CGEventFlags, CGEventTapLocation};
use core_graphics::event_source::CGEventSource;

use super::source;

#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
    fn CGEventCreate(source: *mut std::ffi::c_void) -> *mut std::ffi::c_void;
    fn CGEventSetType(event: *mut std::ffi::c_void, event_type: u32);
    fn CGEventSetFlags(event: *mut std::ffi::c_void, flags: u64);
    fn CGEventSetIntegerValueField(event: *mut std::ffi::c_void, field: u32, value: i64);
    fn CGEventPost(tap: u32, event: *mut std::ffi::c_void);
    fn CGEventSourceCreate(state_id: u32) -> *mut std::ffi::c_void;
}

#[link(name = "CoreFoundation", kind = "framework")]
extern "C" {
    fn CFRelease(cf: *mut std::ffi::c_void);
}

fn key_code(name: &str) -> Option<u16> {
    Some(match name.to_ascii_lowercase().as_str() {
        "a" => 0x00,
        "s" => 0x01,
        "d" => 0x02,
        "f" => 0x03,
        "h" => 0x04,
        "g" => 0x05,
        "z" => 0x06,
        "x" => 0x07,
        "c" => 0x08,
        "v" => 0x09,
        "b" => 0x0b,
        "q" => 0x0c,
        "w" => 0x0d,
        "e" => 0x0e,
        "r" => 0x0f,
        "y" => 0x10,
        "t" => 0x11,
        "1" => 0x12,
        "2" => 0x13,
        "3" => 0x14,
        "4" => 0x15,
        "5" => 0x17,
        "6" => 0x16,
        "=" | "equal" => 0x18,
        "9" => 0x19,
        "7" => 0x1a,
        "-" | "minus" => 0x1b,
        "8" => 0x1c,
        "0" => 0x1d,
        "]" => 0x1e,
        "o" => 0x1f,
        "u" => 0x20,
        "[" => 0x21,
        "i" => 0x22,
        "p" => 0x23,
        "l" => 0x25,
        "j" => 0x26,
        "'" | "quote" => 0x27,
        "k" => 0x28,
        ";" | "semicolon" => 0x29,
        "\\" | "backslash" => 0x2a,
        "," => 0x2b,
        "/" | "slash" => 0x2c,
        "n" => 0x2d,
        "m" => 0x2e,
        "." => 0x2f,
        "space" => 0x31,
        "tab" => 0x30,
        "return" | "enter" => 0x24,
        "escape" | "esc" => 0x35,
        "delete" | "backspace" => 0x33,
        "left" | "arrow_left" | "arrowleft" => 0x7b,
        "right" | "arrow_right" | "arrowright" => 0x7c,
        "down" | "arrow_down" | "arrowdown" => 0x7d,
        "up" | "arrow_up" | "arrowup" => 0x7e,
        "f1" => 0x7a,
        "f2" => 0x78,
        "f3" => 0x63,
        "f4" => 0x76,
        "f5" => 0x60,
        "f6" => 0x61,
        "f7" => 0x62,
        "f8" => 0x64,
        "f9" => 0x65,
        "f10" => 0x6d,
        "f11" => 0x67,
        "f12" => 0x6f,
        "volume_up" | "sound_up" => 0x48,
        "volume_down" | "sound_down" => 0x49,
        "mute" | "sound_mute" => 0x4a,
        "play" | "play_pause" | "playpause" => 0x42,
        "next" | "next_track" | "nexttrack" => 0x43,
        "previous" | "previous_track" | "previoustrack" => 0x44,
        _ => return None,
    })
}

fn is_modifier(name: &str) -> Option<CGEventFlags> {
    match name.to_ascii_lowercase().as_str() {
        "meta" | "cmd" | "command" | "left_meta" | "right_meta" | "left_command"
        | "right_command" => Some(CGEventFlags::CGEventFlagCommand),
        "alt" | "option" | "left_alt" | "right_alt" | "left_option" | "right_option" => {
            Some(CGEventFlags::CGEventFlagAlternate)
        }
        "ctrl" | "control" | "left_ctrl" | "right_ctrl" | "left_control" | "right_control" => {
            Some(CGEventFlags::CGEventFlagControl)
        }
        "shift" | "left_shift" | "right_shift" => Some(CGEventFlags::CGEventFlagShift),
        "fn" | "function" => Some(CGEventFlags::CGEventFlagSecondaryFn),
        _ => None,
    }
}

/// Physical keycodes for modifiers (left-side). Needed so OS modifier state
/// does not stick after a chord — flag-only events leave Control "down",
/// which turns the next left-click into a right-click on macOS.
fn modifier_keycode(flag: CGEventFlags) -> Option<u16> {
    if flag.contains(CGEventFlags::CGEventFlagControl) {
        Some(0x3b) // Left Control
    } else if flag.contains(CGEventFlags::CGEventFlagAlternate) {
        Some(0x3a) // Left Option
    } else if flag.contains(CGEventFlags::CGEventFlagShift) {
        Some(0x38) // Left Shift
    } else if flag.contains(CGEventFlags::CGEventFlagCommand) {
        Some(0x37) // Left Command
    } else if flag.contains(CGEventFlags::CGEventFlagSecondaryFn) {
        Some(0x3f) // Fn
    } else {
        None
    }
}

pub(super) fn post_key(src: &CGEventSource, code: u16, key_down: bool, flags: CGEventFlags) {
    if let Ok(e) = CGEvent::new_keyboard_event(src.clone(), code, key_down) {
        e.set_flags(flags);
        e.post(CGEventTapLocation::HID);
    }
}

fn keystroke_with_source(src: &CGEventSource, keys: &[String]) {
    let mut flags = CGEventFlags::empty();
    let mut mod_order: Vec<CGEventFlags> = Vec::new();
    let mut main_key: Option<u16> = None;
    for k in keys {
        if let Some(f) = is_modifier(k) {
            if !flags.contains(f) {
                flags.insert(f);
                mod_order.push(f);
            }
        } else if let Some(code) = key_code(k) {
            main_key = Some(code);
        }
    }
    let Some(code) = main_key else {
        return;
    };

    let mut accumulated = CGEventFlags::empty();
    for flag in &mod_order {
        if let Some(mk) = modifier_keycode(*flag) {
            accumulated.insert(*flag);
            post_key(src, mk, true, accumulated);
        }
    }

    post_key(src, code, true, flags);
    post_key(src, code, false, flags);

    for flag in mod_order.iter().rev() {
        if let Some(mk) = modifier_keycode(*flag) {
            accumulated.remove(*flag);
            post_key(src, mk, false, accumulated);
        }
    }
}

pub(super) fn keystroke(keys: &[String]) {
    keystroke_with_source(&super::source(), keys);
}

/// Keystroke via a private event source — ignores combined-session modifier state
/// so a held Control/Option does not pollute Cmd+Space etc.
pub fn keystroke_isolated(keys: &[String]) {
    use core_graphics::event_source::CGEventSourceStateID;
    let src = CGEventSource::new(CGEventSourceStateID::Private)
        .unwrap_or_else(|_| super::source());
    keystroke_with_source(&src, keys);
}

/// Release tracked chord modifiers/keys so injected actions are not polluted
/// (e.g. Control held → right-click; Control+Command+Space → emoji picker).
pub fn release_chord_hold(modifiers: &[String], keys: &[String]) {
    let src = super::source();
    let mut accumulated = CGEventFlags::empty();
    let mod_flags: Vec<CGEventFlags> = modifiers
        .iter()
        .filter_map(|name| is_modifier(name))
        .collect();
    for flag in &mod_flags {
        accumulated.insert(*flag);
    }
    for name in keys.iter().rev() {
        if is_modifier(name).is_some() {
            continue;
        }
        if let Some(code) = key_code(name) {
            post_key(&src, code, false, accumulated);
        }
    }
    for flag in mod_flags.iter().rev() {
        if let Some(code) = modifier_keycode(*flag) {
            accumulated.remove(*flag);
            post_key(&src, code, false, accumulated);
        }
    }
}

/// NX auxiliary / media keys via NSEvent (shows volume HUD + Now Playing).
/// Raw CGEventCreate is only a fallback — it often never reaches the OSD.
fn post_nx_key(key_type: i64) {
    use cocoa::appkit::{NSEvent, NSEventModifierFlags, NSEventSubtype, NSSystemDefined};
    use cocoa::base::{id, nil};
    use cocoa::foundation::NSPoint;

    const TAP_HID: u32 = 0;

    unsafe {
        for down in [true, false] {
            let state: i64 = if down { 0xa } else { 0xb };
            let flags = NSEventModifierFlags::from_bits_truncate((state << 8) as u64);
            let data1 = (key_type << 16) | (state << 8);
            let ns: id = NSEvent::otherEventWithType_location_modifierFlags_timestamp_windowNumber_context_subtype_data1_data2_(
                nil,
                NSSystemDefined,
                NSPoint::new(0.0, 0.0),
                flags,
                0.0,
                0,
                nil,
                // NX_SUBTYPE_AUX_CONTROL_BUTTONS == 8 (named ScreenChanged in cocoa)
                NSEventSubtype::NSScreenChangedEventType,
                data1,
                -1,
            );
            if ns != nil {
                let cg: *mut std::ffi::c_void = NSEvent::CGEvent(ns);
                if !cg.is_null() {
                    CGEventPost(TAP_HID, cg);
                }
            } else {
                let src = CGEventSourceCreate(1); // HIDSystemState
                if src.is_null() {
                    log::warn!("post_nx_key: CGEventSourceCreate failed");
                    continue;
                }
                let e = CGEventCreate(src);
                if !e.is_null() {
                    CGEventSetType(e, 14);
                    CGEventSetFlags(e, (state << 8) as u64);
                    CGEventSetIntegerValueField(e, 99, 8);
                    CGEventSetIntegerValueField(e, 149, data1);
                    CGEventSetIntegerValueField(e, 150, -1);
                    CGEventPost(TAP_HID, e);
                    CFRelease(e);
                }
                CFRelease(src);
            }
            std::thread::sleep(std::time::Duration::from_millis(30));
        }
    }
}

pub(super) fn media_volume_up() {
    post_nx_key(0); // NX_KEYTYPE_SOUND_UP — system volume HUD
}
pub(super) fn media_volume_down() {
    post_nx_key(1); // NX_KEYTYPE_SOUND_DOWN
}
pub(super) fn media_mute() {
    post_nx_key(7); // NX_KEYTYPE_MUTE
}
pub(super) fn media_play_pause() {
    // NX reaches system Now Playing (browser etc.). Do not also AppleScript
    // Music/Spotify — that double-toggles and looks like "nothing happened".
    post_nx_key(16); // NX_KEYTYPE_PLAY
}
pub(super) fn media_next() {
    post_nx_key(17); // NX_KEYTYPE_NEXT
}
pub(super) fn media_previous() {
    post_nx_key(18); // NX_KEYTYPE_PREVIOUS
}
