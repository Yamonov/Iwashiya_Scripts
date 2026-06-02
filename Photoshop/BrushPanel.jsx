#target photoshop

/*

SCRIPTMETA-BEGIN
Script-ID=org.iwashi.toggleBrushesPalette
Version=1
Meta-URL=https://github.com/Yamonov/Iwashiya_Scripts/tree/main/Photoshop
Name=ブラシパネル表示・非表示
Author=Murakami Yoshiteru
Target-App=Photoshop
Edit-Password-SHA256=OimhoL9gM4ocNsFN:ffca0de550cc5bb1001f8f4b9ba34bec4c54ac8216baaa55a96259a91cc92446
SCRIPTMETA-END

*/

(function () {
    var commandID = "toggleBrushesPalette";

    try {
        // ブラシパネル（Window > Brushes）
        app.runMenuItem(stringIDToTypeID(commandID));
    } catch (e) {
        alert("ブラシパネルを開けませんでした。\nCommand: " + commandID + "\n" + e);
    }
}());
