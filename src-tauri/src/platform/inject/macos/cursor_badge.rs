//! Ring around the pointer while ball-scroll is on.
//!
//! Safari and most apps composite our overlay window. Chrome draws the page
//! on a GPU overlay that covers other windows, but still uses the hardware
//! cursor — so Chromium gets a system-cursor hook instead of a window.

use cocoa::appkit::{
    NSBackingStoreBuffered, NSColor, NSCompositingOperation, NSCursor, NSEvent, NSImage, NSWindow,
    NSWindowCollectionBehavior, NSWindowStyleMask,
};
use cocoa::base::{id, nil, BOOL, NO, YES};
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

/// Outer diameter of the ring around the pointer hotspot.
const RING: f64 = 44.0;
const WHITE: f64 = 1.0;
const PURPLE: f64 = 3.0;
const BLACK: f64 = 1.0;
/// App accent `#c07bc4`.
const ACCENT_R: f64 = 192.0 / 255.0;
const ACCENT_G: f64 = 123.0 / 255.0;
const ACCENT_B: f64 = 196.0 / 255.0;

const RING_VIEW_CLASS: &str = "ElecomHugeBallScrollRingView";
const GESTURE_VIEW_CLASS: &str = "ElecomHugeGestureBadgeView";
const PANEL_CLASS: &str = "ElecomHugeBallScrollPanel";

#[derive(Clone, Copy, PartialEq, Eq)]
enum BadgeStyle {
    BallScrollRing,
    GestureFilled,
}
/// `NSWindowStyleMaskNonactivatingPanel`
const NONACTIVATING_PANEL: u64 = 1 << 7;
/// `kCGSOrderAbove`
const ORDER_ABOVE: i32 = 1;

#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
    fn CGShieldingWindowLevel() -> i32;
    fn CGMainDisplayID() -> u32;
    fn CGDisplayShowCursor(display: u32) -> i32;
}

static WINDOW: Mutex<Option<usize>> = Mutex::new(None);
static STYLE: Mutex<BadgeStyle> = Mutex::new(BadgeStyle::BallScrollRing);
static RAISING: AtomicBool = AtomicBool::new(false);
static CURSOR_HOOKED: AtomicBool = AtomicBool::new(false);
static CURSOR_BLOB: Mutex<Option<CursorBlob>> = Mutex::new(None);

#[derive(Clone)]
struct CursorBlob {
    pixels: Vec<u8>,
    row_bytes: i32,
    width: f64,
    height: f64,
    hot_x: f64,
    hot_y: f64,
    depth: i32,
    components: i32,
    bpc: i32,
}

pub fn show() {
    *STYLE.lock() = BadgeStyle::BallScrollRing;
    app_bus::run_on_main(|| unsafe { show_on_main() });
}

pub fn show_gesture() {
    *STYLE.lock() = BadgeStyle::GestureFilled;
    app_bus::run_on_main(|| unsafe { show_on_main() });
}

pub fn hide() {
    RAISING.store(false, Ordering::SeqCst);
    app_bus::run_on_main(|| unsafe { hide_on_main() });
}

/// Quit path: stop the raise loop without scheduling AppKit work from a tap thread.
pub fn abort_for_quit() {
    RAISING.store(false, Ordering::SeqCst);
}

/// App exit: stop the raise loop and tear down the overlay immediately.
pub fn shutdown() {
    RAISING.store(false, Ordering::SeqCst);
    app_bus::run_on_main(|| unsafe { hide_on_main() });
}

fn shielding_level() -> i32 {
    unsafe { CGShieldingWindowLevel() }
}

unsafe fn show_on_main() {
    hide_on_main();
    let loc = NSEvent::mouseLocation(nil);
    let origin = NSPoint::new(loc.x - RING / 2.0, loc.y - RING / 2.0);
    let rect = NSRect::new(origin, NSSize::new(RING, RING));
    let style = NSWindowStyleMask::from_bits_truncate(
        NSWindowStyleMask::NSBorderlessWindowMask.bits() | NONACTIVATING_PANEL,
    );
    let win: id = msg_send![panel_class(), alloc];
    let win: id = win.initWithContentRect_styleMask_backing_defer_(
        rect,
        style,
        NSBackingStoreBuffered,
        NO,
    );
    if win.is_null() {
        return;
    }
    win.setReleasedWhenClosed_(NO);
    win.setHasShadow_(NO);
    win.setIgnoresMouseEvents_(YES);
    win.setHidesOnDeactivate_(NO);
    let _: () = msg_send![win, setAnimationBehavior: 2i64];
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

    let frame = NSRect::new(NSPoint::new(0.0, 0.0), NSSize::new(RING, RING));
    let style = *STYLE.lock();
    let view_class = match style {
        BadgeStyle::BallScrollRing => ring_view_class(),
        BadgeStyle::GestureFilled => gesture_view_class(),
    };
    let view: id = msg_send![view_class, alloc];
    let view: id = msg_send![view, initWithFrame: frame];
    let _: () = msg_send![view, setWantsLayer: NO];
    win.setContentView_(view);

    win.setOpaque_(NO);
    win.setBackgroundColor_(NSColor::clearColor(nil));
    win.orderFrontRegardless();
    apply_badge_shape(win, style);
    win.setLevel_(i64::from(shielding_level()));
    win.orderFrontRegardless();
    raise_window_server(win);

    *WINDOW.lock() = Some(win as usize);
    start_raise_loop();
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

unsafe fn hide_on_main() {
    restore_cursor_ring();
    if let Some(ptr) = WINDOW.lock().take() {
        let win = ptr as id;
        if !win.is_null() {
            win.orderOut_(nil);
            win.close();
            let _: () = msg_send![win, release];
        }
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
            no_bool as extern "C" fn(&Object, Sel) -> BOOL,
        );
        decl.add_method(
            sel!(canBecomeMainWindow),
            no_bool as extern "C" fn(&Object, Sel) -> BOOL,
        );
    }
    decl.register();
    Class::get(PANEL_CLASS).expect(PANEL_CLASS)
}

fn gesture_view_class() -> &'static Class {
    if let Some(cls) = Class::get(GESTURE_VIEW_CLASS) {
        return cls;
    }
    let mut decl = ClassDecl::new(GESTURE_VIEW_CLASS, class!(NSView)).expect(GESTURE_VIEW_CLASS);
    unsafe {
        decl.add_method(
            sel!(drawRect:),
            draw_gesture_filled as extern "C" fn(&Object, Sel, NSRect),
        );
        decl.add_method(sel!(isOpaque), no_bool as extern "C" fn(&Object, Sel) -> BOOL);
        decl.add_method(
            sel!(wantsLayer),
            no_bool as extern "C" fn(&Object, Sel) -> BOOL,
        );
    }
    decl.register();
    Class::get(GESTURE_VIEW_CLASS).expect(GESTURE_VIEW_CLASS)
}

fn ring_view_class() -> &'static Class {
    if let Some(cls) = Class::get(RING_VIEW_CLASS) {
        return cls;
    }
    let mut decl = ClassDecl::new(RING_VIEW_CLASS, class!(NSView)).expect(RING_VIEW_CLASS);
    unsafe {
        decl.add_method(
            sel!(drawRect:),
            draw_ring as extern "C" fn(&Object, Sel, NSRect),
        );
        decl.add_method(sel!(isOpaque), no_bool as extern "C" fn(&Object, Sel) -> BOOL);
        decl.add_method(
            sel!(wantsLayer),
            no_bool as extern "C" fn(&Object, Sel) -> BOOL,
        );
    }
    decl.register();
    Class::get(RING_VIEW_CLASS).expect(RING_VIEW_CLASS)
}

extern "C" fn no_bool(_this: &Object, _cmd: Sel) -> BOOL {
    NO
}

extern "C" fn draw_gesture_filled(_this: &Object, _cmd: Sel, _dirty: NSRect) {
    unsafe {
        let purple = NSColor::colorWithCalibratedRed_green_blue_alpha_(
            nil, ACCENT_R, ACCENT_G, ACCENT_B, 1.0,
        );
        let purple_dark = NSColor::colorWithCalibratedRed_green_blue_alpha_(
            nil,
            ACCENT_R * 0.55,
            ACCENT_G * 0.55,
            ACCENT_B * 0.55,
            1.0,
        );
        let purple_light = NSColor::colorWithCalibratedRed_green_blue_alpha_(
            nil,
            (ACCENT_R + 0.22).min(1.0),
            (ACCENT_G + 0.22).min(1.0),
            (ACCENT_B + 0.22).min(1.0),
            0.85,
        );
        let white = NSColor::colorWithCalibratedRed_green_blue_alpha_(nil, 1.0, 1.0, 1.0, 0.92);

        let inset = 2.0;
        let span = RING - inset * 2.0;
        let rect = NSRect::new(NSPoint::new(inset, inset), NSSize::new(span, span));
        let fill: id = msg_send![class!(NSBezierPath), bezierPathWithOvalInRect: rect];
        let _: () = msg_send![purple, setFill];
        let _: () = msg_send![fill, fill];

        // Subtle inner shadow along the bottom edge.
        let shadow_rect = NSRect::new(
            NSPoint::new(inset + 1.0, inset + 1.0),
            NSSize::new(span - 2.0, span * 0.45),
        );
        let shadow: id = msg_send![class!(NSBezierPath), bezierPathWithOvalInRect: shadow_rect];
        let _: () = msg_send![purple_dark, setFill];
        let _: () = msg_send![shadow, fill];

        // Top highlight arc.
        let highlight_rect = NSRect::new(
            NSPoint::new(inset + 3.0, inset + span * 0.42),
            NSSize::new(span - 6.0, span * 0.42),
        );
        let highlight: id = msg_send![class!(NSBezierPath), bezierPathWithOvalInRect: highlight_rect];
        let _: () = msg_send![purple_light, setFill];
        let _: () = msg_send![highlight, fill];

        // Embossed gesture-stroke icon (squiggle) at center.
        let cx = RING / 2.0;
        let cy = RING / 2.0;
        let icon: id = msg_send![class!(NSBezierPath), bezierPath];
        let _: () = msg_send![icon, moveToPoint: NSPoint::new(cx - 9.0, cy + 1.0)];
        let _: () = msg_send![
            icon,
            curveToPoint: NSPoint::new(cx - 1.0, cy - 8.0)
            controlPoint1: NSPoint::new(cx - 6.0, cy - 2.0)
            controlPoint2: NSPoint::new(cx - 3.0, cy - 7.0)
        ];
        let _: () = msg_send![
            icon,
            curveToPoint: NSPoint::new(cx + 9.0, cy + 2.0)
            controlPoint1: NSPoint::new(cx + 2.0, cy - 6.0)
            controlPoint2: NSPoint::new(cx + 5.0, cy + 4.0)
        ];
        let _: () = msg_send![icon, setLineWidth: 2.4];
        let _: () = msg_send![icon, setLineCapStyle: 1i64]; // round
        let _: () = msg_send![icon, setLineJoinStyle: 1i64]; // round

        let shadow_icon: id = msg_send![icon, copy];
        let _: () = msg_send![
            shadow_icon,
            transformUsingAffineTransform: affine_translate(0.6, -0.7)
        ];
        let _: () = msg_send![purple_dark, setStroke];
        let _: () = msg_send![shadow_icon, stroke];

        let _: () = msg_send![white, setStroke];
        let _: () = msg_send![icon, stroke];
    }
}

unsafe fn affine_translate(dx: f64, dy: f64) -> id {
    let t: id = msg_send![class!(NSAffineTransform), transform];
    let _: () = msg_send![t, translateXBy: dx yBy: dy];
    t
}

extern "C" fn draw_ring(_this: &Object, _cmd: Sel, _dirty: NSRect) {
    unsafe {
        let white = NSColor::colorWithCalibratedRed_green_blue_alpha_(nil, 1.0, 1.0, 1.0, 1.0);
        let purple = NSColor::colorWithCalibratedRed_green_blue_alpha_(
            nil, ACCENT_R, ACCENT_G, ACCENT_B, 1.0,
        );
        let black = NSColor::colorWithCalibratedRed_green_blue_alpha_(nil, 0.0, 0.0, 0.0, 1.0);
        let white_mid = WHITE / 2.0;
        let purple_mid = WHITE + PURPLE / 2.0;
        let black_mid = WHITE + PURPLE + BLACK / 2.0;
        stroke_oval(white_mid, RING - WHITE, WHITE, white);
        stroke_oval(purple_mid, RING - 2.0 * purple_mid, PURPLE, purple);
        stroke_oval(black_mid, RING - 2.0 * black_mid, BLACK, black);
    }
}

unsafe fn stroke_oval(inset: f64, span: f64, width: f64, color: id) {
    let rect = NSRect::new(NSPoint::new(inset, inset), NSSize::new(span, span));
    let path: id = msg_send![class!(NSBezierPath), bezierPathWithOvalInRect: rect];
    let _: () = msg_send![path, setLineWidth: width];
    let _: () = msg_send![color, setStroke];
    let _: () = msg_send![path, stroke];
}

type CgsMain = unsafe extern "C" fn() -> i32;
type CgsNewRects = unsafe extern "C" fn(*const NSRect, i32, *mut *mut c_void) -> i32;
type SlsSetShape = unsafe extern "C" fn(i32, u32, f32, f32, *mut c_void) -> i32;
type SlsSetLevel = unsafe extern "C" fn(i32, u32, i32) -> i32;
type SlsOrder = unsafe extern "C" fn(i32, u32, i32, u32) -> i32;
type CgsRelease = unsafe extern "C" fn(*mut c_void);

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
        b"/System/Library/Frameworks/ApplicationServices.framework/ApplicationServices\0".as_slice(),
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

unsafe fn window_id(win: id) -> Option<u32> {
    let wid: i64 = msg_send![win, windowNumber];
    (wid > 0).then_some(wid as u32)
}

unsafe fn apply_badge_shape(win: id, style: BadgeStyle) -> bool {
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

    let rects = match style {
        BadgeStyle::BallScrollRing => ring_scanlines(),
        BadgeStyle::GestureFilled => filled_circle_scanlines(RING),
    };
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

fn filled_circle_scanlines(diameter: f64) -> Vec<NSRect> {
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

fn ring_scanlines() -> Vec<NSRect> {
    let cx = RING / 2.0;
    let cy = RING / 2.0;
    let r_out = RING / 2.0;
    let r_in = (RING / 2.0 - WHITE - PURPLE - BLACK).max(0.0);
    let mut rects = Vec::new();
    let mut y = 0.0;
    while y < RING {
        let dy = (y + 0.5) - cy;
        let dy2 = dy * dy;
        let out2 = r_out * r_out;
        if dy2 < out2 {
            let half_out = (out2 - dy2).sqrt();
            let in2 = r_in * r_in;
            if dy2 >= in2 {
                rects.push(NSRect::new(
                    NSPoint::new(cx - half_out, y),
                    NSSize::new(half_out * 2.0, 1.0),
                ));
            } else {
                let half_in = (in2 - dy2).sqrt();
                let span = half_out - half_in;
                if span > 0.0 {
                    rects.push(NSRect::new(
                        NSPoint::new(cx - half_out, y),
                        NSSize::new(span, 1.0),
                    ));
                    rects.push(NSRect::new(
                        NSPoint::new(cx + half_in, y),
                        NSSize::new(span, 1.0),
                    ));
                }
            }
        }
        y += 1.0;
    }
    rects
}

fn is_chromium_frontmost() -> bool {
    unsafe {
        let ws: id = msg_send![class!(NSWorkspace), sharedWorkspace];
        let app: id = msg_send![ws, frontmostApplication];
        if app.is_null() {
            return false;
        }
        let bid: id = msg_send![app, bundleIdentifier];
        if bid.is_null() {
            return false;
        }
        let bytes: *const i8 = msg_send![bid, UTF8String];
        if bytes.is_null() {
            return false;
        }
        let id = std::ffi::CStr::from_ptr(bytes)
            .to_string_lossy()
            .to_ascii_lowercase();
        id.contains("chrome")
            || id.contains("chromium")
            || id.contains("brave")
            || id.contains("edgemac")
            || id.contains("vivaldi")
            || id.contains("opera")
            || id.contains("thebrowser")
            || id.contains("zen-browser")
    }
}

type CoreCursorSetFn = unsafe extern "C" fn(i32, i32);
type CoreCursorUnregisterFn = unsafe extern "C" fn(i32) -> i32;
type ForceShowFn = unsafe extern "C" fn(i32) -> i32;
type ShowCursorFn = unsafe extern "C" fn(i32) -> i32;
/// CGSSetCursorFromData(cid, data, size, rowBytes, CGRect, CGPoint, depth, components, bpc, seed)
type SetCursorFromData = unsafe extern "C" fn(
    i32,
    *const u8,
    i32,
    i32,
    f64,
    f64,
    f64,
    f64,
    f64,
    f64,
    i32,
    i32,
    i32,
    *mut i32,
) -> i32;
/// CGSSetCursorFromPremultipliedDataWithSeed(cid, seed, data, size, rowBytes, CGRect, CGPoint, depth, components, bpc)
type SetCursorPremul = unsafe extern "C" fn(
    i32,
    *mut i32,
    *const u8,
    i32,
    i32,
    f64,
    f64,
    f64,
    f64,
    f64,
    f64,
    i32,
    i32,
    i32,
) -> i32;

unsafe fn apply_cursor_ring() -> bool {
    // SLSSetCursorFromData aborts if bitmap/alpha layout is wrong
    // (`alpha_data == NULL || alpha_data == bitmap_data`). Do not call it.
    false
}

unsafe fn force_show_hardware_cursor() {
    let _: () = msg_send![class!(NSCursor), unhide];
    let _: () = msg_send![class!(NSCursor), setHiddenUntilMouseMoves: NO];
    let _ = CGDisplayShowCursor(CGMainDisplayID());
    if let Some(main) = first_sym::<CgsMain>(&[b"SLSMainConnectionID\0", b"CGSMainConnectionID\0"]) {
        let cid = main();
        if let Some(show) = first_sym::<ShowCursorFn>(&[b"SLSShowCursor\0", b"CGSShowCursor\0"]) {
            let _ = show(cid);
        }
        if let Some(force) =
            first_sym::<ForceShowFn>(&[b"SLSForceShowCursor\0", b"CGSForceShowCursor\0"])
        {
            let _ = force(cid);
        }
    }
}

unsafe fn restore_cursor_ring() {
    CURSOR_BLOB.lock().take();
    if !CURSOR_HOOKED.swap(false, Ordering::SeqCst) {
        return;
    }
    let Some(main) = first_sym::<CgsMain>(&[b"SLSMainConnectionID\0", b"CGSMainConnectionID\0"])
    else {
        return;
    };
    let cid = main();
    if let Some(unreg) = load_sym::<CoreCursorUnregisterFn>(b"CoreCursorUnregisterAll\0") {
        let _ = unreg(cid);
    }
    if let Some(set) = load_sym::<CoreCursorSetFn>(b"CoreCursorSet\0") {
        set(cid, 0);
    }
}

unsafe fn cursor_ring_blob() -> Option<CursorBlob> {
    let (img, width, height, hot_x, hot_y) = cursor_ring_nsimage()?;
    let tiff: id = msg_send![img, TIFFRepresentation];
    if tiff.is_null() {
        return None;
    }
    let rep: id = msg_send![class!(NSBitmapImageRep), imageRepWithData: tiff];
    if rep.is_null() {
        return None;
    }
    let px_w: i64 = msg_send![rep, pixelsWide];
    let px_h: i64 = msg_send![rep, pixelsHigh];
    let row: i64 = msg_send![rep, bytesPerRow];
    let bpp: i64 = msg_send![rep, bitsPerPixel];
    let bps: i64 = msg_send![rep, bitsPerSample];
    let spp: i64 = msg_send![rep, samplesPerPixel];
    let data: *const u8 = msg_send![rep, bitmapData];
    if data.is_null() || px_w <= 0 || px_h <= 0 || row <= 0 {
        return None;
    }
    let len = (row * px_h) as usize;
    let pixels = std::slice::from_raw_parts(data, len).to_vec();
    let scale = if width > 0.0 {
        px_w as f64 / width
    } else {
        1.0
    };
    Some(CursorBlob {
        pixels,
        row_bytes: row as i32,
        width: px_w as f64,
        height: px_h as f64,
        hot_x: hot_x * scale,
        hot_y: hot_y * scale,
        depth: bpp as i32,
        components: spp as i32,
        bpc: bps as i32,
    })
}

unsafe fn cursor_ring_nsimage() -> Option<(id, f64, f64, f64, f64)> {
    let mut cursor: id = NSCursor::current_system_cursor(nil);
    if cursor.is_null() {
        cursor = NSCursor::arrow_cursor(nil);
    }
    if cursor.is_null() {
        return None;
    }
    let arrow: id = msg_send![cursor, image];
    if arrow.is_null() {
        return None;
    }
    let hot: NSPoint = msg_send![cursor, hotSpot];
    let arrow_size: NSSize = msg_send![arrow, size];
    let half = RING / 2.0;
    let left = half.max(hot.x);
    let top = half.max(hot.y);
    let right = half.max(arrow_size.width - hot.x);
    let bottom = half.max(arrow_size.height - hot.y);
    let width = left + right;
    let height = top + bottom;
    let img: id = NSImage::alloc(nil).initWithSize_(NSSize::new(width, height));
    img.lockFocus();

    // NSCursor hotspot is top-left; lockFocus is bottom-left.
    let arrow_x = left - hot.x;
    let arrow_y = height - (top - hot.y + arrow_size.height);
    arrow.drawInRect_fromRect_operation_fraction_(
        NSRect::new(NSPoint::new(arrow_x, arrow_y), arrow_size),
        NSRect::new(NSPoint::new(0.0, 0.0), NSSize::new(0.0, 0.0)),
        NSCompositingOperation::NSCompositeSourceOver,
        1.0,
    );

    let hot_x = left;
    let hot_y_bl = height - top;
    let ring_origin = NSPoint::new(hot_x - half, hot_y_bl - half);
    stroke_ring_at(ring_origin);

    img.unlockFocus();
    Some((img, width, height, left, top))
}

unsafe fn stroke_ring_at(origin: NSPoint) {
    let white = NSColor::colorWithCalibratedRed_green_blue_alpha_(nil, 1.0, 1.0, 1.0, 1.0);
    let purple = NSColor::colorWithCalibratedRed_green_blue_alpha_(
        nil, ACCENT_R, ACCENT_G, ACCENT_B, 1.0,
    );
    let black = NSColor::colorWithCalibratedRed_green_blue_alpha_(nil, 0.0, 0.0, 0.0, 1.0);
    let white_mid = WHITE / 2.0;
    let purple_mid = WHITE + PURPLE / 2.0;
    let black_mid = WHITE + PURPLE + BLACK / 2.0;
    stroke_oval_at(origin, white_mid, RING - WHITE, WHITE, white);
    stroke_oval_at(origin, purple_mid, RING - 2.0 * purple_mid, PURPLE, purple);
    stroke_oval_at(origin, black_mid, RING - 2.0 * black_mid, BLACK, black);
}

unsafe fn stroke_oval_at(origin: NSPoint, inset: f64, span: f64, width: f64, color: id) {
    let rect = NSRect::new(
        NSPoint::new(origin.x + inset, origin.y + inset),
        NSSize::new(span, span),
    );
    let path: id = msg_send![class!(NSBezierPath), bezierPathWithOvalInRect: rect];
    let _: () = msg_send![path, setLineWidth: width];
    let _: () = msg_send![color, setStroke];
    let _: () = msg_send![path, stroke];
}
