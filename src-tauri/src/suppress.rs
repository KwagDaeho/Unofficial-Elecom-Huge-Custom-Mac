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

const BIT_LEFT: u8 = 1 << 0;
const BIT_RIGHT: u8 = 1 << 1;
const BIT_MIDDLE: u8 = 1 << 2;
const BIT_BACK: u8 = 1 << 3;
const BIT_FORWARD: u8 = 1 << 4;

static SUPPRESS_MASK: AtomicU8 = AtomicU8::new(0);
/// When we synthesize mouse-down, OS still posts plain MouseMoved — suppress it
/// so `inject::move_by` owns the stream (*MouseDragged).
static SUPPRESS_MOTION: AtomicBool = AtomicBool::new(false);
/// Drop OS ScrollWheel until this unix-ms (set when HID reports HUGE wheel/pan).
static SCROLL_ARM_UNTIL_MS: AtomicU64 = AtomicU64::new(0);

static TAP_RUNNING: AtomicBool = AtomicBool::new(false);
static TAP_PORT: AtomicPtr<std::ffi::c_void> = AtomicPtr::new(std::ptr::null_mut());
static TAP_THREAD: Mutex<Option<JoinHandle<()>>> = Mutex::new(None);

const EVENT_SCROLL_WHEEL: u32 = 22;
const EVENT_MOUSE_MOVED: u32 = 5;
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

/// True while our tap is dropping OS events for this physical HUGE button.
pub fn os_button_suppressed(id: crate::device::ButtonId) -> bool {
    use crate::device::ButtonId;
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
pub fn os_mouse_button_suppressed(button: &crate::profile::MouseClickButton) -> bool {
    use crate::profile::MouseClickButton;
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
    SCROLL_ARM_UNTIL_MS.store(0, Ordering::SeqCst);
}

fn scroll_echo_armed() -> bool {
    now_ms() <= SCROLL_ARM_UNTIL_MS.load(Ordering::SeqCst)
}

fn should_suppress(etype: u32, button_number: i64) -> bool {
    if SUPPRESS_MOTION.load(Ordering::SeqCst) && etype == EVENT_MOUSE_MOVED {
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

pub fn mask_for(
    left: bool,
    right: bool,
    middle: bool,
    back: bool,
    forward: bool,
    left_remap: bool,
    right_remap: bool,
    middle_remap: bool,
    back_remap: bool,
    forward_remap: bool,
) -> u8 {
    let mut m = 0u8;
    if left && left_remap {
        m |= BIT_LEFT;
    }
    if right && right_remap {
        m |= BIT_RIGHT;
    }
    if middle && middle_remap {
        m |= BIT_MIDDLE;
    }
    if back && back_remap {
        m |= BIT_BACK;
    }
    if forward && forward_remap {
        m |= BIT_FORWARD;
    }
    m
}

pub fn action_is_native_for(id: crate::device::ButtonId, action: &crate::profile::Action) -> bool {
    use crate::device::ButtonId;
    use crate::profile::{Action, MouseClickButton};
    match action {
        Action::Default => true,
        Action::MouseClick { button } => matches!(
            (id, button),
            (ButtonId::Left, MouseClickButton::Left)
                | (ButtonId::Right, MouseClickButton::Right)
                | (ButtonId::Middle, MouseClickButton::Middle)
                | (ButtonId::Back, MouseClickButton::Back)
                | (ButtonId::Forward, MouseClickButton::Forward)
        ),
        _ => false,
    }
}

pub fn is_remapped(
    id: crate::device::ButtonId,
    action: &crate::profile::Action,
    long_press: &crate::profile::Action,
) -> bool {
    use crate::profile::Action;
    let click_remap = !action_is_native_for(id, action);
    let lp_remap = !matches!(long_press, Action::Disabled | Action::Default)
        && !action_is_native_for(id, long_press);
    click_remap || lp_remap
}

pub fn remap_flags(profile: &crate::profile::Profile) -> (bool, bool, bool, bool, bool) {
    use crate::device::ButtonId;
    let flag = |id: ButtonId| {
        let b = profile.buttons.get(&id).cloned().unwrap_or_else(|| {
            crate::profile::ButtonBinding::from_click(crate::profile::Action::Default)
        });
        let lp = if b.uses_long_press() {
            &b.long_press
        } else {
            &crate::profile::Action::Disabled
        };
        // Auto-click / remapped hold always needs suppress even if click looks native.
        let click_remap = !action_is_native_for(id, &b.click) || b.uses_auto_click();
        let lp_remap = !matches!(lp, crate::profile::Action::Disabled | crate::profile::Action::Default)
            && !action_is_native_for(id, lp);
        click_remap || lp_remap || b.uses_long_press()
    };
    (
        flag(ButtonId::Left),
        flag(ButtonId::Right),
        flag(ButtonId::Middle),
        flag(ButtonId::Back),
        flag(ButtonId::Forward),
    )
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

    if etype == EVENT_SCROLL_WHEEL {
        if should_drop_scroll_echo(event) {
            return std::ptr::null_mut();
        }
        return event;
    }

    let button = unsafe { CGEventGetIntegerValueField(event, EventField::MOUSE_EVENT_BUTTON_NUMBER) };
    if should_suppress(etype, button) {
        return std::ptr::null_mut();
    }
    event
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
