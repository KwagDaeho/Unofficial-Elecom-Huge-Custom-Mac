use crate::domain::ball_scroll;
use crate::domain::custom_mapping;
use crate::domain::gesture_mapping;
use crate::domain::profile::Profile;

pub fn needs_os_event_watch(profile: &Profile) -> bool {
    ball_scroll::needs_event_watch(profile)
        || custom_mapping::uses_os_watch()
        || gesture_mapping::needs_event_watch(profile)
}
