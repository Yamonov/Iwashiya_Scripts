use scripting additions

property defaultUnits : {"mm", "mm", "級", "歯"}
property uiWaitCount : 50
property uiWaitInterval : 0.1

on run argv
	set requestedUnits to my requestedUnitsFromArguments(argv)
	set targetLabels to {}
	repeat with requestedUnit in requestedUnits
		set end of targetLabels to my canonicalUnitLabel(requestedUnit as text)
	end repeat

	tell application id "com.adobe.illustrator" to activate

	tell application "System Events"
		set illustratorProcess to first application process whose bundle identifier is "com.adobe.illustrator"
	end tell

	set preferencesArea to my openUnitsPreferences(illustratorProcess)
	set choicesByComboBox to {}

	repeat with comboBoxIndex from 1 to 4
		set targetLabel to item comboBoxIndex of targetLabels
		set choices to my selectUnit(illustratorProcess, preferencesArea, comboBoxIndex, targetLabel)
		set end of choicesByComboBox to choices
	end repeat

	set finalValues to my readComboBoxValues(preferencesArea)
	if finalValues is not targetLabels then
		error "単位の変更結果が指定値と一致しません。現在値: " & my joinText(finalValues, ", ")
	end if

	my clickOKAndWait(illustratorProcess, preferencesArea)

	return "一般=" & item 1 of finalValues & linefeed & ¬
		"線=" & item 2 of finalValues & linefeed & ¬
		"文字=" & item 3 of finalValues & linefeed & ¬
		"東アジア言語=" & item 4 of finalValues
end run

on requestedUnitsFromArguments(argv)
	set argumentCount to count of argv
	if argumentCount is 0 then return defaultUnits
	if argumentCount is not 4 then
		error "4つの単位を、一般・線・文字・東アジア言語の順で指定してください。例: mm mm 級 歯"
	end if
	return argv
end requestedUnitsFromArguments

on openUnitsPreferences(illustratorProcess)
	tell application "System Events"
		tell illustratorProcess
			set preferencesAreas to every UI element whose role is "AXLayoutArea" and name is "環境設定"
			if (count of preferencesAreas) > 0 then
				set preferencesArea to item 1 of preferencesAreas
				if (count of combo boxes of preferencesArea) is 4 then return preferencesArea
				error "環境設定は開いていますが、「単位」ページではありません。"
			end if

			click menu bar item "Illustrator" of menu bar 1
			delay 0.2
			click menu item "単位..." of menu 1 of menu item "設定…" of menu 1 of menu bar item "Illustrator" of menu bar 1
		end tell
	end tell

	repeat uiWaitCount times
		delay uiWaitInterval
		tell application "System Events"
			tell illustratorProcess
				set preferencesAreas to every UI element whose role is "AXLayoutArea" and name is "環境設定"
				if (count of preferencesAreas) > 0 then
					set preferencesArea to item 1 of preferencesAreas
					if (count of combo boxes of preferencesArea) is 4 then return preferencesArea
				end if
			end tell
		end tell
	end repeat

	error "Illustratorの「環境設定 ＞ 単位」を開けませんでした。"
end openUnitsPreferences

on selectUnit(illustratorProcess, preferencesArea, comboBoxIndex, targetLabel)
	tell application "System Events"
		tell illustratorProcess
			set targetComboBox to combo box comboBoxIndex of preferencesArea
			perform action "AXPress" of targetComboBox
		end tell
	end tell

	set popupArea to my waitForUnitPopup(illustratorProcess)

	tell application "System Events"
		set choices to description of every static text of popupArea
	end tell

	set targetIndex to my indexOfText(targetLabel, choices)
	if targetIndex is 0 then
		my closePopup()
		error "comboBox" & comboBoxIndex & " に「" & targetLabel & "」がありません。候補: " & my joinText(choices, ", ")
	end if

	tell application "System Events"
		key code 115 -- Home
		repeat (targetIndex - 1) times
			key code 125 -- Down Arrow
		end repeat
		key code 36 -- Return
	end tell

	repeat uiWaitCount times
		delay uiWaitInterval
		tell application "System Events"
			set currentValue to value of targetComboBox as text
		end tell
		if currentValue is targetLabel then return choices
	end repeat

	error "comboBox" & comboBoxIndex & " を「" & targetLabel & "」に変更できませんでした。"
end selectUnit

on waitForUnitPopup(illustratorProcess)
	repeat uiWaitCount times
		delay uiWaitInterval
		tell application "System Events"
			tell illustratorProcess
				set layoutAreas to every UI element whose role is "AXLayoutArea"
				if (count of layoutAreas) > 1 then return item 1 of layoutAreas
			end tell
		end tell
	end repeat

	error "単位の候補一覧を開けませんでした。"
end waitForUnitPopup

on readComboBoxValues(preferencesArea)
	tell application "System Events"
		return value of every combo box of preferencesArea
	end tell
end readComboBoxValues

on clickOKAndWait(illustratorProcess, preferencesArea)
	tell application "System Events"
		set okButtons to every button of preferencesArea whose description is "OK"
		if (count of okButtons) is 0 then error "環境設定のOKボタンが見つかりません。"
		click item 1 of okButtons
	end tell

	repeat uiWaitCount times
		delay uiWaitInterval
		tell application "System Events"
			tell illustratorProcess
				set preferencesAreas to every UI element whose role is "AXLayoutArea" and name is "環境設定"
				if (count of preferencesAreas) is 0 then return
			end tell
		end tell
	end repeat

	error "OKを押しましたが、環境設定が閉じませんでした。"
end clickOKAndWait

on closePopup()
	tell application "System Events" to key code 53
end closePopup

on indexOfText(targetText, textList)
	repeat with itemIndex from 1 to count of textList
		if (item itemIndex of textList as text) is targetText then return itemIndex
	end repeat
	return 0
end indexOfText

on canonicalUnitLabel(rawUnit)
	ignoring case
		if rawUnit is in {"px", "pixel", "pixels", "ピクセル"} then return "ピクセル"
		if rawUnit is in {"pt", "point", "points", "ポイント"} then return "ポイント"
		if rawUnit is in {"pc", "pica", "picas", "パイカ"} then return "パイカ"
		if rawUnit is in {"q", "級"} then return "級"
		if rawUnit is in {"h", "歯"} then return "歯"
		if rawUnit is in {"in", "inch", "inches", "インチ"} then return "インチ"
		if rawUnit is in {"ft", "foot", "feet", "フィート"} then return "フィート"
		if rawUnit is in {"ft+in", "feet and inches", "フィートとインチ"} then return "フィートとインチ"
		if rawUnit is in {"yd", "yard", "yards", "ヤード"} then return "ヤード"
		if rawUnit is in {"mm", "millimeter", "millimeters", "millimetre", "millimetres", "ミリメートル"} then return "ミリメートル"
		if rawUnit is in {"cm", "centimeter", "centimeters", "centimetre", "centimetres", "センチメートル"} then return "センチメートル"
		if rawUnit is in {"m", "meter", "meters", "metre", "metres", "メートル"} then return "メートル"
	end ignoring
	return rawUnit
end canonicalUnitLabel

on joinText(textList, separatorText)
	set previousDelimiters to AppleScript's text item delimiters
	set AppleScript's text item delimiters to separatorText
	set joinedText to textList as text
	set AppleScript's text item delimiters to previousDelimiters
	return joinedText
end joinText
