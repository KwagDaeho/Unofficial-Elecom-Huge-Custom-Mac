use std::collections::{HashMap, HashSet};
use std::sync::atomic::Ordering;
use std::time::{Duration, Instant};

use crate::domain::device::{ButtonId, ButtonState};
use crate::domain::engine::input::{
    apply_binding_press, apply_binding_release, cancel_regular_binding,
    fire_due_key_repeats_for, take_due_scroll_repeats_for,
    ActionRepeat, PendingHold, ScrollRepeat,
};
use crate::domain::profile::{Action, ButtonBinding, Profile};
use crate::domain::remap;
use crate::platform::inject;

use super::chord::{find_match, release_active_chord};
use super::state::entry_by_id;
use super::state::{
    self, effective_sorted_modifiers, sync_active_buttons, ACTIVE_BUTTONS, CHORD_REEVAL,
};

pub struct CustomMaps {
    pub pending: HashMap<String, PendingHold>,
    pub held: HashMap<String, Action>,
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

fn fire_custom_press(
    entry_id: String,
    button: ButtonId,
    binding: &ButtonBinding,
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

fn reconcile_held_chords(
    state: ButtonState,
    profile: &Profile,
    maps: &mut CustomMaps,
    pending: &mut HashMap<ButtonId, PendingHold>,
    held: &mut HashMap<ButtonId, Action>,
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
        if state::uses_os_watch() {
            super::chord::note_os_button_swallowed(id);
        }
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
    held: &mut HashMap<ButtonId, Action>,
    scroll_repeats: &mut HashMap<ButtonId, ScrollRepeat>,
    key_repeats: &mut HashMap<ButtonId, ActionRepeat>,
) -> HashSet<ButtonId> {
    let mut skip_press = HashSet::new();
    if !state::uses_os_watch() {
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
    held: &mut HashMap<ButtonId, Action>,
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
        if state::uses_os_watch() {
            super::chord::note_os_button_swallowed(id);
        }
        fire_custom_press(entry.id, id, &entry.binding, profile, maps);
    }

    sync_active_buttons(&maps.active);

    (skip_release, skip_press)
}

pub fn fire_due_ticks(maps: &mut CustomMaps, profile: &Profile, threshold: Duration) {
    let now = Instant::now();
    let due: Vec<(String, Action)> = maps
        .pending
        .iter_mut()
        .filter_map(|(entry_id, hold)| {
            if hold.long_fired || now.duration_since(hold.started) < threshold {
                return None;
            }
            hold.long_fired = true;
            if hold.long_press.is_noop() {
                return None;
            }
            let button = entry_by_id(entry_id)
                .map(|e| e.activator.button)
                .unwrap_or(ButtonId::Left);
            let mods = super::state::effective_sorted_modifiers();
            inject::with_chord_action(&mods, || {
                inject::press_action(button, &hold.long_press, &profile.pointer);
            });
            Some((entry_id.clone(), hold.long_press.clone()))
        })
        .collect();
    for (entry_id, action) in due {
        maps.held.insert(entry_id, action);
    }
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
    for entry in state::entries().iter() {
        let id = entry.activator.button;
        if !down.is_down(id) {
            continue;
        }
        if maps.active.contains_key(&id) {
            let b = &entry.binding;
            if b.uses_auto_click()
                || b.waits_for_long_press()
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

fn action_needs_pointer_takeover(id: ButtonId, action: &Action) -> bool {
    if is_physical_mouse_button(id) {
        return !remap::action_is_native_for(id, action);
    }
    matches!(
        action,
        Action::MouseClick { .. } | Action::DoubleClick | Action::Scroll { .. }
    )
}
