use std::sync::atomic::{AtomicBool, Ordering};

use std::time::{Duration, Instant};

use parking_lot::Mutex;

use crate::domain::profile::{Activator, GestureMappingEntry, GesturePoint, PointerSettings, Profile};
use crate::platform::inject;

use super::recognizer::{match_score, passes_shape_checks, raw_path_length};

static ENTRIES: Mutex<Vec<GestureMappingEntry>> = Mutex::new(Vec::new());
static POINTER: Mutex<PointerSettings> = Mutex::new(PointerSettings {
    speed: 1.0,
    speed_x: Some(1.0),
    speed_y: Some(1.0),
    acceleration: true,
    scroll_speed: 1.0,
    scroll_speed_vertical: Some(1.0),
    scroll_speed_horizontal: Some(1.0),
    natural_scroll: false,
    invert_vertical_scroll: Some(false),
    invert_horizontal_scroll: Some(false),
});
static HOLD_DOWN: AtomicBool = AtomicBool::new(false);
static SESSION: Mutex<Option<GestureSession>> = Mutex::new(None);
static IGNORE_BALL_MOTION_UNTIL: Mutex<Option<Instant>> = Mutex::new(None);

const MIN_RAW_PATH_LENGTH: f64 = 24.0;
/// Match ball-scroll: drop inertial ball HID right after gesture hold ends.
const BALL_MOTION_IGNORE: Duration = crate::platform::inject::POST_UNPIN_BALL_IGNORE;
/// Match canvas template recording: ball HID counts overshoot visual stroke.
const RECORD_BALL_DELTA_SCALE: f64 = 0.45;

struct GestureSession {
    hold: Activator,
    points: Vec<GesturePoint>,
}

pub fn sync_from_profile(profile: &Profile) {
    let next = if profile.enabled {
        profile
            .gesture_mappings
            .iter()
            .filter(|entry| entry.is_valid())
            .cloned()
            .collect()
    } else {
        Vec::new()
    };
    *ENTRIES.lock() = next;
    *POINTER.lock() = profile.pointer.clone();
    if !profile.enabled {
        end_session(false);
    }
}

pub fn uses_os_watch() -> bool {
    ENTRIES.lock().iter().any(|entry| {
        matches!(
            entry.hold_activator,
            Some(Activator::Key { .. }) | Some(Activator::Mouse { .. })
        )
    })
}

pub fn needs_event_watch(profile: &Profile) -> bool {
    profile.enabled && uses_os_watch()
}

pub fn session_active() -> bool {
    HOLD_DOWN.load(Ordering::SeqCst)
}

/// Drop HUGE ball deltas as pointer motion right after a gesture hold ends.
pub fn ignore_ball_pointer_motion() -> bool {
    if crate::platform::inject::restore_cursor_active() {
        return true;
    }
    IGNORE_BALL_MOTION_UNTIL
        .lock()
        .is_some_and(|until| Instant::now() < until)
}

fn entries_for_hold(hold: &Activator) -> Vec<GestureMappingEntry> {
    ENTRIES
        .lock()
        .iter()
        .filter(|entry| entry.hold_activator.as_ref() == Some(hold))
        .cloned()
        .collect()
}

fn is_modifier_key(activator: &Activator) -> bool {
    matches!(
        activator,
        Activator::Key { name }
            if matches!(name.as_str(), "Control" | "Option" | "Shift" | "Meta")
    )
}

fn should_swallow(activator: &Activator) -> bool {
    !is_modifier_key(activator)
}

pub fn on_os_down(activator: &Activator, is_repeat: bool) -> bool {
    if entries_for_hold(activator).is_empty() {
        return false;
    }
    if is_repeat {
        return session_active() && should_swallow(activator);
    }
    HOLD_DOWN.store(true, Ordering::SeqCst);
    *IGNORE_BALL_MOTION_UNTIL.lock() = None;
    *SESSION.lock() = Some(GestureSession {
        hold: activator.clone(),
        points: vec![GesturePoint { x: 0.0, y: 0.0 }],
    });
    inject::pin_cursor_gesture();
    should_swallow(activator)
}

pub fn on_os_up(activator: &Activator, is_repeat: bool) -> bool {
    if is_repeat {
        return session_active() && should_swallow(activator);
    }
    let Some(session) = SESSION.lock().take() else {
        return false;
    };
    if session.hold != *activator {
        *SESSION.lock() = Some(session);
        return false;
    }
    HOLD_DOWN.store(false, Ordering::SeqCst);
    *IGNORE_BALL_MOTION_UNTIL.lock() = Some(Instant::now() + BALL_MOTION_IGNORE);
    inject::restore_pinned_cursor();
    let handled = should_swallow(activator);
    try_fire_match(session);
    handled
}

pub fn note_huge_edges(prev: crate::domain::device::ButtonState, state: crate::domain::device::ButtonState) {
    for id in state.pressed_edges(prev) {
        let activator = Activator::Huge { button: id };
        if !entries_for_hold(&activator).is_empty() {
            on_os_down(&activator, false);
        }
    }
    for id in state.released_edges(prev) {
        let activator = Activator::Huge { button: id };
        if session_active() || !entries_for_hold(&activator).is_empty() {
            on_os_up(&activator, false);
        }
    }
}

pub fn record_motion(dx: f64, dy: f64) {
    if !session_active() {
        return;
    }
    let mut guard = SESSION.lock();
    let Some(session) = guard.as_mut() else {
        return;
    };
    let last = session.points.last().cloned().unwrap_or(GesturePoint {
        x: 0.0,
        y: 0.0,
    });
    session.points.push(GesturePoint {
        x: last.x + dx * RECORD_BALL_DELTA_SCALE,
        y: last.y + dy * RECORD_BALL_DELTA_SCALE,
    });
}

fn try_fire_match(session: GestureSession) {
    if raw_path_length(&session.points) < MIN_RAW_PATH_LENGTH {
        return;
    }
    let candidates = entries_for_hold(&session.hold);
    let mut best: Option<(&GestureMappingEntry, f64)> = None;
    for entry in &candidates {
        if !passes_shape_checks(
            &session.points,
            &entry.template,
            entry.template_path_length,
            entry.template_corner_count,
            entry.template_bend_signature,
        ) {
            continue;
        }
        let score = match_score(
            &session.points,
            &entry.template,
            entry.template_corner_count,
            entry.template_bend_signature,
        );
        if score < entry.min_score {
            continue;
        }
        if best.map(|(_, current)| score > current).unwrap_or(true) {
            best = Some((entry, score));
        }
    }
    let Some((entry, _score)) = best else {
        return;
    };
    let pointer = POINTER.lock().clone();
    crate::domain::engine::input::fire_gesture_action(&entry.binding.click, &pointer);
}

fn end_session(restore_cursor: bool) {
    HOLD_DOWN.store(false, Ordering::SeqCst);
    SESSION.lock().take();
    if restore_cursor {
        *IGNORE_BALL_MOTION_UNTIL.lock() = Some(Instant::now() + BALL_MOTION_IGNORE);
        inject::restore_pinned_cursor();
    }
}

pub fn shutdown() {
    end_session(true);
}
