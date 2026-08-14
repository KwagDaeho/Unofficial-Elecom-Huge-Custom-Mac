//! OS event injection + macOS permission helpers.

use crate::device::ButtonId;
use crate::profile::{Action, MacroStep, MouseClickButton, SystemCommand};

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionStatus {
    pub accessibility: bool,
    pub input_monitoring: bool,
    pub post_event: bool,
    pub ready: bool,
}

#[cfg(target_os = "macos")]
mod macos {
    use super::*;
    use core_graphics::event::{
        CGEvent, CGEventFlags, CGEventTapLocation, CGEventType, CGMouseButton, EventField,
        ScrollEventUnit,
    };
    use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};
    use core_graphics::geometry::CGPoint;
    use parking_lot::Mutex;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::OnceLock;

    static SHARED_POINTER_MODE: AtomicBool = AtomicBool::new(true);

    pub fn set_shared_pointer_mode(shared: bool) {
        SHARED_POINTER_MODE.store(shared, Ordering::SeqCst);
    }

    pub fn shared_pointer_mode() -> bool {
        SHARED_POINTER_MODE.load(Ordering::SeqCst)
    }

    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" {
        fn CGPreflightListenEventAccess() -> bool;
        fn CGRequestListenEventAccess() -> bool;
        fn CGPreflightPostEventAccess() -> bool;
        fn CGRequestPostEventAccess() -> bool;
        fn CGWarpMouseCursorPosition(newCursorPosition: CGPoint) -> i32;
        fn CGAssociateMouseAndMouseCursorPosition(connected: bool) -> i32;
        fn CGEventSourceSetLocalEventsSuppressionInterval(
            source: *mut std::ffi::c_void,
            seconds: f64,
        );
        fn CGEventCreate(source: *mut std::ffi::c_void) -> *mut std::ffi::c_void;
        fn CGEventSetType(event: *mut std::ffi::c_void, event_type: u32);
        fn CGEventSetFlags(event: *mut std::ffi::c_void, flags: u64);
        fn CGEventSetIntegerValueField(event: *mut std::ffi::c_void, field: u32, value: i64);
        fn CGEventPost(tap: u32, event: *mut std::ffi::c_void);
        fn CGEventSourceCreate(state_id: u32) -> *mut std::ffi::c_void;
    }

    #[link(name = "CoreFoundation", kind = "framework")]
    extern "C" {
        fn CFRelease(cf: *mut std::ffi::c_void);
    }

    /// Private Dock SPI — toggles Launchpad / Tahoe “Apps” view (same action as
    /// System Settings → 앱 보기), independent of the user’s chosen hotkey.
    #[link(name = "ApplicationServices", kind = "framework")]
    extern "C" {
        fn CoreDockSendNotification(notification: core_foundation::string::CFStringRef);
    }

    fn source() -> CGEventSource {
        CGEventSource::new(CGEventSourceStateID::CombinedSessionState)
            .expect("CGEventSource")
    }

    /// Hardware-like source — middle / other buttons are more reliable with this.
    fn hid_source() -> CGEventSource {
        CGEventSource::new(CGEventSourceStateID::HIDSystemState)
            .unwrap_or_else(|_| source())
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
        fn drag_kind(self) -> Option<(CGEventType, CGMouseButton, Option<i64>)> {
            if self.left {
                Some((CGEventType::LeftMouseDragged, CGMouseButton::Left, None))
            } else if self.right {
                Some((CGEventType::RightMouseDragged, CGMouseButton::Right, None))
            } else if self.middle {
                Some((CGEventType::OtherMouseDragged, CGMouseButton::Center, Some(2)))
            } else if self.back {
                Some((CGEventType::OtherMouseDragged, CGMouseButton::Left, Some(3)))
            } else if self.forward {
                Some((CGEventType::OtherMouseDragged, CGMouseButton::Left, Some(4)))
            } else {
                None
            }
        }
    }

    fn cursor_state() -> &'static Mutex<CGPoint> {
        CURSOR.get_or_init(|| Mutex::new(cursor_pos()))
    }

    fn buttons_down() -> &'static Mutex<ButtonsDown> {
        BUTTONS_DOWN.get_or_init(|| Mutex::new(ButtonsDown::default()))
    }

    fn sync_motion_suppress() {
        let held = buttons_down().lock().any();
        crate::suppress::set_suppress_motion(held);
    }

    /// True while we have synthesized a mouse button down (e.g. Fn → left click).
    pub fn synthetic_buttons_held() -> bool {
        buttons_down().lock().any()
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
        pointer: &crate::profile::PointerSettings,
    ) {
        scroll_notches_ex(dx_notches, dy_notches, pointer, false);
    }

    /// `continuous`: match trackpad-style gestures so a held horizontal scroll
    /// is not dropped when another device is mid vertical scroll.
    pub fn scroll_notches_ex(
        dx_notches: f64,
        dy_notches: f64,
        pointer: &crate::profile::PointerSettings,
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
    pub fn scroll_by_units(dx_units: i32, dy_units: i32, pointer: &crate::profile::PointerSettings) {
        scroll_by_units_ex(dx_units, dy_units, pointer, false);
    }

    pub fn scroll_by_units_ex(
        dx_units: i32,
        dy_units: i32,
        pointer: &crate::profile::PointerSettings,
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

    fn post_mouse_event(e: &CGEvent, button: &MouseClickButton) {
        // HID posts go through our suppress tap. When that button's OS stream is
        // suppressed (remap / auto-click / long-press), post at Session so the
        // synth click isn't deleted with the real HUGE click.
        if crate::suppress::os_mouse_button_suppressed(button) {
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
        unsafe {
            let _ = CGAssociateMouseAndMouseCursorPosition(true);
        }
    }

    fn click_once(button: &MouseClickButton, click_state: i64) {
        let (down, up, cg_btn, number, other) = cg_button(button);
        let src = if other { hid_source() } else { source() };
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

    fn double_click() {
        click_once(&MouseClickButton::Left, 1);
        std::thread::sleep(std::time::Duration::from_millis(40));
        click_once(&MouseClickButton::Left, 2);
        // Ensure we didn't leave synthetic button / motion-suppress state sticky.
        buttons_down().lock().set(&MouseClickButton::Left, false);
        sync_motion_suppress();
    }

    fn key_code(name: &str) -> Option<u16> {
        Some(match name.to_ascii_lowercase().as_str() {
            "a" => 0x00,
            "s" => 0x01,
            "d" => 0x02,
            "f" => 0x03,
            "h" => 0x04,
            "g" => 0x05,
            "z" => 0x06,
            "x" => 0x07,
            "c" => 0x08,
            "v" => 0x09,
            "b" => 0x0b,
            "q" => 0x0c,
            "w" => 0x0d,
            "e" => 0x0e,
            "r" => 0x0f,
            "y" => 0x10,
            "t" => 0x11,
            "1" => 0x12,
            "2" => 0x13,
            "3" => 0x14,
            "4" => 0x15,
            "5" => 0x17,
            "6" => 0x16,
            "=" | "equal" => 0x18,
            "9" => 0x19,
            "7" => 0x1a,
            "-" | "minus" => 0x1b,
            "8" => 0x1c,
            "0" => 0x1d,
            "]" => 0x1e,
            "o" => 0x1f,
            "u" => 0x20,
            "[" => 0x21,
            "i" => 0x22,
            "p" => 0x23,
            "l" => 0x25,
            "j" => 0x26,
            "'" | "quote" => 0x27,
            "k" => 0x28,
            ";" | "semicolon" => 0x29,
            "\\" | "backslash" => 0x2a,
            "," => 0x2b,
            "/" | "slash" => 0x2c,
            "n" => 0x2d,
            "m" => 0x2e,
            "." => 0x2f,
            "space" => 0x31,
            "tab" => 0x30,
            "return" | "enter" => 0x24,
            "escape" | "esc" => 0x35,
            "delete" | "backspace" => 0x33,
            "left" | "arrow_left" | "arrowleft" => 0x7b,
            "right" | "arrow_right" | "arrowright" => 0x7c,
            "down" | "arrow_down" | "arrowdown" => 0x7d,
            "up" | "arrow_up" | "arrowup" => 0x7e,
            "f1" => 0x7a,
            "f2" => 0x78,
            "f3" => 0x63,
            "f4" => 0x76,
            "f5" => 0x60,
            "f6" => 0x61,
            "f7" => 0x62,
            "f8" => 0x64,
            "f9" => 0x65,
            "f10" => 0x6d,
            "f11" => 0x67,
            "f12" => 0x6f,
            "volume_up" | "sound_up" => 0x48,
            "volume_down" | "sound_down" => 0x49,
            "mute" | "sound_mute" => 0x4a,
            "play" | "play_pause" | "playpause" => 0x42,
            "next" | "next_track" | "nexttrack" => 0x43,
            "previous" | "previous_track" | "previoustrack" => 0x44,
            _ => return None,
        })
    }

    fn is_modifier(name: &str) -> Option<CGEventFlags> {
        match name.to_ascii_lowercase().as_str() {
            "meta" | "cmd" | "command" | "left_meta" | "right_meta" | "left_command"
            | "right_command" => Some(CGEventFlags::CGEventFlagCommand),
            "alt" | "option" | "left_alt" | "right_alt" | "left_option" | "right_option" => {
                Some(CGEventFlags::CGEventFlagAlternate)
            }
            "ctrl" | "control" | "left_ctrl" | "right_ctrl" | "left_control" | "right_control" => {
                Some(CGEventFlags::CGEventFlagControl)
            }
            "shift" | "left_shift" | "right_shift" => Some(CGEventFlags::CGEventFlagShift),
            "fn" | "function" => Some(CGEventFlags::CGEventFlagSecondaryFn),
            _ => None,
        }
    }

    /// Physical keycodes for modifiers (left-side). Needed so OS modifier state
    /// does not stick after a chord — flag-only events leave Control "down",
    /// which turns the next left-click into a right-click on macOS.
    fn modifier_keycode(flag: CGEventFlags) -> Option<u16> {
        if flag.contains(CGEventFlags::CGEventFlagControl) {
            Some(0x3b) // Left Control
        } else if flag.contains(CGEventFlags::CGEventFlagAlternate) {
            Some(0x3a) // Left Option
        } else if flag.contains(CGEventFlags::CGEventFlagShift) {
            Some(0x38) // Left Shift
        } else if flag.contains(CGEventFlags::CGEventFlagCommand) {
            Some(0x37) // Left Command
        } else if flag.contains(CGEventFlags::CGEventFlagSecondaryFn) {
            Some(0x3f) // Fn
        } else {
            None
        }
    }

    fn post_key(src: &CGEventSource, code: u16, key_down: bool, flags: CGEventFlags) {
        if let Ok(e) = CGEvent::new_keyboard_event(src.clone(), code, key_down) {
            e.set_flags(flags);
            e.post(CGEventTapLocation::HID);
        }
    }

    fn keystroke(keys: &[String]) {
        let mut flags = CGEventFlags::empty();
        let mut mod_order: Vec<CGEventFlags> = Vec::new();
        let mut main_key: Option<u16> = None;
        for k in keys {
            if let Some(f) = is_modifier(k) {
                if !flags.contains(f) {
                    flags.insert(f);
                    mod_order.push(f);
                }
            } else if let Some(code) = key_code(k) {
                main_key = Some(code);
            }
        }
        let Some(code) = main_key else {
            return;
        };

        let src = source();

        // 1) Press modifiers for real (updates system modifier state).
        let mut accumulated = CGEventFlags::empty();
        for flag in &mod_order {
            if let Some(mk) = modifier_keycode(*flag) {
                accumulated.insert(*flag);
                post_key(&src, mk, true, accumulated);
            }
        }

        // 2) Main key tap with full chord flags.
        post_key(&src, code, true, flags);
        post_key(&src, code, false, flags);

        // 3) Release modifiers in reverse — clears sticky Control/Option/etc.
        for flag in mod_order.iter().rev() {
            if let Some(mk) = modifier_keycode(*flag) {
                accumulated.remove(*flag);
                post_key(&src, mk, false, accumulated);
            }
        }

        // 4) Belt-and-suspenders: empty flags-changed style noop via key up of
        //    nothing is unavailable; posting a neutral key-up with empty flags
        //    on a dummy is unnecessary if steps above ran.
    }

    fn open_app(bundle_id: &str) {
        // Prefer exact bundle, then known aliases (System Settings renamed across macOS).
        let aliases: &[&str] = match bundle_id {
            "com.apple.SystemSettings" | "com.apple.systempreferences" => &[
                "com.apple.systempreferences",
                "com.apple.SystemSettings",
            ],
            other => &[other],
        };
        for id in aliases {
            match std::process::Command::new("open").args(["-b", id]).status() {
                Ok(status) if status.success() => return,
                Ok(status) => log::warn!("open -b {id} failed: {status}"),
                Err(err) => log::warn!("open -b {id} spawn failed: {err}"),
            }
        }
        if bundle_id.to_ascii_lowercase().contains("system")
            || bundle_id.to_ascii_lowercase().contains("preference")
        {
            if open_named_app("System Settings") {
                return;
            }
            let _ = open_named_app("System Preferences");
            let _ = std::process::Command::new("open")
                .args(["x-apple.systempreferences:"])
                .spawn();
        }
    }

    /// NX auxiliary / media keys via NSEvent (shows volume HUD + Now Playing).
    /// Raw CGEventCreate is only a fallback — it often never reaches the OSD.
    fn post_nx_key(key_type: i64) {
        use cocoa::appkit::{NSEvent, NSEventModifierFlags, NSEventSubtype, NSSystemDefined};
        use cocoa::base::{id, nil};
        use cocoa::foundation::NSPoint;

        const TAP_HID: u32 = 0;

        unsafe {
            for down in [true, false] {
                let state: i64 = if down { 0xa } else { 0xb };
                let flags = NSEventModifierFlags::from_bits_truncate((state << 8) as u64);
                let data1 = (key_type << 16) | (state << 8);
                let ns: id = NSEvent::otherEventWithType_location_modifierFlags_timestamp_windowNumber_context_subtype_data1_data2_(
                    nil,
                    NSSystemDefined,
                    NSPoint::new(0.0, 0.0),
                    flags,
                    0.0,
                    0,
                    nil,
                    // NX_SUBTYPE_AUX_CONTROL_BUTTONS == 8 (named ScreenChanged in cocoa)
                    NSEventSubtype::NSScreenChangedEventType,
                    data1,
                    -1,
                );
                if ns != nil {
                    let cg: *mut std::ffi::c_void = NSEvent::CGEvent(ns);
                    if !cg.is_null() {
                        CGEventPost(TAP_HID, cg);
                    }
                } else {
                    let src = CGEventSourceCreate(1); // HIDSystemState
                    if src.is_null() {
                        log::warn!("post_nx_key: CGEventSourceCreate failed");
                        continue;
                    }
                    let e = CGEventCreate(src);
                    if !e.is_null() {
                        CGEventSetType(e, 14);
                        CGEventSetFlags(e, (state << 8) as u64);
                        CGEventSetIntegerValueField(e, 99, 8);
                        CGEventSetIntegerValueField(e, 149, data1);
                        CGEventSetIntegerValueField(e, 150, -1);
                        CGEventPost(TAP_HID, e);
                        CFRelease(e);
                    }
                    CFRelease(src);
                }
                std::thread::sleep(std::time::Duration::from_millis(30));
            }
        }
    }

    fn media_volume_up() {
        post_nx_key(0); // NX_KEYTYPE_SOUND_UP — system volume HUD
    }
    fn media_volume_down() {
        post_nx_key(1); // NX_KEYTYPE_SOUND_DOWN
    }
    fn media_mute() {
        post_nx_key(7); // NX_KEYTYPE_MUTE
    }
    fn media_play_pause() {
        // NX reaches system Now Playing (browser etc.). Do not also AppleScript
        // Music/Spotify — that double-toggles and looks like "nothing happened".
        post_nx_key(16); // NX_KEYTYPE_PLAY
    }
    fn media_next() {
        post_nx_key(17); // NX_KEYTYPE_NEXT
    }
    fn media_previous() {
        post_nx_key(18); // NX_KEYTYPE_PREVIOUS
    }

    fn app_switcher() {
        if run_osascript(
            r#"tell application "System Events" to keystroke tab using command down"#,
        ) {
            return;
        }
        // Hold ⌘ briefly so the switcher can appear.
        let src = source();
        post_key(&src, 0x37, true, CGEventFlags::CGEventFlagCommand);
        std::thread::sleep(std::time::Duration::from_millis(20));
        post_key(&src, 0x30, true, CGEventFlags::CGEventFlagCommand);
        post_key(&src, 0x30, false, CGEventFlags::CGEventFlagCommand);
        std::thread::sleep(std::time::Duration::from_millis(120));
        post_key(&src, 0x37, false, CGEventFlags::empty());
    }

    fn launchpad() {
        // System “앱 보기” / Apps (Launchpad’s successor). Use Dock’s notification
        // SPI — the same action System Settings binds a hotkey to — not whatever
        // chord the current user happened to assign (e.g. ⌃⇧5).
        use core_foundation::base::TCFType;
        use core_foundation::string::CFString;
        let name = CFString::new("com.apple.launchpad.toggle");
        unsafe {
            CoreDockSendNotification(name.as_concrete_TypeRef());
        }
    }

    fn system_command(cmd: &SystemCommand) {
        log::info!("system_command: {cmd:?}");
        match cmd {
            SystemCommand::MissionControl => mission_control(),
            SystemCommand::AppExpose => app_expose(),
            SystemCommand::ShowDesktop => show_desktop(),
            SystemCommand::Launchpad => launchpad(),
            SystemCommand::Spotlight => {
                if !run_osascript(
                    "tell application \"System Events\" to keystroke space using command down",
                ) {
                    keystroke(&["Meta".into(), "Space".into()]);
                }
            }
            SystemCommand::AppSwitcher => app_switcher(),
            SystemCommand::CloseWindow => keystroke(&["Meta".into(), "W".into()]),
            SystemCommand::Save => keystroke(&["Meta".into(), "S".into()]),
            SystemCommand::Cut => keystroke(&["Meta".into(), "X".into()]),
            SystemCommand::Copy => keystroke(&["Meta".into(), "C".into()]),
            SystemCommand::Paste => keystroke(&["Meta".into(), "V".into()]),
            SystemCommand::Undo => keystroke(&["Meta".into(), "Z".into()]),
            SystemCommand::Redo => keystroke(&["Meta".into(), "Shift".into(), "Z".into()]),
            SystemCommand::VolumeUp => media_volume_up(),
            SystemCommand::VolumeDown => media_volume_down(),
            SystemCommand::Mute => media_mute(),
            SystemCommand::PreviousTrack => media_previous(),
            SystemCommand::NextTrack => media_next(),
            SystemCommand::PlayPause => media_play_pause(),
            SystemCommand::MoveSpaceLeft => move_space(true),
            SystemCommand::MoveSpaceRight => move_space(false),
        }
    }

    fn run_macro(steps: &[MacroStep]) {
        for step in steps {
            match step {
                MacroStep::KeyStroke { keys } => keystroke(keys),
                MacroStep::Delay { ms } => {
                    std::thread::sleep(std::time::Duration::from_millis((*ms).min(5_000)));
                }
                MacroStep::MouseClick { button } => {
                    click_once(button, 1);
                }
            }
        }
    }

    /// Mission Control Spaces ignore many synthetic CGEvent chords.
    /// System Events (Accessibility) is the reliable path on modern macOS.
    fn move_space(left: bool) {
        let key_code = if left { 123 } else { 124 }; // Left / Right arrow
        let script = format!(
            "tell application \"System Events\" to key code {key_code} using control down"
        );
        match std::process::Command::new("/usr/bin/osascript")
            .args(["-e", &script])
            .output()
        {
            Ok(out) if out.status.success() => return,
            Ok(out) => {
                log::warn!(
                    "move_space osascript failed: {}",
                    String::from_utf8_lossy(&out.stderr)
                );
            }
            Err(err) => log::warn!("move_space osascript spawn failed: {err}"),
        }

        // Fallback: CGEvent with Control (+ Function bit, as Spaces hotkeys often expect).
        let code: u16 = if left { 0x7b } else { 0x7c };
        let src = source();
        let ctrl = CGEventFlags::CGEventFlagControl;
        let flags = ctrl | CGEventFlags::CGEventFlagSecondaryFn;
        post_key(&src, 0x3b, true, ctrl);
        std::thread::sleep(std::time::Duration::from_millis(10));
        post_key(&src, code, true, flags);
        post_key(&src, code, false, flags);
        post_key(&src, 0x3b, false, CGEventFlags::empty());
    }

    /// Mission Control / Launchpad / Exposé ignore many synthetic CGEvent chords.
    /// Prefer launching the apps or driving System Events (same path as Spaces).
    fn run_osascript(script: &str) -> bool {
        match std::process::Command::new("/usr/bin/osascript")
            .args(["-e", script])
            .output()
        {
            Ok(out) if out.status.success() => true,
            Ok(out) => {
                log::warn!(
                    "osascript failed: {}",
                    String::from_utf8_lossy(&out.stderr)
                );
                false
            }
            Err(err) => {
                log::warn!("osascript spawn failed: {err}");
                false
            }
        }
    }

    fn open_named_app(name: &str) -> bool {
        match std::process::Command::new("open")
            .args(["-a", name])
            .status()
        {
            Ok(status) if status.success() => true,
            Ok(status) => {
                log::warn!("open -a {name} failed: {status}");
                false
            }
            Err(err) => {
                log::warn!("open -a {name} spawn failed: {err}");
                false
            }
        }
    }

    fn mission_control() {
        if open_named_app("Mission Control") {
            return;
        }
        let _ = run_osascript(
            "tell application \"System Events\" to key code 126 using control down",
        );
    }

    fn app_expose() {
        if run_osascript(
            "tell application \"System Events\" to key code 125 using control down",
        ) {
            return;
        }
        keystroke(&["Control".into(), "Down".into()]);
    }

    fn show_desktop() {
        // F11 / Fn+F11 — System Events + function key bit is more reliable than CGEvent alone.
        if run_osascript(
            "tell application \"System Events\" to key code 103 using function down",
        ) {
            return;
        }
        if run_osascript("tell application \"System Events\" to key code 103") {
            return;
        }
        // CGEvent fallback with SecondaryFn (laptop F-keys).
        let src = source();
        let flags = CGEventFlags::CGEventFlagSecondaryFn;
        post_key(&src, 0x3f, true, flags);
        std::thread::sleep(std::time::Duration::from_millis(10));
        post_key(&src, 0x67, true, flags);
        post_key(&src, 0x67, false, flags);
        post_key(&src, 0x3f, false, CGEventFlags::empty());
    }

    pub fn default_mouse_button(id: ButtonId) -> Option<MouseClickButton> {
        match id {
            ButtonId::Left => Some(MouseClickButton::Left),
            ButtonId::Right => Some(MouseClickButton::Right),
            ButtonId::Middle => Some(MouseClickButton::Middle),
            ButtonId::Back => Some(MouseClickButton::Back),
            ButtonId::Forward => Some(MouseClickButton::Forward),
            _ => None,
        }
    }

    pub fn press_action(
        id: ButtonId,
        action: &Action,
        pointer: &crate::profile::PointerSettings,
    ) {
        match action {
            Action::Disabled => {}
            Action::Default => {
                // Shared: OS delivers L/R/M/… unless we suppress that button
                // (auto-click / long-press / remap) — then we must synthesize.
                if let Some(btn) = default_mouse_button(id) {
                    let os_owns = shared_pointer_mode()
                        && !id.is_hidden_from_macos()
                        && !crate::suppress::os_button_suppressed(id);
                    if !os_owns {
                        mouse_down(&btn);
                    }
                }
            }
            Action::MouseClick { button } => {
                // Same-as-native on L/R/…: OS owns it unless that stream is suppressed.
                if shared_pointer_mode() {
                    if let Some(native) = default_mouse_button(id) {
                        if &native == button
                            && !crate::suppress::os_button_suppressed(id)
                        {
                            return;
                        }
                    }
                }
                mouse_down(button);
            }
            Action::DoubleClick => double_click(),
            Action::KeyStroke { keys } => keystroke(keys),
            Action::System { command } => system_command(command),
            Action::OpenApp { bundle_id, .. } => open_app(bundle_id),
            Action::Scroll { dx, dy } => scroll_by_units_ex(*dx, *dy, pointer, true),
            Action::Macro { steps } => run_macro(steps),
        }
    }

    pub fn release_action(id: ButtonId, action: &Action) {
        match action {
            Action::Disabled
            | Action::KeyStroke { .. }
            | Action::System { .. }
            | Action::DoubleClick
            | Action::OpenApp { .. }
            | Action::Scroll { .. }
            | Action::Macro { .. } => {}
            Action::Default => {
                if let Some(btn) = default_mouse_button(id) {
                    let os_owns = shared_pointer_mode()
                        && !id.is_hidden_from_macos()
                        && !crate::suppress::os_button_suppressed(id);
                    if !os_owns {
                        mouse_up(&btn);
                    }
                }
            }
            Action::MouseClick { button } => {
                if shared_pointer_mode() {
                    if let Some(native) = default_mouse_button(id) {
                        if &native == button
                            && !crate::suppress::os_button_suppressed(id)
                        {
                            return;
                        }
                    }
                }
                mouse_up(button);
            }
        }
    }

    pub fn permission_status() -> PermissionStatus {
        let accessibility = macos_accessibility_client::accessibility::application_is_trusted();
        let input_monitoring = unsafe { CGPreflightListenEventAccess() };
        let post_event = unsafe { CGPreflightPostEventAccess() };
        let ready = accessibility || post_event;
        PermissionStatus {
            accessibility,
            input_monitoring,
            post_event,
            ready,
        }
    }

    pub fn accessibility_granted() -> bool {
        permission_status().ready
    }

    pub fn prompt_accessibility() -> bool {
        // One system alert at a time. Accessibility prompt is the primary gate;
        // Input Monitoring is requested only if Accessibility already looks OK.
        let trusted =
            macos_accessibility_client::accessibility::application_is_trusted_with_prompt();
        if trusted {
            let _ = unsafe { CGRequestListenEventAccess() };
        }
        permission_status().ready
    }

    pub fn open_permission_settings() -> Result<(), String> {
        // Open Accessibility only — opening ListenEvent in the same click stacks panes.
        tauri_plugin_opener::open_url(
            "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility",
            None::<&str>,
        )
        .map_err(|e| e.to_string())
    }
}

#[cfg(not(target_os = "macos"))]
mod stub {
    use super::*;
    pub fn sync_cursor_from_system() {}
    pub fn move_by(_dx: f64, _dy: f64) {}
    pub fn scroll(_dx_lines: i32, _dy_lines: i32) {}
    pub fn scroll_pixels(_dx: i32, _dy: i32) {}
    pub fn scroll_notches(
        _dx_notches: f64,
        _dy_notches: f64,
        _pointer: &crate::profile::PointerSettings,
    ) {
    }
    pub fn scroll_notches_ex(
        _dx_notches: f64,
        _dy_notches: f64,
        _pointer: &crate::profile::PointerSettings,
        _continuous: bool,
    ) {
    }
    pub fn scroll_by_units(
        _dx_units: i32,
        _dy_units: i32,
        _pointer: &crate::profile::PointerSettings,
    ) {
    }
    pub fn scroll_by_units_ex(
        _dx_units: i32,
        _dy_units: i32,
        _pointer: &crate::profile::PointerSettings,
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
        _pointer: &crate::profile::PointerSettings,
    ) {
    }
    pub fn release_action(_id: ButtonId, _action: &Action) {}
    pub fn permission_status() -> PermissionStatus {
        PermissionStatus {
            accessibility: true,
            input_monitoring: true,
            post_event: true,
            ready: true,
        }
    }
    pub fn accessibility_granted() -> bool {
        true
    }
    pub fn prompt_accessibility() -> bool {
        true
    }
    pub fn open_permission_settings() -> Result<(), String> {
        Ok(())
    }
}

#[cfg(target_os = "macos")]
pub use macos::*;
#[cfg(not(target_os = "macos"))]
pub use stub::*;
