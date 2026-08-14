use std::fs::File;
use std::os::fd::AsRawFd;

use crate::constants::{APP_CONFIG_DIR, INSTANCE_LOCK_FILENAME};

/// Non-blocking exclusive lock under Application Support.
/// Prevents LaunchAgent + "reopen windows" from running two remappers after login.
pub fn acquire_instance_lock() -> Option<File> {
    let dir = dirs::config_dir()?.join(APP_CONFIG_DIR);
    std::fs::create_dir_all(&dir).ok()?;
    let file = std::fs::OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(false)
        .open(dir.join(INSTANCE_LOCK_FILENAME))
        .ok()?;
    let rc = unsafe { libc::flock(file.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) };
    if rc != 0 {
        return None;
    }
    Some(file)
}
