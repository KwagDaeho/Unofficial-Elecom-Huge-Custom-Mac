use std::fs;
use std::path::PathBuf;

use crate::domain::profile::Profile;

pub fn profile_path() -> Result<PathBuf, String> {
    let dir = dirs::config_dir()
        .ok_or_else(|| "Could not resolve config directory".to_string())?
        .join("elecom-huge");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("profile.json"))
}

pub fn load_profile() -> Profile {
    let Ok(path) = profile_path() else {
        return Profile::default();
    };
    match fs::read_to_string(&path) {
        Ok(raw) => serde_json::from_str(&raw).unwrap_or_default(),
        Err(_) => Profile::default(),
    }
}

pub fn save_profile(profile: &Profile) -> Result<(), String> {
    let path = profile_path()?;
    let raw = serde_json::to_string_pretty(profile).map_err(|e| e.to_string())?;
    fs::write(path, raw).map_err(|e| e.to_string())
}
