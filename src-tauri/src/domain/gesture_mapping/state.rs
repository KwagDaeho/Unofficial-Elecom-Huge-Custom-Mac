use std::sync::atomic::{AtomicBool, Ordering};

use parking_lot::Mutex;

use crate::domain::profile::{Activator, GestureMappingEntry, GesturePoint, PointerSettings, Profile};
use crate::platform::inject;

use super::recognizer::{match_score, raw_path_length};

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

const MIN_RAW_PATH_LENGTH: f64 = 24.0;

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
    *SESSION.lock() = Some(GestureSession {
        hold: activator.clone(),
        points: vec![GesturePoint { x: 0.0, y: 0.0 }],
    });
    inject::pin_cursor();
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
    inject::restore_pinned_cursor();
    let handled = should_swallow(activator);
    try_fire_match(session);
    handled
}

pub fn note_huge_down(id: crate::domain::device::ButtonId) -> bool {
    on_os_down(&Activator::Huge { button: id }, false)
}

pub fn note_huge_up(id: crate::domain::device::ButtonId) -> bool {
    on_os_up(&Activator::Huge { button: id }, false)
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
        x: last.x + dx,
        y: last.y + dy,
    });
}

fn try_fire_match(session: GestureSession) {
    if raw_path_length(&session.points) < MIN_RAW_PATH_LENGTH {
        return;
    }
    let candidates = entries_for_hold(&session.hold);
    let mut best: Option<(&GestureMappingEntry, f64)> = None;
    for entry in &candidates {
        let score = match_score(&session.points, &entry.template);
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
        inject::restore_pinned_cursor();
    }
}

pub fn shutdown() {
    end_session(true);
}
