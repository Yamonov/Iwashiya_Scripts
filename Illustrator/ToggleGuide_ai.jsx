#target "illustrator"

/*
SCRIPTMETA-BEGIN
Script-ID=org.iwashi.ToggleGuide_ai
Version=1
Meta-URL=https://github.com/Yamonov/Iwashiya_Scripts/tree/main/Illustrator
Name=ガイド表示をトグル
Author=Murakami Yoshiteru
Target-App=Illustrator
Description=Illustratorのガイド表示を表示・非表示で切り替えます。
SCRIPTMETA-END
*/

(function () {
    try {
        app.executeMenuCommand("showguide");
    } catch (_) {}
}());