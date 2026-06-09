/*

SCRIPTMETA-BEGIN
Script-ID=org.iwashi.Photoshop_ClippingView
Version=1
Meta-URL=https://github.com/Yamonov/Iwashiya_Scripts/tree/main/Photoshop
Name=クリッピング表示レイヤーグループ作成
Author=Murakami Yoshiteru
Release-Date=2026-03-23
Target-App=Photoshop
Edit-Password-SHA256=dd11a7f844bc4fc3:0ae4c79c57740cfe77e7dfd5dd59450bd38776a4ee7482f7abc02a031e490d74
Description-BEGIN
RGBドキュメントとCMYKドキュメントで実行すると、潰れるところを青、飛ぶところを赤で表示するレイヤーグループを最上部に作成します。
もう一度実行すると非表示に、再度実行すると最上部に移動した上で表示状態になります。
CMYKドキュメントでは総インキ量を指定できます。システム側にインストールされる「TotalInkPreview.icc」を使用します。
Description-END
SCRIPTMETA-END


*/

if(app.documents.length){
app.activeDocument.suspendHistory("クリッピング表示","main()");
}
// ===========================================
// メイン処理
// ===========================================
function main() {
    if (toggleAllClippingViewGroups()) {return;}

    var colorMode = getDocumentColorMode();

    if (colorMode === "CMYK") {
        processCMYK();
    } else if (colorMode === "RGB") {
        processRGB();
    } else {
        alert("RGBまたはCMYKドキュメントで実行してください。");
    }
}

// ===========================================
// CMYKモード用の処理
// ===========================================
function processCMYK() {
    moveActiveLayerSelection(0);
    createGroup("TEMP");
    createColorLookupLayerWithICC(getICCPath(),"TAC2Gary");
    setLayerBlendRangeGrayFull([0,0,254,254],[0,0,255,255]);
    createThresholdLayer();
    setThresholdByTAC();
    applySolidFillEffect("CMYK",[100,50,0,0],"lighterColor");
    createClippingMask();
    createSolidColorLayer("CMYK",[0,100,100,0],"Highlight");
    setLayerBlendRangeGrayFull([0,0,255,255],[255,255,255,255]);
    moveActiveLayerSelection(0);
    ungroupSelectedLayers();
    selectLayerIDsFromTop(3);
    makeLayerGroup("Clipping_View_CMYK","orange");
}

// ===========================================
// RGBモード用の処理
// ===========================================
function processRGB() {
    moveActiveLayerSelection(0);
    createGroup("TEMP");
    createSolidColorLayer("RGB",[0,0,255],"Shadow");
    setLayerBlendRangeGrayFull([0,0,255,255],[0,0,0,0]);
    createSolidColorLayer("RGB",[255,0,0],"Highlight");
    setLayerBlendRangeGrayFull([0,0,255,255],[255,255,255,255]);
    moveActiveLayerSelection(0);
    ungroupSelectedLayers();
    selectLayerIDsFromTop(2);
    makeLayerGroup("Clipping_View_RGB","orange");
}

// ===========================================
// OSに応じてICCファイルのパスを返す
// ===========================================
function getICCPath() {
    var iccPath;

    if ($.os.toLowerCase().indexOf("mac") >= 0) {
        // Macの場合
        iccPath = "/Library/Application Support/Adobe/Color Profiles/TotalInkPreview.icc";
    } else {
        // Windowsの場合
        iccPath = "C:\\Program Files (x86)\\Common Files\\Adobe\\Color Profiles\\TotalInkPreview.icc";
    }

    var iccFile = new File(iccPath);
    if (!iccFile.exists) {
        alert(
            "ICCプロファイルが見つかりません：\n" +
            iccPath +
            "\n付近を探して、見つかったパスを script71行目あたりで書き換えてください"
        );
        throw new Error("ICCプロファイルが存在しません。");
    }

    return iccPath;
}

// ===========================================
// ドキュメント直下の「Clipping_View_」で始まるすべてのレイヤーグループを
// 最上位に移動し、表示/非表示をトグル
// ===========================================
function toggleAllClippingViewGroups() {
    if (app.documents.length === 0) return false;

    var doc = app.activeDocument;
    var targetPrefix = "Clipping_View_";
    var targetGroups = [];

    for (var i = 0; i < doc.layers.length; i++) {
        var layer = doc.layers[i];
        if (layer.typename === "LayerSet" && layer.name.indexOf(targetPrefix) === 0) {
            targetGroups.push(layer);
        }
    }

    if (targetGroups.length === 0) return false;

    for (var j = targetGroups.length - 1; j >= 0; j--) {
        var group = targetGroups[j];
        if (doc.layers[0] !== group) {
            group.move(doc.layers[0], ElementPlacement.PLACEBEFORE);
        }
    }
    for (var k = 0; k < targetGroups.length; k++) {
        targetGroups[k].visible = !targetGroups[k].visible;
    }

    return true;
}

// ===========================================
// 選択中の2階調化レイヤーの閾値を、総インキ量（TAC）入力から再設定する
// ===========================================
function setThresholdByTAC() {
    if (app.documents.length && app.activeDocument.activeLayer.kind === LayerKind.THRESHOLD) {
        var layer = app.activeDocument.activeLayer;

        var match = layer.name.match(/TAC値[:：]\s*(\d+(?:\.\d+)?)%?/);
        var defaultValue = match ? match[1] : "350";

        var x = null;
        while (true) {
            var input = prompt("総インキ量を入力してください（1〜400％）", defaultValue);
            if (input === null) break;
            x = parseFloat(input);
            if (!isNaN(x) && x >= 1 && x <= 400) break;
            alert("1〜400 の数値を入力してください。");
        }

        if (x !== null) {
            var level = Math.round(255 * (1 - x / 400));

            var desc = new ActionDescriptor();
            var ref = new ActionReference();
            ref.putEnumerated(stringIDToTypeID("adjustmentLayer"), stringIDToTypeID("ordinal"), stringIDToTypeID("targetEnum"));
            desc.putReference(stringIDToTypeID("null"), ref);

            var toDesc = new ActionDescriptor();
            toDesc.putInteger(stringIDToTypeID("level"), level);
            desc.putObject(stringIDToTypeID("to"), stringIDToTypeID("thresholdClassEvent"), toDesc);

            executeAction(stringIDToTypeID("set"), desc, DialogModes.NO);

            layer.name = "TAC値：" + x + "%";
        }

    } else {
        alert("2階調化調整レイヤーを選択してください。");
    }
}

// ===========================================
// アクティブレイヤーの選択を指定位置に移動する
// 引数：0 = 最上部を選択、正数 = 上へ（前面側）選択移動、負数 = 下へ（背面側）選択移動
// ===========================================
function moveActiveLayerSelection(position) {
    var doc = app.activeDocument;
    var layers = getAllLayers(doc);
    var currentLayer = doc.activeLayer;
    var index = findLayerIndex(currentLayer, layers);

    if (index === -1) {
        alert("レイヤー位置を特定できません。");
        return;
    }

    if (position === 0) {
        doc.activeLayer = layers[0];
    } else {
        var targetIndex = index - position;
        if (targetIndex < 0) {
            targetIndex = 0;
        }
        if (targetIndex >= layers.length) {
            targetIndex = layers.length - 1;
        }
        doc.activeLayer = layers[targetIndex];
    }
}

// ===========================================
// 指定した名前と色でレイヤーグループを作成
// ===========================================
function makeLayerGroup(groupName, groupColorName) {
    var idMake = stringIDToTypeID("make");
    var desc = new ActionDescriptor();

    var refClass = new ActionReference();
    refClass.putClass(stringIDToTypeID("layerSection"));
    desc.putReference(stringIDToTypeID("null"), refClass);

    var refFrom = new ActionReference();
    refFrom.putEnumerated(
        stringIDToTypeID("layer"),
        stringIDToTypeID("ordinal"),
        stringIDToTypeID("targetEnum")
    );
    desc.putReference(stringIDToTypeID("from"), refFrom);

    var usingDesc = new ActionDescriptor();
    usingDesc.putString(stringIDToTypeID("name"), groupName);
    usingDesc.putEnumerated(
        stringIDToTypeID("color"),
        stringIDToTypeID("color"),
        stringIDToTypeID(groupColorName)
    );
    desc.putObject(stringIDToTypeID("using"), stringIDToTypeID("layerSection"), usingDesc);
    desc.putString(stringIDToTypeID("name"), groupName);

    executeAction(idMake, desc, DialogModes.NO);
}

// ===========================================
// 選択中のレイヤーグループを解除（ungroup）
// ===========================================
function ungroupSelectedLayers() {
    // var idUngroup = stringIDToTypeID("ungroupLayersEvent");
    // var desc = new ActionDescriptor();

    // var ref = new ActionReference();
    // ref.putEnumerated(
    //     stringIDToTypeID("layer"),
    //     stringIDToTypeID("ordinal"),
    //     stringIDToTypeID("targetEnum")
    // );
    // desc.putReference(stringIDToTypeID("null"), ref);

    // executeAction(idUngroup, desc, DialogModes.NO);

    var idungroupLayersEvent = stringIDToTypeID( "ungroupLayersEvent" );
    var desc308 = new ActionDescriptor();
    var idnull = stringIDToTypeID( "null" );
        var ref48 = new ActionReference();
        var idlayer = stringIDToTypeID( "layer" );
        var idordinal = stringIDToTypeID( "ordinal" );
        var idtargetEnum = stringIDToTypeID( "targetEnum" );
        ref48.putEnumerated( idlayer, idordinal, idtargetEnum );
    desc308.putReference( idnull, ref48 );
executeAction( idungroupLayersEvent, desc308, DialogModes.NO );
}

// ===========================================
// 全レイヤーリスト内でレイヤーのインデックスを見つける
// ===========================================
function findLayerIndex(targetLayer, layers) {
    for (var i = 0; i < layers.length; i++) {
        if (layers[i] === targetLayer) {
            return i;
        }
    }
    return -1;
}

// ===========================================
// 上から順に指定数の layerID を選択
// ===========================================
function selectLayerIDsFromTop(count) {
    var ids = getAllLayerIDs(app.activeDocument).slice(0, count);
    if (!(ids instanceof Array)) ids = [ids];

    var selectDesc = new ActionDescriptor();
    var selectRef = new ActionReference();

    for (var i = 0; i < ids.length; i++) {
        selectRef.putIdentifier(charIDToTypeID("Lyr "), ids[i]);
    }

    selectDesc.putReference(charIDToTypeID("null"), selectRef);
    selectDesc.putBoolean(charIDToTypeID("MkVs"), false);

    executeAction(charIDToTypeID("slct"), selectDesc, DialogModes.NO);
}

// ===========================================
// 単一レイヤーからlayerIDを取得
// ===========================================
function getLayerID(layer) {
    try {
        var ref = new ActionReference();
        ref.putIndex(charIDToTypeID("Lyr "), layer.itemIndex);
        var desc = executeActionGet(ref);
        return desc.getInteger(stringIDToTypeID("layerID"));
    } catch (e) {
        return -1;
    }
}

// ===========================================
// ドキュメント内の全レイヤーの layerID を上から順に返す
// ===========================================
function getAllLayerIDs(doc) {
    var ids = [];

    function collect(container) {
        for (var i = 0; i < container.layers.length; i++) {
            var layer = container.layers[i];
            if (layer.typename === "ArtLayer" || layer.typename === "LayerSet") {
                var id = getLayerID(layer);
                if (id !== -1) ids.push(id);
                if (layer.typename === "LayerSet") collect(layer);
            }
        }
    }

    collect(doc);
    return ids;
}

// ===========================================
// ドキュメント内の全レイヤーをフラットに取得する
// ===========================================
function getAllLayers(doc) {
    var layers = [];

    function collect(layerContainer) {
        for (var i = 0; i < layerContainer.layers.length; i++) {
            var layer = layerContainer.layers[i];
            if (layer.typename === "ArtLayer") {
                layers.push(layer);
            } else if (layer.typename === "LayerSet") {
                layers.push(layer);
                collect(layer);
            }
        }
    }

    collect(doc);
    return layers;
}

// ===========================================
// 指定した名前で新しいフォルダ（レイヤーグループ）を作成する
// ===========================================
function createGroup(name) {
    var doc = app.activeDocument;
    var group = doc.layerSets.add();
    group.name = name;
}

// ===========================================
// アクティブなレイヤーをクリッピングマスクにする
// ===========================================
function createClippingMask() {
    app.activeDocument.activeLayer.grouped = true;
}

// ===========================================
// 現在のドキュメントのカラーモードを判定して返す
// （"RGB" / "CMYK" / "Other" を返す）
// ===========================================
function getDocumentColorMode() {
    var mode = app.activeDocument.mode;
    if (mode == DocumentMode.RGB) {
        return "RGB";
    } else if (mode == DocumentMode.CMYK) {
        return "CMYK";
    } else {
        return "Other";
    }
}

// ===========================================
// 2階調化（Threshold）レイヤーを作成する
// ===========================================
function createThresholdLayer(level) {
    var idmake = stringIDToTypeID("make");
    var desc = new ActionDescriptor();

    var idnull = stringIDToTypeID("null");
    var ref = new ActionReference();
    var idadjustmentLayer = stringIDToTypeID("adjustmentLayer");
    ref.putClass(idadjustmentLayer);
    desc.putReference(idnull, ref);

    var idusing = stringIDToTypeID("using");
    var descUsing = new ActionDescriptor();

    var idtype = stringIDToTypeID("type");
    var descType = new ActionDescriptor();
    var idlevel = stringIDToTypeID("level");
    descType.putInteger(idlevel, (level !== undefined) ? level : 128);

    var idthresholdClassEvent = stringIDToTypeID("thresholdClassEvent");
    descUsing.putObject(idtype, idthresholdClassEvent, descType);

    desc.putObject(idusing, idadjustmentLayer, descUsing);

    executeAction(idmake, desc, DialogModes.NO);
}

// ===========================================
// Color Lookup調整レイヤーを作成し、ICCプロファイルを適用、レイヤー名を設定する
// ===========================================
function createColorLookupLayerWithICC(filePath, layerName) {
    try {
        var desc = new ActionDescriptor();
        var ref = new ActionReference();
        ref.putClass(stringIDToTypeID("adjustmentLayer"));
        desc.putReference(stringIDToTypeID("null"), ref);

        var descInner = new ActionDescriptor();
        descInner.putClass(stringIDToTypeID("type"), stringIDToTypeID("colorLookup"));
        desc.putObject(stringIDToTypeID("using"), stringIDToTypeID("adjustmentLayer"), descInner);

        executeAction(stringIDToTypeID("make"), desc, DialogModes.NO);

        var iccFile = new File(filePath);
        if (!iccFile.exists) {
            alert("指定されたICCファイルが存在しません: " + filePath);
            return;
        }

        var refSet = new ActionReference();
        refSet.putEnumerated(
            charIDToTypeID("AdjL"),
            charIDToTypeID("Ordn"),
            charIDToTypeID("Trgt")
        );

        var descSet = new ActionDescriptor();
        descSet.putReference(charIDToTypeID("null"), refSet);

        var descLookup = new ActionDescriptor();
        descLookup.putEnumerated(
            stringIDToTypeID("lookupType"),
            stringIDToTypeID("colorLookupType"),
            stringIDToTypeID("deviceLinkProfile")
        );
        descLookup.putString(charIDToTypeID("Nm  "), iccFile.name);

        iccFile.open("r");
        iccFile.encoding = "BINARY";
        var binData = iccFile.read();
        iccFile.close();

        descLookup.putData(stringIDToTypeID("profile"), binData);

        descSet.putObject(
            charIDToTypeID("T   "),
            stringIDToTypeID("colorLookup"),
            descLookup
        );

        executeAction(charIDToTypeID("setd"), descSet, DialogModes.NO);

        if (layerName) {
            app.activeDocument.activeLayer.name = layerName;
        }

    } catch (e) {
        alert("エラー: " + e);
    }
}

// ===========================================
// 選択レイヤーのブレンド条件（グレー）を設定する
// 引数: srcRangeArray, destRangeArray
// - srcRangeArray = [srcBlackMin, srcBlackMax, srcWhiteMin, srcWhiteMax]
// - destRangeArray = [destBlackMin, destBlackMax, destWhiteMin, destWhiteMax]
// ===========================================
function setLayerBlendRangeGrayFull(srcRangeArray, destRangeArray) {
    if (!srcRangeArray || !destRangeArray || srcRangeArray.length !== 4 || destRangeArray.length !== 4) {
        throw new Error("srcRangeArrayとdestRangeArrayにはそれぞれ4つの数値を指定してください。");
    }

    var desc = new ActionDescriptor();
    var ref = new ActionReference();
    ref.putEnumerated(stringIDToTypeID("layer"), stringIDToTypeID("ordinal"), stringIDToTypeID("targetEnum"));
    desc.putReference(stringIDToTypeID("null"), ref);

    var layerDesc = new ActionDescriptor();
    var blendRangeList = new ActionList();

    var grayChannelDesc = new ActionDescriptor();
    var channelRef = new ActionReference();
    channelRef.putEnumerated(stringIDToTypeID("channel"), stringIDToTypeID("channel"), stringIDToTypeID("gray"));
    grayChannelDesc.putReference(stringIDToTypeID("channel"), channelRef);

    // 現在のレイヤー
    grayChannelDesc.putInteger(stringIDToTypeID("srcBlackMin"), srcRangeArray[0]);
    grayChannelDesc.putInteger(stringIDToTypeID("srcBlackMax"), srcRangeArray[1]);
    grayChannelDesc.putInteger(stringIDToTypeID("srcWhiteMin"), srcRangeArray[2]);
    grayChannelDesc.putInteger(stringIDToTypeID("srcWhiteMax"), srcRangeArray[3]);

    // 下になっているレイヤー
    grayChannelDesc.putInteger(stringIDToTypeID("destBlackMin"), destRangeArray[0]);
    grayChannelDesc.putInteger(stringIDToTypeID("destBlackMax"), destRangeArray[1]);
    grayChannelDesc.putInteger(stringIDToTypeID("destWhiteMin"), destRangeArray[2]);
    grayChannelDesc.putInteger(stringIDToTypeID("destWhiteMax"), destRangeArray[3]);

    blendRangeList.putObject(stringIDToTypeID("blendRange"), grayChannelDesc);
    layerDesc.putList(stringIDToTypeID("blendRange"), blendRangeList);

    desc.putObject(stringIDToTypeID("to"), stringIDToTypeID("layer"), layerDesc);

    executeAction(stringIDToTypeID("set"), desc, DialogModes.NO);
}

// ===========================================
// アクティブレイヤーに単色塗りレイヤースタイルを適用する
// 引数:
// - colorMode: "RGB" または "CMYK"
// - colorArray: [R,G,B] または [C,M,Y,K]
// - blendMode: ブレンドモード（省略時は"normal"）
// ===========================================
function applySolidFillEffect(colorMode, colorArray, blendMode) {
    if (!colorMode || !colorArray || !(colorArray instanceof Array)) {
        throw new Error("colorMode と colorArray を正しく指定してください。");
    }

    var desc = new ActionDescriptor();
    var ref = new ActionReference();
    ref.putProperty(stringIDToTypeID("property"), stringIDToTypeID("layerEffects"));
    ref.putEnumerated(stringIDToTypeID("layer"), stringIDToTypeID("ordinal"), stringIDToTypeID("targetEnum"));
    desc.putReference(stringIDToTypeID("null"), ref);

    var layerEffectsDesc = new ActionDescriptor();
    layerEffectsDesc.putUnitDouble(stringIDToTypeID("scale"), stringIDToTypeID("percentUnit"), 100.0);

    var solidFillDesc = new ActionDescriptor();
    solidFillDesc.putBoolean(stringIDToTypeID("enabled"), true);
    solidFillDesc.putBoolean(stringIDToTypeID("present"), true);
    solidFillDesc.putBoolean(stringIDToTypeID("showInDialog"), true);

    solidFillDesc.putEnumerated(
        stringIDToTypeID("mode"),
        stringIDToTypeID("blendMode"),
        stringIDToTypeID(blendMode || "normal")
    );

    // buildColorDescriptor関数を使用
    var colorResult = buildColorDescriptor(colorMode, colorArray);
    solidFillDesc.putObject(stringIDToTypeID("color"), stringIDToTypeID(colorResult.colorType), colorResult.colorDesc);

    solidFillDesc.putUnitDouble(stringIDToTypeID("opacity"), stringIDToTypeID("percentUnit"), 100.0);

    layerEffectsDesc.putObject(stringIDToTypeID("solidFill"), stringIDToTypeID("solidFill"), solidFillDesc);
    desc.putObject(stringIDToTypeID("to"), stringIDToTypeID("layerEffects"), layerEffectsDesc);

    executeAction(stringIDToTypeID("set"), desc, DialogModes.NO);
}

// ===========================================
// ベタ塗りレイヤー（Solid Color Fill Layer）を作成する（RGB/CMYK対応）
// 引数:
// - colorMode: "RGB" または "CMYK"
// - colorArray: [R,G,B] または [C,M,Y,K]
// - name: レイヤー名（省略可）
// ===========================================
function createSolidColorLayer(colorMode, colorArray, name) {
    if (!colorMode || !colorArray || !(colorArray instanceof Array)) {
        throw new Error("colorMode と colorArray を正しく指定してください。");
    }

    var desc = new ActionDescriptor();
    var ref = new ActionReference();
    ref.putClass(stringIDToTypeID("contentLayer"));
    desc.putReference(stringIDToTypeID("null"), ref);

    var usingDesc = new ActionDescriptor();
    var typeDesc = new ActionDescriptor();

    // buildColorDescriptor関数を使用
    var colorResult = buildColorDescriptor(colorMode, colorArray);
    typeDesc.putObject(stringIDToTypeID("color"), stringIDToTypeID(colorResult.colorType), colorResult.colorDesc);

    usingDesc.putObject(stringIDToTypeID("type"), stringIDToTypeID("solidColorLayer"), typeDesc);
    desc.putObject(stringIDToTypeID("using"), stringIDToTypeID("contentLayer"), usingDesc);

    executeAction(stringIDToTypeID("make"), desc, DialogModes.NO);

    if (name) {
        app.activeDocument.activeLayer.name = name;
    }
}

// ===========================================
// colorModeとcolorArrayに応じたColor Descriptorを生成する
// 戻り値: { colorDesc: ActionDescriptor, colorType: "RGBColor" or "CMYKColorClass" }
// ===========================================
function buildColorDescriptor(colorMode, colorArray) {
    var colorDesc = new ActionDescriptor();

    if (colorMode === "RGB") {
        colorDesc.putDouble(stringIDToTypeID("red"),   colorArray[0] || 0);
        colorDesc.putDouble(stringIDToTypeID("green"), colorArray[1] || 0);
        colorDesc.putDouble(stringIDToTypeID("blue"),  colorArray[2] || 0);
        return { colorDesc: colorDesc, colorType: "RGBColor" };
    } else if (colorMode === "CMYK") {
        colorDesc.putDouble(stringIDToTypeID("cyan"),    colorArray[0] || 0);
        colorDesc.putDouble(stringIDToTypeID("magenta"), colorArray[1] || 0);
        colorDesc.putDouble(stringIDToTypeID("yellowColor"), colorArray[2] || 0);
        colorDesc.putDouble(stringIDToTypeID("black"),   colorArray[3] || 0);
        return { colorDesc: colorDesc, colorType: "CMYKColorClass" };
    } else {
        throw new Error("colorModeには 'RGB' または 'CMYK' を指定してください。");
    }
}