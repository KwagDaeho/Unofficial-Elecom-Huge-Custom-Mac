use std::sync::atomic::Ordering;
use std::time::Instant;

use crate::domain::device::ButtonState;
use crate::domain::profile::{Activator, MouseClickButton};
use crate::platform::{app_bus, inject, suppress};

use super::state::{
    emit_active, logical_armed, settings, DEACTIVATE_AT, DEACTIVATE_GRACE, FORCE_DEACTIVATE,
    HOLD_DOWN, LAST_TOGGLE_AT, QUIT_ARMED, SHUTTING_DOWN, TOGGLE_DEBOUNCE, TOGGLE_LATCH,
    WAS_ACTIVE, IGNORE_BALL_MOTION_UNTIL,
};

const MODIFIER_KEYS: [&str; 4] = ["Control", "Option", "Shift", "Meta"];

pub fn note_huge_edges(prev: ButtonState, state: ButtonState) {
    for id in state.pressed_edges(prev) {
        on_down(&Activator::Huge { button: id });
    }
    for id in state.released_edges(prev) {
        on_up(&Activator::Huge { button: id });
    }
}

pub fn on_os_down(activator: &Activator, is_repeat: bool) -> bool {
    if is_modifier_key(activator) {
        return if is_repeat {
            false
        } else {
            on_down(activator)
        };
    }
    if is_repeat {
        return matches_hold(activator) || matches_toggle(activator);
    }
    on_down(activator)
}

pub fn on_os_up(activator: &Activator, is_repeat: bool) -> bool {
    if is_modifier_key(activator) {
        return if is_repeat {
            false
        } else {
            on_up(activator)
        };
    }
    if is_repeat {
        return matches_hold(activator) || matches_toggle(activator);
    }
    on_up(activator)
}

fn matches_hold(activator: &Activator) -> bool {
    settings().hold_armed() == Some(activator)
}

fn matches_toggle(activator: &Activator) -> bool {
    settings().toggle_armed() == Some(activator)
}

fn is_modifier_key(activator: &Activator) -> bool {
    matches!(activator, Activator::Key { name } if MODIFIER_KEYS.contains(&name.as_str()))
}

/// ⌘Q — tear down ball-scroll synchronously, then quit (do not wait for HID worker).
pub fn arm_app_quit() {
    if SHUTTING_DOWN.swap(true, Ordering::SeqCst) {
        app_bus::request_exit();
        return;
    }
    QUIT_ARMED.store(true, Ordering::SeqCst);
    HOLD_DOWN.store(false, Ordering::SeqCst);
    TOGGLE_LATCH.store(false, Ordering::SeqCst);
    FORCE_DEACTIVATE.store(false, Ordering::SeqCst);
    *DEACTIVATE_AT.lock() = None;
    *IGNORE_BALL_MOTION_UNTIL.lock() = None;
    if WAS_ACTIVE.swap(false, Ordering::SeqCst) {
        suppress::set_suppress_motion(false);
        inject::release_ball_scroll_pin_for_quit();
    }
    app_bus::request_exit();
}

/// Modifier hold pins the cursor; release immediately when a chord starts (⌘C, …).
pub fn yield_modifier_hold_for_chord(key: &Activator) {
    if !HOLD_DOWN.load(Ordering::SeqCst) {
        return;
    }
    let Some(hold) = settings().hold_armed().cloned() else {
        return;
    };
    if !is_modifier_key(&hold) || hold == *key {
        return;
    }
    if !matches!(key, Activator::Key { .. }) {
        return;
    }
    HOLD_DOWN.store(false, Ordering::SeqCst);
    *DEACTIVATE_AT.lock() = None;
    if WAS_ACTIVE.load(Ordering::SeqCst) {
        FORCE_DEACTIVATE.store(true, Ordering::SeqCst);
    }
    emit_active();
}

fn on_down(activator: &Activator) -> bool {
    let mut swallow = false;
    if matches_hold(activator) {
        HOLD_DOWN.store(true, Ordering::SeqCst);
        swallow = !is_modifier_key(activator);
        notify_active();
    }
    if matches_toggle(activator) {
        let now = Instant::now();
        let mut last = LAST_TOGGLE_AT.lock();
        if last
            .map(|t| now.duration_since(t) < TOGGLE_DEBOUNCE)
            .unwrap_or(false)
        {
            return !is_modifier_key(activator);
        }
        *last = Some(now);
        drop(last);
        let next = !TOGGLE_LATCH.load(Ordering::SeqCst);
        TOGGLE_LATCH.store(next, Ordering::SeqCst);
        notify_active();
        swallow = swallow || !is_modifier_key(activator);
    }
    swallow
}

fn on_up(activator: &Activator) -> bool {
    if matches_hold(activator) {
        HOLD_DOWN.store(false, Ordering::SeqCst);
        notify_active();
        return !is_modifier_key(activator);
    }
    matches_toggle(activator) && !is_modifier_key(activator)
}

fn notify_active() {
    if logical_armed() {
        *DEACTIVATE_AT.lock() = None;
    } else if WAS_ACTIVE.load(Ordering::SeqCst) {
        *DEACTIVATE_AT.lock() = Some(Instant::now() + DEACTIVATE_GRACE);
    }
    emit_active();
}

pub fn mouse_from_event(etype: u32, button_number: i64) -> Option<(Activator, bool)> {
    let (button, down) = match etype {
        1 => (MouseClickButton::Left, true),
        2 => (MouseClickButton::Left, false),
        3 => (MouseClickButton::Right, true),
        4 => (MouseClickButton::Right, false),
        25 => {
            let b = other_mouse(button_number)?;
            (b, true)
        }
        26 => {
            let b = other_mouse(button_number)?;
            (b, false)
        }
        _ => return None,
    };
    Some((Activator::Mouse { button }, down))
}

fn other_mouse(button_number: i64) -> Option<MouseClickButton> {
    match button_number {
        2 => Some(MouseClickButton::Middle),
        n if (3..=255).contains(&n) => Some(MouseClickButton::Other {
            number: n as u8,
        }),
        _ => None,
    }
}
