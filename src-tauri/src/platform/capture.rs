//! Keyboard / mouse capture for custom chords and ball-scroll activators.

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};

use crate::domain::device::ButtonId;
use crate::domain::profile::{Activator, ComboActivator};
use crate::platform::app_bus;

static CAPTURE_ACTIVE: AtomicBool = AtomicBool::new(false);
static KEY_CAPTURE_WANTED: AtomicBool = AtomicBool::new(false);
static ACTIVATOR_CAPTURE: AtomicBool = AtomicBool::new(false);
static ACTIVATOR_CAPTURE_WANTED: AtomicBool = AtomicBool::new(false);
static COMBO_ACTIVATOR_CAPTURE: AtomicBool = AtomicBool::new(false);
static COMBO_TRIGGER_CAPTURE: AtomicBool = AtomicBool::new(false);
static UI_MODAL_ACTIVE: AtomicBool = AtomicBool::new(false);
static TAP_STARTED: AtomicBool = AtomicBool::new(false);

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureSession {
    pub key_capture: bool,
    pub combo_trigger: bool,
    pub activator_capture: bool,
    pub ui_modal: bool,
}

impl CaptureSession {
    pub const OFF: Self = Self {
        key_capture: false,
        combo_trigger: false,
        activator_capture: false,
        ui_modal: false,
    };
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureChord {
    pub keys: Vec<String>,
    pub escape: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivatorCapture {
    pub escape: bool,
    pub rejected: Option<String>,
    pub activator: Option<Activator>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ComboTriggerCapture {
    pub escape: bool,
    pub rejected: Option<String>,
    pub combo: Option<ComboActivator>,
}

pub fn register_app_handle(app: tauri::AppHandle) {
    app_bus::register(app);
}

fn refresh_capture_active() {
    let active = KEY_CAPTURE_WANTED.load(Ordering::SeqCst)
        || COMBO_TRIGGER_CAPTURE.load(Ordering::SeqCst);
    CAPTURE_ACTIVE.store(active, Ordering::SeqCst);
    ensure_watch_tap();
}

fn refresh_activator_capture() {
    let active = ACTIVATOR_CAPTURE_WANTED.load(Ordering::SeqCst)
        || COMBO_TRIGGER_CAPTURE.load(Ordering::SeqCst);
    ACTIVATOR_CAPTURE.store(active, Ordering::SeqCst);
    COMBO_ACTIVATOR_CAPTURE.store(
        COMBO_TRIGGER_CAPTURE.load(Ordering::SeqCst),
        Ordering::SeqCst,
    );
}

/// Atomically apply the full capture session (avoids FE race between invoke calls).
pub fn apply_capture_session(session: CaptureSession) {
    let combo_was = COMBO_TRIGGER_CAPTURE.load(Ordering::SeqCst);
    KEY_CAPTURE_WANTED.store(session.key_capture, Ordering::SeqCst);
    ACTIVATOR_CAPTURE_WANTED.store(session.activator_capture, Ordering::SeqCst);
    COMBO_TRIGGER_CAPTURE.store(session.combo_trigger, Ordering::SeqCst);
    UI_MODAL_ACTIVE.store(session.ui_modal, Ordering::SeqCst);

    if session.combo_trigger != combo_was {
        #[cfg(target_os = "macos")]
        macos::clear_combo_held();
    }

    refresh_activator_capture();
    refresh_capture_active();
}

pub fn set_key_capture(active: bool) {
    KEY_CAPTURE_WANTED.store(active, Ordering::SeqCst);
    refresh_capture_active();
}

pub fn set_activator_capture(active: bool) {
    ACTIVATOR_CAPTURE_WANTED.store(active, Ordering::SeqCst);
    refresh_activator_capture();
    ensure_watch_tap();
}

pub fn set_combo_activator_capture(active: bool) {
    COMBO_ACTIVATOR_CAPTURE.store(active, Ordering::SeqCst);
    ACTIVATOR_CAPTURE_WANTED.store(active, Ordering::SeqCst);
    refresh_activator_capture();
    ensure_watch_tap();
}

/// Unified combo-trigger session: keyboard chord + HUGE button snapshot.
pub fn set_combo_trigger_capture(active: bool) {
    let combo_was = COMBO_TRIGGER_CAPTURE.load(Ordering::SeqCst);
    COMBO_TRIGGER_CAPTURE.store(active, Ordering::SeqCst);
    if active != combo_was {
        #[cfg(target_os = "macos")]
        macos::clear_combo_held();
    }
    refresh_activator_capture();
    refresh_capture_active();
}

pub fn set_ui_modal(active: bool) {
    UI_MODAL_ACTIVE.store(active, Ordering::SeqCst);
}

pub fn combo_trigger_capture_active() -> bool {
    COMBO_TRIGGER_CAPTURE.load(Ordering::SeqCst)
}

pub fn ui_modal_active() -> bool {
    UI_MODAL_ACTIVE.load(Ordering::SeqCst)
}

pub fn activator_capture_active() -> bool {
    ACTIVATOR_CAPTURE.load(Ordering::SeqCst)
}

pub fn key_capture_active() -> bool {
    CAPTURE_ACTIVE.load(Ordering::SeqCst)
}

/// Any UI capture session — block HUGE remaps leaking to the OS.
pub fn input_capture_active() -> bool {
    key_capture_active() || activator_capture_active()
}

pub fn ensure_watch_tap() {
    #[cfg(target_os = "macos")]
    macos::ensure_tap_thread();
}

pub fn emit_activator_from_hid(activator: Activator) {
    if combo_trigger_capture_active() {
        if let Activator::Huge { button } = activator {
            emit_combo_trigger_huge(button);
        }
        return;
    }
    if !ACTIVATOR_CAPTURE.load(Ordering::SeqCst) {
        return;
    }
    emit_activator_choice(activator);
}

pub fn emit_combo_trigger_huge(button: ButtonId) {
    if !combo_trigger_capture_active() {
        return;
    }
    #[cfg(target_os = "macos")]
    {
        let (modifiers, keys) = macos::combo_held_parts();
        if modifiers.is_empty() && keys.is_empty() {
            if ui_modal_active() && button == ButtonId::Left {
                crate::platform::inject::click_at_cursor();
            }
            return;
        }
        app_bus::emit(
            "combo-trigger-capture",
            ComboTriggerCapture {
                escape: false,
                rejected: None,
                combo: Some(ComboActivator {
                    modifiers,
                    keys,
                    button,
                }),
            },
        );
    }
}

fn emit_chord(payload: CaptureChord) {
    app_bus::emit("key-capture", payload);
}

fn emit_activator(payload: ActivatorCapture) {
    app_bus::emit("activator-capture", payload);
}

fn emit_activator_choice(activator: Activator) {
    if activator.is_left_click() {
        let allow_huge_left = matches!(activator, Activator::Huge { .. })
            && COMBO_ACTIVATOR_CAPTURE.load(Ordering::SeqCst);
        if !allow_huge_left {
            emit_activator(ActivatorCapture {
                escape: false,
                rejected: Some("left".into()),
                activator: None,
            });
            return;
        }
    }
    if activator.is_huge_tilt() {
        emit_activator(ActivatorCapture {
            escape: false,
            rejected: Some("tilt".into()),
            activator: None,
        });
        return;
    }
    emit_activator(ActivatorCapture {
        escape: false,
        rejected: None,
        activator: Some(activator),
    });
}

#[cfg(target_os = "macos")]
mod macos {
    use super::*;
    use crate::domain::ball_scroll;
    use crate::domain::custom_mapping;
    use crate::domain::profile::Activator;
    use core_foundation::base::TCFType;
    use core_foundation::mach_port::{CFMachPort, CFMachPortRef};
    use core_foundation::runloop::{kCFRunLoopCommonModes, CFRunLoop};
    use std::ffi::c_void;
    use std::os::raw::c_ulonglong;

    type CGEventRef = *mut c_void;
    type CGEventTapProxy = *mut c_void;
    type CGEventMask = c_ulonglong;

    const KEY_DOWN: u32 = 10;
    const KEY_UP: u32 = 11;
    const FLAGS_CHANGED: u32 = 12;
    const LEFT_DOWN: u32 = 1;
    const LEFT_UP: u32 = 2;
    const RIGHT_DOWN: u32 = 3;
    const RIGHT_UP: u32 = 4;
    const OTHER_DOWN: u32 = 25;
    const OTHER_UP: u32 = 26;

    const KEYBOARD_EVENT_KEYCODE: u32 = 9;
    const KEYBOARD_EVENT_AUTOREPEAT: u32 = 8;
    const MOUSE_EVENT_BUTTON_NUMBER: u32 = 3;

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
        fn CGEventSourceFlagsState(stateID: i32) -> u64;
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
            0x37 | 0x36 | 0x3a | 0x3d | 0x3b | 0x3e | 0x38 | 0x3c => return None,
            _ => return None,
        })
    }

    fn modifier_name(code: u16) -> Option<(&'static str, u64)> {
        Some(match code {
            0x38 | 0x3c => ("Shift", FLAG_SHIFT),
            0x3b | 0x3e => ("Control", FLAG_CONTROL),
            0x3a | 0x3d => ("Option", FLAG_OPTION),
            0x37 | 0x36 => ("Meta", FLAG_COMMAND),
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

    fn chord_from_flags(event: CGEventRef) -> CaptureChord {
        let flags = unsafe { CGEventGetFlags(event) };
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
        CaptureChord {
            escape: false,
            keys,
        }
    }

    fn key_activator(event: CGEventRef) -> Option<Activator> {
        let code = unsafe { CGEventGetIntegerValueField(event, KEYBOARD_EVENT_KEYCODE) } as u16;
        let name = keycode_name(code)?;
        Some(Activator::Key {
            name: name.to_string(),
        })
    }

    fn modifier_down(event: CGEventRef) -> Option<(Activator, bool)> {
        let code = unsafe { CGEventGetIntegerValueField(event, KEYBOARD_EVENT_KEYCODE) } as u16;
        let flags = unsafe { CGEventGetFlags(event) };
        let (name, bit) = modifier_name(code)?;
        Some((
            Activator::Key {
                name: name.to_string(),
            },
            flags & bit != 0,
        ))
    }

    use parking_lot::Mutex;
    use std::collections::HashSet;
    use std::sync::LazyLock;

    static HELD_MODS: LazyLock<Mutex<HashSet<String>>> =
        LazyLock::new(|| Mutex::new(HashSet::new()));
    static HELD_KEYS: LazyLock<Mutex<HashSet<String>>> =
        LazyLock::new(|| Mutex::new(HashSet::new()));

    const MODIFIER_ORDER: [&str; 4] = ["Control", "Option", "Shift", "Meta"];

    pub(super) fn clear_combo_held() {
        HELD_MODS.lock().clear();
        HELD_KEYS.lock().clear();
    }

    pub(super) fn combo_held_parts() -> (Vec<String>, Vec<String>) {
        let live_mods = mods_from_session_flags();
        let tracked_mods = HELD_MODS.lock().clone();
        let merged: HashSet<String> = live_mods.union(&tracked_mods).cloned().collect();
        let mods: Vec<String> = MODIFIER_ORDER
            .iter()
            .filter(|m| merged.contains(**m))
            .map(|s| (*s).to_string())
            .collect();
        let mut keys: Vec<String> = HELD_KEYS.lock().iter().cloned().collect();
        keys.sort();
        (mods, keys)
    }

    fn mods_from_session_flags() -> HashSet<String> {
        let flags = unsafe { CGEventSourceFlagsState(0) };
        let mut mods = HashSet::new();
        if flags & FLAG_CONTROL != 0 {
            mods.insert("Control".into());
        }
        if flags & FLAG_OPTION != 0 {
            mods.insert("Option".into());
        }
        if flags & FLAG_SHIFT != 0 {
            mods.insert("Shift".into());
        }
        if flags & FLAG_COMMAND != 0 {
            mods.insert("Meta".into());
        }
        mods
    }

    fn is_modifier(name: &str) -> bool {
        MODIFIER_ORDER.contains(&name)
    }

    fn sync_mods_from_flags(event: CGEventRef) {
        let flags = unsafe { CGEventGetFlags(event) };
        let mut mods = HELD_MODS.lock();
        mods.clear();
        if flags & FLAG_CONTROL != 0 {
            mods.insert("Control".into());
        }
        if flags & FLAG_OPTION != 0 {
            mods.insert("Option".into());
        }
        if flags & FLAG_SHIFT != 0 {
            mods.insert("Shift".into());
        }
        if flags & FLAG_COMMAND != 0 {
            mods.insert("Meta".into());
        }
    }

    fn sync_from_chord(keys: &[String]) {
        HELD_MODS.lock().clear();
        HELD_KEYS.lock().clear();
        for k in keys {
            if is_modifier(k) {
                HELD_MODS.lock().insert(k.clone());
            } else {
                HELD_KEYS.lock().insert(k.clone());
            }
        }
    }

    fn note_key_up(code: u16) {
        if let Some((name, _)) = modifier_name(code) {
            HELD_MODS.lock().remove(name);
        } else if let Some(name) = keycode_name(code) {
            HELD_KEYS.lock().remove(name);
        }
    }

    fn emit_combo_preview() {
        let (mods, keys) = combo_held_parts();
        let mut chord = mods;
        chord.extend(keys);
        if chord.is_empty() {
            return;
        }
        emit_chord(CaptureChord {
            escape: false,
            keys: chord,
        });
    }

    unsafe extern "C" fn tap_callback(
        _proxy: CGEventTapProxy,
        etype: u32,
        event: CGEventRef,
        _user: *mut c_void,
    ) -> CGEventRef {
        if CAPTURE_ACTIVE.load(Ordering::SeqCst) {
            let combo = COMBO_TRIGGER_CAPTURE.load(Ordering::SeqCst);
            if etype == KEY_UP {
                if combo {
                    let code =
                        unsafe { CGEventGetIntegerValueField(event, KEYBOARD_EVENT_KEYCODE) }
                            as u16;
                    note_key_up(code);
                    emit_combo_preview();
                }
                return std::ptr::null_mut();
            }
            if etype == FLAGS_CHANGED {
                sync_mods_from_flags(event);
                emit_combo_preview();
                return std::ptr::null_mut();
            }
            if etype == KEY_DOWN {
                let autorepeat =
                    unsafe { CGEventGetIntegerValueField(event, KEYBOARD_EVENT_AUTOREPEAT) } != 0;
                if !autorepeat {
                    if let Some(chord) = chord_from_event(event) {
                        if chord.escape {
                            if combo {
                                app_bus::emit(
                                    "combo-trigger-capture",
                                    ComboTriggerCapture {
                                        escape: true,
                                        rejected: None,
                                        combo: None,
                                    },
                                );
                            } else {
                                emit_chord(chord);
                            }
                            return std::ptr::null_mut();
                        }
                        if combo {
                            sync_from_chord(&chord.keys);
                        }
                        emit_chord(chord);
                    } else if combo {
                        sync_mods_from_flags(event);
                        emit_combo_preview();
                    }
                }
                return std::ptr::null_mut();
            }
            return event;
        }

        if ACTIVATOR_CAPTURE.load(Ordering::SeqCst) && !COMBO_TRIGGER_CAPTURE.load(Ordering::SeqCst) {
            return handle_activator_capture(etype, event);
        }

        handle_watch(etype, event)
    }

    fn handle_activator_capture(etype: u32, event: CGEventRef) -> CGEventRef {
        if etype == KEY_DOWN {
            let autorepeat =
                unsafe { CGEventGetIntegerValueField(event, KEYBOARD_EVENT_AUTOREPEAT) } != 0;
            if autorepeat {
                return std::ptr::null_mut();
            }
            if let Some(activator) = key_activator(event) {
                if matches!(&activator, Activator::Key { name } if name == "Escape") {
                    emit_activator(ActivatorCapture {
                        escape: true,
                        rejected: None,
                        activator: None,
                    });
                } else {
                    emit_activator_choice(activator);
                }
            }
            return std::ptr::null_mut();
        }
        if etype == KEY_UP {
            return std::ptr::null_mut();
        }
        if etype == FLAGS_CHANGED {
            if let Some((activator, down)) = modifier_down(event) {
                if down {
                    emit_activator_choice(activator);
                }
            }
            return std::ptr::null_mut();
        }
        if let Some((activator, down)) = ball_scroll::mouse_from_event(
            etype,
            unsafe { CGEventGetIntegerValueField(event, MOUSE_EVENT_BUTTON_NUMBER) },
        ) {
            if activator.is_left_click() {
                if down {
                    emit_activator_choice(activator);
                }
                return event;
            }
            if down {
                emit_activator_choice(activator);
            }
            return std::ptr::null_mut();
        }
        event
    }

    fn handle_watch(etype: u32, event: CGEventRef) -> CGEventRef {
        if etype == KEY_DOWN {
            let autorepeat =
                unsafe { CGEventGetIntegerValueField(event, KEYBOARD_EVENT_AUTOREPEAT) } != 0;
            if let Some(activator) = key_activator(event) {
                custom_mapping::note_os_down(&activator, autorepeat);
                if ball_scroll::on_os_down(&activator, autorepeat) {
                    return std::ptr::null_mut();
                }
            }
            return event;
        }
        if etype == KEY_UP {
            let autorepeat =
                unsafe { CGEventGetIntegerValueField(event, KEYBOARD_EVENT_AUTOREPEAT) } != 0;
            if let Some(activator) = key_activator(event) {
                custom_mapping::note_os_up(&activator, autorepeat);
                if ball_scroll::on_os_up(&activator, autorepeat) {
                    return std::ptr::null_mut();
                }
            }
            return event;
        }
        if etype == FLAGS_CHANGED {
            if let Some((activator, down)) = modifier_down(event) {
                if down {
                    custom_mapping::note_os_down(&activator, false);
                } else {
                    custom_mapping::note_os_up(&activator, false);
                }
                let handled = if down {
                    ball_scroll::on_os_down(&activator, false)
                } else {
                    ball_scroll::on_os_up(&activator, false)
                };
                if handled {
                    return std::ptr::null_mut();
                }
            }
            return event;
        }
        if let Some((activator, down)) = ball_scroll::mouse_from_event(
            etype,
            unsafe { CGEventGetIntegerValueField(event, MOUSE_EVENT_BUTTON_NUMBER) },
        ) {
            let handled = if down {
                ball_scroll::on_os_down(&activator, false)
            } else {
                ball_scroll::on_os_up(&activator, false)
            };
            if handled {
                return std::ptr::null_mut();
            }
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
                let events = mask_bit(KEY_DOWN)
                    | mask_bit(KEY_UP)
                    | mask_bit(FLAGS_CHANGED)
                    | mask_bit(LEFT_DOWN)
                    | mask_bit(LEFT_UP)
                    | mask_bit(RIGHT_DOWN)
                    | mask_bit(RIGHT_UP)
                    | mask_bit(OTHER_DOWN)
                    | mask_bit(OTHER_UP);
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
