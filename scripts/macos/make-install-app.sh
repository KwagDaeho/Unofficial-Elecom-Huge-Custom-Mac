#!/usr/bin/env bash
# Build Install.app (CFBundleDisplayName: 설치하기) from Install.applescript
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
OUT_DIR="$ROOT/dist"
APP="$OUT_DIR/Install.app"
SCRIPT="$ROOT/Install.applescript"

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

/usr/bin/osacompile -o "$APP" "$SCRIPT"

# Finder label: bilingual so “Install” is obvious (not a hidden extra icon)
/usr/libexec/PlistBuddy -c "Set :CFBundleName Install · 설치하기" "$APP/Contents/Info.plist" 2>/dev/null \
  || /usr/libexec/PlistBuddy -c "Add :CFBundleName string Install · 설치하기" "$APP/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName Install · 설치하기" "$APP/Contents/Info.plist" 2>/dev/null \
  || /usr/libexec/PlistBuddy -c "Add :CFBundleDisplayName string Install · 설치하기" "$APP/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier com.kwagdaeho.elecom-huge.install" "$APP/Contents/Info.plist" 2>/dev/null \
  || /usr/libexec/PlistBuddy -c "Add :CFBundleIdentifier string com.kwagdaeho.elecom-huge.install" "$APP/Contents/Info.plist"

# Ad-hoc sign so Gatekeeper is slightly less angry on the helper itself
codesign --force --deep -s - "$APP" 2>/dev/null || true

echo "Built $APP"
