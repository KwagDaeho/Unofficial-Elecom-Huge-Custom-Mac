use std::collections::HashSet;

use crate::domain::device::ButtonId;
use crate::domain::profile::{Activator, ComboActivator, CustomMappingEntry};
use crate::platform::inject;

use super::state::{
    self, effective_sorted_keys, effective_sorted_modifiers, entry_by_id, is_modifier,
    modifiers_from_flags, normalize_combo_keys, normalize_combo_modifiers, request_chord_reeval,
    sorted_modifiers, ACTIVE_BUTTONS, SWALLOWED_OS_BUTTONS,
};

pub(crate) fn combo_matches(combo: &ComboActivator, mods: &[String], keys: &[String]) -> bool {
    normalize_combo_modifiers(&combo.modifiers) == *mods
        && normalize_combo_keys(&combo.keys) == *keys
}

pub(crate) fn find_match(id: ButtonId) -> Option<CustomMappingEntry> {
    let mods = effective_sorted_modifiers();
    let keys = effective_sorted_keys();
    state::entries()
        .iter()
        .find(|e| e.activator.button == id && combo_matches(&e.activator, &mods, &keys))
        .cloned()
}

pub(crate) fn find_match_with_flags(id: ButtonId, event_flags: u64) -> Option<CustomMappingEntry> {
    let mods = sorted_modifiers(&modifiers_from_flags(event_flags));
    let keys = effective_sorted_keys();
    state::entries()
        .iter()
        .find(|e| e.activator.button == id && combo_matches(&e.activator, &mods, &keys))
        .cloned()
}

fn chord_matches_any(id: ButtonId) -> bool {
    let mods = effective_sorted_modifiers();
    let keys = effective_sorted_keys();
    state::entries()
        .iter()
        .any(|e| e.activator.button == id && combo_matches(&e.activator, &mods, &keys))
}

pub fn is_reserved_huge(id: ButtonId) -> bool {
    if ACTIVE_BUTTONS.lock().contains(&id) {
        return true;
    }
    if state::entries().is_empty() {
        return false;
    }
    if chord_matches_any(id) {
        return true;
    }
    chord_ready_for_button(id)
}

/// Modifiers + chord keys satisfied; waiting for or during HUGE button press.
fn chord_ready_for_button(id: ButtonId) -> bool {
    let mods = effective_sorted_modifiers();
    if mods.is_empty() {
        return false;
    }
    let keys = effective_sorted_keys();
    state::entries().iter().any(|entry| {
        if entry.activator.button != id {
            return false;
        }
        if normalize_combo_modifiers(&entry.activator.modifiers) != mods {
            return false;
        }
        let entry_keys = normalize_combo_keys(&entry.activator.keys);
        entry_keys.iter().all(|key| keys.contains(key))
    })
}

pub(crate) fn release_active_chord() {
    let mut mods: HashSet<String> = state::modifiers_held().clone();
    mods.extend(state::live_modifiers());
    let keys: Vec<String> = state::keys_held().iter().cloned().collect();
    let mod_vec = sorted_modifiers(&mods);
    if mod_vec.is_empty() && keys.is_empty() {
        return;
    }
    inject::release_chord_hold(&mod_vec, &keys);
    state::modifiers_held().clear();
    state::keys_held().clear();
}

/// Map CG mouse edge → HUGE button (shared-pointer OS events).
pub fn button_edge_from_event(etype: u32, button_number: i64) -> Option<(ButtonId, bool)> {
    match etype {
        1 => Some((ButtonId::Left, true)),
        2 => Some((ButtonId::Left, false)),
        3 => Some((ButtonId::Right, true)),
        4 => Some((ButtonId::Right, false)),
        25 => match button_number {
            2 => Some((ButtonId::Middle, true)),
            3 => Some((ButtonId::Back, true)),
            4 => Some((ButtonId::Forward, true)),
            _ => None,
        },
        26 => match button_number {
            2 => Some((ButtonId::Middle, false)),
            3 => Some((ButtonId::Back, false)),
            4 => Some((ButtonId::Forward, false)),
            _ => None,
        },
        _ => None,
    }
}

pub fn note_os_button_swallowed(id: ButtonId) {
    SWALLOWED_OS_BUTTONS.lock().insert(id);
}

pub fn note_os_button_released(id: ButtonId) {
    SWALLOWED_OS_BUTTONS.lock().remove(&id);
}

/// Drop OS mouse events for an active or matching custom chord before the HID worker runs.
pub fn should_swallow_os_button(id: ButtonId, event_flags: u64, down: bool) -> bool {
    if !state::uses_os_watch() {
        return false;
    }
    if down {
        if find_match_with_flags(id, event_flags).is_some() || find_match(id).is_some() {
            return true;
        }
        // Shift (etc.) may live in keyboard state while the mouse event flags omit it.
        if is_reserved_huge(id) {
            return true;
        }
        return false;
    }
    SWALLOWED_OS_BUTTONS.lock().contains(&id) || ACTIVE_BUTTONS.lock().contains(&id)
}

/// Swallow OS key events that complete an active custom chord while the HUGE
/// button is held — prevents cmd+R etc. from reaching foreground apps.
pub fn should_swallow_os_key(name: &str) -> bool {
    if !state::uses_os_watch() {
        return false;
    }
    let active = ACTIVE_BUTTONS.lock();
    if active.iter().any(|button| {
        state::entries().iter().any(|entry| {
            entry.activator.button == *button
                && entry.activator.keys.iter().any(|k| k == name)
        })
    }) {
        return true;
    }
    drop(active);
    let mods = effective_sorted_modifiers();
    if !mods.is_empty() {
        let matches_prefix = state::entries().iter().any(|entry| {
            if !entry.activator.keys.iter().any(|k| k == name) {
                return false;
            }
            normalize_combo_modifiers(&entry.activator.modifiers) == mods
        });
        if matches_prefix {
            return true;
        }
    }
    let button_state = *state::button_state();
    let keys = effective_sorted_keys();
    state::entries().iter().any(|entry| {
        if !entry.activator.keys.iter().any(|k| k == name) {
            return false;
        }
        if !button_state.is_down(entry.activator.button) {
            return false;
        }
        combo_matches(&entry.activator, &mods, &keys)
    })
}

pub fn note_os_down(activator: &Activator, is_repeat: bool) {
    if is_repeat || !state::uses_os_watch() {
        return;
    }
    match activator {
        Activator::Key { name } => {
            if is_modifier(name) {
                state::modifiers_held().insert(name.clone());
            } else {
                state::keys_held().insert(name.clone());
            }
        }
        _ => {}
    }
    request_chord_reeval();
}

pub fn note_os_up(activator: &Activator, is_repeat: bool) {
    if is_repeat || !state::uses_os_watch() {
        return;
    }
    match activator {
        Activator::Key { name } => {
            if is_modifier(name) {
                state::modifiers_held().remove(name);
            } else {
                state::keys_held().remove(name);
            }
        }
        _ => {}
    }
    request_chord_reeval();
}
