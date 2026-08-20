//! Button / timing policy helpers used by the HID worker.

mod tilt;

use std::collections::{HashMap, HashSet};
use std::hash::Hash;
use std::thread;
use std::time::{Duration, Instant};

use crate::domain::ball_scroll;
use crate::domain::custom_mapping;
use crate::domain::device::{ButtonId, ButtonState};
use crate::domain::profile::{Action, ButtonBinding, Profile};
use crate::domain::remap;
use crate::platform::inject;

pub(crate) use tilt::TiltHoldGate;

/// First hold tick is immediate; then pause before auto-repeat (key-repeat style).
const SCROLL_REPEAT_DELAY: Duration = Duration::from_millis(220);
const SCROLL_REPEAT_RATE: Duration = Duration::from_millis(40);
const KEY_REPEAT_DELAY: Duration = Duration::from_millis(400);
const KEY_REPEAT_RATE: Duration = Duration::from_millis(50);

pub(crate) struct PendingHold {
    pub started: Instant,
    pub click: Action,
    pub long_press: Action,
    pub long_fired: bool,
}

pub(crate) struct ScrollRepeat {
    pub dx: i32,
    pub dy: i32,
    pub next_at: Instant,
}

pub(crate) struct ActionRepeat {
    pub action: Action,
    pub next_at: Instant,
}

pub(crate) fn is_scroll_action(action: &Action) -> bool {
    matches!(action, Action::Scroll { .. })
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

/// Actions that leave a mouse button held until release_action.
fn action_needs_held_release(action: &Action) -> bool {
    matches!(action, Action::MouseClick { .. } | Action::Default)
}

/// One complete activation (tap). Mouse/Default get down→up; others are already pulses.
fn fire_action_pulse(
    id: ButtonId,
    action: &Action,
    pointer: &crate::domain::profile::PointerSettings,
) {
    fire_action_pulse_with(id, action, pointer, false);
}

/// Click after a long-press wait: OS down was already swallowed, and the
/// suppress bit is off because the physical button is up — still inject.
fn fire_deferred_click_pulse(
    id: ButtonId,
    action: &Action,
    pointer: &crate::domain::profile::PointerSettings,
) {
    fire_action_pulse_with(id, action, pointer, true);
}

fn fire_action_pulse_with(
    id: ButtonId,
    action: &Action,
    pointer: &crate::domain::profile::PointerSettings,
    force_synth: bool,
) {
    if force_synth {
        inject::press_action_forced(id, action, pointer);
    } else {
        inject::press_action(id, action, pointer);
    }
    if action_needs_held_release(action) {
        thread::sleep(Duration::from_millis(12));
        if force_synth {
            inject::release_action_forced(id, action);
        } else {
            inject::release_action(id, action);
        }
    }
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

fn physical_button_needs_takeover(id: ButtonId, profile: &Profile) -> bool {
    let b = binding_of(profile, id);
    b.uses_auto_click()
        || b.uses_long_press()
        || !remap::action_is_native_for(id, &b.click)
}

pub(crate) fn pointer_takeover_active(
    held: &HashMap<ButtonId, Action>,
    pending: &HashMap<ButtonId, PendingHold>,
    down: &ButtonState,
    profile: &Profile,
) -> bool {
    if inject::synthetic_buttons_held() {
        return true;
    }
    if held
        .iter()
        .any(|(id, a)| action_needs_pointer_takeover(*id, a))
    {
        return true;
    }
    if pending.iter().any(|(id, h)| {
        // While waiting for long-press we suppress OS *Dragged — move ourselves.
        is_physical_mouse_button(*id)
            || action_needs_pointer_takeover(*id, &h.click)
            || (h.long_fired && action_needs_pointer_takeover(*id, &h.long_press))
    }) {
        return true;
    }
    // Auto-click / remapped physical buttons: OS *Dragged is suppressed while held.
    [
        ButtonId::Left,
        ButtonId::Right,
        ButtonId::Middle,
        ButtonId::Back,
        ButtonId::Forward,
    ]
    .into_iter()
    .any(|id| down.is_down(id) && physical_button_needs_takeover(id, profile))
}

pub(crate) fn fire_due_long_presses(
    pending: &mut HashMap<ButtonId, PendingHold>,
    held: &mut HashMap<ButtonId, Action>,
    pointer: &crate::domain::profile::PointerSettings,
    threshold: Duration,
) {
    fire_due_long_presses_for(
        pending,
        held,
        pointer,
        threshold,
        |id| *id,
    );
}

pub(crate) fn fire_due_long_presses_for<K, F>(
    pending: &mut HashMap<K, PendingHold>,
    held: &mut HashMap<K, Action>,
    pointer: &crate::domain::profile::PointerSettings,
    threshold: Duration,
    inject_id: F,
) where
    K: Eq + Hash + Clone,
    F: Fn(&K) -> ButtonId,
{
    let now = Instant::now();
    let due: Vec<(K, Action)> = pending
        .iter_mut()
        .filter_map(|(key, hold)| {
            if hold.long_fired || now.duration_since(hold.started) < threshold {
                return None;
            }
            hold.long_fired = true;
            let id = inject_id(key);
            inject::press_action(id, &hold.long_press, pointer);
            Some((key.clone(), hold.long_press.clone()))
        })
        .collect();
    for (key, action) in due {
        held.insert(key, action);
    }
}

pub(crate) fn fire_due_key_repeats(
    repeats: &mut HashMap<ButtonId, ActionRepeat>,
    pointer: &crate::domain::profile::PointerSettings,
) {
    fire_due_key_repeats_for(repeats, pointer, |id| *id);
}

pub(crate) fn fire_due_key_repeats_for<K, F>(
    repeats: &mut HashMap<K, ActionRepeat>,
    pointer: &crate::domain::profile::PointerSettings,
    inject_id: F,
) where
    K: Eq + Hash,
    F: Fn(&K) -> ButtonId,
{
    let now = Instant::now();
    for (key, rep) in repeats.iter_mut() {
        if now < rep.next_at {
            continue;
        }
        fire_action_pulse(inject_id(key), &rep.action, pointer);
        rep.next_at = now + KEY_REPEAT_RATE;
    }
}

fn start_key_repeat(repeats: &mut HashMap<ButtonId, ActionRepeat>, id: ButtonId, action: &Action) {
    // Default is "noop" for long-press binding checks, but auto-click on OS-default
    // must still repeat (resolve to the native mouse button when possible).
    if matches!(action, Action::Disabled) || is_scroll_action(action) {
        return;
    }
    let action = match action {
        Action::Default => {
            if let Some(btn) = inject::default_mouse_button(id) {
                Action::MouseClick { button: btn }
            } else {
                return;
            }
        }
        other => other.clone(),
    };
    repeats.insert(
        id,
        ActionRepeat {
            action,
            next_at: Instant::now() + KEY_REPEAT_DELAY,
        },
    );
}

pub(crate) fn fire_due_scroll_repeats(
    repeats: &mut HashMap<ButtonId, ScrollRepeat>,
    pointer: &crate::domain::profile::PointerSettings,
) {
    let (dx, dy) = take_due_scroll_repeats(repeats);
    if dx != 0 || dy != 0 {
        // Continuous so hold-to-scroll isn't dropped beside trackpad/other vertical scrolls.
        inject::scroll_by_units_ex(dx, dy, pointer, true);
    }
}

pub(crate) fn take_due_scroll_repeats_for<K>(
    repeats: &mut HashMap<K, ScrollRepeat>,
) -> (i32, i32)
where
    K: Eq + Hash,
{
    let now = Instant::now();
    let mut dx = 0i32;
    let mut dy = 0i32;
    for rep in repeats.values_mut() {
        if now < rep.next_at {
            continue;
        }
        dx += rep.dx;
        dy += rep.dy;
        rep.next_at = now + SCROLL_REPEAT_RATE;
    }
    (dx, dy)
}

/// Accumulate due hold-repeat ticks (may be multiple buttons) without injecting yet,
/// so the engine can merge them with the same report's wheel/pan into one gesture.
pub(crate) fn take_due_scroll_repeats(repeats: &mut HashMap<ButtonId, ScrollRepeat>) -> (i32, i32) {
    take_due_scroll_repeats_for(repeats)
}

fn start_scroll_repeat(repeats: &mut HashMap<ButtonId, ScrollRepeat>, id: ButtonId, action: &Action) {
    if let Action::Scroll { dx, dy } = action {
        if *dx != 0 || *dy != 0 {
            repeats.insert(
                id,
                ScrollRepeat {
                    dx: *dx,
                    dy: *dy,
                    next_at: Instant::now() + SCROLL_REPEAT_DELAY,
                },
            );
        }
    }
}

pub(crate) fn binding_of(profile: &Profile, id: ButtonId) -> ButtonBinding {
    profile
        .buttons
        .get(&id)
        .cloned()
        .unwrap_or_else(|| ButtonBinding::from_click(Action::Default))
}

/// OS-default and catalog "Scroll left/right" on tilt share one path: stream
/// horizontal scroll from sticky HID pan while held (same feel either way).
pub(crate) fn tilt_uses_pan_stream(b: &ButtonBinding) -> bool {
    if b.uses_long_press() {
        return false;
    }
    match &b.click {
        Action::Default => true,
        Action::Scroll { dx, dy } if *dy == 0 && *dx != 0 => true,
        _ => false,
    }
}

pub(crate) fn tilt_pan_stream_dx_notches(b: &ButtonBinding, pan: i8) -> f64 {
    match &b.click {
        Action::Default => pan as f64,
        Action::Scroll { dx, .. } => {
            let sign = if *dx > 0 { 1.0 } else { -1.0 };
            sign * (pan.unsigned_abs() as f64)
        }
        _ => 0.0,
    }
}

pub(crate) fn tilt_side_sustain(_profile: &Profile, _id: ButtonId) -> bool {
    // Never sustain tilt on sticky pan. Remapped tilt is pulse + re-arm on HID
    // idle (UI still shows continuous-click ON). Pan-stream scroll ignores this.
    false
}

fn start_key_repeat_for<K: Eq + Hash>(
    repeats: &mut HashMap<K, ActionRepeat>,
    key: K,
    id: ButtonId,
    action: &Action,
) {
    if matches!(action, Action::Disabled) || is_scroll_action(action) {
        return;
    }
    let action = match action {
        Action::Default => {
            if let Some(btn) = inject::default_mouse_button(id) {
                Action::MouseClick { button: btn }
            } else {
                return;
            }
        }
        other => other.clone(),
    };
    repeats.insert(
        key,
        ActionRepeat {
            action,
            next_at: Instant::now() + KEY_REPEAT_DELAY,
        },
    );
}

fn start_scroll_repeat_for<K: Eq + Hash>(
    repeats: &mut HashMap<K, ScrollRepeat>,
    key: K,
    action: &Action,
) {
    if let Action::Scroll { dx, dy } = action {
        if *dx != 0 || *dy != 0 {
            repeats.insert(
                key,
                ScrollRepeat {
                    dx: *dx,
                    dy: *dy,
                    next_at: Instant::now() + SCROLL_REPEAT_DELAY,
                },
            );
        }
    }
}

pub(crate) fn apply_binding_release<K>(
    state_key: K,
    inject_id: ButtonId,
    profile: &Profile,
    pending: &mut HashMap<K, PendingHold>,
    held: &mut HashMap<K, Action>,
    scroll_repeats: &mut HashMap<K, ScrollRepeat>,
    key_repeats: &mut HashMap<K, ActionRepeat>,
) where
    K: Eq + Hash,
{
    scroll_repeats.remove(&state_key);
    key_repeats.remove(&state_key);
    if let Some(hold) = pending.remove(&state_key) {
        if hold.long_fired {
            if let Some(action) = held.remove(&state_key) {
                inject::release_action(inject_id, &action);
            }
        } else {
            fire_deferred_click_pulse(inject_id, &hold.click, &profile.pointer);
        }
    } else if let Some(action) = held.remove(&state_key) {
        inject::release_action(inject_id, &action);
    }
}

pub(crate) fn apply_binding_press<K>(
    state_key: K,
    inject_id: ButtonId,
    binding: &ButtonBinding,
    profile: &Profile,
    pending: &mut HashMap<K, PendingHold>,
    held: &mut HashMap<K, Action>,
    scroll_repeats: &mut HashMap<K, ScrollRepeat>,
    key_repeats: &mut HashMap<K, ActionRepeat>,
) where
    K: Eq + Hash + Clone,
{
    let is_tilt = matches!(
        inject_id,
        ButtonId::WheelTiltLeft | ButtonId::WheelTiltRight
    );
    if is_tilt && tilt_uses_pan_stream(binding) {
        return;
    }
    if is_tilt {
        if inject::shared_pointer_mode() && remap::action_is_native_for(inject_id, &binding.click) {
            // OS-native already handled elsewhere.
        } else if is_scroll_action(&binding.click) {
            inject::press_action(inject_id, &binding.click, &profile.pointer);
        } else {
            fire_action_pulse(inject_id, &binding.click, &profile.pointer);
        }
        return;
    }

    if binding.uses_long_press() {
        pending.insert(
            state_key,
            PendingHold {
                started: Instant::now(),
                click: binding.click.clone(),
                long_press: binding.long_press.clone(),
                long_fired: false,
            },
        );
    } else if binding.uses_auto_click() {
        if is_scroll_action(&binding.click) {
            held.insert(state_key.clone(), binding.click.clone());
            inject::press_action(inject_id, &binding.click, &profile.pointer);
            start_scroll_repeat_for(scroll_repeats, state_key, &binding.click);
        } else {
            let pulse = match &binding.click {
                Action::Default => {
                    if let Some(btn) = inject::default_mouse_button(inject_id) {
                        Action::MouseClick { button: btn }
                    } else {
                        binding.click.clone()
                    }
                }
                other => other.clone(),
            };
            fire_action_pulse(inject_id, &pulse, &profile.pointer);
            start_key_repeat_for(key_repeats, state_key, inject_id, &pulse);
        }
    } else if inject::shared_pointer_mode()
        && remap::action_is_native_for(inject_id, &binding.click)
    {
        // Both off + OS-native → OS owns hold/drag.
    } else if is_scroll_action(&binding.click) {
        inject::press_action(inject_id, &binding.click, &profile.pointer);
    } else {
        held.insert(state_key, binding.click.clone());
        inject::press_action(inject_id, &binding.click, &profile.pointer);
    }
}

pub(crate) fn cancel_regular_binding(
    id: ButtonId,
    profile: &Profile,
    pending: &mut HashMap<ButtonId, PendingHold>,
    held: &mut HashMap<ButtonId, Action>,
    scroll_repeats: &mut HashMap<ButtonId, ScrollRepeat>,
    key_repeats: &mut HashMap<ButtonId, ActionRepeat>,
) {
    scroll_repeats.remove(&id);
    key_repeats.remove(&id);
    if let Some(hold) = pending.remove(&id) {
        if hold.long_fired {
            if let Some(action) = held.remove(&id) {
                inject::release_action(id, &action);
            }
        }
    } else if let Some(action) = held.remove(&id) {
        inject::release_action(id, &action);
    }
}

pub(crate) fn clear_regular_binding_state(
    id: ButtonId,
    pending: &mut HashMap<ButtonId, PendingHold>,
    held: &mut HashMap<ButtonId, Action>,
    scroll_repeats: &mut HashMap<ButtonId, ScrollRepeat>,
    key_repeats: &mut HashMap<ButtonId, ActionRepeat>,
) {
    scroll_repeats.remove(&id);
    key_repeats.remove(&id);
    pending.remove(&id);
    held.remove(&id);
}

pub(crate) fn handle_button_transitions(
    prev: ButtonState,
    state: ButtonState,
    profile: &Profile,
    pending: &mut HashMap<ButtonId, PendingHold>,
    held: &mut HashMap<ButtonId, Action>,
    scroll_repeats: &mut HashMap<ButtonId, ScrollRepeat>,
    key_repeats: &mut HashMap<ButtonId, ActionRepeat>,
    skip_release: &HashSet<ButtonId>,
    skip_press: &HashSet<ButtonId>,
) {
    for id in state.released_edges(prev) {
        if skip_release.contains(&id) {
            clear_regular_binding_state(id, pending, held, scroll_repeats, key_repeats);
            continue;
        }
        if ball_scroll::is_reserved_huge(id) || custom_mapping::is_reserved_huge(id) {
            scroll_repeats.remove(&id);
            key_repeats.remove(&id);
            pending.remove(&id);
            if let Some(action) = held.remove(&id) {
                inject::release_action(id, &action);
            }
            continue;
        }
        apply_binding_release(id, id, profile, pending, held, scroll_repeats, key_repeats);
    }
    for id in state.pressed_edges(prev) {
        if skip_press.contains(&id) {
            continue;
        }
        if ball_scroll::is_reserved_huge(id) || custom_mapping::is_reserved_huge(id) {
            continue;
        }
        let binding = binding_of(profile, id);
        apply_binding_press(
            id,
            id,
            &binding,
            profile,
            pending,
            held,
            scroll_repeats,
            key_repeats,
        );
    }
}

/// Fire a gesture-matched action (no physical HUGE button context).
pub fn fire_gesture_action(
    action: &Action,
    pointer: &crate::domain::profile::PointerSettings,
) {
    match action {
        Action::Disabled | Action::Default => return,
        other => fire_action_pulse_with(ButtonId::Left, other, pointer, true),
    }
}
