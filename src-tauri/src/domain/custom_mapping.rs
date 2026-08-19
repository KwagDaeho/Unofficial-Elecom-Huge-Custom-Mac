//! Modifier/key + HUGE button combos with the same binding rules as normal buttons.

use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::LazyLock;
use std::time::Duration;

use parking_lot::Mutex;

use crate::domain::device::{ButtonId, ButtonState};
use crate::domain::engine::input::{
    apply_binding_press, apply_binding_release, cancel_regular_binding,
    fire_due_key_repeats_for, fire_due_long_presses_for, take_due_scroll_repeats_for,
    ActionRepeat, PendingHold, ScrollRepeat,
};
use crate::domain::profile::{Activator, ComboActivator, CustomMappingEntry, Profile};
use crate::domain::remap;
use crate::platform::inject;

const MODIFIER_ORDER: [&str; 4] = ["Control", "Option", "Shift", "Meta"];

const FLAG_CONTROL: u64 = 0x0004_0000;
const FLAG_OPTION: u64 = 0x0008_0000;
const FLAG_SHIFT: u64 = 0x0002_0000;
const FLAG_COMMAND: u64 = 0x0010_0000;

#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
    fn CGEventSourceFlagsState(state_id: u32) -> u64;
}

static ENTRIES: Mutex<Vec<CustomMappingEntry>> = Mutex::new(Vec::new());
static MODIFIERS_HELD: LazyLock<Mutex<HashSet<String>>> =
    LazyLock::new(|| Mutex::new(HashSet::new()));
static KEYS_HELD: LazyLock<Mutex<HashSet<String>>> =
    LazyLock::new(|| Mutex::new(HashSet::new()));
static ACTIVE_BUTTONS: LazyLock<Mutex<HashSet<ButtonId>>> =
    LazyLock::new(|| Mutex::new(HashSet::new()));
static BUTTON_STATE: LazyLock<Mutex<ButtonState>> =
    LazyLock::new(|| Mutex::new(ButtonState::default()));
static CHORD_REEVAL: AtomicBool = AtomicBool::new(false);
static SWALLOWED_OS_BUTTONS: LazyLock<Mutex<HashSet<ButtonId>>> =
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
}

pub fn sync_button_state(state: ButtonState) {
    *BUTTON_STATE.lock() = state;
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
    ENTRIES.lock().iter().any(|entry| {
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

fn release_active_chord() {
    let mut mods: HashSet<String> = MODIFIERS_HELD.lock().clone();
    mods.extend(live_modifiers());
    let keys: Vec<String> = KEYS_HELD.lock().iter().cloned().collect();
    let mod_vec = sorted_modifiers(&mods);
    if mod_vec.is_empty() && keys.is_empty() {
        return;
    }
    inject::release_chord_hold(&mod_vec, &keys);
    MODIFIERS_HELD.lock().clear();
    KEYS_HELD.lock().clear();
}

fn fire_custom_press(
    entry_id: String,
    button: ButtonId,
    binding: &crate::domain::profile::ButtonBinding,
    profile: &Profile,
    maps: &mut CustomMaps,
) {
    let mods = effective_sorted_modifiers();
    inject::with_chord_action(&mods, || {
        release_active_chord();
        apply_binding_press(
            entry_id,
            button,
            binding,
            profile,
            &mut maps.pending,
            &mut maps.held,
            &mut maps.scroll_repeats,
            &mut maps.key_repeats,
        );
    });
}

fn chord_matches_any(id: ButtonId) -> bool {
    let mods = effective_sorted_modifiers();
    let keys = effective_sorted_keys();
    ENTRIES
        .lock()
        .iter()
        .any(|e| e.activator.button == id && combo_matches(&e.activator, &mods, &keys))
}

fn find_match_with_flags(id: ButtonId, event_flags: u64) -> Option<CustomMappingEntry> {
    let mods = sorted_modifiers(&modifiers_from_flags(event_flags));
    let keys = effective_sorted_keys();
    ENTRIES
        .lock()
        .iter()
        .find(|e| e.activator.button == id && combo_matches(&e.activator, &mods, &keys))
        .cloned()
}

fn modifiers_from_flags(flags: u64) -> HashSet<String> {
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
    if !uses_os_watch() {
        return false;
    }
    if down {
        if find_match_with_flags(id, event_flags).is_some() {
            return true;
        }
        return false;
    }
    SWALLOWED_OS_BUTTONS.lock().contains(&id) || ACTIVE_BUTTONS.lock().contains(&id)
}

fn find_match(id: ButtonId) -> Option<CustomMappingEntry> {
    let mods = effective_sorted_modifiers();
    let keys = effective_sorted_keys();
    ENTRIES
        .lock()
        .iter()
        .find(|e| e.activator.button == id && combo_matches(&e.activator, &mods, &keys))
        .cloned()
}

fn live_modifiers() -> HashSet<String> {
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

fn effective_modifiers() -> HashSet<String> {
    let mut merged = MODIFIERS_HELD.lock().clone();
    merged.extend(live_modifiers());
    merged
}

fn effective_keys() -> HashSet<String> {
    KEYS_HELD.lock().clone()
}

fn effective_sorted_modifiers() -> Vec<String> {
    sorted_modifiers(&effective_modifiers())
}

fn effective_sorted_keys() -> Vec<String> {
    sorted_keys(&effective_keys())
}

fn entry_by_id(id: &str) -> Option<CustomMappingEntry> {
    ENTRIES.lock().iter().find(|e| e.id == id).cloned()
}

fn request_chord_reeval() {
    CHORD_REEVAL.store(true, Ordering::SeqCst);
}

fn sync_active_buttons(maps: &CustomMaps) {
    let mut active = ACTIVE_BUTTONS.lock();
    active.clear();
    active.extend(maps.active.keys().copied());
}

/// Swallow OS key events that complete an active custom chord while the HUGE
/// button is held — prevents cmd+R etc. from reaching foreground apps.
pub fn should_swallow_os_key(name: &str) -> bool {
    if !uses_os_watch() {
        return false;
    }
    let active = ACTIVE_BUTTONS.lock();
    if active.iter().any(|button| {
        ENTRIES.lock().iter().any(|entry| {
            entry.activator.button == *button
                && entry.activator.keys.iter().any(|k| k == name)
        })
    }) {
        return true;
    }
    drop(active);
    let mods = effective_sorted_modifiers();
    if !mods.is_empty() {
        let matches_prefix = ENTRIES.lock().iter().any(|entry| {
            if !entry.activator.keys.iter().any(|k| k == name) {
                return false;
            }
            normalize_combo_modifiers(&entry.activator.modifiers) == mods
        });
        if matches_prefix {
            return true;
        }
    }
    let state = *BUTTON_STATE.lock();
    let keys = effective_sorted_keys();
    ENTRIES.lock().iter().any(|entry| {
        if !entry.activator.keys.iter().any(|k| k == name) {
            return false;
        }
        if !state.is_down(entry.activator.button) {
            return false;
        }
        combo_matches(&entry.activator, &mods, &keys)
    })
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
    request_chord_reeval();
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
    request_chord_reeval();
}

fn reconcile_held_chords(
    state: ButtonState,
    profile: &Profile,
    maps: &mut CustomMaps,
    pending: &mut HashMap<ButtonId, PendingHold>,
    held: &mut HashMap<ButtonId, crate::domain::profile::Action>,
    scroll_repeats: &mut HashMap<ButtonId, ScrollRepeat>,
    key_repeats: &mut HashMap<ButtonId, ActionRepeat>,
    skip_press: &mut HashSet<ButtonId>,
) {
    for id in ButtonId::ALL {
        if !state.is_down(id) {
            continue;
        }
        let Some(entry) = find_match(id) else {
            continue;
        };
        skip_press.insert(id);
        if maps.active.contains_key(&id) {
            continue;
        }
        cancel_regular_binding(id, profile, pending, held, scroll_repeats, key_repeats);
        maps.active.insert(id, entry.id.clone());
        ACTIVE_BUTTONS.lock().insert(id);
        fire_custom_press(
            entry.id.clone(),
            id,
            &entry.binding,
            profile,
            maps,
        );
    }
}

pub fn maintain_chords(
    state: ButtonState,
    profile: &Profile,
    maps: &mut CustomMaps,
    pending: &mut HashMap<ButtonId, PendingHold>,
    held: &mut HashMap<ButtonId, crate::domain::profile::Action>,
    scroll_repeats: &mut HashMap<ButtonId, ScrollRepeat>,
    key_repeats: &mut HashMap<ButtonId, ActionRepeat>,
) -> HashSet<ButtonId> {
    let mut skip_press = HashSet::new();
    if !uses_os_watch() {
        CHORD_REEVAL.store(false, Ordering::SeqCst);
        return skip_press;
    }
    reconcile_held_chords(
        state,
        profile,
        maps,
        pending,
        held,
        scroll_repeats,
        key_repeats,
        &mut skip_press,
    );
    CHORD_REEVAL.store(false, Ordering::SeqCst);
    skip_press
}

pub fn handle_transitions(
    prev: ButtonState,
    state: ButtonState,
    profile: &Profile,
    maps: &mut CustomMaps,
    pending: &mut HashMap<ButtonId, PendingHold>,
    held: &mut HashMap<ButtonId, crate::domain::profile::Action>,
    scroll_repeats: &mut HashMap<ButtonId, ScrollRepeat>,
    key_repeats: &mut HashMap<ButtonId, ActionRepeat>,
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
        if maps.active.contains_key(&id) {
            skip_press.insert(id);
            continue;
        }
        let Some(entry) = find_match(id) else {
            continue;
        };
        skip_press.insert(id);
        maps.active.insert(id, entry.id.clone());
        ACTIVE_BUTTONS.lock().insert(id);
        fire_custom_press(entry.id, id, &entry.binding, profile, maps);
    }

    sync_active_buttons(maps);

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
