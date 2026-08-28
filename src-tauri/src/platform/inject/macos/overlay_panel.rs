//! Shared NSPanel helpers for top-most, click-through overlays on macOS.
//!
//! All overlays use the same window-server stack: nonactivating NSPanel at
//! screen-saver level, click-through, visible on every Space (including other
//! apps' native full-screen Spaces) while overlays are active.

use cocoa::appkit::{
    NSBackingStoreBuffered, NSColor, NSWindow, NSWindowCollectionBehavior, NSWindowStyleMask,
};
use cocoa::base::{id, nil, NO, YES};
use cocoa::foundation::{NSPoint, NSRect, NSSize};
use objc::declare::ClassDecl;
use objc::runtime::{Class, Object, Sel};
use objc::{class, msg_send, sel, sel_impl};
use std::ffi::c_void;
use std::sync::atomic::{AtomicU32, Ordering};

/// `NSWindowStyleMaskNonactivatingPanel`
pub const NONACTIVATING_PANEL: u64 = 1 << 7;
/// `kCGSOrderAbove`
const ORDER_ABOVE: i32 = 1;
/// `kCGScreenSaverWindowLevelKey`
const SCREEN_SAVER_LEVEL_KEY: i32 = 13;
/// `NSApplicationActivationPolicyAccessory`
const ACTIVATION_POLICY_ACCESSORY: i64 = 1;
/// `NSApplicationActivationPolicyRegular`
const ACTIVATION_POLICY_REGULAR: i64 = 0;
pub const RAISE_INTERVAL_MS: u64 = 60;

static OVERLAY_POLICY_REFS: AtomicU32 = AtomicU32::new(0);

pub fn stop_raise_loop(raising: &std::sync::atomic::AtomicBool) {
    raising.store(false, std::sync::atomic::Ordering::SeqCst);
}

/// Regular apps cannot layer windows into another app's full-screen Space.
/// While any overlay is visible, switch to accessory (tray-only) activation.
pub fn retain_overlay_activation_policy() {
    if OVERLAY_POLICY_REFS.fetch_add(1, Ordering::SeqCst) == 0 {
        unsafe { set_activation_policy(ACTIVATION_POLICY_ACCESSORY) };
    }
}

pub fn release_overlay_activation_policy() {
    loop {
        let count = OVERLAY_POLICY_REFS.load(Ordering::SeqCst);
        if count == 0 {
            return;
        }
        if OVERLAY_POLICY_REFS
            .compare_exchange(count, count - 1, Ordering::SeqCst, Ordering::SeqCst)
            .is_ok()
        {
            if count == 1 {
                unsafe { set_activation_policy(ACTIVATION_POLICY_REGULAR) };
            }
            return;
        }
    }
}

unsafe fn set_activation_policy(policy: i64) {
    let app: id = msg_send![class!(NSApplication), sharedApplication];
    let _: () = msg_send![app, setActivationPolicy: policy];
}

type CgsMain = unsafe extern "C" fn() -> i32;
type CgsNewRects = unsafe extern "C" fn(*const NSRect, i32, *mut *mut c_void) -> i32;
type SlsSetShape = unsafe extern "C" fn(i32, u32, f32, f32, *mut c_void) -> i32;
type SlsSetLevel = unsafe extern "C" fn(i32, u32, i32) -> i32;
type SlsOrder = unsafe extern "C" fn(i32, u32, i32, i32) -> i32;
type CgsRelease = unsafe extern "C" fn(*mut c_void);

#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
    fn CGWindowLevelForKey(key: i32) -> i32;
}

/// Level used for all overlays. Screen-saver tier sits above native full-screen app
/// content; shielding level is reserved for system cursor capture and may not
/// composite into other apps' full-screen Spaces.
pub fn overlay_level() -> i32 {
    unsafe { CGWindowLevelForKey(SCREEN_SAVER_LEVEL_KEY) + 1 }
}

/// Level for full-screen stroke overlays.
pub fn overlay_stroke_level() -> i32 {
    overlay_level()
}

/// Level for the fixed start badge; always above stroke overlays.
pub fn overlay_badge_level() -> i32 {
    overlay_level() + 1
}

pub fn overlay_collection_behavior() -> NSWindowCollectionBehavior {
    NSWindowCollectionBehavior::NSWindowCollectionBehaviorCanJoinAllSpaces
        | NSWindowCollectionBehavior::NSWindowCollectionBehaviorStationary
        | NSWindowCollectionBehavior::NSWindowCollectionBehaviorIgnoresCycle
        | NSWindowCollectionBehavior::NSWindowCollectionBehaviorFullScreenAuxiliary
        | NSWindowCollectionBehavior::from_bits_truncate(1 << 18)
}

pub unsafe fn configure_overlay_panel(win: id) {
    configure_overlay_panel_at(win, overlay_stroke_level());
}

pub unsafe fn configure_overlay_panel_at(win: id, level: i32) {
    win.setReleasedWhenClosed_(NO);
    win.setHasShadow_(NO);
    win.setOpaque_(NO);
    win.setBackgroundColor_(NSColor::clearColor(nil));
    win.setIgnoresMouseEvents_(YES);
    win.setHidesOnDeactivate_(NO);
    let _: () = msg_send![win, setAnimationBehavior: 2i64];
    let _: () = msg_send![win, setCanHide: NO];
    let _: () = msg_send![win, setFloatingPanel: YES];
    let _: () = msg_send![win, setBecomesKeyOnlyIfNeeded: YES];
    win.setLevel_(i64::from(level));
    win.setCollectionBehavior_(overlay_collection_behavior());
}

pub unsafe fn order_overlay_front(win: id) {
    order_overlay_front_at(win, overlay_stroke_level());
}

pub unsafe fn order_overlay_badge_front(win: id) {
    order_overlay_front_at(win, overlay_badge_level());
}

pub unsafe fn order_overlay_front_at(win: id, level: i32) {
    win.orderFrontRegardless();
    win.setLevel_(i64::from(level));
    raise_window_server_at(win, level);
    win.orderFrontRegardless();
}

pub unsafe fn close_overlay_panel(win: id) {
    if win.is_null() {
        return;
    }
    win.orderOut_(nil);
    win.close();
    let _: () = msg_send![win, release];
}

pub fn register_nonactivating_panel_class(name: &str) -> &'static Class {
    if let Some(cls) = Class::get(name) {
        return cls;
    }
    let mut decl = ClassDecl::new(name, class!(NSPanel)).expect(name);
    unsafe {
        decl.add_method(
            sel!(canBecomeKeyWindow),
            panel_no as extern "C" fn(&Object, Sel) -> cocoa::base::BOOL,
        );
        decl.add_method(
            sel!(canBecomeMainWindow),
            panel_no as extern "C" fn(&Object, Sel) -> cocoa::base::BOOL,
        );
    }
    decl.register();
    Class::get(name).expect(name)
}

extern "C" fn panel_no(_this: &Object, _cmd: Sel) -> cocoa::base::BOOL {
    NO
}

pub unsafe fn alloc_overlay_panel(panel_class: &Class, frame: NSRect) -> id {
    let style = NSWindowStyleMask::from_bits_truncate(
        NSWindowStyleMask::NSBorderlessWindowMask.bits() | NONACTIVATING_PANEL,
    );
    let win: id = msg_send![panel_class, alloc];
    let win: id = msg_send![
        win,
        initWithContentRect: frame
        styleMask: style
        backing: NSBackingStoreBuffered
        defer: NO
    ];
    if win.is_null() {
        return nil;
    }
    configure_overlay_panel_at(win, overlay_stroke_level());
    win
}

pub unsafe fn alloc_overlay_badge_panel(panel_class: &Class, frame: NSRect) -> id {
    let style = NSWindowStyleMask::from_bits_truncate(
        NSWindowStyleMask::NSBorderlessWindowMask.bits() | NONACTIVATING_PANEL,
    );
    let win: id = msg_send![panel_class, alloc];
    let win: id = msg_send![
        win,
        initWithContentRect: frame
        styleMask: style
        backing: NSBackingStoreBuffered
        defer: NO
    ];
    if win.is_null() {
        return nil;
    }
    configure_overlay_panel_at(win, overlay_badge_level());
    win
}

pub unsafe fn screen_frames() -> Vec<NSRect> {
    let screens: id = msg_send![class!(NSScreen), screens];
    if screens.is_null() {
        return main_screen_frame().into_iter().collect();
    }
    let count: usize = msg_send![screens, count];
    if count == 0 {
        return main_screen_frame().into_iter().collect();
    }
    let mut frames = Vec::with_capacity(count);
    for index in 0..count {
        let screen: id = msg_send![screens, objectAtIndex: index];
        if screen.is_null() {
            continue;
        }
        let frame: NSRect = msg_send![screen, frame];
        frames.push(frame);
    }
    if frames.is_empty() {
        main_screen_frame().into_iter().collect()
    } else {
        frames
    }
}

pub unsafe fn unified_desktop_frame() -> NSRect {
    let frames = screen_frames();
    let mut min_x = f64::MAX;
    let mut min_y = f64::MAX;
    let mut max_x = f64::MIN;
    let mut max_y = f64::MIN;
    for frame in frames {
        min_x = min_x.min(frame.origin.x);
        min_y = min_y.min(frame.origin.y);
        max_x = max_x.max(frame.origin.x + frame.size.width);
        max_y = max_y.max(frame.origin.y + frame.size.height);
    }
    if min_x == f64::MAX {
        return main_screen_frame().unwrap_or(NSRect::new(
            NSPoint::new(0.0, 0.0),
            NSSize::new(0.0, 0.0),
        ));
    }
    NSRect::new(
        NSPoint::new(min_x, min_y),
        NSSize::new(max_x - min_x, max_y - min_y),
    )
}

unsafe fn main_screen_frame() -> Option<NSRect> {
    let screen: id = msg_send![class!(NSScreen), mainScreen];
    if screen.is_null() {
        None
    } else {
        Some(msg_send![screen, frame])
    }
}

pub unsafe fn window_id(win: id) -> Option<u32> {
    let wid: i64 = msg_send![win, windowNumber];
    (wid > 0).then_some(wid as u32)
}

pub unsafe fn raise_window_server(win: id) {
    raise_window_server_at(win, overlay_stroke_level());
}

pub unsafe fn raise_window_server_at(win: id, level: i32) {
    let Some(wid) = window_id(win) else {
        return;
    };
    let Some(main) = first_sym::<CgsMain>(&[b"SLSMainConnectionID\0", b"CGSMainConnectionID\0"])
    else {
        return;
    };
    let cid = main();
    if let Some(set_level) =
        first_sym::<SlsSetLevel>(&[b"SLSSetWindowLevel\0", b"CGSSetWindowLevel\0"])
    {
        let _ = set_level(cid, wid, level);
    }
    if let Some(order) = first_sym::<SlsOrder>(&[b"SLSOrderWindow\0", b"CGSOrderWindow\0"]) {
        let _ = order(cid, wid, ORDER_ABOVE, 0);
    }
}

pub unsafe fn apply_window_shape(win: id, rects: &[NSRect]) -> bool {
    let Some(wid) = window_id(win) else {
        return false;
    };
    let Some(main) = first_sym::<CgsMain>(&[b"SLSMainConnectionID\0", b"CGSMainConnectionID\0"])
    else {
        return false;
    };
    let Some(new_rects) = load_sym::<CgsNewRects>(b"CGSNewRegionWithRectList\0") else {
        return false;
    };
    let Some(set_shape) = first_sym::<SlsSetShape>(&[
        b"SLSSetWindowShapeInWindowCoordinates\0",
        b"SLSSetWindowShape\0",
        b"CGSSetWindowShape\0",
    ]) else {
        return false;
    };
    let release = load_sym::<CgsRelease>(b"CGSReleaseRegion\0");
    if rects.is_empty() {
        return false;
    }
    let mut region: *mut c_void = std::ptr::null_mut();
    if new_rects(rects.as_ptr(), rects.len() as i32, &mut region) != 0 || region.is_null() {
        return false;
    }
    let cid = main();
    let err = set_shape(cid, wid, 0.0, 0.0, region);
    if let Some(release) = release {
        release(region);
    }
    err == 0
}

pub fn filled_circle_scanlines(diameter: f64) -> Vec<NSRect> {
    let cx = diameter / 2.0;
    let cy = diameter / 2.0;
    let r = diameter / 2.0;
    let mut rects = Vec::new();
    let mut y = 0.0;
    while y < diameter {
        let dy = (y + 0.5) - cy;
        let dy2 = dy * dy;
        let r2 = r * r;
        if dy2 < r2 {
            let half = (r2 - dy2).sqrt();
            rects.push(NSRect::new(
                NSPoint::new(cx - half, y),
                NSSize::new(half * 2.0, 1.0),
            ));
        }
        y += 1.0;
    }
    rects
}

unsafe fn dlsym_named<T>(handle: *mut c_void, name: &[u8]) -> Option<T> {
    let ptr = libc::dlsym(handle, name.as_ptr() as *const i8);
    if ptr.is_null() {
        None
    } else {
        Some(std::mem::transmute_copy(&ptr))
    }
}

unsafe fn load_sym<T>(name: &[u8]) -> Option<T> {
    if let Some(f) = dlsym_named(libc::RTLD_DEFAULT, name) {
        return Some(f);
    }
    for path in [
        b"/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics\0".as_slice(),
        b"/System/Library/PrivateFrameworks/SkyLight.framework/SkyLight\0".as_slice(),
        b"/System/Library/Frameworks/ApplicationServices.framework/ApplicationServices\0"
            .as_slice(),
    ] {
        let handle = libc::dlopen(path.as_ptr() as *const i8, libc::RTLD_LAZY);
        if handle.is_null() {
            continue;
        }
        if let Some(f) = dlsym_named(handle, name) {
            return Some(f);
        }
    }
    None
}

unsafe fn first_sym<T>(names: &[&[u8]]) -> Option<T> {
    names.iter().copied().find_map(|name| load_sym(name))
}
