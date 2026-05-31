/*

SCRIPTMETA-BEGIN
Script-ID=org.iwashi.Photoshop_ChangeMaskColor
Version=1
Release-Date=2026-03-23
Meta-URL=https://github.com/Yamonov/Iwashiya_Scripts/tree/main/Photoshop
Target-App=Photoshop
Description-BEGIN
マスクのオーバーレイ表示カラーを、実行する度に色相環で60度ごとに切り替えます。
Description-END
SCRIPTMETA-END

*/

var regKey = "myMaskColor"; // 実行内容を記録するキー

// カラー設定
var defaultSaturation = 80; // 彩度（0〜100）
var defaultBrightness = 80; // 輝度（0〜100）
var defaultOpacity = 90; // 不透明度（0〜100）
var hueStep = 60; // 前回から加算するH（例: 120=RGB, 60=CMY）

// 前回記録の取得 or 初回記録
var currentHue;
try {
    var desc = app.getCustomOptions(regKey);
    currentHue = parseInt(desc.getString(1001), 10);
} catch (e) {
    currentHue = saveHue(0); // 初回は0で記録
}

// 新しい色相の計算と保存
currentHue += hueStep;
if (currentHue >= 360) currentHue = 0;
saveHue(currentHue);

// 実行
try {
    applyMaskColor(currentHue);
} catch (e) {}

// 関数：H値を保存
function saveHue(hue) {
    var desc = new ActionDescriptor();
    desc.putString(1001, String(hue));
    app.putCustomOptions(regKey, desc, true);
    return hue;
}

// 関数：マスクカラーを変更
function applyMaskColor(hue) {
    var idSet = charIDToTypeID("setd");
    var descSet = new ActionDescriptor();

    var idNull = charIDToTypeID("null");
    var ref = new ActionReference();
    ref.putEnumerated(charIDToTypeID("Chnl"), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
    descSet.putReference(idNull, ref);

    var idTo = charIDToTypeID("T   ");
    var descChannel = new ActionDescriptor();

    var idColor = charIDToTypeID("Clr ");
    var descHSB = new ActionDescriptor();
    descHSB.putUnitDouble(charIDToTypeID("H   "), charIDToTypeID("#Ang"), hue);
    descHSB.putDouble(charIDToTypeID("Strt"), defaultSaturation);
    descHSB.putDouble(charIDToTypeID("Brgh"), defaultBrightness);

    descChannel.putObject(idColor, charIDToTypeID("HSBC"), descHSB);

    // 不透明度を設定（不要ならこのブロック削除）
    descChannel.putUnitDouble(
        charIDToTypeID("Opct"),
        charIDToTypeID("#Prc"),
        defaultOpacity
    );

    descSet.putObject(idTo, charIDToTypeID("Chnl"), descChannel);
    executeAction(idSet, descSet, DialogModes.NO);
}