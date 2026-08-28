use std::ffi::c_void;
use std::os::raw::c_ulonglong;

use crate::domain::profile::Activator;

use super::super::types::CaptureChord;

pub(crate) type CGEventRef = *mut c_void;
pub(crate) type CGEventTapProxy = *mut c_void;
pub(crate) type CGEventMask = c_ulonglong;

pub(crate) const KEY_DOWN: u32 = 10;
pub(crate) const KEY_UP: u32 = 11;
pub(crate) const FLAGS_CHANGED: u32 = 12;
pub(crate) const LEFT_DOWN: u32 = 1;
pub(crate) const LEFT_UP: u32 = 2;
pub(crate) const RIGHT_DOWN: u32 = 3;
pub(crate) const RIGHT_UP: u32 = 4;
pub(crate) const OTHER_DOWN: u32 = 25;
pub(crate) const OTHER_UP: u32 = 26;

pub(crate) const KEYBOARD_EVENT_KEYCODE: u32 = 9;
pub(crate) const KEYBOARD_EVENT_AUTOREPEAT: u32 = 8;
pub(crate) const MOUSE_EVENT_BUTTON_NUMBER: u32 = 3;

pub(crate) const FLAG_COMMAND: u64 = 0x0010_0000;
pub(crate) const FLAG_SHIFT: u64 = 0x0002_0000;
pub(crate) const FLAG_CONTROL: u64 = 0x0004_0000;
pub(crate) const FLAG_OPTION: u64 = 0x0008_0000;

#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
    pub(crate) fn CGEventGetIntegerValueField(event: CGEventRef, field: u32) -> i64;
    pub(crate) fn CGEventGetFlags(event: CGEventRef) -> u64;
    pub(crate) fn CGEventSourceFlagsState(stateID: i32) -> u64;
}

pub(crate) fn mask_bit(t: u32) -> CGEventMask {
    1u64 << t
}

pub(crate) fn keycode_name(code: u16) -> Option<&'static str> {
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
        0x69 => "F13",
        0x6b => "F14",
        0x71 => "F15",
        0x6a => "F16",
        0x40 => "F17",
        0x4f => "F18",
        0x50 => "F19",
        0x37 | 0x36 | 0x3a | 0x3d | 0x3b | 0x3e | 0x38 | 0x3c => return None,
        _ => return None,
    })
}

pub(crate) fn key_activator_name(code: u16) -> String {
    keycode_name(code)
        .map(str::to_string)
        .unwrap_or_else(|| format!("keycode_{code}"))
}

pub(crate) fn modifier_name(code: u16) -> Option<(&'static str, u64)> {
    Some(match code {
        0x38 | 0x3c => ("Shift", FLAG_SHIFT),
        0x3b | 0x3e => ("Control", FLAG_CONTROL),
        0x3a | 0x3d => ("Option", FLAG_OPTION),
        0x37 | 0x36 => ("Meta", FLAG_COMMAND),
        _ => return None,
    })
}

pub(crate) fn chord_from_event(event: CGEventRef) -> Option<CaptureChord> {
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

pub(crate) fn key_activator(event: CGEventRef) -> Option<Activator> {
    let code = unsafe { CGEventGetIntegerValueField(event, KEYBOARD_EVENT_KEYCODE) } as u16;
    Some(Activator::Key {
        name: key_activator_name(code),
    })
}

pub(crate) fn modifier_down(event: CGEventRef) -> Option<(Activator, bool)> {
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
