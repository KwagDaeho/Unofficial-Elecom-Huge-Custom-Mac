//! Modifier/key + HUGE button combos with the same binding rules as normal buttons.

mod chord;
mod handler;
mod state;

pub use chord::{
    button_edge_from_event, is_reserved_huge, note_os_button_released, note_os_button_swallowed,
    note_os_down, note_os_up, should_swallow_os_button, should_swallow_os_key,
};
pub use handler::{
    fire_due_ticks, handle_transitions, maintain_chords, pointer_takeover_active, CustomMaps,
};
pub use state::{sync_button_state, sync_from_profile, uses_os_watch};
