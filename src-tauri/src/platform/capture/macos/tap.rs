use std::ffi::c_void;

use crate::domain::ball_scroll;
use crate::domain::custom_mapping;
use crate::domain::gesture_mapping;
use crate::domain::profile::Activator;
use crate::platform::app_bus;
use crate::platform::inject;

use super::combo::{emit_combo_preview, note_key_up, sync_from_chord, sync_mods_from_flags};
use super::keycodes::{
    chord_from_event, key_activator, modifier_down, CGEventRef, CGEventTapProxy,
    CGEventGetIntegerValueField, FLAG_COMMAND, KEYBOARD_EVENT_AUTOREPEAT,
    KEYBOARD_EVENT_KEYCODE, KEY_DOWN, KEY_UP, FLAGS_CHANGED, MOUSE_EVENT_BUTTON_NUMBER,
};
use super::super::emit::{emit_activator, emit_activator_choice, emit_chord};
use super::super::session;
use super::super::types::{ActivatorCapture, ComboTriggerCapture};

pub(crate) unsafe extern "C" fn tap_callback(
    _proxy: CGEventTapProxy,
    etype: u32,
    event: CGEventRef,
    _user: *mut c_void,
) -> CGEventRef {
    if etype == 0xFFFF_FFFE || etype == 0xFFFF_FFFF {
        super::reenable_key_capture_tap();
        return event;
    }

    if session::capture_active() {
        let combo = session::combo_trigger_capture();
        if etype == KEY_UP {
            if combo {
                let code =
                    unsafe { CGEventGetIntegerValueField(event, KEYBOARD_EVENT_KEYCODE) } as u16;
                note_key_up(code);
                emit_combo_preview();
            }
            return std::ptr::null_mut();
        }
        if etype == FLAGS_CHANGED {
            sync_mods_from_flags(event);
            emit_combo_preview();
            return std::ptr::null_mut();
        }
        if etype == KEY_DOWN {
            let autorepeat =
                unsafe { CGEventGetIntegerValueField(event, KEYBOARD_EVENT_AUTOREPEAT) } != 0;
            if !autorepeat {
                if let Some(chord) = chord_from_event(event) {
                    if chord.escape {
                        if combo {
                            app_bus::emit(
                                "combo-trigger-capture",
                                ComboTriggerCapture {
                                    escape: true,
                                    rejected: None,
                                    combo: None,
                                },
                            );
                        } else {
                            emit_chord(chord);
                        }
                        return std::ptr::null_mut();
                    }
                    if combo {
                        sync_from_chord(&chord.keys);
                    }
                    emit_chord(chord);
                } else if combo {
                    sync_mods_from_flags(event);
                    emit_combo_preview();
                }
            }
            return std::ptr::null_mut();
        }
        return event;
    }

    if session::activator_capture() && !session::combo_trigger_capture() {
        return handle_activator_capture(etype, event);
    }

    handle_watch(etype, event)
}

fn handle_activator_capture(etype: u32, event: CGEventRef) -> CGEventRef {
    if etype == KEY_DOWN {
        let autorepeat =
            unsafe { CGEventGetIntegerValueField(event, KEYBOARD_EVENT_AUTOREPEAT) } != 0;
        if autorepeat {
            return std::ptr::null_mut();
        }
        if let Some(activator) = key_activator(event) {
            if matches!(&activator, Activator::Key { name } if name == "Escape") {
                emit_activator(ActivatorCapture {
                    escape: true,
                    rejected: None,
                    activator: None,
                });
            } else {
                emit_activator_choice(activator);
            }
        }
        return std::ptr::null_mut();
    }
    if etype == KEY_UP {
        return std::ptr::null_mut();
    }
    if etype == FLAGS_CHANGED {
        if let Some((activator, down)) = modifier_down(event) {
            if down {
                emit_activator_choice(activator);
            }
        }
        return std::ptr::null_mut();
    }
    if let Some((activator, down)) = ball_scroll::mouse_from_event(
        etype,
        unsafe { CGEventGetIntegerValueField(event, MOUSE_EVENT_BUTTON_NUMBER) },
    ) {
        if activator.is_left_click() {
            if down {
                emit_activator_choice(activator);
            }
            return event;
        }
        if down {
            emit_activator_choice(activator);
        }
        return std::ptr::null_mut();
    }
    event
}

fn handle_watch(etype: u32, event: CGEventRef) -> CGEventRef {
    if let Some((button_id, down)) = custom_mapping::button_edge_from_event(
        etype,
        unsafe { CGEventGetIntegerValueField(event, MOUSE_EVENT_BUTTON_NUMBER) },
    ) {
        let flags = unsafe { super::keycodes::CGEventGetFlags(event) };
        if custom_mapping::should_swallow_os_button(button_id, flags, down) {
            if down {
                custom_mapping::note_os_button_swallowed(button_id);
            } else {
                custom_mapping::note_os_button_released(button_id);
            }
            return std::ptr::null_mut();
        }
    }
    if etype == KEY_DOWN {
        let autorepeat =
            unsafe { CGEventGetIntegerValueField(event, KEYBOARD_EVENT_AUTOREPEAT) } != 0;
        if let Some(activator) = key_activator(event) {
            if !autorepeat {
                let flags = unsafe { super::keycodes::CGEventGetFlags(event) };
                if matches!(&activator, Activator::Key { name } if name == "Q")
                    && flags & FLAG_COMMAND != 0
                {
                    ball_scroll::arm_app_quit();
                }
                ball_scroll::yield_modifier_hold_for_chord(&activator);
            }
            custom_mapping::note_os_down(&activator, autorepeat);
            if let Activator::Key { name } = &activator {
                if inject::should_block_chord_modifier(name) {
                    return std::ptr::null_mut();
                }
                if custom_mapping::should_swallow_os_key(name) {
                    if gesture_mapping::on_os_down(&activator, autorepeat) {
                        return std::ptr::null_mut();
                    }
                    if ball_scroll::on_os_down(&activator, autorepeat) {
                        return std::ptr::null_mut();
                    }
                    return std::ptr::null_mut();
                }
            }
            if gesture_mapping::on_os_down(&activator, autorepeat) {
                return std::ptr::null_mut();
            }
            if ball_scroll::on_os_down(&activator, autorepeat) {
                return std::ptr::null_mut();
            }
        }
        return event;
    }
    if etype == KEY_UP {
        let autorepeat =
            unsafe { CGEventGetIntegerValueField(event, KEYBOARD_EVENT_AUTOREPEAT) } != 0;
        if let Some(activator) = key_activator(event) {
            custom_mapping::note_os_up(&activator, autorepeat);
            if let Activator::Key { name } = &activator {
                if inject::should_block_chord_modifier(name) {
                    return std::ptr::null_mut();
                }
                if custom_mapping::should_swallow_os_key(name) {
                    if gesture_mapping::on_os_up(&activator, autorepeat) {
                        return std::ptr::null_mut();
                    }
                    if ball_scroll::on_os_up(&activator, autorepeat) {
                        return std::ptr::null_mut();
                    }
                    return std::ptr::null_mut();
                }
            }
            if gesture_mapping::on_os_up(&activator, autorepeat) {
                return std::ptr::null_mut();
            }
            if ball_scroll::on_os_up(&activator, autorepeat) {
                return std::ptr::null_mut();
            }
        }
        return event;
    }
    if etype == FLAGS_CHANGED {
        if let Some((activator, down)) = modifier_down(event) {
            if let Activator::Key { name } = &activator {
                if inject::should_block_chord_modifier(name) {
                    return std::ptr::null_mut();
                }
            }
            if down {
                custom_mapping::note_os_down(&activator, false);
            } else {
                custom_mapping::note_os_up(&activator, false);
            }
            let handled = if down {
                gesture_mapping::on_os_down(&activator, false)
                    || ball_scroll::on_os_down(&activator, false)
            } else {
                gesture_mapping::on_os_up(&activator, false)
                    || ball_scroll::on_os_up(&activator, false)
            };
            if handled {
                return std::ptr::null_mut();
            }
        }
        return event;
    }
    if let Some((activator, down)) = ball_scroll::mouse_from_event(
        etype,
        unsafe { CGEventGetIntegerValueField(event, MOUSE_EVENT_BUTTON_NUMBER) },
    ) {
        let handled = if down {
            gesture_mapping::on_os_down(&activator, false)
                || ball_scroll::on_os_down(&activator, false)
        } else {
            gesture_mapping::on_os_up(&activator, false)
                || ball_scroll::on_os_up(&activator, false)
        };
        if handled {
            return std::ptr::null_mut();
        }
    }
    event
}
