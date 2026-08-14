-- Install helper for the DMG: copy app → Applications, eject DMG, launch.
-- Built into "Install.app" (display name: 설치하기) via make-install-app.sh

property appBundleName : "Elecom Huge Custom.app"
property destPath : "/Applications/Elecom Huge Custom.app"

on run
	try
		my doInstall()
	on error errMsg number errNum
		display alert "설치 실패 / Install failed" message (errMsg as text) as critical buttons {"OK"} default button 1
	end try
end run

on doInstall()
	set installerPath to POSIX path of (path to me)
	if installerPath ends with "/" then
		set installerPath to text 1 thru -2 of installerPath
	end if
	
	set dmgRoot to do shell script "/usr/bin/dirname " & quoted form of installerPath
	set srcApp to dmgRoot & "/" & appBundleName
	set volumeRoot to dmgRoot
	
	if volumeRoot does not start with "/Volumes/" then
		error "이 설치 도우미는 DMG 안에서 실행해야 합니다." & return & "Run this installer from inside the mounted DMG."
	end if
	
	try
		do shell script "/bin/test -d " & quoted form of srcApp
	on error
		error "DMG에서 앱을 찾을 수 없습니다:" & return & srcApp & return & return & "App not found on the disk image."
	end try
	
	do shell script "/bin/rm -rf " & quoted form of destPath
	do shell script "/bin/cp -R " & quoted form of srcApp & " " & quoted form of destPath
	
	try
		do shell script "/usr/bin/xattr -cr " & quoted form of destPath
	end try
	
	display notification "응용 프로그램에 설치했습니다. DMG를 닫습니다." with title "Elecom Huge Custom"
	
	-- Eject after we quit (Install.app lives on the volume), then open the installed app
	set ejectCmd to "VOL=" & quoted form of volumeRoot & "; (" & ¬
		"sleep 1; " & ¬
		"/usr/bin/hdiutil detach \"$VOL\" -quiet || /usr/bin/hdiutil detach \"$VOL\" -force -quiet; " & ¬
		"/usr/bin/open " & quoted form of destPath & ¬
		") >/dev/null 2>&1 &"
	do shell script ejectCmd
	
	try
		tell application "Finder"
			set volName to name of (POSIX file volumeRoot as alias)
			repeat with w in (every window)
				try
					if (name of w as text) contains volName then close w
				end try
			end repeat
		end tell
	end try
end doInstall
