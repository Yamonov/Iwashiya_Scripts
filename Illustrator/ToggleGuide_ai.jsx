#target "illustrator"

/*
SCRIPTMETA-BEGIN
Script-ID=org.iwashi.ToggleGuide_ai
Meta-Default-language=ja
Version=1
Meta-URL=https://github.com/Yamonov/Iwashiya_Scripts/tree/main/Illustrator
Name=ガイド表示をトグル
Name[en]=Toggle Guide Visibility
Tags=ガイド,guides,表示,view
Author=Murakami Yoshiteru
Target-App=Illustrator
Description-BEGIN
[ja]
Illustratorのガイド表示を表示・非表示で切り替えます。

[en]
Toggles the visibility of guides in Illustrator.
Description-END
SCRIPTMETA-END
*/

(function () {
    try {
        app.executeMenuCommand("showguide");
    } catch (_) {}
}());