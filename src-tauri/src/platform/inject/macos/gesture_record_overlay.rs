//! Full-screen stroke overlay for gesture template recording and runtime holds.

use cocoa::appkit::{
    NSBackingStoreBuffered, NSColor, NSView, NSWindow, NSWindowCollectionBehavior, NSWindowStyleMask,
};
use cocoa::base::{id, nil, NO, YES};
use cocoa::foundation::{NSPoint, NSRect, NSSize};
use objc::declare::ClassDecl;
use objc::runtime::{Class, Object, Sel};
use objc::{class, msg_send, sel, sel_impl};
use parking_lot::Mutex;
use std::ffi::c_void;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::Duration;

use crate::platform::app_bus;

const STROKE_WIDTH: f64 = 3.0;
const ACCENT_R: f64 = 192.0 / 255.0;
const ACCENT_G: f64 = 123.0 / 255.0;
const ACCENT_B: f64 = 196.0 / 255.0;
const VIEW_CLASS: &str = "ElecomHugeGestureRecordOverlayView";
const PANEL_CLASS: &str = "ElecomHugeGestureStrokePanel";
const NONACTIVATING_PANEL: u64 = 1 << 7;
const ORDER_ABOVE: i32 = 1;

type CgsMain = unsafe extern "C" fn() -> i32;
type SlsSetLevel = unsafe extern "C" fn(i32, u32, i32) -> i32;
type SlsOrder = unsafe extern "C" fn(i32, u32, i32, i32) -> i32;

#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
    fn CGShieldingWindowLevel() -> i32;
}

static WINDOW: Mutex<Option<usize>> = Mutex::new(None);
static POINTS: Mutex<Vec<NSPoint>> = Mutex::new(Vec::new());
static ACTIVE: AtomicBool = AtomicBool::new(false);
static RAISING: AtomicBool = AtomicBool::new(false);

pub fn set_active(active: bool) {
    ACTIVE.store(active, Ordering::SeqCst);
    if active {
        app_bus::run_on_main(|| unsafe { show_on_main() });
    } else {
        RAISING.store(false, Ordering::SeqCst);
        app_bus::run_on_main(|| unsafe { hide_on_main() });
    }
}

pub fn clear_stroke() {
    POINTS.lock().clear();
    redraw();
}

pub fn append_cursor_point() {
    if !ACTIVE.load(Ordering::SeqCst) {
        return;
    }
    app_bus::run_on_main(|| unsafe {
        let loc = cocoa::appkit::NSEvent::mouseLocation(nil);
        append_point(loc);
    });
}

pub fn append_screen_point(x: f64, y: f64) {
    if !ACTIVE.load(Ordering::SeqCst) {
        return;
    }
    app_bus::run_on_main(move || append_point(NSPoint::new(x, y)));
}

fn append_point(point: NSPoint) {
    let mut points = POINTS.lock();
    if let Some(last) = points.last() {
        let dx = point.x - last.x;
        let dy = point.y - last.y;
        if dx * dx + dy * dy < 1.0 {
            return;
        }
    }
    points.push(point);
    drop(points);
    redraw();
}

fn redraw() {
    app_bus::run_on_main(|| unsafe {
        let Some(ptr) = *WINDOW.lock() else {
            return;
        };
        let win = ptr as id;
        if win.is_null() {
            return;
        }
        let view: id = win.contentView();
        if !view.is_null() {
            let _: () = msg_send![view, setNeedsDisplay: YES];
        }
    });
}

fn shielding_level() -> i32 {
    unsafe { CGShieldingWindowLevel() }
}

unsafe fn show_on_main() {
    hide_on_main();
    let screen: id = msg_send![class!(NSScreen), mainScreen];
    if screen.is_null() {
        return;
    }
    let frame: NSRect = msg_send![screen, frame];
    let style = NSWindowStyleMask::from_bits_truncate(
        NSWindowStyleMask::NSBorderlessWindowMask.bits() | NONACTIVATING_PANEL,
    );
    let win: id = msg_send![panel_class(), alloc];
    let win: id = msg_send![
        win,
        initWithContentRect: frame
        styleMask: style
        backing: NSBackingStoreBuffered
        defer: NO
    ];
    if win.is_null() {
        return;
    }
    win.setReleasedWhenClosed_(NO);
    win.setOpaque_(NO);
    win.setBackgroundColor_(NSColor::clearColor(nil));
    win.setIgnoresMouseEvents_(YES);
    win.setHidesOnDeactivate_(NO);
    let _: () = msg_send![win, setCanHide: NO];
    win.setLevel_(i64::from(shielding_level()));
    win.setCollectionBehavior_(
        NSWindowCollectionBehavior::NSWindowCollectionBehaviorCanJoinAllSpaces
            | NSWindowCollectionBehavior::NSWindowCollectionBehaviorStationary
            | NSWindowCollectionBehavior::NSWindowCollectionBehaviorTransient
            | NSWindowCollectionBehavior::NSWindowCollectionBehaviorIgnoresCycle
            | NSWindowCollectionBehavior::NSWindowCollectionBehaviorFullScreenAuxiliary
            | NSWindowCollectionBehavior::from_bits_truncate(1 << 18),
    );

    let view: id = msg_send![overlay_view_class(), alloc];
    let view: id = msg_send![view, initWithFrame: frame];
    win.setContentView_(view);
    win.orderFrontRegardless();
    win.setLevel_(i64::from(shielding_level()));
    raise_window_server(win);
    *WINDOW.lock() = Some(win as usize);
    start_raise_loop();
    redraw();
}

unsafe fn hide_on_main() {
    RAISING.store(false, Ordering::SeqCst);
    POINTS.lock().clear();
    if let Some(ptr) = WINDOW.lock().take() {
        let win = ptr as id;
        if !win.is_null() {
            let _: () = msg_send![win, orderOut: nil];
            let _: () = msg_send![win, close];
        }
    }
}

fn start_raise_loop() {
    if RAISING.swap(true, Ordering::SeqCst) {
        return;
    }
    thread::spawn(|| {
        while RAISING.load(Ordering::SeqCst) {
            app_bus::run_on_main(|| unsafe { raise_on_main() });
            thread::sleep(Duration::from_millis(120));
        }
    });
}

unsafe fn raise_on_main() {
    let Some(ptr) = *WINDOW.lock() else {
        return;
    };
    let win = ptr as id;
    if win.is_null() {
        return;
    }
    win.setLevel_(i64::from(shielding_level()));
    raise_window_server(win);
}

unsafe fn window_id(win: id) -> Option<u32> {
    let wid: i64 = msg_send![win, windowNumber];
    (wid > 0).then_some(wid as u32)
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

unsafe fn raise_window_server(win: id) {
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
        let _ = set_level(cid, wid, shielding_level());
    }
    if let Some(order) = first_sym::<SlsOrder>(&[b"SLSOrderWindow\0", b"CGSOrderWindow\0"]) {
        let _ = order(cid, wid, ORDER_ABOVE, 0);
    }
}

fn panel_class() -> &'static Class {
    if let Some(cls) = Class::get(PANEL_CLASS) {
        return cls;
    }
    let mut decl = ClassDecl::new(PANEL_CLASS, class!(NSPanel)).expect(PANEL_CLASS);
    unsafe {
        decl.add_method(
            sel!(canBecomeKeyWindow),
            no_bool as extern "C" fn(&Object, Sel) -> cocoa::base::BOOL,
        );
        decl.add_method(
            sel!(canBecomeMainWindow),
            no_bool as extern "C" fn(&Object, Sel) -> cocoa::base::BOOL,
        );
    }
    decl.register();
    Class::get(PANEL_CLASS).expect(PANEL_CLASS)
}

extern "C" fn no_bool(_this: &Object, _sel: Sel) -> cocoa::base::BOOL {
    NO
}

fn overlay_view_class() -> &'static Class {
    overlay_view_class_init()
}

fn overlay_view_class_init() -> &'static Class {
    use std::sync::OnceLock;
    static CLASS: OnceLock<&'static Class> = OnceLock::new();
    CLASS.get_or_init(|| {
        let mut decl = ClassDecl::new(VIEW_CLASS, class!(NSView))
            .expect("gesture record overlay view");
        unsafe {
            decl.add_method(
                sel!(isFlipped),
                is_flipped as extern "C" fn(&Object, Sel) -> cocoa::base::BOOL,
            );
            decl.add_method(
                sel!(drawRect:),
                draw_rect as extern "C" fn(&Object, Sel, NSRect),
            );
        }
        decl.register()
    })
}

extern "C" fn is_flipped(_this: &Object, _sel: Sel) -> cocoa::base::BOOL {
    YES
}

extern "C" fn draw_rect(this: &Object, _sel: Sel, _rect: NSRect) {
    let points = POINTS.lock().clone();
    if points.is_empty() {
        return;
    }
    unsafe {
        let win: id = msg_send![this, window];
        if win.is_null() {
            return;
        }
        let screen_frame: NSRect = msg_send![win, frame];
        let color = NSColor::colorWithRed_green_blue_alpha_(
            nil,
            ACCENT_R,
            ACCENT_G,
            ACCENT_B,
            0.92,
        );
        let _: () = msg_send![color, setStroke];

        if points.len() == 1 {
            let point = points[0];
            let view_y = screen_frame.size.height - (point.y - screen_frame.origin.y);
            let view_x = point.x - screen_frame.origin.x;
            let dot: id = msg_send![class!(NSBezierPath), bezierPath];
            let _: () = msg_send![dot, appendBezierPathWithArcWithCenter: NSPoint::new(view_x, view_y) radius: STROKE_WIDTH * 1.5 startAngle: 0.0 endAngle: 360.0];
            let _: () = msg_send![color, setFill];
            let _: () = msg_send![dot, fill];
            return;
        }

        let path: id = msg_send![class!(NSBezierPath), bezierPath];
        let _: () = msg_send![path, setLineWidth: STROKE_WIDTH];
        let _: () = msg_send![path, setLineCapStyle: 1i64];
        let _: () = msg_send![path, setLineJoinStyle: 1i64];

        for (index, point) in points.iter().enumerate() {
            let view_y = screen_frame.size.height - (point.y - screen_frame.origin.y);
            let view_x = point.x - screen_frame.origin.x;
            let view_pt = NSPoint::new(view_x, view_y);
            if index == 0 {
                let _: () = msg_send![path, moveToPoint: view_pt];
            } else {
                let _: () = msg_send![path, lineToPoint: view_pt];
            }
        }
        let _: () = msg_send![path, stroke];
    }
}

pub fn shutdown() {
    ACTIVE.store(false, Ordering::SeqCst);
    RAISING.store(false, Ordering::SeqCst);
    app_bus::run_on_main(|| unsafe { hide_on_main() });
}
