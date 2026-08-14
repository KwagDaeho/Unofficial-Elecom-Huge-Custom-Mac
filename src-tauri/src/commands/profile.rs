use crate::app::state::AppState;
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
    state.engine.set_profile(profile);
    Ok(())
}
