-- Arrange DMG Finder icons so Install.app is visible (Tauri only lays out app + Applications).
-- Usage: osascript layout-dmg.applescript "<volume name>"

on run argv
	if (count of argv) < 1 then error "volume name required"
	set volumeName to item 1 of argv

	tell application "Finder"
		repeat 20 times
			try
				if exists disk volumeName then exit repeat
			end try
			delay 0.5
		end repeat

		tell disk volumeName
			open
			set current view of container window to icon view
			set toolbar visible of container window to false
			set statusbar visible of container window to false
			set sidebar width of container window to 0
			-- Wider window: app | Install | Applications on one row
			set bounds of container window to {200, 120, 860, 480}

			set opts to icon view options of container window
			set arrangement of opts to not arranged
			set icon size of opts to 96
			set text size of opts to 12

			try
				set position of item "Elecom Huge Custom.app" to {120, 180}
			end try
			try
				set position of item "Install.app" to {340, 180}
			end try
			try
				set position of item "Applications" to {560, 180}
			end try
			try
				set position of item "설치방법.txt" to {220, 340}
			end try
			try
				set position of item "install.sh" to {460, 340}
			end try

			update without registering applications
			delay 1
			close
			open
			delay 2
			close
		end tell
	end tell
end run
