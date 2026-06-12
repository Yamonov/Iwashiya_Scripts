#target photoshop

/*

SCRIPTMETA-BEGIN
Script-ID=org.iwashi.NoiseTexturePaint
Version=1.1
Meta-URL=https://github.com/Yamonov/Iwashiya_Scripts/tree/main/Photoshop
Name=テクスチャ塗り
Author=Murakami Yoshiteru
Target-App=Photoshop
Edit-Password-SHA256=34d903dd737546ea:a9773e7d5ed8d07a29f368c9b00c99fc61047f9e859212de8041a54b2c6149c9
Description-BEGIN
ノイズ入りのテクスチャ塗り用レイヤーを作成します。
Description-END
SCRIPTMETA-END

*/

(function () {
    // 変更用変数
    var GROUP_NAME = "テクスチャ塗り";
    var PAINT_LAYER_NAME = "塗り";
    var TEXTURE_LAYER_NAME = "テクスチャ";
    var GROUP_COLOR = "Ylw ";

    var BLUR_AMOUNT = 15.0;
    var NOISE_AMOUNT_PERCENT = 23.70000034570694;
    var NOISE_SIZE_PERCENT = 25.0;
    var NOISE_ROUGHNESS_PERCENT = 50.0;
    var NOISE_RANDOM_SEED = 874221;

    // .atn 記録時の参照矩形と Blur Gallery ピン位置。
    var REFERENCE_TOP = 0;
    var REFERENCE_LEFT = 0;
    var REFERENCE_BOTTOM = 1600;
    var REFERENCE_RIGHT = 1071;
    var WIDGET_LOCATION_X = 535.0;
    var WIDGET_LOCATION_Y = 800.0;

    if (!app.documents.length) {
        alert("ドキュメントを開いてから実行してください。");
        return;
    }

    runWithHistory("テクスチャ塗り", runNoiseTexturePaint);

    function runWithHistory(historyName, runner) {
        var runnerName = "__iwashiNoiseTexturePaintHistoryRunner";
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

    function runNoiseTexturePaint() {
        // 1. select / 選択範囲: front layer
        selectLayerByOrdinal("Frnt");

        // 2. make / 作成: テクスチャ塗り group
        makeLayerSection(GROUP_NAME, GROUP_COLOR);

        // 3. make / 作成: Reveal All layer mask
        addLayerMask("RvlA");

        // 4. make / 作成: 塗り layer
        makeLayer(PAINT_LAYER_NAME);

        // 5. make / 作成: テクスチャ layer, Soft Light, clipped, neutral fill
        makeTextureLayer(TEXTURE_LAYER_NAME);

        // 6. newPlacedLayer / スマートオブジェクトに変換
        convertActiveLayerToSmartObject();

        // 7. blurbTransform / ぼかしギャラリー
        applyBlurGalleryNoiseTexture();

        // 8. select / 選択範囲: backward layer
        selectLayerByOrdinal("Bckw");
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

    function makeLayerSection(groupName, colorCode) {
        var desc = new ActionDescriptor();
        var ref = new ActionReference();
        var groupDesc = new ActionDescriptor();

        ref.putClass(sTID("layerSection"));
        desc.putReference(cTID("null"), ref);

        groupDesc.putString(cTID("Nm  "), groupName);
        groupDesc.putEnumerated(cTID("Clr "), cTID("Clr "), cTID(colorCode));
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

    function makeLayer(layerName) {
        var desc = new ActionDescriptor();
        var ref = new ActionReference();
        var layerDesc = new ActionDescriptor();

        ref.putClass(cTID("Lyr "));
        desc.putReference(cTID("null"), ref);

        layerDesc.putString(cTID("Nm  "), layerName);
        desc.putObject(cTID("Usng"), cTID("Lyr "), layerDesc);

        executeAction(cTID("Mk  "), desc, DialogModes.NO);
    }

    function makeTextureLayer(layerName) {
        var desc = new ActionDescriptor();
        var ref = new ActionReference();
        var layerDesc = new ActionDescriptor();

        ref.putClass(cTID("Lyr "));
        desc.putReference(cTID("null"), ref);

        layerDesc.putString(cTID("Nm  "), layerName);
        layerDesc.putEnumerated(cTID("Md  "), cTID("BlnM"), sTID("softLight"));
        layerDesc.putBoolean(cTID("Grup"), true);
        layerDesc.putBoolean(cTID("FlNt"), true);
        desc.putObject(cTID("Usng"), cTID("Lyr "), layerDesc);

        executeAction(cTID("Mk  "), desc, DialogModes.NO);
    }

    function convertActiveLayerToSmartObject() {
        executeAction(sTID("newPlacedLayer"), undefined, DialogModes.NO);
    }

    function applyBlurGalleryNoiseTexture() {
        var desc = new ActionDescriptor();
        var ref = new ActionReference();
        var referenceRect = new ActionDescriptor();
        var widgetList = new ActionList();
        var widget = new ActionDescriptor();
        var noiseDesc = new ActionDescriptor();

        ref.putEnumerated(cTID("Lyr "), cTID("Ordn"), cTID("Trgt"));
        desc.putReference(cTID("null"), ref);

        desc.putBoolean(sTID("blurbType"), true);
        desc.putInteger(cTID("VrsM"), 1);
        desc.putInteger(cTID("VrsN"), 0);

        referenceRect.putInteger(cTID("Top "), REFERENCE_TOP);
        referenceRect.putInteger(cTID("Left"), REFERENCE_LEFT);
        referenceRect.putInteger(cTID("Btom"), REFERENCE_BOTTOM);
        referenceRect.putInteger(cTID("Rght"), REFERENCE_RIGHT);
        desc.putObject(sTID("referenceRect"), cTID("Rctn"), referenceRect);

        desc.putInteger(sTID("blurbOpenPanel"), 0);
        desc.putBoolean(sTID("blurbGeneralBlurEffectApplied"), true);
        desc.putBoolean(sTID("blurbSaveMaskChannel"), false);
        desc.putBoolean(sTID("blurbHighQuality"), false);

        widget.putInteger(sTID("blurbWidgetType"), 0);
        widget.putDouble(sTID("blurbWidgetLocationX"), WIDGET_LOCATION_X);
        widget.putDouble(sTID("blurbWidgetLocationY"), WIDGET_LOCATION_Y);
        widget.putBoolean(sTID("blurbWidgetSelected"), true);
        widget.putBoolean(sTID("blurbWidgetEffectEnabled"), true);
        widget.putDouble(sTID("blurbGeneralBlurAmount"), BLUR_AMOUNT);
        widgetList.putObject(sTID("blurbWidget"), widget);
        desc.putList(sTID("blurbWidgetList"), widgetList);

        noiseDesc.putUnitDouble(cTID("Amnt"), cTID("#Prc"), NOISE_AMOUNT_PERCENT);
        noiseDesc.putUnitDouble(cTID("Sz  "), cTID("#Prc"), NOISE_SIZE_PERCENT);
        noiseDesc.putUnitDouble(sTID("roughness"), cTID("#Prc"), NOISE_ROUGHNESS_PERCENT);
        noiseDesc.putInteger(cTID("RndS"), NOISE_RANDOM_SEED);
        desc.putObject(cTID("Nose"), sTID("blurbGrainParams"), noiseDesc);

        desc.putDouble(cTID("PuX0"), 0.0);
        desc.putDouble(cTID("PuX1"), REFERENCE_RIGHT);
        desc.putDouble(cTID("PuX2"), REFERENCE_RIGHT);
        desc.putDouble(cTID("PuX3"), 0.0);
        desc.putDouble(cTID("PuY0"), 0.0);
        desc.putDouble(cTID("PuY1"), 0.0);
        desc.putDouble(cTID("PuY2"), REFERENCE_BOTTOM);
        desc.putDouble(cTID("PuY3"), REFERENCE_BOTTOM);

        executeAction(sTID("blurbTransform"), desc, DialogModes.NO);
    }
})();
