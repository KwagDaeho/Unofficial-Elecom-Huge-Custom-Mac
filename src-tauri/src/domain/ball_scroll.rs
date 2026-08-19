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
/// Unpin on the HID worker only — never from the CGEvent tap (deadlock on ⌘Q).
static FORCE_DEACTIVATE: AtomicBool = AtomicBool::new(false);
static SHUTTING_DOWN: AtomicBool = AtomicBool::new(false);
/// ⌘Q while ball-scroll is on — block worker re-pin until app exit teardown.
static QUIT_ARMED: AtomicBool = AtomicBool::new(false);
static LAST_TOGGLE_AT: Mutex<Option<Instant>> = Mutex::new(None);
static DEACTIVATE_AT: Mutex<Option<Instant>> = Mutex::new(None);
/// After unpin, ball inertia still arrives as HID dx/dy — drop it briefly.
static IGNORE_BALL_MOTION_UNTIL: Mutex<Option<Instant>> = Mutex::new(None);
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
const BALL_MOTION_IGNORE: Duration = Duration::from_millis(250);

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
    if !SHUTTING_DOWN.load(Ordering::SeqCst) {
        apply_active(logical_armed());
    }
}

/// Release pin/suppress before the HID worker is joined on app exit.
pub fn shutdown() {
    SHUTTING_DOWN.store(true, Ordering::SeqCst);
    HOLD_DOWN.store(false, Ordering::SeqCst);
    TOGGLE_LATCH.store(false, Ordering::SeqCst);
    FORCE_DEACTIVATE.store(false, Ordering::SeqCst);
    QUIT_ARMED.store(false, Ordering::SeqCst);
    *DEACTIVATE_AT.lock() = None;
    *IGNORE_BALL_MOTION_UNTIL.lock() = None;
    if WAS_ACTIVE.swap(false, Ordering::SeqCst) {
        suppress::set_suppress_motion(false);
        inject::release_ball_scroll_pin();
    }
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

/// Keyboard watch for activators and ⌘Q while ball-scroll is configured or active.
pub fn needs_event_watch(profile: &Profile) -> bool {
    if !profile.enabled {
        return is_active();
    }
    profile.ball_scroll.hold_enabled
        || profile.ball_scroll.toggle_enabled
        || profile.ball_scroll.uses_os_watch()
        || is_active()
}

/// Drop HUGE ball deltas as pointer motion right after ball-scroll ends.
pub fn ignore_ball_pointer_motion() -> bool {
    IGNORE_BALL_MOTION_UNTIL
        .lock()
        .is_some_and(|until| Instant::now() < until)
}

/// Commit a pending off after bounce grace, and keep tray/UI in sync.
pub fn tick() {
    if FORCE_DEACTIVATE.swap(false, Ordering::SeqCst) {
        apply_active(false);
        return;
    }
    let due = DEACTIVATE_AT
        .lock()
        .map(|t| Instant::now() >= t)
        .unwrap_or(false);
    if due {
        *DEACTIVATE_AT.lock() = None;
        if !logical_armed() {
            apply_active(false);
        }
    } else if logical_armed()
        && !WAS_ACTIVE.load(Ordering::SeqCst)
        && !QUIT_ARMED.load(Ordering::SeqCst)
    {
        // Pin on the HID worker — never from the CGEvent tap callback (deadlock on ⌘Q).
        apply_active(true);
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
    SETTINGS.lock().hold_armed() == Some(activator)
}

fn matches_toggle(activator: &Activator) -> bool {
    SETTINGS.lock().toggle_armed() == Some(activator)
}

const MODIFIER_KEYS: [&str; 4] = ["Control", "Option", "Shift", "Meta"];

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
    let Some(hold) = SETTINGS.lock().hold_armed().cloned() else {
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

fn apply_active(active: bool) {
    if active && SHUTTING_DOWN.load(Ordering::SeqCst) {
        return;
    }
    let was = WAS_ACTIVE.swap(active, Ordering::SeqCst);
    if active && !was {
        *IGNORE_BALL_MOTION_UNTIL.lock() = None;
        suppress::set_suppress_motion(true);
        inject::pin_cursor();
    } else if !active && was {
        *IGNORE_BALL_MOTION_UNTIL.lock() = Some(Instant::now() + BALL_MOTION_IGNORE);
        inject::restore_pinned_cursor();
        suppress::set_suppress_motion(false);
    }
    if !SHUTTING_DOWN.load(Ordering::SeqCst) {
        emit_active();
    }
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
