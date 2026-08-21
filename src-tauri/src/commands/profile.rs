use crate::app::state::AppState;
use crate::domain::ball_scroll;
use crate::domain::custom_mapping;
use crate::domain::gesture_mapping;
use crate::domain::watch;
use crate::domain::profile::Profile;
use crate::persistence::profile_store;
use tauri::State;

#[tauri::command]
pub fn get_profile(state: State<'_, AppState>) -> Profile {
    state.engine.profile()
}

#[tauri::command]
pub fn save_profile(state: State<'_, AppState>, profile: Profile) -> Result<(), String> {
    profile_store::save_profile(&profile)?;
    ball_scroll::sync_from_profile(&profile);
    custom_mapping::sync_from_profile(&profile);
    gesture_mapping::sync_from_profile(&profile);
    if watch::needs_os_event_watch(&profile) {
        crate::platform::capture::ensure_watch_tap();
    }
    state.engine.set_profile(profile);
    Ok(())
}
