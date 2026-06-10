#target photoshop


/*

SCRIPTMETA-BEGIN
Script-ID=org.iwashi.FrequencySeparationFull.Comp
Version=1
Meta-URL=https://github.com/Yamonov/Iwashiya_Scripts/tree/main/Photoshop
Name=周波数分離＋カンプ作成
Author=Murakami Yoshiteru
Target-App=Photoshop
Edit-Password-SHA256=34d903dd737546ea:a9773e7d5ed8d07a29f368c9b00c99fc61047f9e859212de8041a54b2c6149c9
Description-BEGIN
①明るさの中間値ダイアログでディテールをぼかしてください。ここで消えたディテールがテクスチャレイヤーに移動します。
　※重いフィルタなので、プレビューは切っておきましょう。
②ガウスぼかしで、①で消えなかった細かいディテールをぼかしてください。

Expandレイヤーを表示すると、テクスチャレイヤーの操作をしやすくなります。
テクスチャグループ、カラーグループの表示を切り替えて作業してください。

作業用に、通常・テクスチャのみ+Expand、カラーのみのレイヤーカンプを作成します。
Description-END
SCRIPTMETA-END

*/

(function () {
    // 変更用変数
    var STEP2_GROUP_NAME = "Frequency Separation";
    var STEP11_MEDIAN_RADIUS_PX = 8;
    var STEP12_GAUSSIAN_BLUR_RADIUS_PX = 2;
    var STEP28_CONTRAST = 90;

    // 元のアクションと同じく、手順 11/12 はフィルタダイアログを表示する。
    var SHOW_FILTER_DIALOGS = true;

    if (!app.documents.length) {
        alert("ドキュメントを開いてから実行してください。");
        return;
    }

    runFrequencySeparation();
    createLayerCompsFromFrequencySeparation();

    function runFrequencySeparation() {
        // 1. select / 選択範囲: front layer
        selectLayerByOrdinal("Frnt");

        // 2. make / 作成: Frequency Separation group, blend mode Normal
        makeLayerSection(STEP2_GROUP_NAME);

        // 3. AdobeScriptAutomation Scripts: 選択レイヤー名をカウントアップ
        renameLayerWithIncrement();

        // 4. AdobeScriptAutomation Scripts: レイヤーマスク操作
        runLayerMaskOperation();

        // 5. move / 移動: target layer to front
        moveActiveLayerToOrdinal("Frnt");

        // 6. mergeVisible / 表示レイヤーを結合: duplicate
        mergeVisibleDuplicate();

        // 7. set / 設定: COLORBASE
        setActiveLayerName("COLORBASE");

        // 8. mergeVisible / 表示レイヤーを結合: duplicate
        mergeVisibleDuplicate();

        // 9. set / 設定: TEXTUREBASE
        setActiveLayerName("TEXTUREBASE");

        // 10. select / 選択範囲: backward layer
        selectLayerByOrdinal("Bckw");

        // 11. median / 明るさの中間値
        applyMedian(STEP11_MEDIAN_RADIUS_PX);

        // 12. gaussianBlur / ぼかし (ガウス)
        applyGaussianBlur(STEP12_GAUSSIAN_BLUR_RADIUS_PX);

        // 13. select / 選択範囲: forward layer
        selectLayerByOrdinal("Frwr");

        // 14. AdobeScriptAutomation Scripts: 周波数分離用画像操作8/16bit
        applyImageAddInvertToLayer("COLORBASE", getApplyImageOffsetByBitDepth());

        // 15. select / 選択範囲: backward layer
        selectLayerByOrdinal("Bckw");

        // 16. make / 作成: ★ColorGROUP
        makeLayerSectionFromActive("★ColorGROUP", "Ylw ", "");

        // 17. move / 移動: target layer to previous
        moveActiveLayerToOrdinal("Prvs");

        // 18. make / 作成: Color_Retouch
        makeLayer("Color_Retouch");

        // 18a. add layer mask: Reveal All
        addLayerMask("RvlA");

        // 19. select / 選択範囲: forward layer
        selectLayerByOrdinal("Frwr");

        // 20. select / 選択範囲: forward layer
        selectLayerByOrdinal("Frwr");

        // 21. select / 選択範囲: forward layer
        selectLayerByOrdinal("Frwr");

        // 22. make / 作成: TextureGROUP
        makeLayerSectionFromActive("TextureGROUP", "Orng", "linearLight");

        // 23. move / 移動: target layer to previous
        moveActiveLayerToOrdinal("Prvs");

        // 24. make / 作成: Texture_Retouch
        makeLayer("Texture_Retouch");

        // 24a. add layer mask: Reveal All
        addLayerMask("RvlA");

        // 25. select / 選択範囲: forward layer
        selectLayerByOrdinal("Frwr");

        // 26. select / 選択範囲: forward layer
        selectLayerByOrdinal("Frwr");

        // 27. make / 作成: brightness/contrast adjustment layer
        makeBrightnessContrastLayer();

        // 28. set / 設定: brightness 0, contrast variable
        setBrightnessContrast(0, STEP28_CONTRAST);

        // 29. set / 設定: Expand
        setActiveLayerName("Expand");

        // 29a. remove the default layer mask from the adjustment layer
        delLayerMask();

        // 30. set / 設定: layer color red
        setActiveLayerColor("Rd  ");

        // 31. hide / 隠す
        hideActiveLayer();

        // 32. select / 選択範囲: backward layer
        selectLayerByOrdinal("Bckw");

        // 33. select / 選択範囲: backward layer
        selectLayerByOrdinal("Bckw");
    }

    function cTID(value) {
        return charIDToTypeID(value);
    }

    function sTID(value) {
        return stringIDToTypeID(value);
    }

    function filterDialogMode() {
        return SHOW_FILTER_DIALOGS ? DialogModes.ALL : DialogModes.NO;
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

    function makeLayerSection(groupName) {
        var desc = new ActionDescriptor();
        var ref = new ActionReference();
        var groupDesc = new ActionDescriptor();

        ref.putClass(sTID("layerSection"));
        desc.putReference(cTID("null"), ref);

        groupDesc.putString(cTID("Nm  "), groupName);
        groupDesc.putEnumerated(cTID("Md  "), cTID("BlnM"), cTID("Nrml"));
        desc.putObject(cTID("Usng"), sTID("layerSection"), groupDesc);

        executeAction(cTID("Mk  "), desc, DialogModes.NO);
    }

    function makeLayerSectionFromActive(groupName, colorCode, blendModeStringID) {
        var desc = new ActionDescriptor();
        var refClass = new ActionReference();
        var refFrom = new ActionReference();
        var groupDesc = new ActionDescriptor();

        refClass.putClass(sTID("layerSection"));
        desc.putReference(cTID("null"), refClass);

        refFrom.putEnumerated(cTID("Lyr "), cTID("Ordn"), cTID("Trgt"));
        desc.putReference(cTID("From"), refFrom);

        groupDesc.putString(cTID("Nm  "), groupName);

        if (colorCode) {
            groupDesc.putEnumerated(cTID("Clr "), cTID("Clr "), cTID(colorCode));
        }

        if (blendModeStringID) {
            groupDesc.putEnumerated(cTID("Md  "), cTID("BlnM"), sTID(blendModeStringID));
        }

        desc.putObject(cTID("Usng"), sTID("layerSection"), groupDesc);

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

    function setActiveLayerColor(colorCode) {
        var desc = new ActionDescriptor();
        var ref = new ActionReference();
        var layerDesc = new ActionDescriptor();

        ref.putEnumerated(cTID("Lyr "), cTID("Ordn"), cTID("Trgt"));
        desc.putReference(cTID("null"), ref);

        layerDesc.putEnumerated(cTID("Clr "), cTID("Clr "), cTID(colorCode));
        desc.putObject(cTID("T   "), cTID("Lyr "), layerDesc);

        executeAction(cTID("setd"), desc, DialogModes.NO);
    }

    function hideActiveLayer() {
        var desc = new ActionDescriptor();
        var list = new ActionList();
        var ref = new ActionReference();

        ref.putEnumerated(cTID("Lyr "), cTID("Ordn"), cTID("Trgt"));
        list.putReference(ref);
        desc.putList(cTID("null"), list);

        executeAction(cTID("Hd  "), desc, DialogModes.NO);
    }

    function applyMedian(radiusPx) {
        var desc = new ActionDescriptor();
        desc.putUnitDouble(cTID("Rds "), cTID("#Pxl"), radiusPx);
        executeAction(cTID("Mdn "), desc, filterDialogMode());
    }

    function applyGaussianBlur(radiusPx) {
        var desc = new ActionDescriptor();
        desc.putUnitDouble(cTID("Rds "), cTID("#Pxl"), radiusPx);
        executeAction(cTID("GsnB"), desc, filterDialogMode());
    }

    function makeBrightnessContrastLayer() {
        var desc = new ActionDescriptor();
        var ref = new ActionReference();
        var adjustmentDesc = new ActionDescriptor();
        var brightnessContrastDesc = new ActionDescriptor();

        ref.putClass(cTID("AdjL"));
        desc.putReference(cTID("null"), ref);

        brightnessContrastDesc.putBoolean(sTID("useLegacy"), false);
        adjustmentDesc.putObject(cTID("Type"), cTID("BrgC"), brightnessContrastDesc);
        desc.putObject(cTID("Usng"), cTID("AdjL"), adjustmentDesc);

        executeAction(cTID("Mk  "), desc, DialogModes.NO);
    }

    function setBrightnessContrast(brightness, contrast) {
        var desc = new ActionDescriptor();
        var ref = new ActionReference();
        var brightnessContrastDesc = new ActionDescriptor();

        ref.putEnumerated(cTID("AdjL"), cTID("Ordn"), cTID("Trgt"));
        desc.putReference(cTID("null"), ref);

        brightnessContrastDesc.putInteger(cTID("Brgh"), brightness);
        brightnessContrastDesc.putInteger(cTID("Cntr"), contrast);
        desc.putObject(cTID("T   "), cTID("BrgC"), brightnessContrastDesc);

        executeAction(cTID("setd"), desc, DialogModes.NO);
    }

    // Embedded helper: 選択レイヤー名をカウントアップ.jsx
    function renameLayerWithIncrement() {
        if (!app.documents.length) {
            return;
        }

        var doc = app.activeDocument;
        var layer = doc.activeLayer;
        var originalName = layer.name;

        var nameMatch = originalName.match(/^(.*?)(?:\s+(\d+))?$/);
        var baseName = (nameMatch && nameMatch[1])
            ? ("" + nameMatch[1]).replace(/\s+$/, "")
            : originalName;

        var number = (nameMatch && nameMatch[2])
            ? parseInt(nameMatch[2], 10) + 1
            : 1;

        var newName;
        var exists;

        do {
            var paddedNumber = ("0" + number).slice(-2);
            newName = baseName + " " + paddedNumber;

            exists = false;
            for (var i = 0; i < doc.layers.length; i++) {
                if (doc.layers[i].name === newName && doc.layers[i] !== layer) {
                    exists = true;
                    break;
                }
            }

            number++;
        } while (exists);

        layer.name = newName;
    }

    // Embedded helper: 選択範囲があればマスク追加.jsx
    function runLayerMaskOperation() {
        var doc = app.activeDocument;

        if (isSelectionRect(doc)) {
            if (hasLayerMask()) {
                delLayerMask();
            }
            addLayerMask("RvlS");
            app.activeDocument.selection.deselect();
        } else {
            if (hasLayerMask()) {
                invertLayerMask();
            } else {
                addLayerMask("RvlA");
            }
        }
    }

    function hasLayerMask() {
        try {
            var ref = new ActionReference();
            var keyUsrM = cTID("UsrM");

            ref.putProperty(cTID("Prpr"), keyUsrM);
            ref.putEnumerated(cTID("Lyr "), cTID("Ordn"), cTID("Trgt"));

            var desc = executeActionGet(ref);
            return desc.hasKey(keyUsrM);
        } catch (e) {
            return false;
        }
    }

    function delLayerMask() {
        try {
            var desc = new ActionDescriptor();
            var ref = new ActionReference();

            ref.putEnumerated(cTID("Chnl"), cTID("Chnl"), cTID("Msk "));
            desc.putReference(cTID("null"), ref);
            desc.putBoolean(cTID("Aply"), false);
            executeAction(cTID("Dlt "), desc, DialogModes.NO);
            return true;
        } catch (e) {
            return false;
        }
    }

    function addLayerMask(maskType) {
        try {
            var desc = new ActionDescriptor();
            var ref = new ActionReference();

            ref.putEnumerated(cTID("Chnl"), cTID("Chnl"), cTID("Msk "));
            desc.putReference(cTID("At  "), ref);
            desc.putClass(cTID("Nw  "), cTID("Chnl"));
            desc.putEnumerated(cTID("Usng"), cTID("UsrM"), cTID(maskType));
            executeAction(cTID("Mk  "), desc, DialogModes.NO);
            return true;
        } catch (e) {
            return false;
        }
    }

    function invertLayerMask() {
        try {
            var desc = new ActionDescriptor();
            var ref = new ActionReference();

            ref.putEnumerated(cTID("Chnl"), cTID("Chnl"), cTID("Msk "));
            desc.putReference(cTID("null"), ref);
            executeAction(cTID("slct"), desc, DialogModes.NO);
            executeAction(cTID("Invr"), undefined, DialogModes.NO);
            return true;
        } catch (e) {
            return false;
        }
    }

    function isSelectionRect(doc) {
        try {
            doc.selection.bounds;
            return true;
        } catch (e) {
            return false;
        }
    }

    // Embedded helper: applyImageEvent8or16bit.jsx
    function applyImageAddInvertToLayer(layerName, offset) {
        var idApplyImageEvent = sTID("applyImageEvent");
        var descRoot = new ActionDescriptor();
        var idWith = sTID("with");
        var descWith = new ActionDescriptor();
        var idTo = sTID("to");
        var refTo = new ActionReference();
        var idChannel = sTID("channel");
        var idRGB = sTID("RGB");
        var idLayer = sTID("layer");
        var idInvert = sTID("invert");
        var idCalculation = sTID("calculation");
        var idCalculationType = sTID("calculationType");
        var idAdd = sTID("add");
        var idScale = sTID("scale");
        var idOffset = sTID("offset");

        refTo.putEnumerated(idChannel, idChannel, idRGB);
        refTo.putName(idLayer, layerName);
        descWith.putReference(idTo, refTo);

        descWith.putBoolean(idInvert, true);
        descWith.putEnumerated(idCalculation, idCalculationType, idAdd);
        descWith.putDouble(idScale, 2.0);
        descWith.putInteger(idOffset, offset);

        descRoot.putObject(idWith, idCalculation, descWith);

        executeAction(idApplyImageEvent, descRoot, DialogModes.NO);
    }

    function getApplyImageOffsetByBitDepth(doc) {
        var d = doc || app.activeDocument;
        var bits = d.bitsPerChannel;

        if (bits === BitsPerChannelType.EIGHT) {
            return 1;
        }

        if (bits === BitsPerChannelType.SIXTEEN) {
            return 0;
        }

        throw new Error("8bit/16bit以外の色深度は未対応です: " + bits);
    }

    // Embedded helper: 周波数分離からカンプ作成.jsx
    function createLayerCompsFromFrequencySeparation() {
        var fsGroupPattern = /^Frequency Separation (\d+)$/;

        app.bringToFront();

        if (!app.documents.length) {
            alert("ドキュメントが開かれていません。");
            return;
        }

        var doc = app.activeDocument;
        var selectedLayer = doc.activeLayer;
        var rootGroup = findNearestFrequencySeparationGroup(selectedLayer, fsGroupPattern);

        if (!rootGroup) {
            alert("選択中のレイヤーの親グループに 'Frequency Separation [数字]' の名前が見つかりません。");
            return;
        }

        var groupNameMatch = rootGroup.name.match(fsGroupPattern);
        var nn = groupNameMatch[1];
        var currentFsNumber = parseInt(nn, 10);
        var fsCompPattern = /^FS(\d+)[：:]/;

        for (var k = doc.layerComps.length - 1; k >= 0; k--) {
            var compNameMatch = doc.layerComps[k].name.match(fsCompPattern);
            if (compNameMatch && parseInt(compNameMatch[1], 10) <= currentFsNumber) {
                doc.layerComps[k].remove();
            }
        }

        var expandLayer = null;
        var textureGroup = null;
        var colorGroup = null;

        for (var i = 0; i < rootGroup.layers.length; i++) {
            var layer = rootGroup.layers[i];
            var isGroup = (layer.typename === "LayerSet");

            if (!expandLayer && layer.name === "Expand") {
                expandLayer = layer;
                continue;
            }

            if (!textureGroup && isGroup && layer.name === "TextureGROUP") {
                textureGroup = layer;
                continue;
            }

            if (!colorGroup && isGroup && (layer.name === "★ColorGROUP" || startsWithText(layer.name, "ColorGROUP"))) {
                colorGroup = layer;
                continue;
            }

            if (expandLayer && textureGroup && colorGroup) {
                break;
            }
        }

        if (!expandLayer || !textureGroup || !colorGroup) {
            alert("必要なレイヤーまたはグループが '" + rootGroup.name + "' 内に見つかりません。");
            return;
        }

        var normalName = "FS" + nn + "：NORMAL";

        addLayerComp(doc, normalName, expandLayer, false, textureGroup, true, colorGroup, true);
        addLayerComp(doc, "FS" + nn + "：TEXTURE", expandLayer, true, textureGroup, true, colorGroup, false);
        addLayerComp(doc, "FS" + nn + "：COLOR", expandLayer, false, textureGroup, false, colorGroup, true);

        for (var c = 0; c < doc.layerComps.length; c++) {
            var comp = doc.layerComps[c];
            if (comp.name === normalName) {
                comp.apply();
                break;
            }
        }
    }

    function findNearestFrequencySeparationGroup(layer, fsGroupPattern) {
        var current = layer;

        while (current && current !== app.activeDocument) {
            if (fsGroupPattern.test(current.name)) {
                return current;
            }
            current = current.parent;
        }

        return null;
    }

    function addLayerComp(doc, compName, expandLayer, expandVisible, textureGroup, textureVisible, colorGroup, colorVisible) {
        expandLayer.visible = expandVisible;
        textureGroup.visible = textureVisible;
        colorGroup.visible = colorVisible;
        doc.layerComps.add(compName, "", true, true, true);
    }

    function startsWithText(text, head) {
        return String(text).indexOf(head) === 0;
    }
})();
