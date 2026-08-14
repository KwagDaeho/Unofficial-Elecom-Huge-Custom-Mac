#!/usr/bin/env bash
# After `tauri build`, inject Install.app (설치하기) into the release DMG.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MACOS_SCRIPTS="$(cd "$(dirname "$0")" && pwd)"
DMG_DIR="$ROOT/src-tauri/target/release/bundle/dmg"

bash "$MACOS_SCRIPTS/make-install-app.sh"
INSTALL_APP="$MACOS_SCRIPTS/dist/Install.app"
[[ -d "$INSTALL_APP" ]] || { echo "Install.app missing"; exit 1; }

DMG="$(ls -t "$DMG_DIR"/*.dmg 2>/dev/null | head -1 || true)"
[[ -n "$DMG" && -f "$DMG" ]] || { echo "No DMG found in $DMG_DIR"; exit 1; }

echo "Injecting 설치하기 into: $DMG"

WORK="$(mktemp -d /tmp/elecom-dmg-XXXXXX)"
RW="$WORK/rw.dmg"
FINAL="$WORK/final.dmg"
MOUNT_POINT=""

cleanup() {
  if [[ -n "$MOUNT_POINT" && -d "$MOUNT_POINT" ]]; then
    hdiutil detach "$MOUNT_POINT" -quiet -force 2>/dev/null || true
  fi
  # also detach by device if needed
  rm -rf "$WORK"
}
trap cleanup EXIT

# Convert to read-write, attach, copy helper, convert back to compressed
hdiutil convert "$DMG" -format UDRW -o "$RW" -quiet
# attach returns lines like: /dev/disk4s1\tApple_HFS\t/Volumes/Elecom Huge Custom 1.0.1
ATTACH_OUT="$(hdiutil attach -readwrite -noverify -noautoopen "$RW")"
echo "$ATTACH_OUT"
MOUNT_POINT="$(echo "$ATTACH_OUT" | awk -F'\t' '/\/Volumes\//{print $NF; exit}')"
[[ -n "$MOUNT_POINT" && -d "$MOUNT_POINT" ]] || {
  # fallback parse
  MOUNT_POINT="$(echo "$ATTACH_OUT" | sed -n 's/.*\(\/Volumes\/.*\)$/\1/p' | tail -1)"
}
[[ -d "$MOUNT_POINT" ]] || { echo "Failed to resolve mount point"; exit 1; }

echo "Mounted at: $MOUNT_POINT"
rm -rf "$MOUNT_POINT/Install.app" "$MOUNT_POINT/설치하기.app"
cp -R "$INSTALL_APP" "$MOUNT_POINT/Install.app"

# Optional: hide extension / set Korean name via .localized — Finder shows CFBundleDisplayName
sync
hdiutil detach "$MOUNT_POINT" -quiet
MOUNT_POINT=""

hdiutil convert "$RW" -format UDZO -imagekey zlib-level=9 -o "$FINAL" -quiet
mv -f "$FINAL" "$DMG"

# Also produce a clean GitHub-release filename copy next to it (optional convenience)
BASE="$(basename "$DMG")"
# keep tauri name; release script renames on upload

echo "Done: $DMG"
ls -lh "$DMG"
