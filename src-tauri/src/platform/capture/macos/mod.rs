#[cfg(target_os = "macos")]
mod combo;
#[cfg(target_os = "macos")]
mod keycodes;
#[cfg(target_os = "macos")]
mod tap;

#[cfg(target_os = "macos")]
pub use combo::{clear_combo_held, combo_held_parts};

#[cfg(target_os = "macos")]
pub fn ensure_tap_thread() {
    use core_foundation::base::TCFType;
    use core_foundation::mach_port::{CFMachPort, CFMachPortRef};
    use core_foundation::runloop::{kCFRunLoopCommonModes, CFRunLoop};
    use std::ffi::c_void;
    use std::sync::atomic::Ordering;

    use super::session::TAP_STARTED;
    use keycodes::{
        mask_bit, CGEventMask, CGEventRef, CGEventTapProxy, LEFT_DOWN, LEFT_UP, OTHER_DOWN,
        OTHER_UP, RIGHT_DOWN, RIGHT_UP, KEY_DOWN, KEY_UP, FLAGS_CHANGED,
    };
    use tap::tap_callback;

    type CGEventTapCallback = unsafe extern "C" fn(
        CGEventTapProxy,
        u32,
        CGEventRef,
        *mut c_void,
    ) -> CGEventRef;

    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" {
        fn CGEventTapCreate(
            tap: u32,
            place: u32,
            options: u32,
            eventsOfInterest: CGEventMask,
            callback: CGEventTapCallback,
            userInfo: *mut c_void,
        ) -> CFMachPortRef;
        fn CGEventTapEnable(tap: CFMachPortRef, enable: bool);
    }

    if TAP_STARTED.swap(true, Ordering::SeqCst) {
        return;
    }

    std::thread::Builder::new()
        .name("key-capture-tap".into())
        .spawn(|| {
            let events = mask_bit(KEY_DOWN)
                | mask_bit(KEY_UP)
                | mask_bit(FLAGS_CHANGED)
                | mask_bit(LEFT_DOWN)
                | mask_bit(LEFT_UP)
                | mask_bit(RIGHT_DOWN)
                | mask_bit(RIGHT_UP)
                | mask_bit(OTHER_DOWN)
                | mask_bit(OTHER_UP);
            let port = unsafe {
                CGEventTapCreate(
                    0,
                    0,
                    0,
                    events,
                    tap_callback,
                    std::ptr::null_mut(),
                )
            };
            if port.is_null() {
                log::warn!("key-capture tap failed — grant Accessibility / Input Monitoring");
                TAP_STARTED.store(false, Ordering::SeqCst);
                return;
            }

            let mach = unsafe { CFMachPort::wrap_under_create_rule(port) };
            let source = mach
                .create_runloop_source(0)
                .expect("CFMachPortCreateRunLoopSource");
            let rl = CFRunLoop::get_current();
            rl.add_source(&source, unsafe { kCFRunLoopCommonModes });
            unsafe { CGEventTapEnable(port, true) };
            log::info!("key-capture event tap ready");
            CFRunLoop::run_current();
            let _keep = (mach, source);
        })
        .expect("spawn key-capture-tap");
}

#[cfg(not(target_os = "macos"))]
pub fn ensure_tap_thread() {}

#[cfg(not(target_os = "macos"))]
pub fn clear_combo_held() {}

#[cfg(not(target_os = "macos"))]
pub fn combo_held_parts() -> (Vec<String>, Vec<String>) {
    (Vec::new(), Vec::new())
}
