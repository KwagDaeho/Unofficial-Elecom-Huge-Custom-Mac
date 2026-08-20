use std::sync::atomic::{AtomicBool, Ordering};

use super::types::CaptureSession;

static CAPTURE_ACTIVE: AtomicBool = AtomicBool::new(false);
static KEY_CAPTURE_WANTED: AtomicBool = AtomicBool::new(false);
static ACTIVATOR_CAPTURE: AtomicBool = AtomicBool::new(false);
static ACTIVATOR_CAPTURE_WANTED: AtomicBool = AtomicBool::new(false);
static COMBO_ACTIVATOR_CAPTURE: AtomicBool = AtomicBool::new(false);
static COMBO_TRIGGER_CAPTURE: AtomicBool = AtomicBool::new(false);
static UI_MODAL_ACTIVE: AtomicBool = AtomicBool::new(false);
static GESTURE_RECORD_ACTIVE: AtomicBool = AtomicBool::new(false);
static GESTURE_CANVAS_DRAWING: AtomicBool = AtomicBool::new(false);
static GESTURE_BALL_STROKE_ACTIVE: AtomicBool = AtomicBool::new(false);
pub(crate) static TAP_STARTED: AtomicBool = AtomicBool::new(false);

fn refresh_capture_active() {
    let active = KEY_CAPTURE_WANTED.load(Ordering::SeqCst)
        || COMBO_TRIGGER_CAPTURE.load(Ordering::SeqCst);
    CAPTURE_ACTIVE.store(active, Ordering::SeqCst);
    super::ensure_watch_tap();
}

fn refresh_activator_capture() {
    let active = ACTIVATOR_CAPTURE_WANTED.load(Ordering::SeqCst)
        || COMBO_TRIGGER_CAPTURE.load(Ordering::SeqCst);
    ACTIVATOR_CAPTURE.store(active, Ordering::SeqCst);
    COMBO_ACTIVATOR_CAPTURE.store(
        COMBO_TRIGGER_CAPTURE.load(Ordering::SeqCst),
        Ordering::SeqCst,
    );
}

/// Atomically apply the full capture session (avoids FE race between invoke calls).
pub fn apply_capture_session(session: CaptureSession) {
    let combo_was = COMBO_TRIGGER_CAPTURE.load(Ordering::SeqCst);
    let gesture_was = GESTURE_RECORD_ACTIVE.load(Ordering::SeqCst);
    KEY_CAPTURE_WANTED.store(session.key_capture, Ordering::SeqCst);
    ACTIVATOR_CAPTURE_WANTED.store(session.activator_capture, Ordering::SeqCst);
    COMBO_TRIGGER_CAPTURE.store(session.combo_trigger, Ordering::SeqCst);
    UI_MODAL_ACTIVE.store(session.ui_modal, Ordering::SeqCst);

    if gesture_was && !session.gesture_record {
        GESTURE_CANVAS_DRAWING.store(false, Ordering::SeqCst);
        GESTURE_BALL_STROKE_ACTIVE.store(false, Ordering::SeqCst);
        super::emit::emit_gesture_canvas_phase("end");
    }

    GESTURE_RECORD_ACTIVE.store(session.gesture_record, Ordering::SeqCst);

    if session.combo_trigger != combo_was {
        #[cfg(target_os = "macos")]
        super::macos::clear_combo_held();
    }

    refresh_activator_capture();
    refresh_capture_active();
}

pub fn set_key_capture(active: bool) {
    KEY_CAPTURE_WANTED.store(active, Ordering::SeqCst);
    refresh_capture_active();
}

pub fn set_activator_capture(active: bool) {
    ACTIVATOR_CAPTURE_WANTED.store(active, Ordering::SeqCst);
    refresh_activator_capture();
    super::ensure_watch_tap();
}

pub fn set_combo_activator_capture(active: bool) {
    COMBO_ACTIVATOR_CAPTURE.store(active, Ordering::SeqCst);
    ACTIVATOR_CAPTURE_WANTED.store(active, Ordering::SeqCst);
    refresh_activator_capture();
    super::ensure_watch_tap();
}

/// Unified combo-trigger session: keyboard chord + HUGE button snapshot.
pub fn set_combo_trigger_capture(active: bool) {
    let combo_was = COMBO_TRIGGER_CAPTURE.load(Ordering::SeqCst);
    COMBO_TRIGGER_CAPTURE.store(active, Ordering::SeqCst);
    if active != combo_was {
        #[cfg(target_os = "macos")]
        super::macos::clear_combo_held();
    }
    refresh_activator_capture();
    refresh_capture_active();
}

pub fn set_ui_modal(active: bool) {
    UI_MODAL_ACTIVE.store(active, Ordering::SeqCst);
}

pub fn gesture_record_active() -> bool {
    GESTURE_RECORD_ACTIVE.load(Ordering::SeqCst)
}

pub fn set_gesture_canvas_drawing(active: bool) {
    GESTURE_CANVAS_DRAWING.store(active, Ordering::SeqCst);
    if active {
        GESTURE_BALL_STROKE_ACTIVE.store(false, Ordering::SeqCst);
    }
}

pub fn gesture_canvas_drawing() -> bool {
    GESTURE_CANVAS_DRAWING.load(Ordering::SeqCst)
}

pub fn set_gesture_ball_stroke_active(active: bool) {
    GESTURE_BALL_STROKE_ACTIVE.store(active, Ordering::SeqCst);
}

pub fn gesture_ball_stroke_active() -> bool {
    GESTURE_BALL_STROKE_ACTIVE.load(Ordering::SeqCst)
}

pub fn combo_trigger_capture_active() -> bool {
    COMBO_TRIGGER_CAPTURE.load(Ordering::SeqCst)
}

pub fn ui_modal_active() -> bool {
    UI_MODAL_ACTIVE.load(Ordering::SeqCst)
}

pub fn activator_capture_active() -> bool {
    ACTIVATOR_CAPTURE.load(Ordering::SeqCst)
}

pub fn key_capture_active() -> bool {
    CAPTURE_ACTIVE.load(Ordering::SeqCst)
}

/// Any UI capture session — block HUGE remaps leaking to the OS.
pub fn input_capture_active() -> bool {
    key_capture_active() || activator_capture_active()
}

pub(crate) fn capture_active() -> bool {
    CAPTURE_ACTIVE.load(Ordering::SeqCst)
}

pub(crate) fn activator_capture() -> bool {
    ACTIVATOR_CAPTURE.load(Ordering::SeqCst)
}

pub(crate) fn combo_activator_capture() -> bool {
    COMBO_ACTIVATOR_CAPTURE.load(Ordering::SeqCst)
}

pub(crate) fn combo_trigger_capture() -> bool {
    COMBO_TRIGGER_CAPTURE.load(Ordering::SeqCst)
}
