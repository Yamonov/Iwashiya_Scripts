#target photoshop

/*

SCRIPTMETA-BEGIN
Script-ID=org.iwashi.NoiseTexturePaintSimple
Version=1
Meta-URL=https://github.com/Yamonov/Iwashiya_Scripts/tree/main/Photoshop
Name=ノイズテクスチャ塗り
Author=Murakami Yoshiteru
Target-App=Photoshop
Description-BEGIN
ノイズ入りのテクスチャ塗り用レイヤーを作成します。
Description-END
SCRIPTMETA-END

*/

(function () {
    var TEXTURE_LAYER_NAME = "ノイズテクスチャ";

    var BLUR_AMOUNT = 15.0;
    var NOISE_AMOUNT_PERCENT = 10.000000149011612;
    var NOISE_SIZE_PERCENT = 20.000000298023224;
    var NOISE_ROUGHNESS_PERCENT = 30.000001192092896;
    var NOISE_RANDOM_SEED = 22046261;

    // .atn 記録時の参照矩形と Blur Gallery ピン位置。
    var REFERENCE_TOP = 0;
    var REFERENCE_LEFT = 0;
    var REFERENCE_BOTTOM = 2133;
    var REFERENCE_RIGHT = 2133;
    var WIDGET_LOCATION_X = 1066.0;
    var WIDGET_LOCATION_Y = 1066.0;

    if (!app.documents.length) {
        alert("ドキュメントを開いてから実行してください。");
        return;
    }

    runNoiseTexturePaintSimple();

    function runNoiseTexturePaintSimple() {
        // 1. make / 作成: ノイズテクスチャ layer, Soft Light, clipped, neutral fill
        makeTextureLayer(TEXTURE_LAYER_NAME);

        // 2. newPlacedLayer / スマートオブジェクトに変換
        convertActiveLayerToSmartObject();

        // 3. blurbTransform / ぼかしギャラリー
        applyBlurGalleryNoiseTexture();
    }

    function cTID(value) {
        return charIDToTypeID(value);
    }

    function sTID(value) {
        return stringIDToTypeID(value);
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
        desc.putBoolean(sTID("blurbHighQuality"), true);

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
}());
