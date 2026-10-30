(*

SCRIPTMETA-BEGIN
Script-ID=org.iwashi.photoshop.opencurrentdocumentinbridge
Version=0.1
Meta-URL=https://github.com/Yamonov/Iwashiya_Scripts/tree/main/Photoshop
Name=Bridgeで参照
Target-App=Photoshop
SCRIPTMETA-END

*)

try
	if (system attribute "SCRIPTA_TARGET_BUNDLE_ID") is not "com.adobe.Photoshop" then return

	set myPhotoshopPath to system attribute "SCRIPTA_TARGET_BUNDLE_PATH"
	if myPhotoshopPath is "" then return

	set myBridge to application id "com.adobe.bridge"
	set myBridgeName to name of myBridge

	using terms from application id "com.adobe.Photoshop"
		tell application myPhotoshopPath
			set myTarget to file path of current document
		end tell
	end using terms from

	tell myBridge to activate

	do shell script "open -a " & quoted form of myBridgeName & " " & quoted form of (POSIX path of myTarget)
on error
	return
end try
