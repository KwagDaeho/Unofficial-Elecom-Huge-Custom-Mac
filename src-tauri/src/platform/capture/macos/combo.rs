use std::collections::HashSet;
use std::sync::LazyLock;

use parking_lot::Mutex;

use super::keycodes::{
    CGEventRef, CGEventGetFlags, CGEventSourceFlagsState, FLAG_COMMAND, FLAG_CONTROL, FLAG_OPTION,
    FLAG_SHIFT,
};
use super::super::emit::emit_chord;
use super::super::types::CaptureChord;

static HELD_MODS: LazyLock<Mutex<HashSet<String>>> =
    LazyLock::new(|| Mutex::new(HashSet::new()));
static HELD_KEYS: LazyLock<Mutex<HashSet<String>>> =
    LazyLock::new(|| Mutex::new(HashSet::new()));

const MODIFIER_ORDER: [&str; 4] = ["Control", "Option", "Shift", "Meta"];

pub fn clear_combo_held() {
    HELD_MODS.lock().clear();
    HELD_KEYS.lock().clear();
}

pub fn combo_held_parts() -> (Vec<String>, Vec<String>) {
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

pub(crate) fn sync_mods_from_flags(event: CGEventRef) {
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

pub(crate) fn sync_from_chord(keys: &[String]) {
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

pub(crate) fn note_key_up(code: u16) {
    use super::keycodes::{keycode_name, modifier_name};
    if let Some((name, _)) = modifier_name(code) {
        HELD_MODS.lock().remove(name);
    } else if let Some(name) = keycode_name(code) {
        HELD_KEYS.lock().remove(name);
    }
}

pub(crate) fn emit_combo_preview() {
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
