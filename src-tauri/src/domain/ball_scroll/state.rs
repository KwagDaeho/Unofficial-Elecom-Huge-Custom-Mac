use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};

use parking_lot::Mutex;
use serde::Serialize;

use crate::domain::device::ButtonId;
use crate::domain::profile::{BallScrollSettings, Profile};
use crate::platform::{app_bus, inject, suppress};

pub(crate) static HOLD_DOWN: AtomicBool = AtomicBool::new(false);
pub(crate) static TOGGLE_LATCH: AtomicBool = AtomicBool::new(false);
pub(crate) static WAS_ACTIVE: AtomicBool = AtomicBool::new(false);
/// Unpin on the HID worker only — never from the CGEvent tap (deadlock on ⌘Q).
pub(crate) static FORCE_DEACTIVATE: AtomicBool = AtomicBool::new(false);
pub(crate) static SHUTTING_DOWN: AtomicBool = AtomicBool::new(false);
/// ⌘Q while ball-scroll is on — block worker re-pin until app exit teardown.
pub(crate) static QUIT_ARMED: AtomicBool = AtomicBool::new(false);
pub(crate) static LAST_TOGGLE_AT: Mutex<Option<Instant>> = Mutex::new(None);
pub(crate) static DEACTIVATE_AT: Mutex<Option<Instant>> = Mutex::new(None);
/// After unpin, ball inertia still arrives as HID dx/dy — drop it briefly.
pub(crate) static IGNORE_BALL_MOTION_UNTIL: Mutex<Option<Instant>> = Mutex::new(None);
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
pub(crate) const TOGGLE_DEBOUNCE: Duration = Duration::from_millis(80);
/// Absorb contact bounce so we do not unpin the cursor mid-hold.
pub(crate) const DEACTIVATE_GRACE: Duration = Duration::from_millis(40);
pub(crate) const BALL_MOTION_IGNORE: Duration = Duration::from_millis(250);

pub(crate) fn settings() -> parking_lot::MutexGuard<'static, BallScrollSettings> {
    SETTINGS.lock()
}

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

pub(crate) fn logical_armed() -> bool {
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

pub(crate) fn apply_active(active: bool) {
    if active && SHUTTING_DOWN.load(Ordering::SeqCst) {
        return;
    }
    let was = WAS_ACTIVE.swap(active, Ordering::SeqCst);
    if active && !was {
        *IGNORE_BALL_MOTION_UNTIL.lock() = None;
        suppress::set_suppress_motion(true);
        inject::pin_cursor();
    } else if !active && was {
        *IGNORE_BALL_MOTION_UNTIL.lock() = Some(Instant::now() + inject::POST_UNPIN_BALL_IGNORE);
        inject::restore_pinned_cursor();
        suppress::set_suppress_motion(false);
    }
    if !SHUTTING_DOWN.load(Ordering::SeqCst) {
        emit_active();
    }
}

pub(crate) fn emit_active() {
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
