//! HID worker loop body (spawned by `Engine::start`).

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use hidapi::HidApi;
use parking_lot::Mutex;

use crate::domain::ball_scroll;
use crate::domain::custom_mapping::{self, CustomMaps};
use crate::domain::gesture_mapping;
use crate::domain::device::{ButtonId, ButtonState, DeviceInfo, ParsedReport};
use crate::domain::engine::input::{
    binding_of, fire_due_key_repeats, fire_due_long_presses, fire_due_scroll_repeats,
    handle_button_transitions, pointer_takeover_active, take_due_scroll_repeats,
    tilt_pan_stream_dx_notches, tilt_side_sustain, tilt_uses_pan_stream, ActionRepeat,
    PendingHold, ScrollRepeat, TiltHoldGate,
};
use crate::domain::engine::LastReport;
use crate::domain::profile::{Action, Profile};
use crate::domain::remap;
use crate::platform::hid::{find_huge, open_huge_device};
use crate::platform::{capture, inject, permissions, suppress};

pub(crate) fn run(
    profile: Arc<Mutex<Profile>>,
    running: Arc<AtomicBool>,
    last_report: Arc<Mutex<Option<LastReport>>>,
    connected: Arc<Mutex<Option<DeviceInfo>>>,
) {
    let mut prev = ButtonState::default();
    let mut prev_raw = ButtonState::default();
    let mut held: HashMap<ButtonId, Action> = HashMap::new();
    let mut pending: HashMap<ButtonId, PendingHold> = HashMap::new();
    let mut scroll_repeats: HashMap<ButtonId, ScrollRepeat> = HashMap::new();
    let mut key_repeats: HashMap<ButtonId, ActionRepeat> = HashMap::new();
    let mut custom_maps = CustomMaps::default();
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
        ball_scroll::sync_from_profile(&profile_snap);
        custom_mapping::sync_from_profile(&profile_snap);
        gesture_mapping::sync_from_profile(&profile_snap);
        if ball_scroll::needs_event_watch(&profile_snap)
            || custom_mapping::uses_os_watch()
            || gesture_mapping::needs_event_watch(&profile_snap)
        {
            capture::ensure_watch_tap();
        }
        if !profile_snap.enabled {
            // Release any held virtual buttons and don't seize the device.
            for (id, action) in held.drain() {
                inject::release_action(id, &action);
            }
            pending.clear();
            scroll_repeats.clear();
            key_repeats.clear();
            custom_maps.clear();
            tilt_gate = TiltHoldGate::default();
            prev = ButtonState::default();
            suppress::clear_suppress();
            std::thread::sleep(Duration::from_millis(400));
            let _ = api.refresh_devices();
            continue;
        }

        if !permissions::accessibility_granted() {
            std::thread::sleep(Duration::from_millis(800));
            continue;
        }

        let Some(info) = device_info else {
            std::thread::sleep(Duration::from_millis(800));
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
                std::thread::sleep(Duration::from_millis(800));
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
            ball_scroll::sync_from_profile(&profile_snap);
            custom_mapping::sync_from_profile(&profile_snap);
            if profile_snap.ball_scroll.uses_os_watch() || custom_mapping::uses_os_watch() {
                capture::ensure_watch_tap();
            }
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
                    custom_mapping::fire_due_ticks(
                        &mut custom_maps,
                        &profile_snap,
                        profile_snap.long_press_threshold(),
                    );
                    fire_due_scroll_repeats(&mut scroll_repeats, &profile_snap.pointer);
                    fire_due_key_repeats(&mut key_repeats, &profile_snap.pointer);
                    tilt_gate.expire(now);
                    ball_scroll::tick();
                    inject::end_idle_ball_scroll();
                    let mut state = prev;
                    tilt_gate.apply(&mut state);
                    custom_mapping::sync_button_state(state);
                    custom_mapping::maintain_chords(
                        state,
                        &profile_snap,
                        &mut custom_maps,
                        &mut pending,
                        &mut held,
                        &mut scroll_repeats,
                        &mut key_repeats,
                    );
                    if state != prev {
                        apply_button_edges(
                            prev,
                            state,
                            &profile_snap,
                            &mut custom_maps,
                            &mut pending,
                            &mut held,
                            &mut scroll_repeats,
                            &mut key_repeats,
                        );
                        prev = state;
                        // Reflect gated tilt release in Live HID probe.
                        if let Some(rep) = last_report.lock().as_mut() {
                            rep.buttons.retain(|b| {
                                *b != "wheel_tilt_left" && *b != "wheel_tilt_right"
                            });
                            if state.tilt_left {
                                rep.buttons.push("wheel_tilt_left");
                            }
                            if state.tilt_right {
                                rep.buttons.push("wheel_tilt_right");
                            }
                        }
                    }
                    // Pulse (AC off): HID quiet → allow next tilt without pan==0.
                    tilt_gate.clear_pulse_latches_when_idle();
                    inject::expire_restored_cursor_if_due();
                    inject::maintain_restored_cursor();
                    suppress::set_suppress_motion(
                        pointer_takeover_active(
                            &held,
                            &pending,
                            &prev,
                            &profile_snap,
                        ) || custom_mapping::pointer_takeover_active(
                            &custom_maps,
                            &prev,
                            &profile_snap,
                        ),
                    );
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

                    let raw_buttons = parsed.buttons;

                    if capture::gesture_record_active() {
                        if !capture::gesture_canvas_drawing() {
                            for id in raw_buttons.pressed_edges(prev_raw) {
                                if id == ButtonId::Left {
                                    capture::set_gesture_record_stroke_moved(false);
                                    capture::emit_gesture_canvas_phase("start");
                                }
                            }
                        }
                        for id in raw_buttons.released_edges(prev_raw) {
                            if id == ButtonId::Left {
                                capture::emit_gesture_canvas_phase("end");
                                capture::set_gesture_record_stroke_moved(false);
                                capture::set_gesture_canvas_drawing(false);
                            }
                        }
                        if !raw_buttons.left && capture::gesture_ball_stroke_active() {
                            capture::emit_gesture_canvas_phase("end");
                            capture::set_gesture_record_stroke_moved(false);
                            capture::set_gesture_canvas_drawing(false);
                        }
                    }

                    let now = Instant::now();
                    let mut state = raw_buttons;
                    let left_sustain =
                        tilt_side_sustain(&profile_snap, ButtonId::WheelTiltLeft);
                    let right_sustain =
                        tilt_side_sustain(&profile_snap, ButtonId::WheelTiltRight);
                    // Pan axis sticks on HUGE — gate tilt "down" for actions only.
                    tilt_gate.note_pan(parsed.pan, now, left_sustain, right_sustain);
                    tilt_gate.expire(now);
                    tilt_gate.apply(&mut state);
                    custom_mapping::sync_button_state(state);

                    // Probe: show gated tilt (pulse), not sticky raw pan bits.
                    let buttons = ButtonId::ALL
                        .into_iter()
                        .filter(|id| match id {
                            ButtonId::WheelTiltLeft | ButtonId::WheelTiltRight => {
                                state.is_down(*id)
                            }
                            _ => parsed.buttons.is_down(*id),
                        })
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
                    let capture_block = capture::input_capture_active();
                    let (rl, rr, rm, rb, rf) = remap::remap_flags(&profile_snap);
                    suppress::set_suppress_mask(remap::mask_for(
                        state.left,
                        state.right,
                        state.middle,
                        state.back,
                        state.forward,
                        (capture_block && state.left)
                            || rl
                            || ball_scroll::is_reserved_huge(ButtonId::Left)
                            || custom_mapping::is_reserved_huge(ButtonId::Left),
                        (capture_block && state.right)
                            || rr
                            || ball_scroll::is_reserved_huge(ButtonId::Right)
                            || custom_mapping::is_reserved_huge(ButtonId::Right),
                        (capture_block && state.middle)
                            || rm
                            || ball_scroll::is_reserved_huge(ButtonId::Middle)
                            || custom_mapping::is_reserved_huge(ButtonId::Middle),
                        (capture_block && state.back)
                            || rb
                            || ball_scroll::is_reserved_huge(ButtonId::Back)
                            || custom_mapping::is_reserved_huge(ButtonId::Back),
                        (capture_block && state.forward)
                            || rf
                            || ball_scroll::is_reserved_huge(ButtonId::Forward)
                            || custom_mapping::is_reserved_huge(ButtonId::Forward),
                    ));

                    ball_scroll::tick();
                    inject::expire_restored_cursor_if_due();
                    inject::tick_restore_cursor(parsed.dx as f64, parsed.dy as f64);
                    inject::maintain_restored_cursor();
                        let ball_scroll_on = ball_scroll::is_active();
                        let gesture_on = gesture_mapping::session_active();

                        // Shared: OS moves cursor (Dock). Speed ≥ 1 — extras only when
                    // faster than 1× (dx-raw). Skip extras on wheel/pan reports.
                    {
                        let ignore_ball = ball_scroll::ignore_ball_pointer_motion()
                            || gesture_mapping::ignore_ball_pointer_motion();
                        let raw_x = if ignore_ball {
                            0.0
                        } else {
                            parsed.dx as f64
                        };
                        let raw_y = if ignore_ball {
                            0.0
                        } else {
                            parsed.dy as f64
                        };
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
                        if capture::gesture_ball_stroke_active()
                            && (raw_x != 0.0 || raw_y != 0.0)
                        {
                            // Template canvas uses raw ball counts, not pointer speed.
                            capture::emit_gesture_canvas_delta(raw_x, raw_y);
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
                        ) || custom_mapping::pointer_takeover_active(
                            &custom_maps,
                            &state,
                            &profile_snap,
                        );
                        suppress::set_suppress_motion(takeover);
                        let gesture_ball_draw = capture::gesture_ball_stroke_active();
                        let (out_x, out_y) = if gesture_ball_draw {
                            (0.0, 0.0)
                        } else if ball_scroll_on || gesture_on {
                            if gesture_on {
                                gesture_mapping::record_motion(raw_x, raw_y);
                            }
                            (0.0, 0.0)
                        } else if shared && !takeover {
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

                    // HUGE wheel / tilt-pan — skip inject while ball-as-scroll.
                    // Shared HID still posts the OS wheel; arm echo drop so it
                    // does not mix with ball scroll. Trackpad never arms.
                    let mut scroll_dx_notches = 0.0_f64;
                    let mut scroll_dy_notches = 0.0_f64;
                    let mut scroll_continuous = false;

                    if ball_scroll_on && (parsed.wheel != 0 || parsed.pan != 0) {
                        suppress::arm_huge_scroll_echo_suppress();
                    }

                    if !ball_scroll_on {
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
                    }

                    if ball_scroll_on {
                        inject::keep_pinned_cursor();
                        inject::scroll_ball(
                            parsed.dx,
                            parsed.dy,
                            &profile_snap.ball_scroll,
                        );
                        inject::keep_pinned_cursor();
                    } else {
                        inject::end_idle_ball_scroll();
                    }

                    // Buttons: release first, then press.
                    fire_due_long_presses(
                        &mut pending,
                        &mut held,
                        &profile_snap.pointer,
                        profile_snap.long_press_threshold(),
                    );
                    custom_mapping::fire_due_ticks(
                        &mut custom_maps,
                        &profile_snap,
                        profile_snap.long_press_threshold(),
                    );
                    fire_due_key_repeats(&mut key_repeats, &profile_snap.pointer);

                    apply_button_edges(
                        prev,
                        state,
                        &profile_snap,
                        &mut custom_maps,
                        &mut pending,
                        &mut held,
                        &mut scroll_repeats,
                        &mut key_repeats,
                    );

                    prev = state;
                    prev_raw = raw_buttons;
                    suppress::set_suppress_motion(
                        pointer_takeover_active(
                            &held,
                            &pending,
                            &prev,
                            &profile_snap,
                        ) || custom_mapping::pointer_takeover_active(
                            &custom_maps,
                            &prev,
                            &profile_snap,
                        ),
                    );
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
        custom_maps.clear();
        pending.clear();
        scroll_repeats.clear();
        key_repeats.clear();
        tilt_gate = TiltHoldGate::default();
        prev = ButtonState::default();
        prev_raw = ButtonState::default();
        suppress::sync_scroll_transform(false);
        suppress::clear_suppress();
        // Drop device → release exclusive claim so OS can take it if remap off.
        drop(device);
        std::thread::sleep(Duration::from_millis(200));
        let _ = api.refresh_devices();
    }
}

fn apply_button_edges(
    prev: ButtonState,
    state: ButtonState,
    profile: &Profile,
    custom_maps: &mut CustomMaps,
    pending: &mut HashMap<ButtonId, PendingHold>,
    held: &mut HashMap<ButtonId, Action>,
    scroll_repeats: &mut HashMap<ButtonId, ScrollRepeat>,
    key_repeats: &mut HashMap<ButtonId, ActionRepeat>,
) {
    note_huge_activators(prev, state);
    if capture::input_capture_active() || capture::ui_modal_active() {
        return;
    }
    custom_mapping::sync_button_state(state);
    let mut skip_press = custom_mapping::maintain_chords(
        state,
        profile,
        custom_maps,
        pending,
        held,
        scroll_repeats,
        key_repeats,
    );
    let (skip_rel, skip_from_custom) = custom_mapping::handle_transitions(
        prev,
        state,
        profile,
        custom_maps,
        pending,
        held,
        scroll_repeats,
        key_repeats,
    );
    skip_press.extend(skip_from_custom);
    handle_button_transitions(
        prev,
        state,
        profile,
        pending,
        held,
        scroll_repeats,
        key_repeats,
        &skip_rel,
        &skip_press,
    );
}

fn note_huge_activators(prev: ButtonState, state: ButtonState) {
    if capture::combo_trigger_capture_active() {
        for id in state.pressed_edges(prev) {
            capture::emit_combo_trigger_huge(id);
        }
        return;
    }
    // Gesture record L edges are handled on raw HID buttons in the worker loop.
    if capture::gesture_record_active() {
        if !capture::gesture_ball_stroke_active() && !capture::gesture_canvas_drawing() {
            for id in state.pressed_edges(prev) {
                if id == ButtonId::Left {
                    inject::click_at_cursor();
                    return;
                }
            }
        }
        return;
    }
    if capture::ui_modal_active() {
        for id in state.pressed_edges(prev) {
            if id == ButtonId::Left {
                inject::click_at_cursor();
                return;
            }
        }
    }
    if capture::activator_capture_active() {
        for id in state.pressed_edges(prev) {
            capture::emit_activator_from_hid(crate::domain::profile::Activator::Huge {
                button: id,
            });
        }
        return;
    }
    gesture_mapping::note_huge_edges(prev, state);
    ball_scroll::note_huge_edges(prev, state);
}
