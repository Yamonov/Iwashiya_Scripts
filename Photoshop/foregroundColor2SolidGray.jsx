#target photoshop

/*

SCRIPTMETA-BEGIN
Script-ID=org.iwashi.foregroundColor2SolidGray
Meta-Default-language=ja
Version=1
Meta-URL=https://github.com/Yamonov/Iwashiya_Scripts/tree/main/Photoshop
Name=前景色を中間グレーにする
Name[en]=Set Foreground Color to Midgray
Tags=カラー,color,グレー,gray
Author=Murakami Yoshiteru
Target-App=Photoshop
SCRIPTMETA-END

*/

(function () {
    var grayColor = new SolidColor();
    grayColor.gray.gray = 50;
    app.foregroundColor = grayColor;
}());
