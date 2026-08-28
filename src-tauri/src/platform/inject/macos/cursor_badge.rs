//! Ring around the pointer while ball-scroll / gesture hold is active.
//!
//! Always rendered as a click-through NSPanel at the system shielding level,
//! independent of which app is frontmost or focused.

use cocoa::appkit::{NSColor, NSCompositingOperation, NSEvent, NSImage, NSView, NSWindow};
use cocoa::base::{id, nil, NO};
use cocoa::foundation::{NSData, NSPoint, NSRect, NSSize};
use objc::declare::ClassDecl;
use objc::runtime::{Class, Object, Sel};
use objc::{class, msg_send, sel, sel_impl};
use parking_lot::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::OnceLock;
use std::thread;
use std::time::Duration;

use crate::platform::app_bus;

use super::overlay_panel::{
    alloc_overlay_badge_panel, apply_window_shape, close_overlay_panel, filled_circle_scanlines,
    order_overlay_badge_front, register_nonactivating_panel_class, release_overlay_activation_policy,
    retain_overlay_activation_policy, stop_raise_loop, RAISE_INTERVAL_MS,
};
use super::gesture_record_overlay;

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
const APP_ICON_PNG: &[u8] = include_bytes!("../../../../icons/icon.png");

static GESTURE_APP_ICON: OnceLock<usize> = OnceLock::new();

#[derive(Clone, Copy, PartialEq, Eq)]
enum BadgeStyle {
    BallScrollRing,
    GestureFilled,
}

static WINDOW: Mutex<Option<usize>> = Mutex::new(None);
static STYLE: Mutex<BadgeStyle> = Mutex::new(BadgeStyle::BallScrollRing);
static ANCHOR: Mutex<Option<NSPoint>> = Mutex::new(None);
static RAISING: AtomicBool = AtomicBool::new(false);

pub fn show() {
    *STYLE.lock() = BadgeStyle::BallScrollRing;
    app_bus::run_on_main(|| unsafe { show_on_main() });
}

pub fn show_gesture() {
    *STYLE.lock() = BadgeStyle::GestureFilled;
    app_bus::run_on_main(|| unsafe { show_on_main() });
}

pub fn hide() {
    stop_raise_loop(&RAISING);
    app_bus::run_on_main(|| unsafe { hide_on_main() });
}

/// Quit path: stop the raise loop without scheduling AppKit work from a tap thread.
pub fn abort_for_quit() {
    stop_raise_loop(&RAISING);
}

/// App exit: stop the raise loop and tear down the overlay immediately.
pub fn shutdown() {
    stop_raise_loop(&RAISING);
    app_bus::run_on_main(|| unsafe { hide_on_main() });
}

unsafe fn show_on_main() {
    hide_on_main();
    retain_overlay_activation_policy();
    let loc = NSEvent::mouseLocation(nil);
    *ANCHOR.lock() = Some(loc);
    let rect = badge_frame_at(loc);
    let panel_class = register_nonactivating_panel_class(PANEL_CLASS);
    let win = alloc_overlay_badge_panel(panel_class, rect);
    if win.is_null() {
        release_overlay_activation_policy();
        return;
    }

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

    apply_badge_shape(win, style);
    order_overlay_badge_front(win);

    *WINDOW.lock() = Some(win as usize);
    if style == BadgeStyle::GestureFilled {
        gesture_record_overlay::set_start_badge_visible(true);
    }
    start_raise_loop();
}

fn start_raise_loop() {
    if RAISING.swap(true, Ordering::SeqCst) {
        return;
    }
    thread::spawn(|| {
        while RAISING.load(Ordering::SeqCst) {
            app_bus::run_on_main(|| unsafe { raise_on_main() });
            thread::sleep(Duration::from_millis(RAISE_INTERVAL_MS));
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
    order_overlay_badge_front(win);
}

unsafe fn hide_on_main() {
    gesture_record_overlay::set_start_badge_visible(false);
    ANCHOR.lock().take();
    if let Some(ptr) = WINDOW.lock().take() {
        close_overlay_panel(ptr as id);
        release_overlay_activation_policy();
    }
}

fn badge_frame_at(loc: NSPoint) -> NSRect {
    NSRect::new(
        NSPoint::new(loc.x - RING / 2.0, loc.y - RING / 2.0),
        NSSize::new(RING, RING),
    )
}

unsafe fn apply_badge_shape(win: id, style: BadgeStyle) -> bool {
    let rects = match style {
        BadgeStyle::BallScrollRing => ring_scanlines(),
        BadgeStyle::GestureFilled => filled_circle_scanlines(RING),
    };
    apply_window_shape(win, &rects)
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
        decl.add_method(
            sel!(isOpaque),
            view_no as extern "C" fn(&Object, Sel) -> cocoa::base::BOOL,
        );
        decl.add_method(
            sel!(wantsLayer),
            view_no as extern "C" fn(&Object, Sel) -> cocoa::base::BOOL,
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
        decl.add_method(
            sel!(isOpaque),
            view_no as extern "C" fn(&Object, Sel) -> cocoa::base::BOOL,
        );
        decl.add_method(
            sel!(wantsLayer),
            view_no as extern "C" fn(&Object, Sel) -> cocoa::base::BOOL,
        );
    }
    decl.register();
    Class::get(RING_VIEW_CLASS).expect(RING_VIEW_CLASS)
}

extern "C" fn view_no(_this: &Object, _cmd: Sel) -> cocoa::base::BOOL {
    NO
}

extern "C" fn draw_gesture_filled(_this: &Object, _cmd: Sel, _dirty: NSRect) {
    unsafe {
        draw_gesture_filled_in(NSRect::new(NSPoint::new(0.0, 0.0), NSSize::new(RING, RING)));
    }
}

extern "C" fn draw_ring(_this: &Object, _cmd: Sel, _dirty: NSRect) {
    unsafe {
        draw_ring_in(NSRect::new(NSPoint::new(0.0, 0.0), NSSize::new(RING, RING)));
    }
}

unsafe fn draw_gesture_filled_in(bounds: NSRect) {
    let cx = bounds.origin.x + bounds.size.width / 2.0;
    let cy = bounds.origin.y + bounds.size.height / 2.0;
    let diameter = bounds.size.width.min(bounds.size.height);
    let outer = diameter - 2.0;
    let outer_rect = NSRect::new(
        NSPoint::new(cx - outer / 2.0, cy - outer / 2.0),
        NSSize::new(outer, outer),
    );

    let white = NSColor::colorWithCalibratedRed_green_blue_alpha_(nil, 1.0, 1.0, 1.0, 1.0);
    let backing: id = msg_send![class!(NSBezierPath), bezierPathWithOvalInRect: outer_rect];
    let _: () = msg_send![white, setFill];
    let _: () = msg_send![backing, fill];

    let icon_inset = 3.0;
    let icon_size = diameter - icon_inset * 2.0;
    let icon_rect = NSRect::new(
        NSPoint::new(cx - icon_size / 2.0, cy - icon_size / 2.0),
        NSSize::new(icon_size, icon_size),
    );
    draw_clipped_app_icon(icon_rect);

    let purple = NSColor::colorWithCalibratedRed_green_blue_alpha_(
        nil, ACCENT_R, ACCENT_G, ACCENT_B, 1.0,
    );
    let ring: id = msg_send![class!(NSBezierPath), bezierPathWithOvalInRect: outer_rect];
    let _: () = msg_send![ring, setLineWidth: 2.5];
    let _: () = msg_send![purple, setStroke];
    let _: () = msg_send![ring, stroke];

    draw_gesture_checkmark(cx, cy - 0.5);
}

unsafe fn gesture_app_icon() -> id {
    *GESTURE_APP_ICON.get_or_init(|| {
        let data = NSData::dataWithBytes_length_(
            nil,
            APP_ICON_PNG.as_ptr() as *const std::os::raw::c_void,
            APP_ICON_PNG.len() as u64,
        );
        let img = NSImage::alloc(nil);
        NSImage::initWithData_(img, data) as usize
    }) as id
}

unsafe fn draw_clipped_app_icon(rect: NSRect) {
    let ctx: id = msg_send![class!(NSGraphicsContext), currentContext];
    if ctx.is_null() {
        return;
    }
    let _: () = msg_send![ctx, saveGraphicsState];
    let clip: id = msg_send![class!(NSBezierPath), bezierPathWithOvalInRect: rect];
    let _: () = msg_send![clip, addClip];
    let icon = gesture_app_icon();
    if !icon.is_null() {
        icon.drawInRect_fromRect_operation_fraction_(
            rect,
            NSRect::new(NSPoint::new(0.0, 0.0), NSSize::new(0.0, 0.0)),
            NSCompositingOperation::NSCompositeSourceOver,
            1.0,
        );
    }
    let _: () = msg_send![ctx, restoreGraphicsState];
}

unsafe fn draw_gesture_checkmark(cx: f64, cy: f64) {
    let purple_dark = NSColor::colorWithCalibratedRed_green_blue_alpha_(
        nil,
        ACCENT_R * 0.45,
        ACCENT_G * 0.45,
        ACCENT_B * 0.45,
        0.85,
    );
    let white = NSColor::colorWithCalibratedRed_green_blue_alpha_(nil, 1.0, 1.0, 1.0, 0.98);

    let check: id = msg_send![class!(NSBezierPath), bezierPath];
    let _: () = msg_send![check, moveToPoint: NSPoint::new(cx - 5.5, cy + 0.5)];
    let _: () = msg_send![check, lineToPoint: NSPoint::new(cx - 1.0, cy - 3.5)];
    let _: () = msg_send![check, lineToPoint: NSPoint::new(cx + 6.5, cy + 5.0)];
    let _: () = msg_send![check, setLineWidth: 3.8];
    let _: () = msg_send![check, setLineCapStyle: 1i64];
    let _: () = msg_send![check, setLineJoinStyle: 1i64];

    let shadow: id = msg_send![check, copy];
    let _: () = msg_send![
        shadow,
        transformUsingAffineTransform: affine_translate(0.45, -0.55)
    ];
    let _: () = msg_send![purple_dark, setStroke];
    let _: () = msg_send![shadow, stroke];

    let _: () = msg_send![white, setStroke];
    let _: () = msg_send![check, stroke];
}

unsafe fn draw_ring_in(bounds: NSRect) {
    let white = NSColor::colorWithCalibratedRed_green_blue_alpha_(nil, 1.0, 1.0, 1.0, 1.0);
    let purple = NSColor::colorWithCalibratedRed_green_blue_alpha_(
        nil, ACCENT_R, ACCENT_G, ACCENT_B, 1.0,
    );
    let black = NSColor::colorWithCalibratedRed_green_blue_alpha_(nil, 0.0, 0.0, 0.0, 1.0);
    let white_mid = WHITE / 2.0;
    let purple_mid = WHITE + PURPLE / 2.0;
    let black_mid = WHITE + PURPLE + BLACK / 2.0;
    stroke_oval_in(bounds, white_mid, RING - WHITE, WHITE, white);
    stroke_oval_in(bounds, purple_mid, RING - 2.0 * purple_mid, PURPLE, purple);
    stroke_oval_in(bounds, black_mid, RING - 2.0 * black_mid, BLACK, black);
}

unsafe fn stroke_oval_in(bounds: NSRect, inset: f64, span: f64, width: f64, color: id) {
    let rect = NSRect::new(
        NSPoint::new(bounds.origin.x + inset, bounds.origin.y + inset),
        NSSize::new(span, span),
    );
    let path: id = msg_send![class!(NSBezierPath), bezierPathWithOvalInRect: rect];
    let _: () = msg_send![path, setLineWidth: width];
    let _: () = msg_send![color, setStroke];
    let _: () = msg_send![path, stroke];
}

unsafe fn affine_translate(dx: f64, dy: f64) -> id {
    let t: id = msg_send![class!(NSAffineTransform), transform];
    let _: () = msg_send![t, translateXBy: dx yBy: dy];
    t
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
