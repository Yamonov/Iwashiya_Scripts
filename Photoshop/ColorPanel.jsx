#target photoshop

/*

SCRIPTMETA-BEGIN
Script-ID=org.iwashi.ColorPanel
Version=1
Meta-URL=https://github.com/Yamonov/Iwashiya_Scripts/tree/main/Photoshop
Name=カラーパネル表示・非表示
Author=Murakami Yoshiteru
Target-App=Photoshop
Edit-Password-SHA256=gzwc6vU3TIvx2Cn5:95df6d74dbed76d25afab9a7765fdb51f60711fbd0d6d945b1769f6b85cae959
SCRIPTMETA-END

*/

(function () {
    var commandName = "toggleColorPalette";
    var commandID = stringIDToTypeID(commandName);

    try {
        // カラーパネル（ウィンドウ > カラー）
        app.runMenuItem(commandID);
    } catch (e) {
        alert("カラーパネルを開けませんでした。\nCommand: " + commandName + "\n" + e);
    }
}());
