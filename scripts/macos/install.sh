#!/bin/bash
# Same steps as Install.app — run from Terminal if Gatekeeper blocks the Install icon:
#   bash "/Volumes/Elecom Huge Custom/install.sh"
set -euo pipefail

BUNDLE_ID="com.kwagdaeho.elecom-huge"
APP_NAME="Elecom Huge Custom.app"
DEST="/Applications/Elecom Huge Custom.app"

ROOT="$(cd "$(dirname "$0")" && pwd)"
SRC="$ROOT/$APP_NAME"

if [[ ! "$ROOT" == /Volumes/* ]]; then
  echo "Run this script from inside the mounted DMG." >&2
  exit 1
fi
if [[ ! -d "$SRC" ]]; then
  echo "App not found: $SRC" >&2
  exit 1
fi

echo "Installing to $DEST …"
rm -rf "$DEST"
cp -R "$SRC" "$DEST"
xattr -cr "$DEST" || true
tccutil reset Accessibility "$BUNDLE_ID" 2>/dev/null || true
tccutil reset ListenEvent "$BUNDLE_ID" 2>/dev/null || true
tccutil reset PostEvent "$BUNDLE_ID" 2>/dev/null || true

open "x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension" 2>/dev/null \
  || open "x-apple.systempreferences:com.apple.preference.security" 2>/dev/null \
  || true

echo ""
echo "Installed. Privacy & Security should open."
echo "If the app is blocked: Done → Open Anyway → then allow Accessibility."
echo ""

# Eject DMG then launch (script lives on the volume)
(
  sleep 1
  hdiutil detach "$ROOT" -quiet 2>/dev/null || hdiutil detach "$ROOT" -force -quiet 2>/dev/null || true
  sleep 0.3
  open "$DEST"
) &

echo "Launching app and ejecting DMG…"
