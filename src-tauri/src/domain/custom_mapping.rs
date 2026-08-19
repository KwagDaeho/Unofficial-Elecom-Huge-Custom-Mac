//! Modifier/key + HUGE button combos with the same binding rules as normal buttons.

use std::collections::{HashMap, HashSet};
use std::sync::LazyLock;
use std::time::Duration;

use parking_lot::Mutex;

use crate::domain::device::{ButtonId, ButtonState};
use crate::domain::engine::input::{
    apply_binding_press, apply_binding_release, fire_due_key_repeats_for,
    fire_due_long_presses_for, take_due_scroll_repeats_for, ActionRepeat, PendingHold,
    ScrollRepeat,
};
use crate::domain::profile::{Activator, ComboActivator, CustomMappingEntry, Profile};
use crate::domain::remap;
use crate::platform::inject;

const MODIFIER_ORDER: [&str; 4] = ["Control", "Option", "Shift", "Meta"];

static ENTRIES: Mutex<Vec<CustomMappingEntry>> = Mutex::new(Vec::new());
static MODIFIERS_HELD: LazyLock<Mutex<HashSet<String>>> =
    LazyLock::new(|| Mutex::new(HashSet::new()));
static KEYS_HELD: LazyLock<Mutex<HashSet<String>>> =
    LazyLock::new(|| Mutex::new(HashSet::new()));
static ACTIVE_BUTTONS: LazyLock<Mutex<HashSet<ButtonId>>> =
    LazyLock::new(|| Mutex::new(HashSet::new()));

pub struct CustomMaps {
    pub pending: HashMap<String, PendingHold>,
    pub held: HashMap<String, crate::domain::profile::Action>,
    pub scroll_repeats: HashMap<String, ScrollRepeat>,
    pub key_repeats: HashMap<String, ActionRepeat>,
    /// Physical HUGE button → active custom entry id.
    pub active: HashMap<ButtonId, String>,
}

impl Default for CustomMaps {
    fn default() -> Self {
        Self {
            pending: HashMap::new(),
            held: HashMap::new(),
            scroll_repeats: HashMap::new(),
            key_repeats: HashMap::new(),
            active: HashMap::new(),
        }
    }
}

impl CustomMaps {
    pub fn clear(&mut self) {
        for (id, action) in self.held.drain() {
            if let Some(entry) = entry_by_id(&id) {
                inject::release_action(entry.activator.button, &action);
            }
        }
        self.pending.clear();
        self.scroll_repeats.clear();
        self.key_repeats.clear();
        self.active.clear();
        ACTIVE_BUTTONS.lock().clear();
    }
}

pub fn sync_from_profile(profile: &Profile) {
    let next = if profile.enabled {
        profile
            .custom_mappings
            .iter()
            .filter(|e| e.activator.is_valid())
            .cloned()
            .collect()
    } else {
        Vec::new()
    };
    *ENTRIES.lock() = next;
    if !uses_os_watch() {
        MODIFIERS_HELD.lock().clear();
        KEYS_HELD.lock().clear();
    }
    ACTIVE_BUTTONS.lock().clear();
}

pub fn uses_os_watch() -> bool {
    ENTRIES.lock().iter().any(|e| {
        !e.activator.modifiers.is_empty() || !e.activator.keys.is_empty()
    })
}

pub fn is_reserved_huge(id: ButtonId) -> bool {
    if ACTIVE_BUTTONS.lock().contains(&id) {
        return true;
    }
    if ENTRIES.lock().is_empty() {
        return false;
    }
    chord_matches_any(id)
}

fn chord_matches_any(id: ButtonId) -> bool {
    let mods = sorted_modifiers(&MODIFIERS_HELD.lock());
    let keys = sorted_keys(&KEYS_HELD.lock());
    ENTRIES
        .lock()
        .iter()
        .any(|e| e.activator.button == id && combo_matches(&e.activator, &mods, &keys))
}

fn entry_by_id(id: &str) -> Option<CustomMappingEntry> {
    ENTRIES.lock().iter().find(|e| e.id == id).cloned()
}

fn find_match(id: ButtonId) -> Option<CustomMappingEntry> {
    let mods = sorted_modifiers(&MODIFIERS_HELD.lock());
    let keys = sorted_keys(&KEYS_HELD.lock());
    ENTRIES
        .lock()
        .iter()
        .find(|e| e.activator.button == id && combo_matches(&e.activator, &mods, &keys))
        .cloned()
}

fn sorted_modifiers(set: &HashSet<String>) -> Vec<String> {
    MODIFIER_ORDER
        .iter()
        .filter(|m| set.contains(**m))
        .map(|s| (*s).to_string())
        .collect()
}

fn sorted_keys(set: &HashSet<String>) -> Vec<String> {
    let mut keys: Vec<String> = set.iter().cloned().collect();
    keys.sort();
    keys
}

fn normalize_combo_modifiers(v: &[String]) -> Vec<String> {
    MODIFIER_ORDER
        .iter()
        .filter(|m| v.iter().any(|x| x == *m))
        .map(|s| (*s).to_string())
        .collect()
}

fn normalize_combo_keys(v: &[String]) -> Vec<String> {
    let mut keys = v.to_vec();
    keys.sort();
    keys
}

fn combo_matches(combo: &ComboActivator, mods: &[String], keys: &[String]) -> bool {
    normalize_combo_modifiers(&combo.modifiers) == *mods
        && normalize_combo_keys(&combo.keys) == *keys
}

fn is_modifier(name: &str) -> bool {
    MODIFIER_ORDER.contains(&name)
}

pub fn note_os_down(activator: &Activator, is_repeat: bool) {
    if is_repeat || !uses_os_watch() {
        return;
    }
    match activator {
        Activator::Key { name } => {
            if is_modifier(name) {
                MODIFIERS_HELD.lock().insert(name.clone());
            } else {
                KEYS_HELD.lock().insert(name.clone());
            }
        }
        _ => {}
    }
}

pub fn note_os_up(activator: &Activator, is_repeat: bool) {
    if is_repeat || !uses_os_watch() {
        return;
    }
    match activator {
        Activator::Key { name } => {
            if is_modifier(name) {
                MODIFIERS_HELD.lock().remove(name);
            } else {
                KEYS_HELD.lock().remove(name);
            }
        }
        _ => {}
    }
}

pub fn handle_transitions(
    prev: ButtonState,
    state: ButtonState,
    profile: &Profile,
    maps: &mut CustomMaps,
) -> (HashSet<ButtonId>, HashSet<ButtonId>) {
    let mut skip_release = HashSet::new();
    let mut skip_press = HashSet::new();

    for id in state.released_edges(prev) {
        let Some(entry_id) = maps.active.remove(&id) else {
            continue;
        };
        skip_release.insert(id);
        ACTIVE_BUTTONS.lock().remove(&id);
        apply_binding_release(
            entry_id,
            id,
            profile,
            &mut maps.pending,
            &mut maps.held,
            &mut maps.scroll_repeats,
            &mut maps.key_repeats,
        );
    }

    for id in state.pressed_edges(prev) {
        let Some(entry) = find_match(id) else {
            continue;
        };
        skip_press.insert(id);
        maps.active.insert(id, entry.id.clone());
        ACTIVE_BUTTONS.lock().insert(id);
        apply_binding_press(
            entry.id,
            id,
            &entry.binding,
            profile,
            &mut maps.pending,
            &mut maps.held,
            &mut maps.scroll_repeats,
            &mut maps.key_repeats,
        );
    }

    (skip_release, skip_press)
}

pub fn fire_due_ticks(maps: &mut CustomMaps, profile: &Profile, threshold: Duration) {
    fire_due_long_presses_for(
        &mut maps.pending,
        &mut maps.held,
        &profile.pointer,
        threshold,
        |entry_id| {
            entry_by_id(entry_id)
                .map(|e| e.activator.button)
                .unwrap_or(ButtonId::Left)
        },
    );
    let (dx, dy) = take_due_scroll_repeats_for(&mut maps.scroll_repeats);
    if dx != 0 || dy != 0 {
        inject::scroll_by_units_ex(dx, dy, &profile.pointer, true);
    }
    fire_due_key_repeats_for(
        &mut maps.key_repeats,
        &profile.pointer,
        |entry_id| {
            entry_by_id(entry_id)
                .map(|e| e.activator.button)
                .unwrap_or(ButtonId::Left)
        },
    );
}

pub fn pointer_takeover_active(maps: &CustomMaps, down: &ButtonState, profile: &Profile) -> bool {
    for (entry_id, action) in &maps.held {
        let Some(entry) = entry_by_id(entry_id) else {
            continue;
        };
        let id = entry.activator.button;
        if action_needs_pointer_takeover(id, action) {
            return true;
        }
    }
    for (entry_id, hold) in &maps.pending {
        let Some(entry) = entry_by_id(entry_id) else {
            continue;
        };
        let id = entry.activator.button;
        if is_physical_mouse_button(id)
            || action_needs_pointer_takeover(id, &hold.click)
            || (hold.long_fired && action_needs_pointer_takeover(id, &hold.long_press))
        {
            return true;
        }
    }
    for entry in ENTRIES.lock().iter() {
        let id = entry.activator.button;
        if !down.is_down(id) {
            continue;
        }
        if maps.active.contains_key(&id) {
            let b = &entry.binding;
            if b.uses_auto_click()
                || b.uses_long_press()
                || !remap::action_is_native_for(id, &b.click)
            {
                return true;
            }
        }
    }
    false
}

fn is_physical_mouse_button(id: ButtonId) -> bool {
    matches!(
        id,
        ButtonId::Left
            | ButtonId::Right
            | ButtonId::Middle
            | ButtonId::Back
            | ButtonId::Forward
    )
}

fn action_needs_pointer_takeover(id: ButtonId, action: &crate::domain::profile::Action) -> bool {
    if is_physical_mouse_button(id) {
        return !remap::action_is_native_for(id, action);
    }
    matches!(
        action,
        crate::domain::profile::Action::MouseClick { .. }
            | crate::domain::profile::Action::DoubleClick
            | crate::domain::profile::Action::Scroll { .. }
    )
}
