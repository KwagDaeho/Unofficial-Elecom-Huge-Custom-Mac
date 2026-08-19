//! Shared macOS inject state and helpers used across pointer / mouse / action.

mod action;
mod keyboard;
mod mouse;
mod pointer;
mod cursor_badge;

pub use action::{
    default_mouse_button, press_action, press_action_forced, release_action, release_action_forced,
};
pub use keyboard::{keystroke_isolated, release_chord_hold};
pub use mouse::synthetic_buttons_held;
pub use mouse::click_at_cursor;
// mouse_down / mouse_up stay crate-visible via mouse::* for action; also re-export for API parity.
#[allow(unused_imports)]
pub use mouse::{mouse_down, mouse_up};
pub use pointer::{
    end_idle_ball_scroll, expire_restore_sync_if_due, finish_restore_sync, keep_pinned_cursor,
    move_by, pin_cursor, release_ball_scroll_pin, release_ball_scroll_pin_for_quit,
    restore_pinned_cursor, restore_sync_pin, scroll_ball, scroll_by_units_ex,
    scroll_notches_ex, set_shared_pointer_mode, shared_pointer_mode, sync_cursor_from_system,
};
// Extra scroll helpers kept public for API parity with the former monolith.
#[allow(unused_imports)]
pub use pointer::{
    scroll, scroll_by_units, scroll_notches, scroll_pixels, SCROLL_BASE_HORIZONTAL_PX,
    SCROLL_BASE_VERTICAL_PX,
};

use core_graphics::event::CGEvent;
use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};
use core_graphics::geometry::CGPoint;
use parking_lot::Mutex;
use std::collections::HashSet;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::OnceLock;

use crate::domain::profile::MouseClickButton;

fn source() -> CGEventSource {
    CGEventSource::new(CGEventSourceStateID::CombinedSessionState).expect("CGEventSource")
}

/// Hardware-like source — middle / other buttons are more reliable with this.
fn hid_source() -> CGEventSource {
    CGEventSource::new(CGEventSourceStateID::HIDSystemState).unwrap_or_else(|_| source())
}

fn cursor_pos() -> CGPoint {
    CGEvent::new(source())
        .map(|e| e.location())
        .unwrap_or(CGPoint::new(0.0, 0.0))
}

static CURSOR: OnceLock<Mutex<CGPoint>> = OnceLock::new();
static BUTTONS_DOWN: OnceLock<Mutex<ButtonsDown>> = OnceLock::new();

#[derive(Default, Clone, Copy)]
struct ButtonsDown {
    left: bool,
    right: bool,
    middle: bool,
    back: bool,
    forward: bool,
}

impl ButtonsDown {
    fn set(&mut self, button: &MouseClickButton, down: bool) {
        match button {
            MouseClickButton::Left => self.left = down,
            MouseClickButton::Right => self.right = down,
            MouseClickButton::Middle => self.middle = down,
            MouseClickButton::Back => self.back = down,
            MouseClickButton::Forward => self.forward = down,
        }
    }

    fn any(&self) -> bool {
        self.left || self.right || self.middle || self.back || self.forward
    }

    /// Which drag event to emit while moving with a button held.
    fn drag_kind(
        self,
    ) -> Option<(
        core_graphics::event::CGEventType,
        core_graphics::event::CGMouseButton,
        Option<i64>,
    )> {
        use core_graphics::event::{CGEventType, CGMouseButton};
        if self.left {
            Some((CGEventType::LeftMouseDragged, CGMouseButton::Left, None))
        } else if self.right {
            Some((CGEventType::RightMouseDragged, CGMouseButton::Right, None))
        } else if self.middle {
            Some((
                CGEventType::OtherMouseDragged,
                CGMouseButton::Center,
                Some(2),
            ))
        } else if self.back {
            Some((
                CGEventType::OtherMouseDragged,
                CGMouseButton::Left,
                Some(3),
            ))
        } else if self.forward {
            Some((
                CGEventType::OtherMouseDragged,
                CGMouseButton::Left,
                Some(4),
            ))
        } else {
            None
        }
    }
}

fn cursor_is_pinned() -> bool {
    pointer::cursor_is_pinned()
}

fn cursor_state() -> &'static Mutex<CGPoint> {
    CURSOR.get_or_init(|| Mutex::new(cursor_pos()))
}

fn buttons_down() -> &'static Mutex<ButtonsDown> {
    BUTTONS_DOWN.get_or_init(|| Mutex::new(ButtonsDown::default()))
}

fn sync_motion_suppress() {
    let held = buttons_down().lock().any();
    crate::platform::suppress::set_suppress_motion(held);
}

static CHORD_ACTION_INJECT: AtomicBool = AtomicBool::new(false);
static CHORD_BLOCK_MODS: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();

fn chord_block_mods() -> &'static Mutex<HashSet<String>> {
    CHORD_BLOCK_MODS.get_or_init(|| Mutex::new(HashSet::new()))
}

/// Run an injected action without physical chord modifiers polluting keystrokes.
pub fn with_chord_action<F: FnOnce()>(mods: &[String], f: F) {
    {
        let mut block = chord_block_mods().lock();
        block.clear();
        block.extend(mods.iter().cloned());
    }
    CHORD_ACTION_INJECT.store(true, Ordering::SeqCst);
    f();
    CHORD_ACTION_INJECT.store(false, Ordering::SeqCst);
    chord_block_mods().lock().clear();
}

pub fn chord_action_inject() -> bool {
    CHORD_ACTION_INJECT.load(Ordering::SeqCst)
}

pub fn should_block_chord_modifier(name: &str) -> bool {
    chord_block_mods().lock().contains(name)
}
