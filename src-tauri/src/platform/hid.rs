//! ELECOM HUGE HID discovery and open helpers.

use hidapi::HidApi;

use crate::domain::device::{is_huge, DeviceInfo, ELECOM_VID, HUGE_PIDS};

pub fn open_huge_device(
    api: &HidApi,
    info: &DeviceInfo,
) -> Result<hidapi::HidDevice, hidapi::HidError> {
    for d in api.device_list() {
        if d.vendor_id() == info.vendor_id
            && d.product_id() == info.product_id
            && d.path().to_string_lossy() == info.path
        {
            return d.open_device(api);
        }
    }
    api.open(info.vendor_id, info.product_id)
}

pub fn find_huge(api: &HidApi) -> Option<DeviceInfo> {
    api.device_list()
        .filter(|d| is_huge(d.vendor_id(), d.product_id()))
        .min_by_key(|d| {
            let usage_score = match (d.usage_page(), d.usage()) {
                (0x01, 0x02) => 0u8, // Generic Desktop / Mouse
                (0x01, _) => 1,
                _ => 2,
            };
            (usage_score, d.interface_number())
        })
        .map(|d| DeviceInfo {
            vendor_id: d.vendor_id(),
            product_id: d.product_id(),
            product_name: d.product_string().unwrap_or("HUGE TrackBall").to_string(),
            manufacturer: d.manufacturer_string().unwrap_or("ELECOM").to_string(),
            path: d.path().to_string_lossy().to_string(),
            is_huge: true,
        })
}

pub fn list_elecom_devices() -> Result<Vec<DeviceInfo>, String> {
    let api = HidApi::new().map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for d in api.device_list() {
        if d.vendor_id() != ELECOM_VID {
            continue;
        }
        out.push(DeviceInfo {
            vendor_id: d.vendor_id(),
            product_id: d.product_id(),
            product_name: d
                .product_string()
                .unwrap_or("Unknown ELECOM")
                .to_string(),
            manufacturer: d.manufacturer_string().unwrap_or("ELECOM").to_string(),
            path: d.path().to_string_lossy().to_string(),
            is_huge: HUGE_PIDS.contains(&d.product_id()),
        });
    }
    Ok(out)
}
