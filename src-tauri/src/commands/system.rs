#[tauri::command]
pub fn relaunch_app(app: tauri::AppHandle) {
    let _ = std::process::Command::new("/bin/sh")
        .args([
            "-c",
            "sleep 0.7; /usr/bin/open -b com.kwagdaeho.elecom-huge",
        ])
        .spawn();
    app.exit(0);
}
