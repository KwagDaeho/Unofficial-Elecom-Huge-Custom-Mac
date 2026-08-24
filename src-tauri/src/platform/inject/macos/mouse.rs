//! Synthetic mouse button down/up and click helpers.

use core_graphics::event::{CGEvent, CGEventTapLocation, CGEventType, CGMouseButton, EventField};

use crate::domain::profile::MouseClickButton;

use super::{
    buttons_down, cursor_pos, cursor_state, hid_source, source, sync_motion_suppress,
};

#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
    fn CGAssociateMouseAndMouseCursorPosition(connected: bool) -> i32;
}

/// True while we have synthesized a mouse button down (e.g. Fn → left click).
pub fn synthetic_buttons_held() -> bool {
    buttons_down().lock().any()
}

fn post_mouse_event(e: &CGEvent, button: &MouseClickButton) {
    // HID posts go through our suppress tap. When that button's OS stream is
    // suppressed (remap / auto-click / long-press), post at Session so the
    // synth click isn't deleted with the real HUGE click.
    if crate::platform::suppress::os_mouse_button_suppressed(button) {
        e.post(CGEventTapLocation::Session);
    } else {
        e.post(CGEventTapLocation::HID);
    }
}

fn cg_button(button: &MouseClickButton) -> (CGEventType, CGEventType, CGMouseButton, i64, bool) {
    match button {
        MouseClickButton::Left => (
            CGEventType::LeftMouseDown,
            CGEventType::LeftMouseUp,
            CGMouseButton::Left,
            0,
            false,
        ),
        MouseClickButton::Right => (
            CGEventType::RightMouseDown,
            CGEventType::RightMouseUp,
            CGMouseButton::Right,
            1,
            false,
        ),
        // OtherMouse + buttonNumber 2. mouseButton param is the button index for Other*.
        MouseClickButton::Middle => (
            CGEventType::OtherMouseDown,
            CGEventType::OtherMouseUp,
            CGMouseButton::Center,
            2,
            true,
        ),
        MouseClickButton::Back => (
            CGEventType::OtherMouseDown,
            CGEventType::OtherMouseUp,
            CGMouseButton::Left,
            3,
            true,
        ),
        MouseClickButton::Forward => (
            CGEventType::OtherMouseDown,
            CGEventType::OtherMouseUp,
            CGMouseButton::Left,
            4,
            true,
        ),
    }
}

pub fn mouse_down(button: &MouseClickButton) {
    let (down, _, cg_btn, number, other) = cg_button(button);
    let src = if other { hid_source() } else { source() };
    let Some(src) = src else {
        log::warn!("mouse_down: CGEventSource unavailable");
        return;
    };
    let pos = {
        let mut p = cursor_state().lock();
        *p = cursor_pos();
        *p
    };
    buttons_down().lock().set(button, true);
    sync_motion_suppress();
    if let Ok(e) = CGEvent::new_mouse_event(src, down, pos, cg_btn) {
        e.set_integer_value_field(EventField::MOUSE_EVENT_BUTTON_NUMBER, number);
        e.set_integer_value_field(EventField::MOUSE_EVENT_CLICK_STATE, 1);
        post_mouse_event(&e, button);
    }
}

pub fn mouse_up(button: &MouseClickButton) {
    let (_, up, cg_btn, number, other) = cg_button(button);
    let src = if other { hid_source() } else { source() };
    let Some(src) = src else {
        log::warn!("mouse_up: CGEventSource unavailable");
        return;
    };
    let pos = {
        let mut p = cursor_state().lock();
        *p = cursor_pos();
        *p
    };
    buttons_down().lock().set(button, false);
    sync_motion_suppress();
    if let Ok(e) = CGEvent::new_mouse_event(src, up, pos, cg_btn) {
        e.set_integer_value_field(EventField::MOUSE_EVENT_BUTTON_NUMBER, number);
        e.set_integer_value_field(EventField::MOUSE_EVENT_CLICK_STATE, 1);
        post_mouse_event(&e, button);
    }
    if !super::cursor_is_pinned() {
        unsafe {
            let _ = CGAssociateMouseAndMouseCursorPosition(true);
        }
    }
}

pub(super) fn click_once(button: &MouseClickButton, click_state: i64) {
    let (down, up, cg_btn, number, other) = cg_button(button);
    let src = if other { hid_source() } else { source() };
    let Some(src) = src else {
        log::warn!("click_once: CGEventSource unavailable");
        return;
    };
    let pos = {
        let mut p = cursor_state().lock();
        *p = cursor_pos();
        *p
    };
    if let Ok(e) = CGEvent::new_mouse_event(src.clone(), down, pos, cg_btn) {
        e.set_integer_value_field(EventField::MOUSE_EVENT_BUTTON_NUMBER, number);
        e.set_integer_value_field(EventField::MOUSE_EVENT_CLICK_STATE, click_state);
        post_mouse_event(&e, button);
    }
    std::thread::sleep(std::time::Duration::from_millis(16));
    if let Ok(e) = CGEvent::new_mouse_event(src, up, pos, cg_btn) {
        e.set_integer_value_field(EventField::MOUSE_EVENT_BUTTON_NUMBER, number);
        e.set_integer_value_field(EventField::MOUSE_EVENT_CLICK_STATE, click_state);
        post_mouse_event(&e, button);
    }
}

pub(super) fn double_click() {
    click_once(&MouseClickButton::Left, 1);
    std::thread::sleep(std::time::Duration::from_millis(40));
    click_once(&MouseClickButton::Left, 2);
    // Ensure we didn't leave synthetic button / motion-suppress state sticky.
    buttons_down().lock().set(&MouseClickButton::Left, false);
    sync_motion_suppress();
}

/// Post a left click at the cursor for webview UI (HUGE L → modal buttons).
pub fn click_at_cursor() {
    let pos = cursor_pos();
    let Some(src) = source() else {
        return;
    };
    if let Ok(down) = CGEvent::new_mouse_event(
        src.clone(),
        CGEventType::LeftMouseDown,
        pos,
        CGMouseButton::Left,
    ) {
        down.set_integer_value_field(EventField::MOUSE_EVENT_CLICK_STATE, 1);
        down.post(CGEventTapLocation::Session);
    }
    std::thread::sleep(std::time::Duration::from_millis(16));
    if let Ok(up) = CGEvent::new_mouse_event(
        src,
        CGEventType::LeftMouseUp,
        pos,
        CGMouseButton::Left,
    ) {
        up.set_integer_value_field(EventField::MOUSE_EVENT_CLICK_STATE, 1);
        up.post(CGEventTapLocation::Session);
    }
}

/// Hold left button at cursor (gesture canvas drag start).
pub fn left_down_at_cursor() {
    let pos = cursor_pos();
    let Some(src) = source() else {
        return;
    };
    if let Ok(down) = CGEvent::new_mouse_event(
        src,
        CGEventType::LeftMouseDown,
        pos,
        CGMouseButton::Left,
    ) {
        down.set_integer_value_field(EventField::MOUSE_EVENT_CLICK_STATE, 1);
        down.post(CGEventTapLocation::Session);
    }
}

/// Release left button at cursor (gesture canvas drag end).
pub fn left_up_at_cursor() {
    let pos = cursor_pos();
    let Some(src) = source() else {
        return;
    };
    if let Ok(up) = CGEvent::new_mouse_event(
        src,
        CGEventType::LeftMouseUp,
        pos,
        CGMouseButton::Left,
    ) {
        up.set_integer_value_field(EventField::MOUSE_EVENT_CLICK_STATE, 1);
        up.post(CGEventTapLocation::Session);
    }
}

/// Notify webview of drag while left is held (ball moved during gesture record).
pub fn left_drag_at_cursor() {
    let pos = cursor_pos();
    let Some(src) = source() else {
        return;
    };
    if let Ok(drag) = CGEvent::new_mouse_event(
        src,
        CGEventType::LeftMouseDragged,
        pos,
        CGMouseButton::Left,
    ) {
        drag.set_integer_value_field(EventField::MOUSE_EVENT_CLICK_STATE, 1);
        drag.post(CGEventTapLocation::Session);
    }
}
