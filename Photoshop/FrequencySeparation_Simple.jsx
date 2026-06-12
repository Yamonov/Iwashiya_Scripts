#target photoshop

/*

SCRIPTMETA-BEGIN
Script-ID=org.iwashi.FrequencySeparationSimple
Version=1.1
Meta-URL=https://github.com/Yamonov/Iwashiya_Scripts/tree/main/Photoshop
Name=テクスチャ分離シンプル
Author=Murakami Yoshiteru
Target-App=Photoshop
Edit-Password-SHA256=34d903dd737546ea:a9773e7d5ed8d07a29f368c9b00c99fc61047f9e859212de8041a54b2c6149c9
Description-BEGIN
シンプルな周波数分離レイヤーグループを作成します。
Description-END
SCRIPTMETA-END

*/

(function () {
    // 変更用変数
    var STEP2_GROUP_NAME = "テクスチャ分離シンプル";
    var COLOR_LAYER_NAME = "カラー調整レイヤー";
    var TEXTURE_LAYER_NAME = "テクスチャレイヤー";
    var STEP10_MEDIAN_RADIUS_PX = 5;
    var STEP11_GAUSSIAN_BLUR_RADIUS_PX = 0.5;
    var STEP13_APPLY_IMAGE_OFFSET = 1;

    // 更新後の .atn と同じダイアログ表示状態。
    var SHOW_MEDIAN_DIALOG = true;
    var SHOW_GAUSSIAN_BLUR_DIALOG = false;
    var SHOW_APPLY_IMAGE_DIALOG = true;

    if (!app.documents.length) {
        alert("ドキュメントを開いてから実行してください。");
        return;
    }

    runWithHistory("テクスチャ分離シンプル", runFrequencySeparationSimple);

    function runWithHistory(historyName, runner) {
        var runnerName = "__iwashiFrequencySeparationSimpleHistoryRunner";
        $.global[runnerName] = runner;
        try {
            app.activeDocument.suspendHistory(historyName, "$.global." + runnerName + "()");
        } finally {
            try {
                delete $.global[runnerName];
            } catch (e) {
                $.global[runnerName] = null;
            }
        }
    }

    function runFrequencySeparationSimple() {
        // 1. select / 選択範囲: front layer
        selectLayerByOrdinal("Frnt");

        // 2. make / 作成: テクスチャ分離シンプル group
        makeLayerSection(STEP2_GROUP_NAME, "Orng");

        // 3. make / 作成: Reveal All layer mask
        addLayerMask("RvlA");

        // 4. mergeVisible / 表示レイヤーを結合: duplicate
        mergeVisibleDuplicate();

        // 5. move / 移動: target layer to previous
        moveActiveLayerToOrdinal("Prvs");

        // 6. set / 設定: カラー調整レイヤー
        setActiveLayerName(COLOR_LAYER_NAME);

        // 7. mergeVisible / 表示レイヤーを結合: duplicate
        mergeVisibleDuplicate();

        // 8. set / 設定: テクスチャレイヤー
        setActiveLayerName(TEXTURE_LAYER_NAME);

        // 9. select / 選択範囲: backward layer
        selectLayerByOrdinal("Bckw");

        // 10. median / 明るさの中間値
        applyMedian(STEP10_MEDIAN_RADIUS_PX);

        // 11. gaussianBlur / ぼかし (ガウス)
        applyGaussianBlur(STEP11_GAUSSIAN_BLUR_RADIUS_PX);

        // 12. select / 選択範囲: forward layer
        selectLayerByOrdinal("Frwr");

        // 13. applyImageEvent / 画像操作
        applyImageAddInvertToLayer(COLOR_LAYER_NAME, STEP13_APPLY_IMAGE_OFFSET);

        // 14. set / 設定: linear light
        setActiveLayerBlendMode("linearLight");
    }

    function cTID(value) {
        return charIDToTypeID(value);
    }

    function sTID(value) {
        return stringIDToTypeID(value);
    }

    function selectLayerByOrdinal(ordinalCode) {
        var desc = new ActionDescriptor();
        var ref = new ActionReference();

        ref.putEnumerated(cTID("Lyr "), cTID("Ordn"), cTID(ordinalCode));
        desc.putReference(cTID("null"), ref);
        desc.putBoolean(cTID("MkVs"), false);

        executeAction(cTID("slct"), desc, DialogModes.NO);
    }

    function moveActiveLayerToOrdinal(ordinalCode) {
        var desc = new ActionDescriptor();
        var refTarget = new ActionReference();
        var refDestination = new ActionReference();

        refTarget.putEnumerated(cTID("Lyr "), cTID("Ordn"), cTID("Trgt"));
        desc.putReference(cTID("null"), refTarget);

        refDestination.putEnumerated(cTID("Lyr "), cTID("Ordn"), cTID(ordinalCode));
        desc.putReference(cTID("T   "), refDestination);

        executeAction(cTID("move"), desc, DialogModes.NO);
    }

    function makeLayerSection(groupName, colorCode) {
        var desc = new ActionDescriptor();
        var ref = new ActionReference();
        var groupDesc = new ActionDescriptor();

        ref.putClass(sTID("layerSection"));
        desc.putReference(cTID("null"), ref);

        groupDesc.putString(cTID("Nm  "), groupName);
        if (colorCode) {
            groupDesc.putEnumerated(cTID("Clr "), cTID("Clr "), cTID(colorCode));
        }
        desc.putObject(cTID("Usng"), sTID("layerSection"), groupDesc);

        executeAction(cTID("Mk  "), desc, DialogModes.NO);
    }

    function addLayerMask(maskType) {
        var desc = new ActionDescriptor();
        var ref = new ActionReference();

        ref.putEnumerated(cTID("Chnl"), cTID("Chnl"), cTID("Msk "));
        desc.putReference(cTID("At  "), ref);
        desc.putClass(cTID("Nw  "), cTID("Chnl"));
        desc.putEnumerated(cTID("Usng"), cTID("UsrM"), cTID(maskType));

        executeAction(cTID("Mk  "), desc, DialogModes.NO);
    }

    function mergeVisibleDuplicate() {
        var desc = new ActionDescriptor();
        desc.putBoolean(cTID("Dplc"), true);
        executeAction(cTID("MrgV"), desc, DialogModes.NO);
    }

    function setActiveLayerName(layerName) {
        var desc = new ActionDescriptor();
        var ref = new ActionReference();
        var layerDesc = new ActionDescriptor();

        ref.putEnumerated(cTID("Lyr "), cTID("Ordn"), cTID("Trgt"));
        desc.putReference(cTID("null"), ref);

        layerDesc.putString(cTID("Nm  "), layerName);
        desc.putObject(cTID("T   "), cTID("Lyr "), layerDesc);

        executeAction(cTID("setd"), desc, DialogModes.NO);
    }

    function setActiveLayerBlendMode(blendModeStringID) {
        var desc = new ActionDescriptor();
        var ref = new ActionReference();
        var layerDesc = new ActionDescriptor();

        ref.putEnumerated(cTID("Lyr "), cTID("Ordn"), cTID("Trgt"));
        desc.putReference(cTID("null"), ref);

        layerDesc.putEnumerated(cTID("Md  "), cTID("BlnM"), sTID(blendModeStringID));
        desc.putObject(cTID("T   "), cTID("Lyr "), layerDesc);

        executeAction(cTID("setd"), desc, DialogModes.NO);
    }

    function applyMedian(radiusPx) {
        var desc = new ActionDescriptor();
        desc.putUnitDouble(cTID("Rds "), cTID("#Pxl"), radiusPx);
        executeAction(cTID("Mdn "), desc, SHOW_MEDIAN_DIALOG ? DialogModes.ALL : DialogModes.NO);
    }

    function applyGaussianBlur(radiusPx) {
        var desc = new ActionDescriptor();
        desc.putUnitDouble(cTID("Rds "), cTID("#Pxl"), radiusPx);
        executeAction(cTID("GsnB"), desc, SHOW_GAUSSIAN_BLUR_DIALOG ? DialogModes.ALL : DialogModes.NO);
    }

    function applyImageAddInvertToLayer(layerName, offset) {
        var descRoot = new ActionDescriptor();
        var descWith = new ActionDescriptor();
        var refTo = new ActionReference();

        refTo.putEnumerated(cTID("Chnl"), cTID("Chnl"), cTID("RGB "));
        refTo.putName(cTID("Lyr "), layerName);
        descWith.putReference(cTID("T   "), refTo);

        descWith.putBoolean(cTID("Invr"), true);
        descWith.putEnumerated(cTID("Clcl"), cTID("Clcn"), cTID("Add "));
        descWith.putDouble(cTID("Scl "), 2.0);
        descWith.putInteger(cTID("Ofst"), offset);

        descRoot.putObject(cTID("With"), cTID("Clcl"), descWith);

        executeAction(cTID("AppI"), descRoot, SHOW_APPLY_IMAGE_DIALOG ? DialogModes.ALL : DialogModes.NO);
    }
})();
