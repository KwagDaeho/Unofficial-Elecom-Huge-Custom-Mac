use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

use hidapi::HidApi;
use parking_lot::Mutex;

use crate::device::{
    is_huge, ButtonId, ButtonState, DeviceInfo, ParsedReport, ELECOM_VID, HUGE_PIDS,
};
use crate::inject;
use crate::profile::{Action, ButtonBinding, Profile};
use crate::suppress;

/// First hold tick is immediate; then pause before auto-repeat (key-repeat style).
const SCROLL_REPEAT_DELAY: Duration = Duration::from_millis(220);
const SCROLL_REPEAT_RATE: Duration = Duration::from_millis(40);
const KEY_REPEAT_DELAY: Duration = Duration::from_millis(400);
const KEY_REPEAT_RATE: Duration = Duration::from_millis(50);
/// HUGE tilt is an AC Pan axis that often sticks until the next HID frame
/// (or until the wheel is nudged). Gate converts sticky pan into one virtual
/// press per gesture; continuous-click ON sustains until pan returns to 0.
const TILT_HOLD_TTL: Duration = Duration::from_millis(70);

struct PendingHold {
    started: Instant,
    click: Action,
    long_press: Action,
    long_fired: bool,
}

struct ScrollRepeat {
    dx: i32,
    dy: i32,
    next_at: Instant,
}

struct ActionRepeat {
    action: Action,
    next_at: Instant,
}

/// Debounced tilt-down derived from sticky pan reports.
#[derive(Debug, Default, Clone, Copy)]
struct TiltHoldGate {
    left_until: Option<Instant>,
    right_until: Option<Instant>,
    /// Seen pan≠0; cleared only when pan returns to 0.
    left_latched: bool,
    right_latched: bool,
    /// Continuous-click / long-press: stay down until pan==0 (no short TTL).
    left_sustain: bool,
    right_sustain: bool,
}

impl TiltHoldGate {
    fn note_pan(
        &mut self,
        pan: i8,
        now: Instant,
        left_sustain: bool,
        right_sustain: bool,
    ) {
        if pan == 0 {
            self.left_until = None;
            self.right_until = None;
            self.left_latched = false;
            self.right_latched = false;
            self.left_sustain = false;
            self.right_sustain = false;
            return;
        }

        if pan < 0 {
            self.right_until = None;
            self.right_latched = false;
            self.right_sustain = false;
            self.left_sustain = left_sustain;
            if !self.left_latched {
                // One press edge per physical tilt until pan==0.
                // Do not re-arm while pan is sticky — that felt like auto-click ON.
                self.left_latched = true;
                self.left_until = Some(Self::hold_deadline(now, left_sustain));
            } else if left_sustain && self.left_until.is_none() {
                self.left_until = Some(Self::hold_deadline(now, true));
            }
        } else {
            self.left_until = None;
            self.left_latched = false;
            self.left_sustain = false;
            self.right_sustain = right_sustain;
            if !self.right_latched {
                self.right_latched = true;
                self.right_until = Some(Self::hold_deadline(now, right_sustain));
            } else if right_sustain && self.right_until.is_none() {
                self.right_until = Some(Self::hold_deadline(now, true));
            }
        }
    }

    fn hold_deadline(now: Instant, sustain: bool) -> Instant {
        if sustain {
            now + Duration::from_secs(60 * 60)
        } else {
            now + TILT_HOLD_TTL
        }
    }

    fn expire(&mut self, now: Instant) {
        if !self.left_sustain {
            if self.left_until.is_some_and(|t| now >= t) {
                self.left_until = None;
            }
        }
        if !self.right_sustain {
            if self.right_until.is_some_and(|t| now >= t) {
                self.right_until = None;
            }
        }
    }

    fn apply(self, state: &mut ButtonState) {
        state.tilt_left = self.left_until.is_some();
        state.tilt_right = self.right_until.is_some();
    }
}

fn is_scroll_action(action: &Action) -> bool {
    matches!(action, Action::Scroll { .. })
}

fn is_physical_mouse_button(id: ButtonId) -> bool {
    matches!(
        id,
        ButtonId::Left
            | ButtonId::Right
            | ButtonId::Middle
            | ButtonId::Back
            | ButtonId::Forward
    )
}

/// Actions that leave a mouse button held until release_action.
fn action_needs_held_release(action: &Action) -> bool {
    matches!(action, Action::MouseClick { .. } | Action::Default)
}

/// One complete activation (tap). Mouse/Default get down→up; others are already pulses.
fn fire_action_pulse(
    id: ButtonId,
    action: &Action,
    pointer: &crate::profile::PointerSettings,
) {
    inject::press_action(id, action, pointer);
    if action_needs_held_release(action) {
        thread::sleep(Duration::from_millis(12));
        inject::release_action(id, action);
    }
}

fn action_needs_pointer_takeover(id: ButtonId, action: &Action) -> bool {
    if is_physical_mouse_button(id) {
        return !suppress::action_is_native_for(id, action);
    }
    matches!(
        action,
        Action::MouseClick { .. } | Action::DoubleClick | Action::Scroll { .. }
    )
}

fn physical_button_needs_takeover(id: ButtonId, profile: &Profile) -> bool {
    let b = binding_of(profile, id);
    b.uses_auto_click()
        || b.uses_long_press()
        || !suppress::action_is_native_for(id, &b.click)
}

fn pointer_takeover_active(
    held: &HashMap<ButtonId, Action>,
    pending: &HashMap<ButtonId, PendingHold>,
    down: &ButtonState,
    profile: &Profile,
) -> bool {
    if inject::synthetic_buttons_held() {
        return true;
    }
    if held
        .iter()
        .any(|(id, a)| action_needs_pointer_takeover(*id, a))
    {
        return true;
    }
    if pending.iter().any(|(id, h)| {
        // While waiting for long-press we suppress OS *Dragged — move ourselves.
        is_physical_mouse_button(*id)
            || action_needs_pointer_takeover(*id, &h.click)
            || (h.long_fired && action_needs_pointer_takeover(*id, &h.long_press))
    }) {
        return true;
    }
    // Auto-click / remapped physical buttons: OS *Dragged is suppressed while held.
    [
        ButtonId::Left,
        ButtonId::Right,
        ButtonId::Middle,
        ButtonId::Back,
        ButtonId::Forward,
    ]
    .into_iter()
    .any(|id| down.is_down(id) && physical_button_needs_takeover(id, profile))
}

fn fire_due_long_presses(
    pending: &mut HashMap<ButtonId, PendingHold>,
    held: &mut HashMap<ButtonId, Action>,
    pointer: &crate::profile::PointerSettings,
    threshold: Duration,
) {
    let now = Instant::now();
    for (id, hold) in pending.iter_mut() {
        if hold.long_fired || now.duration_since(hold.started) < threshold {
            continue;
        }
        hold.long_fired = true;
        inject::press_action(*id, &hold.long_press, pointer);
        held.insert(*id, hold.long_press.clone());
    }
}

fn fire_due_key_repeats(
    repeats: &mut HashMap<ButtonId, ActionRepeat>,
    pointer: &crate::profile::PointerSettings,
) {
    let now = Instant::now();
    for (id, rep) in repeats.iter_mut() {
        if now < rep.next_at {
            continue;
        }
        fire_action_pulse(*id, &rep.action, pointer);
        rep.next_at = now + KEY_REPEAT_RATE;
    }
}

fn start_key_repeat(repeats: &mut HashMap<ButtonId, ActionRepeat>, id: ButtonId, action: &Action) {
    // Default is "noop" for long-press binding checks, but auto-click on OS-default
    // must still repeat (resolve to the native mouse button when possible).
    if matches!(action, Action::Disabled) || is_scroll_action(action) {
        return;
    }
    let action = match action {
        Action::Default => {
            if let Some(btn) = inject::default_mouse_button(id) {
                Action::MouseClick { button: btn }
            } else {
                return;
            }
        }
        other => other.clone(),
    };
    repeats.insert(
        id,
        ActionRepeat {
            action,
            next_at: Instant::now() + KEY_REPEAT_DELAY,
        },
    );
}

fn fire_due_scroll_repeats(
    repeats: &mut HashMap<ButtonId, ScrollRepeat>,
    pointer: &crate::profile::PointerSettings,
) {
    let (dx, dy) = take_due_scroll_repeats(repeats);
    if dx != 0 || dy != 0 {
        // Continuous so hold-to-scroll isn't dropped beside trackpad/other vertical scrolls.
        inject::scroll_by_units_ex(dx, dy, pointer, true);
    }
}

/// Accumulate due hold-repeat ticks (may be multiple buttons) without injecting yet,
/// so the engine can merge them with the same report's wheel/pan into one gesture.
fn take_due_scroll_repeats(repeats: &mut HashMap<ButtonId, ScrollRepeat>) -> (i32, i32) {
    let now = Instant::now();
    let mut dx = 0i32;
    let mut dy = 0i32;
    for rep in repeats.values_mut() {
        if now < rep.next_at {
            continue;
        }
        dx += rep.dx;
        dy += rep.dy;
        rep.next_at = now + SCROLL_REPEAT_RATE;
    }
    (dx, dy)
}

fn start_scroll_repeat(repeats: &mut HashMap<ButtonId, ScrollRepeat>, id: ButtonId, action: &Action) {
    if let Action::Scroll { dx, dy } = action {
        if *dx != 0 || *dy != 0 {
            repeats.insert(
                id,
                ScrollRepeat {
                    dx: *dx,
                    dy: *dy,
                    next_at: Instant::now() + SCROLL_REPEAT_DELAY,
                },
            );
        }
    }
}

fn binding_of(profile: &Profile, id: ButtonId) -> ButtonBinding {
    profile
        .buttons
        .get(&id)
        .cloned()
        .unwrap_or_else(|| ButtonBinding::from_click(Action::Default))
}

/// OS-default and catalog "Scroll left/right" on tilt share one path: stream
/// horizontal scroll from sticky HID pan while held (same feel either way).
fn tilt_uses_pan_stream(b: &ButtonBinding) -> bool {
    if b.uses_long_press() {
        return false;
    }
    match &b.click {
        Action::Default => true,
        Action::Scroll { dx, dy } if *dy == 0 && *dx != 0 => true,
        _ => false,
    }
}

fn tilt_pan_stream_dx_notches(b: &ButtonBinding, pan: i8) -> f64 {
    match &b.click {
        Action::Default => pan as f64,
        Action::Scroll { dx, .. } => {
            let sign = if *dx > 0 { 1.0 } else { -1.0 };
            sign * (pan.unsigned_abs() as f64)
        }
        _ => 0.0,
    }
}

fn tilt_side_sustain(profile: &Profile, id: ButtonId) -> bool {
    let b = binding_of(profile, id);
    // Pan-stream tilt (OS default / L-R scroll) ignores AC; other remaps sustain.
    !tilt_uses_pan_stream(&b) && (b.uses_auto_click() || b.uses_long_press())
}

fn handle_button_transitions(
    prev: ButtonState,
    state: ButtonState,
    profile: &Profile,
    pending: &mut HashMap<ButtonId, PendingHold>,
    held: &mut HashMap<ButtonId, Action>,
    scroll_repeats: &mut HashMap<ButtonId, ScrollRepeat>,
    key_repeats: &mut HashMap<ButtonId, ActionRepeat>,
) {
    for id in state.released_edges(prev) {
        scroll_repeats.remove(&id);
        key_repeats.remove(&id);
        if let Some(hold) = pending.remove(&id) {
            if hold.long_fired {
                if let Some(action) = held.remove(&id) {
                    inject::release_action(id, &action);
                }
            } else {
                // Released before LP threshold → normal click once.
                fire_action_pulse(id, &hold.click, &profile.pointer);
            }
        } else if let Some(action) = held.remove(&id) {
            inject::release_action(id, &action);
        }
    }
    for id in state.pressed_edges(prev) {
        let binding = binding_of(profile, id);
        if matches!(
            id,
            ButtonId::WheelTiltLeft | ButtonId::WheelTiltRight
        ) && tilt_uses_pan_stream(&binding)
        {
            // OS default / horizontal scroll → HID pan stream only.
            continue;
        }

        if binding.uses_long_press() {
            pending.insert(
                id,
                PendingHold {
                    started: Instant::now(),
                    click: binding.click,
                    long_press: binding.long_press,
                    long_fired: false,
                },
            );
        } else if binding.uses_auto_click() {
            if is_scroll_action(&binding.click) {
                held.insert(id, binding.click.clone());
                inject::press_action(id, &binding.click, &profile.pointer);
                start_scroll_repeat(scroll_repeats, id, &binding.click);
            } else {
                // Prefer concrete MouseClick so pulses/repeats always synthesize
                // while OS clicks are suppressed.
                let pulse = match &binding.click {
                    Action::Default => {
                        if let Some(btn) = inject::default_mouse_button(id) {
                            Action::MouseClick { button: btn }
                        } else {
                            binding.click.clone()
                        }
                    }
                    other => other.clone(),
                };
                fire_action_pulse(id, &pulse, &profile.pointer);
                start_key_repeat(key_repeats, id, &pulse);
            }
        } else if matches!(
            id,
            ButtonId::WheelTiltLeft | ButtonId::WheelTiltRight
        ) {
            // Tilt is a pan notch, not a sustained button — one click per press edge.
            if inject::shared_pointer_mode()
                && suppress::action_is_native_for(id, &binding.click)
            {
                // OS-native / default already handled elsewhere.
            } else if is_scroll_action(&binding.click) {
                inject::press_action(id, &binding.click, &profile.pointer);
            } else {
                fire_action_pulse(id, &binding.click, &profile.pointer);
            }
        } else if inject::shared_pointer_mode()
            && suppress::action_is_native_for(id, &binding.click)
        {
            // Both off + OS-native → OS owns hold/drag.
        } else if is_scroll_action(&binding.click) {
            // Both off + scroll → one notch (no hold-repeat).
            inject::press_action(id, &binding.click, &profile.pointer);
        } else {
            // Both off → sustained hold until release.
            held.insert(id, binding.click.clone());
            inject::press_action(id, &binding.click, &profile.pointer);
        }
    }
}

pub struct Engine {
    profile: Arc<Mutex<Profile>>,
    running: Arc<AtomicBool>,
    worker: Mutex<Option<JoinHandle<()>>>,
    last_report: Arc<Mutex<Option<LastReport>>>,
    connected: Arc<Mutex<Option<DeviceInfo>>>,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LastReport {
    pub hex: String,
    pub buttons: Vec<&'static str>,
    pub dx: i16,
    pub dy: i16,
    pub wheel: i8,
    pub pan: i8,
    pub ignored: bool,
    pub ts_ms: u128,
}

impl Engine {
    pub fn new(profile: Profile) -> Self {
        Self {
            profile: Arc::new(Mutex::new(profile)),
            running: Arc::new(AtomicBool::new(false)),
            worker: Mutex::new(None),
            last_report: Arc::new(Mutex::new(None)),
            connected: Arc::new(Mutex::new(None)),
        }
    }

    pub fn profile(&self) -> Profile {
        self.profile.lock().clone()
    }

    pub fn set_profile(&self, profile: Profile) {
        *self.profile.lock() = profile;
    }

    pub fn connected_device(&self) -> Option<DeviceInfo> {
        self.connected.lock().clone()
    }

    pub fn last_report(&self) -> Option<LastReport> {
        self.last_report.lock().clone()
    }

    pub fn start(&self) {
        if self.running.swap(true, Ordering::SeqCst) {
            return;
        }

        let profile = Arc::clone(&self.profile);
        let running = Arc::clone(&self.running);
        let last_report = Arc::clone(&self.last_report);
        let connected = Arc::clone(&self.connected);

        let handle = thread::spawn(move || {
            let mut prev = ButtonState::default();
            let mut held: HashMap<ButtonId, Action> = HashMap::new();
            let mut pending: HashMap<ButtonId, PendingHold> = HashMap::new();
            let mut scroll_repeats: HashMap<ButtonId, ScrollRepeat> = HashMap::new();
            let mut key_repeats: HashMap<ButtonId, ActionRepeat> = HashMap::new();
            let mut tilt_gate = TiltHoldGate::default();
            let mut api = match HidApi::new() {
                Ok(api) => api,
                Err(err) => {
                    log::error!("hidapi init failed: {err}");
                    running.store(false, Ordering::SeqCst);
                    return;
                }
            };

            while running.load(Ordering::SeqCst) {
                // Keep UI connection status even when remap is off (enumerate only).
                let device_info = find_huge(&api);
                *connected.lock() = device_info.clone();

                let profile_snap = profile.lock().clone();
                if !profile_snap.enabled {
                    // Release any held virtual buttons and don't seize the device.
                    for (id, action) in held.drain() {
                        inject::release_action(id, &action);
                    }
                    pending.clear();
                    scroll_repeats.clear();
                    key_repeats.clear();
                    tilt_gate = TiltHoldGate::default();
                    prev = ButtonState::default();
                    suppress::clear_suppress();
                    thread::sleep(Duration::from_millis(400));
                    let _ = api.refresh_devices();
                    continue;
                }

                if !inject::accessibility_granted() {
                    thread::sleep(Duration::from_millis(800));
                    continue;
                }

                let Some(info) = device_info else {
                    thread::sleep(Duration::from_millis(800));
                    let _ = api.refresh_devices();
                    continue;
                };

                // Always shared: WindowServer keeps the cursor (Dock auto-hide).
                // Remapped primary clicks are swallowed by `suppress` event tap.
                // Wheel invert/speed is applied in-place on the OS ScrollWheel event.
                inject::set_shared_pointer_mode(true);
                #[cfg(target_os = "macos")]
                api.set_open_exclusive(false);
                suppress::ensure_started();
                suppress::sync_scroll_transform(true);

                let device = match open_huge_device(&api, &info) {
                    Ok(d) => d,
                    Err(err) => {
                        log::warn!("open huge failed: {err}");
                        thread::sleep(Duration::from_millis(800));
                        let _ = api.refresh_devices();
                        continue;
                    }
                };

                let _ = device.set_blocking_mode(true);
                inject::sync_cursor_from_system();
                log::info!(
                    "HUGE shared {:04x}:{:04x} {}",
                    info.vendor_id,
                    info.product_id,
                    info.product_name
                );

                let mut buf = [0u8; 64];
                while running.load(Ordering::SeqCst) {
                    let profile_snap = profile.lock().clone();
                    if !profile_snap.enabled {
                        break;
                    }
                    suppress::sync_scroll_transform(true);

                    match device.read_timeout(&mut buf, 40) {
                        Ok(0) => {
                            let now = Instant::now();
                            fire_due_long_presses(
                                &mut pending,
                                &mut held,
                                &profile_snap.pointer,
                                profile_snap.long_press_threshold(),
                            );
                            fire_due_scroll_repeats(&mut scroll_repeats, &profile_snap.pointer);
                            fire_due_key_repeats(&mut key_repeats, &profile_snap.pointer);
                            tilt_gate.expire(now);
                            let mut state = prev;
                            tilt_gate.apply(&mut state);
                            if state != prev {
                                handle_button_transitions(
                                    prev,
                                    state,
                                    &profile_snap,
                                    &mut pending,
                                    &mut held,
                                    &mut scroll_repeats,
                                    &mut key_repeats,
                                );
                                prev = state;
                                // Do not rewrite Live HID probe here — probe shows raw
                                // last report (sticky pan), not the click-gate TTL.
                            }
                            suppress::set_suppress_motion(pointer_takeover_active(
                                &held,
                                &pending,
                                &prev,
                                &profile_snap,
                            ));
                            continue;
                        }
                        Ok(n) => {
                            let data = &buf[..n];
                            let hex = data
                                .iter()
                                .map(|b| format!("{b:02x}"))
                                .collect::<Vec<_>>()
                                .join(" ");

                            let Some(parsed) = ParsedReport::from_bytes(data) else {
                                // Consumer/vendor reports (id 3/4/5…) — never treat as motion/scroll.
                                *last_report.lock() = Some(LastReport {
                                    hex,
                                    buttons: vec![],
                                    dx: 0,
                                    dy: 0,
                                    wheel: 0,
                                    pan: 0,
                                    ignored: true,
                                    ts_ms: std::time::SystemTime::now()
                                        .duration_since(std::time::UNIX_EPOCH)
                                        .map(|d| d.as_millis())
                                        .unwrap_or(0),
                                });
                                continue;
                            };

                            let now = Instant::now();
                            let mut state = parsed.buttons;
                            let left_sustain =
                                tilt_side_sustain(&profile_snap, ButtonId::WheelTiltLeft);
                            let right_sustain =
                                tilt_side_sustain(&profile_snap, ButtonId::WheelTiltRight);
                            // Pan axis sticks on HUGE — gate tilt "down" for actions only.
                            tilt_gate.note_pan(parsed.pan, now, left_sustain, right_sustain);
                            tilt_gate.expire(now);
                            tilt_gate.apply(&mut state);

                            // Probe: raw HID bits / pan (may stick until next frame).
                            let buttons = ButtonId::ALL
                                .into_iter()
                                .filter(|id| parsed.buttons.is_down(*id))
                                .map(|id| id.id_str())
                                .collect::<Vec<_>>();
                            *last_report.lock() = Some(LastReport {
                                hex,
                                buttons,
                                dx: parsed.dx,
                                dy: parsed.dy,
                                wheel: parsed.wheel,
                                pan: parsed.pan,
                                ignored: false,
                                ts_ms: std::time::SystemTime::now()
                                    .duration_since(std::time::UNIX_EPOCH)
                                    .map(|d| d.as_millis())
                                    .unwrap_or(0),
                            });

                            let shared = inject::shared_pointer_mode();

                            // Update suppress mask *before* inject so the tap can
                            // drop the OS click that arrives with this same report.
                            let (rl, rr, rm, rb, rf) = suppress::remap_flags(&profile_snap);
                            suppress::set_suppress_mask(suppress::mask_for(
                                state.left,
                                state.right,
                                state.middle,
                                state.back,
                                state.forward,
                                rl,
                                rr,
                                rm,
                                rb,
                                rf,
                            ));

                            // Shared: OS moves cursor (Dock). Speed ≥ 1 — extras only when
                            // faster than 1× (dx-raw). Skip extras on wheel/pan reports.
                            {
                                let raw_x = parsed.dx as f64;
                                let raw_y = parsed.dy as f64;
                                let mut dx = raw_x * profile_snap.pointer.speed_x();
                                let mut dy = raw_y * profile_snap.pointer.speed_y();
                                if !profile_snap.pointer.acceleration {
                                    let mag = (dx * dx + dy * dy).sqrt();
                                    if mag > 10.0 {
                                        let flatten = (10.0 / mag).sqrt().clamp(0.5, 1.0);
                                        dx *= flatten;
                                        dy *= flatten;
                                    }
                                }
                                let pan_is_stream_scroll = match parsed.pan.cmp(&0) {
                                    std::cmp::Ordering::Less => tilt_uses_pan_stream(
                                        &binding_of(
                                            &profile_snap,
                                            ButtonId::WheelTiltLeft,
                                        ),
                                    ),
                                    std::cmp::Ordering::Greater => tilt_uses_pan_stream(
                                        &binding_of(
                                            &profile_snap,
                                            ButtonId::WheelTiltRight,
                                        ),
                                    ),
                                    std::cmp::Ordering::Equal => false,
                                };
                                let scrolling =
                                    parsed.wheel != 0 || (parsed.pan != 0 && pan_is_stream_scroll);
                                let takeover = pointer_takeover_active(
                                    &held,
                                    &pending,
                                    &state,
                                    &profile_snap,
                                );
                                suppress::set_suppress_motion(takeover);
                                let (out_x, out_y) = if shared && !takeover {
                                    if scrolling {
                                        (0.0, 0.0)
                                    } else {
                                        (dx - raw_x, dy - raw_y)
                                    }
                                } else {
                                    (dx, dy)
                                };
                                if out_x != 0.0 || out_y != 0.0 {
                                    inject::move_by(out_x, out_y);
                                }
                            }

                            // HUGE wheel + default tilt-pan: inject from HID (same invert
                            // path as custom scroll). Drop the OS echo while armed.
                            // Trackpad never arms → untouched.
                            let mut scroll_dx_notches = 0.0_f64;
                            let mut scroll_dy_notches = 0.0_f64;
                            let mut scroll_continuous = false;

                            if parsed.wheel != 0 {
                                suppress::arm_huge_scroll_echo_suppress();
                                scroll_dy_notches += parsed.wheel as f64;
                            }
                            if parsed.pan != 0 {
                                let side = if parsed.pan < 0 {
                                    ButtonId::WheelTiltLeft
                                } else {
                                    ButtonId::WheelTiltRight
                                };
                                let binding = binding_of(&profile_snap, side);
                                suppress::arm_huge_scroll_echo_suppress();
                                if tilt_uses_pan_stream(&binding) {
                                    // OS default and Scroll left/right: same pan stream.
                                    scroll_dx_notches +=
                                        tilt_pan_stream_dx_notches(&binding, parsed.pan);
                                }
                            }

                            let (rep_dx, rep_dy) = take_due_scroll_repeats(&mut scroll_repeats);
                            if rep_dx != 0 || rep_dy != 0 {
                                scroll_dx_notches += rep_dx as f64 / 3.0;
                                scroll_dy_notches += rep_dy as f64 / 3.0;
                                scroll_continuous = true;
                            }

                            if scroll_dx_notches != 0.0 || scroll_dy_notches != 0.0 {
                                inject::scroll_notches_ex(
                                    scroll_dx_notches,
                                    scroll_dy_notches,
                                    &profile_snap.pointer,
                                    scroll_continuous,
                                );
                            }

                            // Buttons: release first, then press.
                            fire_due_long_presses(
                                &mut pending,
                                &mut held,
                                &profile_snap.pointer,
                                profile_snap.long_press_threshold(),
                            );
                            fire_due_key_repeats(&mut key_repeats, &profile_snap.pointer);

                            handle_button_transitions(
                                prev,
                                state,
                                &profile_snap,
                                &mut pending,
                                &mut held,
                                &mut scroll_repeats,
                                &mut key_repeats,
                            );

                            prev = state;
                            suppress::set_suppress_motion(pointer_takeover_active(
                                &held,
                                &pending,
                                &prev,
                                &profile_snap,
                            ));
                        }
                        Err(err) => {
                            log::warn!("huge read error (device gone?): {err}");
                            *connected.lock() = None;
                            break;
                        }
                    }
                }

                for (id, action) in held.drain() {
                    inject::release_action(id, &action);
                }
                pending.clear();
                scroll_repeats.clear();
                key_repeats.clear();
                tilt_gate = TiltHoldGate::default();
                prev = ButtonState::default();
                suppress::sync_scroll_transform(false);
                suppress::clear_suppress();
                // Drop device → release exclusive claim so OS can take it if remap off.
                drop(device);
                thread::sleep(Duration::from_millis(200));
                let _ = api.refresh_devices();
            }
        });

        *self.worker.lock() = Some(handle);
    }

    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
        if let Some(handle) = self.worker.lock().take() {
            let _ = handle.join();
        }
    }
}

fn open_huge_device(
    api: &HidApi,
    info: &DeviceInfo,
) -> Result<hidapi::HidDevice, hidapi::HidError> {
    for d in api.device_list() {
        if d.vendor_id() == info.vendor_id
            && d.product_id() == info.product_id
            && d.path().to_string_lossy() == info.path
        {
            return d.open_device(api);
        }
    }
    api.open(info.vendor_id, info.product_id)
}

fn find_huge(api: &HidApi) -> Option<DeviceInfo> {
    api.device_list()
        .filter(|d| is_huge(d.vendor_id(), d.product_id()))
        .min_by_key(|d| {
            let usage_score = match (d.usage_page(), d.usage()) {
                (0x01, 0x02) => 0u8, // Generic Desktop / Mouse
                (0x01, _) => 1,
                _ => 2,
            };
            (usage_score, d.interface_number())
        })
        .map(|d| DeviceInfo {
            vendor_id: d.vendor_id(),
            product_id: d.product_id(),
            product_name: d.product_string().unwrap_or("HUGE TrackBall").to_string(),
            manufacturer: d.manufacturer_string().unwrap_or("ELECOM").to_string(),
            path: d.path().to_string_lossy().to_string(),
            is_huge: true,
        })
}

pub fn list_elecom_devices() -> Result<Vec<DeviceInfo>, String> {
    let api = HidApi::new().map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for d in api.device_list() {
        if d.vendor_id() != ELECOM_VID {
            continue;
        }
        out.push(DeviceInfo {
            vendor_id: d.vendor_id(),
            product_id: d.product_id(),
            product_name: d
                .product_string()
                .unwrap_or("Unknown ELECOM")
                .to_string(),
            manufacturer: d.manufacturer_string().unwrap_or("ELECOM").to_string(),
            path: d.path().to_string_lossy().to_string(),
            is_huge: HUGE_PIDS.contains(&d.product_id()),
        });
    }
    Ok(out)
}
