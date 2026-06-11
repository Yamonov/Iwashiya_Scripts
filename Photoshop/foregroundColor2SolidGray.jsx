#target photoshop

/*

SCRIPTMETA-BEGIN
Script-ID=org.iwashi.foregroundColor2SolidGray
Version=1
Meta-URL=https://github.com/Yamonov/Iwashiya_Scripts/tree/main/Photoshop
Name=前景色を中間グレーにする
Author=Murakami Yoshiteru
Target-App=Photoshop
SCRIPTMETA-END

*/

(function () {
    var grayColor = new SolidColor();
    grayColor.gray.gray = 50;
    app.foregroundColor = grayColor;
}());
