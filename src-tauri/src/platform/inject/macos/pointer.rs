//! Cursor move + scroll injection.

use core_graphics::event::{
    CGEvent, CGEventTapLocation, CGEventType, CGMouseButton, EventField, ScrollEventUnit,
};
use core_graphics::geometry::CGPoint;
use std::sync::atomic::{AtomicBool, Ordering};

use super::{buttons_down, cursor_pos, cursor_state, hid_source};

static SHARED_POINTER_MODE: AtomicBool = AtomicBool::new(true);

pub fn set_shared_pointer_mode(shared: bool) {
    SHARED_POINTER_MODE.store(shared, Ordering::SeqCst);
}

pub fn shared_pointer_mode() -> bool {
    SHARED_POINTER_MODE.load(Ordering::SeqCst)
}

/// Keep the point on some active display; pin exactly to edges so Dock /
/// menu-bar auto-hide can see "cursor against chrome".
fn clamp_to_displays(mut p: CGPoint) -> CGPoint {
    use core_graphics::display::CGDisplay;
    let ids = CGDisplay::active_displays().unwrap_or_else(|_| vec![CGDisplay::main().id]);
    // Prefer the display that currently contains the cursor; else nearest.
    let mut best = None::<(f64, f64, f64, f64)>; // left, top, right, bottom
    let mut best_dist = f64::MAX;
    for id in ids {
        let b = CGDisplay::new(id).bounds();
        let left = b.origin.x;
        let top = b.origin.y;
        let right = left + b.size.width;
        let bottom = top + b.size.height;
        if p.x >= left && p.x <= right && p.y >= top && p.y <= bottom {
            best = Some((left, top, right, bottom));
            best_dist = 0.0;
            break;
        }
        let cx = p.x.clamp(left, right);
        let cy = p.y.clamp(top, bottom);
        let d = (p.x - cx).hypot(p.y - cy);
        if d < best_dist {
            best_dist = d;
            best = Some((left, top, right, bottom));
        }
    }
    if let Some((left, top, right, bottom)) = best {
        // Inclusive edges — Dock auto-show wants the cursor on the chrome edge.
        p.x = p.x.clamp(left, right);
        p.y = p.y.clamp(top, bottom);
    }
    p
}

pub fn sync_cursor_from_system() {
    *cursor_state().lock() = cursor_pos();
}

pub fn move_by(dx: f64, dy: f64) {
    if dx == 0.0 && dy == 0.0 {
        return;
    }

    // Real HID mice move the cursor only via the event stream. CGWarp is
    // invisible to Dock / menu-bar auto-hide and is what made chrome ignore
    // us. Exclusive-seize already removes the hardware reports, so we must
    // look like a normal mouse: HID-source MouseMoved (+ deltas) only.
    let from = cursor_pos();
    let point = clamp_to_displays(CGPoint::new(from.x + dx, from.y + dy));
    *cursor_state().lock() = point;

    let held = *buttons_down().lock();
    let (etype, cg_btn, number) = held.drag_kind().unwrap_or((
        CGEventType::MouseMoved,
        CGMouseButton::Left,
        None,
    ));

    let src = hid_source();
    if let Ok(e) = CGEvent::new_mouse_event(src, etype, point, cg_btn) {
        e.set_double_value_field(EventField::MOUSE_EVENT_DELTA_X, dx);
        e.set_double_value_field(EventField::MOUSE_EVENT_DELTA_Y, dy);
        e.set_integer_value_field(EventField::MOUSE_EVENT_DELTA_X, dx.round() as i64);
        e.set_integer_value_field(EventField::MOUSE_EVENT_DELTA_Y, dy.round() as i64);
        if let Some(n) = number {
            e.set_integer_value_field(EventField::MOUSE_EVENT_BUTTON_NUMBER, n);
        }
        if held.any() {
            e.set_integer_value_field(EventField::MOUSE_EVENT_CLICK_STATE, 1);
        }
        e.post(CGEventTapLocation::HID);
    }
}

pub fn scroll(dx_lines: i32, dy_lines: i32) {
    scroll_with_unit(dx_lines, dy_lines, ScrollEventUnit::LINE);
}

/// Continuous-feeling wheel scroll (closer to native macOS mouse feel).
pub fn scroll_pixels(dx: i32, dy: i32) {
    scroll_with_unit(dx, dy, ScrollEventUnit::PIXEL);
}

/// One wheel/tilt notch at user multiplier 1.0.
/// Exclusive HID skips WindowServer scroll acceleration, so we bake a baseline;
/// the UI multiplier stacks on top (`base × speed`).
pub const SCROLL_BASE_VERTICAL_PX: f64 = 36.0;
pub const SCROLL_BASE_HORIZONTAL_PX: f64 = 36.0;

/// Hardware wheel/pan notch → pixels, applying axis speed + invert.
pub fn scroll_notches(
    dx_notches: f64,
    dy_notches: f64,
    pointer: &crate::domain::profile::PointerSettings,
) {
    scroll_notches_ex(dx_notches, dy_notches, pointer, false);
}

/// `continuous`: match trackpad-style gestures so a held horizontal scroll
/// is not dropped when another device is mid vertical scroll.
pub fn scroll_notches_ex(
    dx_notches: f64,
    dy_notches: f64,
    pointer: &crate::domain::profile::PointerSettings,
    continuous: bool,
) {
    let mut px = 0i32;
    let mut py = 0i32;
    if dx_notches != 0.0 {
        // Positive notch = tilt-right / scroll-right intent.
        // CGEvent axis2 is opposite that intent — base negate = toggle OFF (normal).
        // Toggle ON flips once more from that normal.
        let mut v = dx_notches * SCROLL_BASE_HORIZONTAL_PX * pointer.scroll_horizontal();
        v = -v;
        if pointer.invert_horizontal() {
            v = -v;
        }
        px = v.round() as i32;
        if px == 0 {
            px = if v >= 0.0 { 1 } else { -1 };
        }
    }
    if dy_notches != 0.0 {
        let mut v = dy_notches * SCROLL_BASE_VERTICAL_PX * pointer.scroll_vertical();
        if pointer.invert_vertical() {
            v = -v;
        }
        py = v.round() as i32;
        if py == 0 {
            py = if v >= 0.0 { 1 } else { -1 };
        }
    }
    post_scroll_gesture(px, py, continuous);
}

/// Catalog scroll units (±3 ≈ one notch). Applies axis speed + invert toggles.
pub fn scroll_by_units(
    dx_units: i32,
    dy_units: i32,
    pointer: &crate::domain::profile::PointerSettings,
) {
    scroll_by_units_ex(dx_units, dy_units, pointer, false);
}

pub fn scroll_by_units_ex(
    dx_units: i32,
    dy_units: i32,
    pointer: &crate::domain::profile::PointerSettings,
    continuous: bool,
) {
    let dx_notches = if dx_units != 0 {
        dx_units as f64 / 3.0
    } else {
        0.0
    };
    let dy_notches = if dy_units != 0 {
        dy_units as f64 / 3.0
    } else {
        0.0
    };
    scroll_notches_ex(dx_notches, dy_notches, pointer, continuous);
}

/// Post a scroll that looks like a real mouse notch: pixel delta + line/fixed fields.
fn post_scroll_gesture(dx_px: i32, dy_px: i32, continuous: bool) {
    if dx_px == 0 && dy_px == 0 {
        return;
    }
    let src = hid_source();
    // Always declare 2 wheels when either axis is present so horizontal isn't
    // stripped while a vertical gesture (trackpad/other mouse) is active.
    let wheel_count = if dx_px != 0 && dy_px != 0 {
        2
    } else if dx_px != 0 {
        2
    } else {
        1
    };
    // LINE magnitude ≈ pixels / ~10 (Apple’s default pixels-per-line).
    let dy_lines = ((dy_px as f64) / 10.0).round() as i32;
    let dx_lines = ((dx_px as f64) / 10.0).round() as i32;
    let Ok(e) = CGEvent::new_scroll_event(
        src,
        if continuous {
            ScrollEventUnit::PIXEL
        } else {
            ScrollEventUnit::PIXEL
        },
        wheel_count,
        dy_px,
        dx_px,
        0,
    ) else {
        return;
    };
    // Enrich like a physical mouse so apps that read line/fixed-point still move.
    if dy_px != 0 {
        let lines = if dy_lines != 0 {
            dy_lines
        } else {
            dy_px.signum()
        };
        e.set_integer_value_field(EventField::SCROLL_WHEEL_EVENT_DELTA_AXIS_1, lines as i64);
        e.set_integer_value_field(
            EventField::SCROLL_WHEEL_EVENT_POINT_DELTA_AXIS_1,
            dy_px as i64,
        );
        e.set_integer_value_field(
            EventField::SCROLL_WHEEL_EVENT_FIXED_POINT_DELTA_AXIS_1,
            (lines as i64) * 0x10000,
        );
    }
    if dx_px != 0 {
        let lines = if dx_lines != 0 {
            dx_lines
        } else {
            dx_px.signum()
        };
        e.set_integer_value_field(EventField::SCROLL_WHEEL_EVENT_DELTA_AXIS_2, lines as i64);
        e.set_integer_value_field(
            EventField::SCROLL_WHEEL_EVENT_POINT_DELTA_AXIS_2,
            dx_px as i64,
        );
        e.set_integer_value_field(
            EventField::SCROLL_WHEEL_EVENT_FIXED_POINT_DELTA_AXIS_2,
            (lines as i64) * 0x10000,
        );
    }
    e.set_integer_value_field(
        EventField::SCROLL_WHEEL_EVENT_IS_CONTINUOUS,
        i64::from(continuous),
    );
    // Session: skip our HID suppress tap so invert/speed aren't applied twice.
    e.post(CGEventTapLocation::Session);
}

fn scroll_with_unit(dx: i32, dy: i32, unit: u32) {
    if dx == 0 && dy == 0 {
        return;
    }
    let src = hid_source();
    if let Ok(e) = CGEvent::new_scroll_event(
        src,
        unit,
        if dx != 0 { 2 } else { 1 },
        dy,
        dx,
        0,
    ) {
        e.post(CGEventTapLocation::Session);
    }
}
