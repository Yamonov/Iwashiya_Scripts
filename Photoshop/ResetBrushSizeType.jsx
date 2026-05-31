#target photoshop
/*

SCRIPTMETA-BEGIN
Script-ID=org.iwashi.Photoshop_ResetBrushSizeType
Version=1
Release-Date=2026-03-23
Meta-URL=https://github.com/Yamonov/Iwashiya_Scripts/tree/main/Photoshop
Target-App=Photoshop
Description-BEGIN
ブラシをブラシパネルの最初のプリセットにし、ブラシサイズをズームレベルに合わせてリセットします。大きすぎる・小さすぎるサイズからショートカットキーで一発で使いやすいサイズにします。
初期設定の円形ブラシをブラシパネルの最初においてください。
Description-END
SCRIPTMETA-END

*/

(function () {
    // 画面上で見えるブラシサイズ(px)
    var TARGET_SCREEN_SIZE = 150;
    
    var originalTool = app.currentTool;
    
    // ブラシ未対応ツールの場合は終了
    if (!app.toolSupportsBrushes(app.currentTool)) return;
    
    // 最初のブラシプリセットに戻す
    selectFirstBrush();
    
    // ズームレベルを取得し、直径を計算（最大5000pxに制限）
    var zoom = getZoomLevel();
    var newDiameter = Math.min(5000, Math.round(TARGET_SCREEN_SIZE / (zoom / 100)));
    
    // masterDiameter を直接設定（他のブラシ設定は変更しない）
    setBrushDiameter(newDiameter);
    
    // --- 関数定義 ---
    
    // ズームレベル取得関数
    function getZoomLevel() {
        var ref = new ActionReference();
        ref.putProperty(stringIDToTypeID("property"), stringIDToTypeID("zoom"));
        ref.putEnumerated(charIDToTypeID("Dcmn"), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
        var desc = executeActionGet(ref);
        return desc.getDouble(stringIDToTypeID("zoom")) * 100;
    }
    
    // masterDiameter を直接設定する関数
    function setBrushDiameter(diameter) {
        var idSet = stringIDToTypeID("set");
        var desc = new ActionDescriptor();
        var ref = new ActionReference();
        var idBrush = stringIDToTypeID("brush");
        var idOrdinal = stringIDToTypeID("ordinal");
        var idTargetEnum = stringIDToTypeID("targetEnum");
        ref.putEnumerated(idBrush, idOrdinal, idTargetEnum);
        desc.putReference(stringIDToTypeID("null"), ref);

        var brushDesc = new ActionDescriptor();
        brushDesc.putUnitDouble(stringIDToTypeID("masterDiameter"), stringIDToTypeID("pixelsUnit"), diameter);

        desc.putObject(stringIDToTypeID("to"), idBrush, brushDesc);
        executeAction(idSet, desc, DialogModes.NO);
    }
    
    // 最初のブラシプリセットを選択する関数
    function selectFirstBrush() {
        var ref = new ActionReference();
        ref.putIndex(stringIDToTypeID("brush"), 1);
        var desc = new ActionDescriptor();
        desc.putReference(charIDToTypeID("null"), ref);
        executeAction(stringIDToTypeID("select"), desc, DialogModes.NO);
    }

    if (app.currentTool !== originalTool) {
        app.currentTool = originalTool;
    }
})();
