use crate::domain::device::ButtonId;
use crate::domain::profile::{Activator, ComboActivator};
use crate::platform::app_bus;
use serde::Serialize;

use super::session;
use super::types::{ActivatorCapture, CaptureChord, ComboTriggerCapture};

pub(crate) fn emit_chord(payload: CaptureChord) {
    app_bus::emit("key-capture", payload);
}

pub(crate) fn emit_activator(payload: ActivatorCapture) {
    app_bus::emit("activator-capture", payload);
}

pub(crate) fn emit_activator_choice(activator: Activator) {
    if activator.is_left_click() {
        let allow_huge_left = matches!(activator, Activator::Huge { .. })
            && session::combo_activator_capture();
        if !allow_huge_left {
            emit_activator(ActivatorCapture {
                escape: false,
                rejected: Some("left".into()),
                activator: None,
            });
            return;
        }
    }
    if activator.is_huge_tilt() {
        emit_activator(ActivatorCapture {
            escape: false,
            rejected: Some("tilt".into()),
            activator: None,
        });
        return;
    }
    emit_activator(ActivatorCapture {
        escape: false,
        rejected: None,
        activator: Some(activator),
    });
}

pub fn emit_activator_from_hid(activator: Activator) {
    if session::combo_trigger_capture_active() {
        if let Activator::Huge { button } = activator {
            emit_combo_trigger_huge(button);
        }
        return;
    }
    if !session::activator_capture() {
        return;
    }
    emit_activator_choice(activator);
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct GestureCanvasDelta {
    dx: f64,
    dy: f64,
}

pub fn emit_gesture_canvas_delta(dx: f64, dy: f64) {
    if !session::gesture_record_active() || !session::gesture_ball_stroke_active() {
        return;
    }
    session::set_gesture_record_stroke_moved(true);
    app_bus::emit(
        "gesture-canvas-delta",
        GestureCanvasDelta { dx, dy },
    );
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct GestureCanvasPhase {
    phase: String,
}

pub fn emit_gesture_canvas_phase(phase: &str) {
    if !session::gesture_record_active() {
        return;
    }
    if phase == "start" {
        session::set_gesture_ball_stroke_active(true);
    } else if phase == "end" {
        session::set_gesture_ball_stroke_active(false);
    }
    app_bus::emit(
        "gesture-canvas-phase",
        GestureCanvasPhase {
            phase: phase.to_string(),
        },
    );
}

pub fn emit_combo_trigger_huge(button: ButtonId) {
    if !session::combo_trigger_capture_active() {
        return;
    }
    #[cfg(target_os = "macos")]
    {
        let (modifiers, keys) = super::macos::combo_held_parts();
        if modifiers.is_empty() && keys.is_empty() {
            if session::ui_modal_active()
                && !session::gesture_record_active()
                && button == ButtonId::Left
            {
                crate::platform::inject::click_at_cursor();
            }
            return;
        }
        app_bus::emit(
            "combo-trigger-capture",
            ComboTriggerCapture {
                escape: false,
                rejected: None,
                combo: Some(ComboActivator {
                    modifiers,
                    keys,
                    button,
                }),
            },
        );
    }
}
