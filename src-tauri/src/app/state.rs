use crate::domain::engine::Engine;
use std::fs::File;
use std::sync::Arc;

pub struct AppState {
    pub engine: Arc<Engine>,
    /// Held for process lifetime so a second copy cannot start another HID engine.
    pub _instance_lock: File,
}
