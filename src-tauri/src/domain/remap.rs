//! Pure remap policy: which physical buttons need OS-click suppression.

use crate::domain::device::ButtonId;
use crate::domain::profile::{Action, ButtonBinding, MouseClickButton, Profile};

pub(crate) const BIT_LEFT: u8 = 1 << 0;
pub(crate) const BIT_RIGHT: u8 = 1 << 1;
pub(crate) const BIT_MIDDLE: u8 = 1 << 2;
pub(crate) const BIT_BACK: u8 = 1 << 3;
pub(crate) const BIT_FORWARD: u8 = 1 << 4;

pub fn mask_for(
    left: bool,
    right: bool,
    middle: bool,
    back: bool,
    forward: bool,
    left_remap: bool,
    right_remap: bool,
    middle_remap: bool,
    back_remap: bool,
    forward_remap: bool,
) -> u8 {
    let mut m = 0u8;
    if left && left_remap {
        m |= BIT_LEFT;
    }
    if right && right_remap {
        m |= BIT_RIGHT;
    }
    if middle && middle_remap {
        m |= BIT_MIDDLE;
    }
    if back && back_remap {
        m |= BIT_BACK;
    }
    if forward && forward_remap {
        m |= BIT_FORWARD;
    }
    m
}

pub fn action_is_native_for(id: ButtonId, action: &Action) -> bool {
    match action {
        Action::Default => true,
        Action::MouseClick { button } => matches!(
            (id, button),
            (ButtonId::Left, MouseClickButton::Left)
                | (ButtonId::Right, MouseClickButton::Right)
                | (ButtonId::Middle, MouseClickButton::Middle)
                | (ButtonId::Back, MouseClickButton::Back)
                | (ButtonId::Forward, MouseClickButton::Forward)
        ),
        _ => false,
    }
}

pub fn is_remapped(id: ButtonId, action: &Action, long_press: &Action) -> bool {
    let click_remap = !action_is_native_for(id, action);
    let lp_remap = !matches!(long_press, Action::Disabled | Action::Default)
        && !action_is_native_for(id, long_press);
    click_remap || lp_remap
}

pub fn remap_flags(profile: &Profile) -> (bool, bool, bool, bool, bool) {
    let flag = |id: ButtonId| {
        let b = profile.buttons.get(&id).cloned().unwrap_or_else(|| {
            ButtonBinding::from_click(Action::Default)
        });
        let lp = if b.uses_long_press() {
            &b.long_press
        } else {
            &Action::Disabled
        };
        // Auto-click / remapped hold always needs suppress even if click looks native.
        let click_remap = !action_is_native_for(id, &b.click) || b.uses_auto_click();
        let lp_remap = !matches!(lp, Action::Disabled | Action::Default)
            && !action_is_native_for(id, lp);
        click_remap || lp_remap || b.uses_long_press()
    };
    (
        flag(ButtonId::Left),
        flag(ButtonId::Right),
        flag(ButtonId::Middle),
        flag(ButtonId::Back),
        flag(ButtonId::Forward),
    )
}
