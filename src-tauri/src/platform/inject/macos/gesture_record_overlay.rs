//! Full-screen stroke overlay for gesture template recording and runtime holds.

use cocoa::appkit::{NSColor, NSView, NSWindow};
use cocoa::base::{id, nil, YES};
use cocoa::foundation::{NSPoint, NSRect};
use objc::declare::ClassDecl;
use objc::runtime::{Class, Object, Sel};
use objc::{class, msg_send, sel, sel_impl};
use parking_lot::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::Duration;

use crate::platform::app_bus;

use super::overlay_panel::{
    alloc_overlay_panel, close_overlay_panel, order_overlay_front,
    register_nonactivating_panel_class, release_overlay_activation_policy,
    retain_overlay_activation_policy, screen_frames, stop_raise_loop, RAISE_INTERVAL_MS,
};

const STROKE_WIDTH: f64 = 3.0;
/// Matches cursor badge radius (`RING / 2` in `cursor_badge.rs`).
const START_BADGE_RADIUS: f64 = 22.0;
const ACCENT_R: f64 = 192.0 / 255.0;
const ACCENT_G: f64 = 123.0 / 255.0;
const ACCENT_B: f64 = 196.0 / 255.0;
const VIEW_CLASS: &str = "ElecomHugeGestureRecordOverlayView";
const PANEL_CLASS: &str = "ElecomHugeGestureStrokePanel";

static WINDOWS: Mutex<Vec<usize>> = Mutex::new(Vec::new());
static POINTS: Mutex<Vec<NSPoint>> = Mutex::new(Vec::new());
static ACTIVE: AtomicBool = AtomicBool::new(false);
static RAISING: AtomicBool = AtomicBool::new(false);
static START_BADGE: AtomicBool = AtomicBool::new(false);

pub fn set_start_badge_visible(visible: bool) {
    START_BADGE.store(visible, Ordering::SeqCst);
    redraw();
}

pub fn set_active(active: bool) {
    ACTIVE.store(active, Ordering::SeqCst);
    if active {
        app_bus::run_on_main(|| unsafe { show_on_main() });
    } else {
        stop_raise_loop(&RAISING);
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
        for ptr in WINDOWS.lock().iter().copied() {
            let win = ptr as id;
            if win.is_null() {
                continue;
            }
            let view: id = win.contentView();
            if !view.is_null() {
                let _: () = msg_send![view, setNeedsDisplay: YES];
            }
        }
    });
}

unsafe fn show_on_main() {
    hide_on_main();
    retain_overlay_activation_policy();
    let panel_class = register_nonactivating_panel_class(PANEL_CLASS);
    let view_class = overlay_view_class();
    let mut handles = Vec::new();

    for frame in screen_frames() {
        let win = alloc_overlay_panel(panel_class, frame);
        if win.is_null() {
            continue;
        }
        let view: id = msg_send![view_class, alloc];
        let view: id = msg_send![view, initWithFrame: frame];
        win.setContentView_(view);
        order_overlay_front(win);
        handles.push(win as usize);
    }

    if handles.is_empty() {
        release_overlay_activation_policy();
        return;
    }

    *WINDOWS.lock() = handles;
    start_raise_loop();
    redraw();
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

unsafe fn hide_on_main() {
    stop_raise_loop(&RAISING);
    START_BADGE.store(false, Ordering::SeqCst);
    POINTS.lock().clear();
    let had_windows = !WINDOWS.lock().is_empty();
    for ptr in WINDOWS.lock().drain(..) {
        close_overlay_panel(ptr as id);
    }
    if had_windows {
        release_overlay_activation_policy();
    }
}

unsafe fn raise_on_main() {
    for ptr in WINDOWS.lock().iter().copied() {
        let win = ptr as id;
        if win.is_null() {
            continue;
        }
        order_overlay_front(win);
    }
}

fn overlay_view_class() -> &'static Class {
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
    let start_badge = START_BADGE.load(Ordering::SeqCst);
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
            if start_badge {
                return;
            }
            let point = points[0];
            let view_y = screen_frame.size.height - (point.y - screen_frame.origin.y);
            let view_x = point.x - screen_frame.origin.x;
            let dot: id = msg_send![class!(NSBezierPath), bezierPath];
            let _: () = msg_send![
                dot,
                appendBezierPathWithArcWithCenter: NSPoint::new(view_x, view_y)
                radius: STROKE_WIDTH * 1.5
                startAngle: 0.0
                endAngle: 360.0
            ];
            let _: () = msg_send![color, setFill];
            let _: () = msg_send![dot, fill];
            return;
        }

        let Some(path_start) = stroke_path_start(&points, start_badge) else {
            return;
        };
        let path: id = msg_send![class!(NSBezierPath), bezierPath];
        let _: () = msg_send![path, setLineWidth: STROKE_WIDTH];
        let _: () = msg_send![path, setLineCapStyle: 1i64];
        let _: () = msg_send![path, setLineJoinStyle: 1i64];

        let start_view = screen_point(path_start, screen_frame);
        let _: () = msg_send![path, moveToPoint: start_view];

        for point in points.iter().skip(1) {
            let view_pt = screen_point(*point, screen_frame);
            let _: () = msg_send![path, lineToPoint: view_pt];
        }
        let _: () = msg_send![path, stroke];
    }
}

fn screen_point(point: NSPoint, screen_frame: NSRect) -> NSPoint {
    NSPoint::new(
        point.x - screen_frame.origin.x,
        screen_frame.size.height - (point.y - screen_frame.origin.y),
    )
}

/// When the start badge is visible, begin the stroke at its edge so the line
/// does not paint underneath the fixed icon.
fn stroke_path_start(points: &[NSPoint], start_badge: bool) -> Option<NSPoint> {
    if points.len() < 2 {
        return None;
    }
    let origin = points[0];
    if !start_badge {
        return Some(origin);
    }
    let next = points[1];
    let dx = next.x - origin.x;
    let dy = next.y - origin.y;
    let dist = (dx * dx + dy * dy).sqrt();
    if dist <= f64::EPSILON {
        return None;
    }
    let inset = START_BADGE_RADIUS.min(dist - STROKE_WIDTH);
    if inset <= 0.0 {
        return Some(next);
    }
    Some(NSPoint::new(
        origin.x + dx / dist * inset,
        origin.y + dy / dist * inset,
    ))
}

pub fn shutdown() {
    ACTIVE.store(false, Ordering::SeqCst);
    stop_raise_loop(&RAISING);
    app_bus::run_on_main(|| unsafe { hide_on_main() });
}
