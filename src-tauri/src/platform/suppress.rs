//! Swallow native mouse-button events while a remapped HUGE button is down,
//! and drop OS ScrollWheel echoes of HUGE wheel/pan while we re-inject from HID.
//!
//! Shared HID keeps WindowServer cursor ownership (Dock auto-hide). Remapped
//! L/R/M/… would double-fire unless OS clicks are deleted here.
//!
//! Scroll invert/speed is applied in `inject` from HID reports (same path as
//! custom scroll actions). This tap only deletes the OS echo when armed by HID
//! so the trackpad (never armed) stays untouched — including momentum.

use std::sync::atomic::{AtomicBool, AtomicPtr, AtomicU64, AtomicU8, Ordering};
use std::thread::{self, JoinHandle};
use std::time::{SystemTime, UNIX_EPOCH};

use core_foundation::mach_port::CFMachPort;
use core_foundation::runloop::{kCFRunLoopCommonModes, CFRunLoop};
use core_graphics::event::EventField;
use parking_lot::Mutex;

use crate::domain::remap::{BIT_BACK, BIT_FORWARD, BIT_LEFT, BIT_MIDDLE, BIT_RIGHT};

static SUPPRESS_MASK: AtomicU8 = AtomicU8::new(0);
/// When we synthesize mouse-down, OS still posts plain MouseMoved — suppress it
/// so `inject::move_by` owns the stream (*MouseDragged).
static SUPPRESS_MOTION: AtomicBool = AtomicBool::new(false);
/// While set, MouseMoved is rewritten to this point (ball-scroll pin).
static CURSOR_LOCK: AtomicBool = AtomicBool::new(false);
static CURSOR_LOCK_X: AtomicU64 = AtomicU64::new(0);
static CURSOR_LOCK_Y: AtomicU64 = AtomicU64::new(0);
/// Drop OS ScrollWheel until this unix-ms (set when HID reports HUGE wheel/pan).
static SCROLL_ARM_UNTIL_MS: AtomicU64 = AtomicU64::new(0);

static TAP_RUNNING: AtomicBool = AtomicBool::new(false);
static TAP_PORT: AtomicPtr<std::ffi::c_void> = AtomicPtr::new(std::ptr::null_mut());
static TAP_THREAD: Mutex<Option<JoinHandle<()>>> = Mutex::new(None);

const EVENT_SCROLL_WHEEL: u32 = 22;
const EVENT_MOUSE_MOVED: u32 = 5;
const EVENT_LEFT_DOWN: u32 = 1;
const EVENT_LEFT_UP: u32 = 2;
const EVENT_RIGHT_DOWN: u32 = 3;
const EVENT_RIGHT_UP: u32 = 4;
const EVENT_LEFT_DRAGGED: u32 = 6;
const EVENT_RIGHT_DRAGGED: u32 = 7;
const EVENT_OTHER_DOWN: u32 = 25;
const EVENT_OTHER_UP: u32 = 26;
const EVENT_OTHER_DRAGGED: u32 = 27;
const FIELD_SCROLL_MOMENTUM_PHASE: u32 = 123;

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

pub fn set_suppress_mask(mask: u8) {
    SUPPRESS_MASK.store(mask, Ordering::SeqCst);
}

pub fn set_suppress_motion(suppress: bool) {
    SUPPRESS_MOTION.store(suppress, Ordering::SeqCst);
}

pub fn set_cursor_lock(point: Option<(f64, f64)>) {
    if let Some((x, y)) = point {
        CURSOR_LOCK_X.store(x.to_bits(), Ordering::SeqCst);
        CURSOR_LOCK_Y.store(y.to_bits(), Ordering::SeqCst);
        CURSOR_LOCK.store(true, Ordering::SeqCst);
    } else {
        CURSOR_LOCK.store(false, Ordering::SeqCst);
    }
}

fn cursor_lock_point() -> Option<(f64, f64)> {
    if CURSOR_LOCK.load(Ordering::SeqCst) {
        Some((
            f64::from_bits(CURSOR_LOCK_X.load(Ordering::SeqCst)),
            f64::from_bits(CURSOR_LOCK_Y.load(Ordering::SeqCst)),
        ))
    } else {
        None
    }
}

/// True while our tap is dropping OS events for this physical HUGE button.
pub fn os_button_suppressed(id: crate::domain::device::ButtonId) -> bool {
    use crate::domain::device::ButtonId;
    let mask = SUPPRESS_MASK.load(Ordering::SeqCst);
    let bit = match id {
        ButtonId::Left => BIT_LEFT,
        ButtonId::Right => BIT_RIGHT,
        ButtonId::Middle => BIT_MIDDLE,
        ButtonId::Back => BIT_BACK,
        ButtonId::Forward => BIT_FORWARD,
        _ => return false,
    };
    mask & bit != 0
}

/// True while our tap is dropping OS events for this synthetic mouse button.
pub fn os_mouse_button_suppressed(button: &crate::domain::profile::MouseClickButton) -> bool {
    use crate::domain::profile::MouseClickButton;
    let mask = SUPPRESS_MASK.load(Ordering::SeqCst);
    let bit = match button {
        MouseClickButton::Left => BIT_LEFT,
        MouseClickButton::Right => BIT_RIGHT,
        MouseClickButton::Middle => BIT_MIDDLE,
        MouseClickButton::Back => BIT_BACK,
        MouseClickButton::Forward => BIT_FORWARD,
    };
    mask & bit != 0
}

/// Session lifecycle hook from the engine (clears scroll-echo arm when inactive).
pub fn sync_scroll_transform(active: bool) {
    if !active {
        SCROLL_ARM_UNTIL_MS.store(0, Ordering::SeqCst);
    }
}

/// Call when we will inject HUGE wheel/pan ourselves — drop the OS copy briefly.
pub fn arm_huge_scroll_echo_suppress() {
    SCROLL_ARM_UNTIL_MS.store(now_ms().saturating_add(150), Ordering::SeqCst);
}

pub fn clear_suppress() {
    SUPPRESS_MASK.store(0, Ordering::SeqCst);
    SUPPRESS_MOTION.store(false, Ordering::SeqCst);
    CURSOR_LOCK.store(false, Ordering::SeqCst);
    SCROLL_ARM_UNTIL_MS.store(0, Ordering::SeqCst);
}

fn scroll_echo_armed() -> bool {
    now_ms() <= SCROLL_ARM_UNTIL_MS.load(Ordering::SeqCst)
}

fn should_suppress(etype: u32, button_number: i64) -> bool {
    if SUPPRESS_MOTION.load(Ordering::SeqCst)
        && matches!(
            etype,
            EVENT_MOUSE_MOVED | EVENT_LEFT_DRAGGED | EVENT_RIGHT_DRAGGED | EVENT_OTHER_DRAGGED
        )
    {
        return true;
    }
    let mask = SUPPRESS_MASK.load(Ordering::SeqCst);
    if mask == 0 {
        return false;
    }
    match etype {
        1 | 2 | 6 => mask & BIT_LEFT != 0,
        3 | 4 | 7 => mask & BIT_RIGHT != 0,
        25 | 26 | 27 => match button_number {
            2 => mask & BIT_MIDDLE != 0,
            3 => mask & BIT_BACK != 0,
            4 => mask & BIT_FORWARD != 0,
            _ => false,
        },
        _ => false,
    }
}

const FIELD_SCROLL_IS_CONTINUOUS: u32 = 88;

fn should_drop_scroll_echo(event: *mut std::ffi::c_void) -> bool {
    if !scroll_echo_armed() {
        return false;
    }
    let momentum = unsafe { CGEventGetIntegerValueField(event, FIELD_SCROLL_MOMENTUM_PHASE) };
    if momentum != 0 {
        return false;
    }
    true
}

/// HUGE wheel is discrete HID. Trackpad is continuous / momentum — leave it.
fn should_drop_huge_wheel_during_ball_scroll(event: *mut std::ffi::c_void) -> bool {
    if !crate::domain::ball_scroll::is_active() {
        return false;
    }
    let momentum = unsafe { CGEventGetIntegerValueField(event, FIELD_SCROLL_MOMENTUM_PHASE) };
    if momentum != 0 {
        return false;
    }
    let continuous =
        unsafe { CGEventGetIntegerValueField(event, FIELD_SCROLL_IS_CONTINUOUS) };
    continuous == 0
}

#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
    fn CGEventTapCreate(
        tap: u32,
        place: u32,
        options: u32,
        events_of_interest: u64,
        callback: unsafe extern "C" fn(
            proxy: *mut std::ffi::c_void,
            etype: u32,
            event: *mut std::ffi::c_void,
            user_info: *mut std::ffi::c_void,
        ) -> *mut std::ffi::c_void,
        user_info: *mut std::ffi::c_void,
    ) -> *mut std::ffi::c_void;
    fn CGEventTapEnable(tap: *mut std::ffi::c_void, enable: bool);
    fn CGEventGetIntegerValueField(event: *mut std::ffi::c_void, field: u32) -> i64;
    fn CGEventGetDoubleValueField(event: *mut std::ffi::c_void, field: u32) -> f64;
    fn CGEventSetIntegerValueField(event: *mut std::ffi::c_void, field: u32, value: i64);
    fn CGEventSetDoubleValueField(event: *mut std::ffi::c_void, field: u32, value: f64);
    fn CGEventSetLocation(event: *mut std::ffi::c_void, point: core_graphics::geometry::CGPoint);
}

unsafe extern "C" fn tap_callback(
    _proxy: *mut std::ffi::c_void,
    etype: u32,
    event: *mut std::ffi::c_void,
    _user_info: *mut std::ffi::c_void,
) -> *mut std::ffi::c_void {
    if etype == 0xFFFF_FFFE || etype == 0xFFFF_FFFF {
        let port = TAP_PORT.load(Ordering::SeqCst);
        if !port.is_null() {
            unsafe { CGEventTapEnable(port, true) };
        }
        return event;
    }

    if matches!(
        etype,
        EVENT_MOUSE_MOVED | EVENT_LEFT_DRAGGED | EVENT_RIGHT_DRAGGED | EVENT_OTHER_DRAGGED
    ) {
        if crate::platform::inject::restore_cursor_active() {
            crate::platform::inject::maintain_restored_cursor();
            return std::ptr::null_mut();
        }
        if let Some((x, y)) = cursor_lock_point() {
            crate::platform::inject::keep_pinned_cursor();
            return std::ptr::null_mut();
        }
    }

    if etype == EVENT_SCROLL_WHEEL {
        if should_drop_huge_wheel_during_ball_scroll(event) {
            return std::ptr::null_mut();
        }
        if let Some((x, y)) = cursor_lock_point() {
            pin_mouse_event(event, x, y);
            return event;
        }
        if should_drop_scroll_echo(event) {
            return std::ptr::null_mut();
        }
        return event;
    }

    if let Some((x, y)) = cursor_lock_point() {
        if matches!(
            etype,
            EVENT_MOUSE_MOVED | EVENT_LEFT_DRAGGED | EVENT_RIGHT_DRAGGED | EVENT_OTHER_DRAGGED
        ) {
            crate::platform::inject::keep_pinned_cursor();
            return std::ptr::null_mut();
        }
        if matches!(
            etype,
            EVENT_LEFT_DOWN
                | EVENT_LEFT_UP
                | EVENT_RIGHT_DOWN
                | EVENT_RIGHT_UP
                | EVENT_OTHER_DOWN
                | EVENT_OTHER_UP
        ) {
            pin_mouse_event(event, x, y);
            return event;
        }
    }

    let button = unsafe { CGEventGetIntegerValueField(event, EventField::MOUSE_EVENT_BUTTON_NUMBER) };
    if should_suppress(etype, button) {
        return std::ptr::null_mut();
    }
    event
}

fn pin_mouse_event(event: *mut std::ffi::c_void, x: f64, y: f64) {
    unsafe {
        CGEventSetLocation(event, core_graphics::geometry::CGPoint::new(x, y));
        CGEventSetDoubleValueField(event, EventField::MOUSE_EVENT_DELTA_X, 0.0);
        CGEventSetDoubleValueField(event, EventField::MOUSE_EVENT_DELTA_Y, 0.0);
        CGEventSetIntegerValueField(event, EventField::MOUSE_EVENT_DELTA_X, 0);
        CGEventSetIntegerValueField(event, EventField::MOUSE_EVENT_DELTA_Y, 0);
    }
}

fn event_mask() -> u64 {
    [1u32, 2, 3, 4, 5, 6, 7, 22, 25, 26, 27]
        .into_iter()
        .fold(0u64, |m, t| m | (1u64 << t))
}

pub fn ensure_started() {
    if TAP_RUNNING.swap(true, Ordering::SeqCst) {
        return;
    }
    let handle = thread::Builder::new()
        .name("huge-suppress-tap".into())
        .spawn(|| {
            let port = unsafe {
                CGEventTapCreate(
                    0, // kCGHIDEventTap
                    0, // kCGHeadInsertEventTap
                    0, // kCGEventTapOptionDefault
                    event_mask(),
                    tap_callback,
                    std::ptr::null_mut(),
                )
            };
            if port.is_null() {
                log::warn!(
                    "button suppress tap failed — grant Accessibility / Input Monitoring"
                );
                TAP_RUNNING.store(false, Ordering::SeqCst);
                return;
            }
            TAP_PORT.store(port, Ordering::SeqCst);
            unsafe {
                use core_foundation::base::TCFType;
                let mach = CFMachPort::wrap_under_create_rule(
                    port as core_foundation::mach_port::CFMachPortRef,
                );
                match mach.create_runloop_source(0) {
                    Ok(source) => {
                        let rl = CFRunLoop::get_current();
                        rl.add_source(&source, kCFRunLoopCommonModes);
                        CGEventTapEnable(port, true);
                        log::info!("button suppress tap enabled (Dock / shared HID)");
                        CFRunLoop::run_current();
                    }
                    Err(()) => {
                        log::warn!("suppress tap runloop source failed");
                        TAP_RUNNING.store(false, Ordering::SeqCst);
                    }
                }
            }
            TAP_PORT.store(std::ptr::null_mut(), Ordering::SeqCst);
            TAP_RUNNING.store(false, Ordering::SeqCst);
        })
        .expect("spawn suppress tap");
    *TAP_THREAD.lock() = Some(handle);
}

pub fn stop() {
    clear_suppress();
}
