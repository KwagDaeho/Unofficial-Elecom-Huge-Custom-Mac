//! Ball-as-scroll mode: hold and/or latched toggle, driven by a single activator.

use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};

use parking_lot::Mutex;

use serde::Serialize;

use crate::domain::device::{ButtonId, ButtonState};
use crate::domain::profile::{Activator, BallScrollSettings, MouseClickButton, Profile};
use crate::platform::{app_bus, inject, suppress};

static HOLD_DOWN: AtomicBool = AtomicBool::new(false);
static TOGGLE_LATCH: AtomicBool = AtomicBool::new(false);
static WAS_ACTIVE: AtomicBool = AtomicBool::new(false);
static LAST_TOGGLE_AT: Mutex<Option<Instant>> = Mutex::new(None);
static DEACTIVATE_AT: Mutex<Option<Instant>> = Mutex::new(None);
static SETTINGS: Mutex<BallScrollSettings> = Mutex::new(BallScrollSettings {
    toggle_enabled: false,
    toggle_activator: None,
    hold_enabled: false,
    hold_activator: None,
    invert_vertical: false,
    invert_horizontal: false,
    speed: 1.0,
});

/// HID + CGEvent can both fire for one physical press; ignore the echo.
const TOGGLE_DEBOUNCE: Duration = Duration::from_millis(80);
/// Absorb contact bounce so we do not unpin the cursor mid-hold.
const DEACTIVATE_GRACE: Duration = Duration::from_millis(40);

pub fn sync_from_profile(profile: &Profile) {
    let next = if profile.enabled {
        profile.ball_scroll.clone()
    } else {
        BallScrollSettings::default()
    };
    *SETTINGS.lock() = next;
    if !profile.enabled || !profile.ball_scroll.hold_enabled {
        HOLD_DOWN.store(false, Ordering::SeqCst);
    }
    if !profile.enabled || !profile.ball_scroll.toggle_enabled {
        TOGGLE_LATCH.store(false, Ordering::SeqCst);
    }
    *DEACTIVATE_AT.lock() = None;
    apply_active(logical_armed());
}

fn logical_armed() -> bool {
    let s = SETTINGS.lock();
    (s.hold_armed().is_some() && HOLD_DOWN.load(Ordering::SeqCst))
        || (s.toggle_armed().is_some() && TOGGLE_LATCH.load(Ordering::SeqCst))
}

pub fn is_active() -> bool {
    logical_armed() || WAS_ACTIVE.load(Ordering::SeqCst)
}

pub fn is_reserved_huge(id: ButtonId) -> bool {
    SETTINGS.lock().is_reserved_huge(id)
}

pub fn latch_on() -> bool {
    TOGGLE_LATCH.load(Ordering::SeqCst) && SETTINGS.lock().toggle_armed().is_some()
}

/// Commit a pending off after bounce grace, and keep tray/UI in sync.
pub fn tick() {
    let due = DEACTIVATE_AT
        .lock()
        .map(|t| Instant::now() >= t)
        .unwrap_or(false);
    if !due {
        return;
    }
    *DEACTIVATE_AT.lock() = None;
    if !logical_armed() {
        apply_active(false);
    }
}

pub fn note_huge_edges(prev: ButtonState, state: ButtonState) {
    for id in state.pressed_edges(prev) {
        on_down(&Activator::Huge { button: id });
    }
    for id in state.released_edges(prev) {
        on_up(&Activator::Huge { button: id });
    }
}

pub fn on_os_down(activator: &Activator, is_repeat: bool) -> bool {
    if is_repeat {
        return matches_hold(activator) || matches_toggle(activator);
    }
    on_down(activator)
}

pub fn on_os_up(activator: &Activator, is_repeat: bool) -> bool {
    if is_repeat {
        return matches_hold(activator) || matches_toggle(activator);
    }
    on_up(activator)
}

fn matches_hold(activator: &Activator) -> bool {
    SETTINGS.lock().hold_armed() == Some(activator)
}

fn matches_toggle(activator: &Activator) -> bool {
    SETTINGS.lock().toggle_armed() == Some(activator)
}

fn on_down(activator: &Activator) -> bool {
    let mut handled = false;
    if matches_hold(activator) {
        HOLD_DOWN.store(true, Ordering::SeqCst);
        handled = true;
        notify_active();
    }
    if matches_toggle(activator) {
        handled = true;
        let now = Instant::now();
        let mut last = LAST_TOGGLE_AT.lock();
        if last
            .map(|t| now.duration_since(t) < TOGGLE_DEBOUNCE)
            .unwrap_or(false)
        {
            return true;
        }
        *last = Some(now);
        drop(last);
        let next = !TOGGLE_LATCH.load(Ordering::SeqCst);
        TOGGLE_LATCH.store(next, Ordering::SeqCst);
        notify_active();
    }
    handled
}

fn on_up(activator: &Activator) -> bool {
    if matches_hold(activator) {
        HOLD_DOWN.store(false, Ordering::SeqCst);
        notify_active();
        return true;
    }
    matches_toggle(activator)
}

fn notify_active() {
    if logical_armed() {
        *DEACTIVATE_AT.lock() = None;
        apply_active(true);
        return;
    }
    if WAS_ACTIVE.load(Ordering::SeqCst) {
        *DEACTIVATE_AT.lock() = Some(Instant::now() + DEACTIVATE_GRACE);
        emit_active();
    }
}

fn apply_active(active: bool) {
    let was = WAS_ACTIVE.swap(active, Ordering::SeqCst);
    if active && !was {
        suppress::set_suppress_motion(true);
        inject::pin_cursor();
    } else if !active && was {
        inject::restore_pinned_cursor();
        suppress::set_suppress_motion(false);
    }
    emit_active();
}

fn emit_active() {
    #[derive(Clone, Serialize)]
    #[serde(rename_all = "camelCase")]
    struct Payload {
        active: bool,
        latch: bool,
    }
    let active = is_active();
    let latch = latch_on();
    app_bus::emit("ball-scroll-active", Payload { active, latch });
    let tip = if latch {
        "Elecom Huge Custom — ball scroll"
    } else {
        "Elecom Huge Custom"
    };
    app_bus::set_tray_tooltip(tip);
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
        3 => Some(MouseClickButton::Back),
        4 => Some(MouseClickButton::Forward),
        _ => None,
    }
}
