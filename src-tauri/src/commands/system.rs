use crate::constants::BUNDLE_ID;

#[tauri::command]
pub fn relaunch_app(app: tauri::AppHandle) {
    let cmd = format!("sleep 0.7; /usr/bin/open -b {BUNDLE_ID}");
    let _ = std::process::Command::new("/bin/sh")
        .args(["-c", &cmd])
        .spawn();
    app.exit(0);
}
