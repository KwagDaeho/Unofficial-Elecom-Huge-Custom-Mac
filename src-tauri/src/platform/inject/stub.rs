//! Non-macOS inject stubs (permissions live in `platform::permissions`).

use crate::domain::device::ButtonId;
use crate::domain::profile::Action;

pub fn click_at_cursor() {}
pub fn left_down_at_cursor() {}
pub fn left_up_at_cursor() {}
pub fn left_drag_at_cursor() {}
pub fn pin_cursor() {}
pub fn pin_cursor_gesture() {}
pub fn restore_pinned_cursor() {}
pub fn release_ball_scroll_pin() {}
pub fn release_ball_scroll_pin_for_quit() {}
pub fn keep_pinned_cursor() {}
pub fn restore_sync_pin() -> Option<core_graphics::geometry::CGPoint> {
    None
}
pub fn finish_restore_sync() {}
pub fn expire_restore_sync_if_due() {}
pub fn expire_post_unpin_if_due() {}
pub fn maintain_post_unpin_cursor() {}
pub fn restore_cursor_active() -> bool {
    false
}
pub fn maintain_restored_cursor() {}
pub fn expire_restored_cursor_if_due() {}
pub fn tick_restore_cursor(_hid_dx: f64, _hid_dy: f64) {}
pub fn post_unpin_active() -> Option<core_graphics::geometry::CGPoint> {
    None
}
pub fn end_idle_ball_scroll() {}
pub fn move_by(_dx: f64, _dy: f64) {}
pub fn scroll(_dx_lines: i32, _dy_lines: i32) {}
pub fn scroll_pixels(_dx: i32, _dy: i32) {}
pub fn scroll_notches(
    _dx_notches: f64,
    _dy_notches: f64,
    _pointer: &crate::domain::profile::PointerSettings,
) {
}
pub fn scroll_notches_ex(
    _dx_notches: f64,
    _dy_notches: f64,
    _pointer: &crate::domain::profile::PointerSettings,
    _continuous: bool,
) {
}
pub fn scroll_ball(
    _hid_dx: i16,
    _hid_dy: i16,
    _ball: &crate::domain::profile::BallScrollSettings,
) {
}
pub fn scroll_by_units(
    _dx_units: i32,
    _dy_units: i32,
    _pointer: &crate::domain::profile::PointerSettings,
) {
}
pub fn scroll_by_units_ex(
    _dx_units: i32,
    _dy_units: i32,
    _pointer: &crate::domain::profile::PointerSettings,
    _continuous: bool,
) {
}
pub fn set_shared_pointer_mode(_shared: bool) {}
pub fn shared_pointer_mode() -> bool {
    false
}
pub fn synthetic_buttons_held() -> bool {
    false
}
pub fn press_action(
    _id: ButtonId,
    _action: &Action,
    _pointer: &crate::domain::profile::PointerSettings,
) {
}
pub fn press_action_forced(
    id: ButtonId,
    action: &Action,
    pointer: &crate::domain::profile::PointerSettings,
) {
    press_action(id, action, pointer);
}
pub fn release_action(_id: ButtonId, _action: &Action) {}
pub fn release_action_forced(id: ButtonId, action: &Action) {
    release_action(id, action);
}
pub fn default_mouse_button(
    _id: ButtonId,
) -> Option<crate::domain::profile::MouseClickButton> {
    None
}
pub fn release_chord_hold(_modifiers: &[String], _keys: &[String]) {}
pub fn keystroke_isolated(_keys: &[String]) {}
pub fn with_chord_action<F: FnOnce()>(_mods: &[String], f: F) {
    f();
}
pub fn chord_action_inject() -> bool {
    false
}
pub fn should_block_chord_modifier(_name: &str) -> bool {
    false
}
pub fn set_gesture_record_overlay_active(_active: bool) {}
pub fn clear_gesture_record_overlay_stroke() {}
pub fn append_gesture_record_cursor_point() {}
pub fn append_gesture_record_screen_point(_x: f64, _y: f64) {}
pub fn shutdown_gesture_record_overlay() {}
