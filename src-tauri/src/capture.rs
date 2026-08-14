//! Temporary keyboard capture that swallows OS shortcuts while the UI records a chord.

use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::OnceLock;
use tauri::{AppHandle, Emitter};

static CAPTURE_ACTIVE: AtomicBool = AtomicBool::new(false);
static TAP_STARTED: AtomicBool = AtomicBool::new(false);
static APP: OnceLock<AppHandle> = OnceLock::new();

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureChord {
    pub keys: Vec<String>,
    pub escape: bool,
}

pub fn register_app_handle(app: AppHandle) {
    let _ = APP.set(app);
}

pub fn set_key_capture(active: bool) {
    CAPTURE_ACTIVE.store(active, Ordering::SeqCst);
    #[cfg(target_os = "macos")]
    macos::ensure_tap_thread();
}

fn emit_chord(payload: CaptureChord) {
    if let Some(app) = APP.get() {
        let _ = app.emit("key-capture", payload);
    }
}

#[cfg(target_os = "macos")]
mod macos {
    use super::*;
    use core_foundation::mach_port::{CFMachPort, CFMachPortRef};
    use core_foundation::runloop::{kCFRunLoopCommonModes, CFRunLoop};
    use core_foundation::base::TCFType;
    use std::ffi::c_void;
    use std::os::raw::c_ulonglong;

    type CGEventRef = *mut c_void;
    type CGEventTapProxy = *mut c_void;
    type CGEventMask = c_ulonglong;

    const KEY_DOWN: u32 = 10;
    const KEY_UP: u32 = 11;
    const FLAGS_CHANGED: u32 = 12;

    const KEYBOARD_EVENT_KEYCODE: u32 = 9;
    const KEYBOARD_EVENT_AUTOREPEAT: u32 = 8;

    const FLAG_COMMAND: u64 = 0x0010_0000;
    const FLAG_SHIFT: u64 = 0x0002_0000;
    const FLAG_CONTROL: u64 = 0x0004_0000;
    const FLAG_OPTION: u64 = 0x0008_0000;

    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" {
        fn CGEventTapCreate(
            tap: u32,
            place: u32,
            options: u32,
            eventsOfInterest: CGEventMask,
            callback: unsafe extern "C" fn(
                CGEventTapProxy,
                u32,
                CGEventRef,
                *mut c_void,
            ) -> CGEventRef,
            userInfo: *mut c_void,
        ) -> CFMachPortRef;
        fn CGEventTapEnable(tap: CFMachPortRef, enable: bool);
        fn CGEventGetIntegerValueField(event: CGEventRef, field: u32) -> i64;
        fn CGEventGetFlags(event: CGEventRef) -> u64;
    }

    fn mask_bit(t: u32) -> CGEventMask {
        1u64 << t
    }

    fn keycode_name(code: u16) -> Option<&'static str> {
        Some(match code {
            0x00 => "A",
            0x01 => "S",
            0x02 => "D",
            0x03 => "F",
            0x04 => "H",
            0x05 => "G",
            0x06 => "Z",
            0x07 => "X",
            0x08 => "C",
            0x09 => "V",
            0x0b => "B",
            0x0c => "Q",
            0x0d => "W",
            0x0e => "E",
            0x0f => "R",
            0x10 => "Y",
            0x11 => "T",
            0x12 => "1",
            0x13 => "2",
            0x14 => "3",
            0x15 => "4",
            0x17 => "5",
            0x16 => "6",
            0x18 => "=",
            0x19 => "9",
            0x1a => "7",
            0x1b => "-",
            0x1c => "8",
            0x1d => "0",
            0x1e => "]",
            0x1f => "O",
            0x20 => "U",
            0x21 => "[",
            0x22 => "I",
            0x23 => "P",
            0x25 => "L",
            0x26 => "J",
            0x27 => "'",
            0x28 => "K",
            0x29 => ";",
            0x2a => "\\",
            0x2b => ",",
            0x2c => "/",
            0x2d => "N",
            0x2e => "M",
            0x2f => ".",
            0x31 => "Space",
            0x30 => "Tab",
            0x24 => "Return",
            0x35 => "Escape",
            0x33 => "Delete",
            0x7b => "Left",
            0x7c => "Right",
            0x7d => "Down",
            0x7e => "Up",
            0x7a => "F1",
            0x78 => "F2",
            0x63 => "F3",
            0x76 => "F4",
            0x60 => "F5",
            0x61 => "F6",
            0x62 => "F7",
            0x64 => "F8",
            0x65 => "F9",
            0x6d => "F10",
            0x67 => "F11",
            0x6f => "F12",
            // Modifier keycodes alone — ignore as main key
            0x37 | 0x36 | 0x3a | 0x3d | 0x3b | 0x3e | 0x38 | 0x3c => return None,
            _ => return None,
        })
    }

    fn chord_from_event(event: CGEventRef) -> Option<CaptureChord> {
        let code = unsafe { CGEventGetIntegerValueField(event, KEYBOARD_EVENT_KEYCODE) } as u16;
        let flags = unsafe { CGEventGetFlags(event) };
        let Some(main) = keycode_name(code) else {
            return None;
        };

        let mut keys = Vec::new();
        if flags & FLAG_CONTROL != 0 {
            keys.push("Control".into());
        }
        if flags & FLAG_OPTION != 0 {
            keys.push("Option".into());
        }
        if flags & FLAG_SHIFT != 0 {
            keys.push("Shift".into());
        }
        if flags & FLAG_COMMAND != 0 {
            keys.push("Meta".into());
        }
        keys.push(main.into());

        Some(CaptureChord {
            escape: main == "Escape" && keys.len() == 1,
            keys,
        })
    }

    unsafe extern "C" fn tap_callback(
        _proxy: CGEventTapProxy,
        etype: u32,
        event: CGEventRef,
        _user: *mut c_void,
    ) -> CGEventRef {
        if !CAPTURE_ACTIVE.load(Ordering::SeqCst) {
            return event;
        }

        // Swallow keyboard traffic so system / browser shortcuts do not fire.
        if etype == KEY_UP || etype == FLAGS_CHANGED {
            return std::ptr::null_mut();
        }

        if etype == KEY_DOWN {
            let autorepeat =
                unsafe { CGEventGetIntegerValueField(event, KEYBOARD_EVENT_AUTOREPEAT) } != 0;
            if !autorepeat {
                if let Some(chord) = chord_from_event(event) {
                    emit_chord(chord);
                }
            }
            return std::ptr::null_mut();
        }

        event
    }

    pub fn ensure_tap_thread() {
        if TAP_STARTED.swap(true, Ordering::SeqCst) {
            return;
        }

        std::thread::Builder::new()
            .name("key-capture-tap".into())
            .spawn(|| {
                let events = mask_bit(KEY_DOWN) | mask_bit(KEY_UP) | mask_bit(FLAGS_CHANGED);
                // CGEventTapLocation::CGHIDEventTap = 0
                // CGEventTapPlacement::HeadInsertEventTap = 0
                // CGEventTapOptions::Default = 0 (active filter)
                let port = unsafe {
                    CGEventTapCreate(
                        0,
                        0,
                        0,
                        events,
                        tap_callback,
                        std::ptr::null_mut(),
                    )
                };
                if port.is_null() {
                    log::warn!(
                        "key-capture tap failed — grant Accessibility / Input Monitoring"
                    );
                    TAP_STARTED.store(false, Ordering::SeqCst);
                    return;
                }

                let mach = unsafe { CFMachPort::wrap_under_create_rule(port) };
                let source = mach
                    .create_runloop_source(0)
                    .expect("CFMachPortCreateRunLoopSource");
                let rl = CFRunLoop::get_current();
                rl.add_source(&source, unsafe { kCFRunLoopCommonModes });
                unsafe { CGEventTapEnable(port, true) };
                log::info!("key-capture event tap ready");
                CFRunLoop::run_current();
                let _keep = (mach, source);
            })
            .expect("spawn key-capture-tap");
    }
}

#[cfg(not(target_os = "macos"))]
mod macos {
    pub fn ensure_tap_thread() {}
}
