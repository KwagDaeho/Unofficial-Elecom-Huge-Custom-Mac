//! Cursor move + scroll injection.

use core_graphics::event::{
    CGEvent, CGEventTapLocation, CGEventType, CGMouseButton, EventField, ScrollEventUnit,
};
use core_graphics::geometry::CGPoint;
use std::sync::atomic::{AtomicBool, Ordering};

use super::{buttons_down, cursor_pos, cursor_state, hid_source};
use parking_lot::Mutex;
use std::time::{Duration, Instant};

static SHARED_POINTER_MODE: AtomicBool = AtomicBool::new(true);
static PINNED_CURSOR: Mutex<Option<CGPoint>> = Mutex::new(None);
static BALL_GESTURE: AtomicBool = AtomicBool::new(false);
static LAST_BALL_SCROLL: Mutex<Option<Instant>> = Mutex::new(None);

const SCROLL_PHASE_FIELD: u32 = 99;
const PHASE_BEGAN: i64 = 1;
const PHASE_CHANGED: i64 = 2;
const PHASE_ENDED: i64 = 4;
const BALL_GESTURE_IDLE: Duration = Duration::from_millis(80);

#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
    fn CGWarpMouseCursorPosition(newCursorPosition: CGPoint) -> i32;
    fn CGAssociateMouseAndMouseCursorPosition(connected: bool) -> i32;
    fn CGSetLocalEventsSuppressionInterval(seconds: f64);
}

static CURSOR_FROZEN: AtomicBool = AtomicBool::new(false);
static RESTORE_SYNC: Mutex<Option<(CGPoint, Instant)>> = Mutex::new(None);

const RESTORE_SYNC_TTL: Duration = Duration::from_millis(250);
/// Drop ball HID as pointer motion after unpin (ball-scroll + gesture hold).
pub const POST_UNPIN_BALL_IGNORE: Duration = Duration::from_millis(350);

pub(super) fn cursor_is_pinned() -> bool {
    CURSOR_FROZEN.load(Ordering::SeqCst)
}

fn zero_warp_suppression() {
    // Default 0.25s after CGWarp dumps later HID deltas as a jump.
    unsafe {
        CGSetLocalEventsSuppressionInterval(0.0);
    }
}

fn freeze_os_cursor() {
    zero_warp_suppression();
    unsafe {
        let _ = CGAssociateMouseAndMouseCursorPosition(false);
    }
}

fn unfreeze_os_cursor() {
    zero_warp_suppression();
    unsafe {
        let _ = CGAssociateMouseAndMouseCursorPosition(true);
    }
}

fn warp_cursor(p: CGPoint) {
    zero_warp_suppression();
    unsafe {
        let _ = CGWarpMouseCursorPosition(p);
    }
}

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

/// Freeze the on-screen pointer so ball-as-scroll HID deltas cannot walk it.
pub fn pin_cursor() {
    pin_cursor_with_badge(super::cursor_badge::show);
}

/// Freeze pointer while recording a gesture path — filled purple badge.
pub fn pin_cursor_gesture() {
    pin_cursor_with_badge(super::cursor_badge::show_gesture);
}

fn pin_cursor_with_badge(show_badge: fn()) {
    let p = cursor_pos();
    *PINNED_CURSOR.lock() = Some(p);
    *cursor_state().lock() = p;
    CURSOR_FROZEN.store(true, Ordering::SeqCst);
    RESTORE_SYNC.lock().take();
    crate::platform::suppress::set_cursor_lock(Some((p.x, p.y)));
    freeze_os_cursor();
    warp_cursor(p);
    show_badge();
}

/// Warp back to the pin each HID packet. Association is ignored while we
/// are a background app, so this is what actually holds the pointer still.
pub fn keep_pinned_cursor() {
    if !CURSOR_FROZEN.load(Ordering::SeqCst) {
        return;
    }
    if let Some(p) = *PINNED_CURSOR.lock() {
        warp_cursor(p);
        *cursor_state().lock() = p;
    }
}

fn unpin_at(p: CGPoint) {
    warp_cursor(p);
    *cursor_state().lock() = p;
    unfreeze_os_cursor();
    warp_cursor(p);
    *cursor_state().lock() = p;
}

/// Release ball-scroll / gesture pin. Re-associate at the pin and swallow stale
/// OS mouse deltas on the first moved event (see suppress tap).
pub fn restore_pinned_cursor() {
    end_ball_scroll_gesture();
    super::cursor_badge::hide();
    CURSOR_FROZEN.store(false, Ordering::SeqCst);
    let Some(p) = *PINNED_CURSOR.lock() else {
        crate::platform::suppress::set_cursor_lock(None);
        finish_restore_sync();
        return;
    };
    warp_cursor(p);
    *cursor_state().lock() = p;
    *RESTORE_SYNC.lock() = Some((p, Instant::now() + RESTORE_SYNC_TTL));
    crate::platform::suppress::set_cursor_lock(None);
    // Re-associate now; stale ball accumulation is cleared on the first moved event.
    unfreeze_os_cursor();
    warp_cursor(p);
    *cursor_state().lock() = p;
}

/// App exit: drop pin, badge, and cursor association immediately.
pub fn release_ball_scroll_pin() {
    end_ball_scroll_gesture();
    super::cursor_badge::shutdown();
    release_pin_state();
}

/// ⌘Q from the event tap — no main-thread AppKit scheduling.
pub fn release_ball_scroll_pin_for_quit() {
    end_ball_scroll_gesture();
    super::cursor_badge::abort_for_quit();
    release_pin_state();
}

fn release_pin_state() {
    CURSOR_FROZEN.store(false, Ordering::SeqCst);
    crate::platform::suppress::set_cursor_lock(None);
    RESTORE_SYNC.lock().take();
    if let Some(p) = PINNED_CURSOR.lock().take() {
        unpin_at(p);
    } else {
        unfreeze_os_cursor();
    }
}

pub fn restore_sync_pin() -> Option<CGPoint> {
    let slot = RESTORE_SYNC.lock();
    match slot.as_ref() {
        Some((p, until)) if Instant::now() < *until => Some(*p),
        _ => None,
    }
}

pub fn finish_restore_sync() {
    let sync_pin = RESTORE_SYNC.lock().take().map(|(p, _)| p);
    if let Some(p) = PINNED_CURSOR.lock().take().or(sync_pin) {
        unpin_at(p);
    } else {
        unfreeze_os_cursor();
        sync_cursor_from_system();
    }
}

pub fn expire_restore_sync_if_due() {
    let due = RESTORE_SYNC
        .lock()
        .as_ref()
        .is_some_and(|(_, until)| Instant::now() >= *until);
    if due {
        finish_restore_sync();
    }
}

pub fn move_by(dx: f64, dy: f64) {
    if dx == 0.0 && dy == 0.0 {
        return;
    }

    if let Some(p) = restore_sync_pin() {
        finish_restore_sync();
        warp_cursor(p);
        *cursor_state().lock() = p;
        return;
    }

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
/// HID units → pixels at ball-scroll 1.0×. Higher = slower default than wheel notches.
const BALL_SCROLL_DIV: f64 = 16.0;

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
    post_scroll_gesture(px, py, continuous, None);
}

/// Ball HID deltas → independent X/Y scroll. Uses ball.speed only (not wheel speed).
pub fn scroll_ball(
    hid_dx: i16,
    hid_dy: i16,
    ball: &crate::domain::profile::BallScrollSettings,
) {
    if hid_dx == 0 && hid_dy == 0 {
        end_idle_ball_scroll();
        return;
    }
    end_idle_ball_scroll();
    let scale = SCROLL_BASE_VERTICAL_PX / BALL_SCROLL_DIV * ball.speed();
    let mut py = hid_dy as f64 * scale;
    let mut px = hid_dx as f64 * scale;
    // CGEvent axis 2 is opposite HID +x (same as tilt-pan).
    px = -px;
    if ball.invert_vertical {
        py = -py;
    }
    if ball.invert_horizontal {
        px = -px;
    }
    let phase = if BALL_GESTURE.swap(true, Ordering::SeqCst) {
        PHASE_CHANGED
    } else {
        PHASE_BEGAN
    };
    post_scroll_gesture(round_scroll_px(px), round_scroll_px(py), true, Some(phase));
    *LAST_BALL_SCROLL.lock() = Some(Instant::now());
}

/// Close a ball-scroll gesture after the ball stops, so apps do not stay
/// locked to the first axis of a previous swipe.
pub fn end_idle_ball_scroll() {
    let stale = LAST_BALL_SCROLL
        .lock()
        .map(|t| t.elapsed() >= BALL_GESTURE_IDLE)
        .unwrap_or(false);
    if stale {
        end_ball_scroll_gesture();
    }
}

fn end_ball_scroll_gesture() {
    *LAST_BALL_SCROLL.lock() = None;
    if BALL_GESTURE.swap(false, Ordering::SeqCst) {
        post_scroll_gesture(0, 0, true, Some(PHASE_ENDED));
    }
}

fn round_scroll_px(v: f64) -> i32 {
    if v == 0.0 {
        return 0;
    }
    let rounded = v.round() as i32;
    if rounded == 0 {
        if v >= 0.0 {
            1
        } else {
            -1
        }
    } else {
        rounded
    }
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
fn post_scroll_gesture(dx_px: i32, dy_px: i32, continuous: bool, phase: Option<i64>) {
    if dx_px == 0 && dy_px == 0 && phase != Some(PHASE_ENDED) {
        return;
    }
    let src = hid_source();
    // 2 wheels whenever horizontal or a 2-axis gesture is in play.
    let wheel_count = if phase.is_some() || dx_px != 0 { 2 } else { 1 };
    let dy_lines = ((dy_px as f64) / 10.0).round() as i32;
    let dx_lines = ((dx_px as f64) / 10.0).round() as i32;
    let Ok(e) = CGEvent::new_scroll_event(
        src,
        ScrollEventUnit::PIXEL,
        wheel_count,
        dy_px,
        dx_px,
        0,
    ) else {
        return;
    };
    let dy_line_out = if dy_lines != 0 {
        dy_lines
    } else if dy_px != 0 {
        dy_px.signum()
    } else {
        0
    };
    let dx_line_out = if dx_lines != 0 {
        dx_lines
    } else if dx_px != 0 {
        dx_px.signum()
    } else {
        0
    };
    e.set_integer_value_field(
        EventField::SCROLL_WHEEL_EVENT_DELTA_AXIS_1,
        dy_line_out as i64,
    );
    e.set_integer_value_field(
        EventField::SCROLL_WHEEL_EVENT_POINT_DELTA_AXIS_1,
        dy_px as i64,
    );
    e.set_integer_value_field(
        EventField::SCROLL_WHEEL_EVENT_FIXED_POINT_DELTA_AXIS_1,
        (dy_line_out as i64) * 0x10000,
    );
    if wheel_count >= 2 {
        e.set_integer_value_field(
            EventField::SCROLL_WHEEL_EVENT_DELTA_AXIS_2,
            dx_line_out as i64,
        );
        e.set_integer_value_field(
            EventField::SCROLL_WHEEL_EVENT_POINT_DELTA_AXIS_2,
            dx_px as i64,
        );
        e.set_integer_value_field(
            EventField::SCROLL_WHEEL_EVENT_FIXED_POINT_DELTA_AXIS_2,
            (dx_line_out as i64) * 0x10000,
        );
    }
    e.set_integer_value_field(
        EventField::SCROLL_WHEEL_EVENT_IS_CONTINUOUS,
        i64::from(continuous || phase.is_some()),
    );
    if let Some(p) = phase {
        e.set_integer_value_field(SCROLL_PHASE_FIELD, p);
    }
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
