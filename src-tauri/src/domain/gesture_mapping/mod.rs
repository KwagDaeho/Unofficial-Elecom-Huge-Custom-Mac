pub mod recognizer;
mod state;
pub mod vector;

pub use state::{
    ignore_ball_pointer_motion, needs_event_watch, note_huge_edges, on_os_down, on_os_up,
    record_motion, session_active, shutdown, sync_from_profile, uses_os_watch,
};
