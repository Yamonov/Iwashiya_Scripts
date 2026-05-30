/*
<javascriptresource>
<name>Illustratorに合わせてリサイズ</name>
<category>YPresets</category>
</javascriptresource>

SCRIPTMETA-BEGIN
Script-ID=org.iwashi.Photoshop_Illustrator_Resize
Version=1.6.5
Meta-URL=https://github.com/Yamonov/Iwashiya_Scripts/tree/main/Photoshop
Name=Illustrator配置に合わせてリサイズ
Author=Murakami Yoshiteru
Release-Date=2026-05-13
Target-App=Photoshop
Edit-Password-SHA256=2mEtByWnFti5LI7V:7daee15078f71848a6d792e7c5f648b6d8a30a70fec73387b5a3267decde5b47
Description-BEGIN
Photoshopで開いている画像を、Illustratorドキュメント上の配置サイズに合わせてリサイズします。配置したIllustratorドキュメントを開いておき、Photoshopから実行してください。
拡張子やパスの違う画像ファイルでもリサイズできますが、同一性の担保はご自身で行ってください。
Description-END
SCRIPTMETA-END
*/

var YAMO_LOCALE_OVERRIDE = ""; // テスト時のみ "ja" または "en" を指定

function currentLocaleCode() {
    var rawLocale = YAMO_LOCALE_OVERRIDE;

    if (!rawLocale) {
        try {
            rawLocale = $.locale;
        } catch (e) {
            rawLocale = "";
        }
    }

    if (!rawLocale) {
        try {
            rawLocale = app.locale;
        } catch (e2) {
            rawLocale = "";
        }
    }

    rawLocale = rawLocale ? rawLocale.toString().toLowerCase() : "";

    if (rawLocale.indexOf("ja") === 0 || rawLocale.indexOf("japanese") !== -1) {
        return "ja";
    }
    if (rawLocale.indexOf("en") === 0 || rawLocale.indexOf("english") !== -1) {
        return "en";
    }

    return "ja";
}

function localText(jaText, enText) {
    return currentLocaleCode() === "en" ? enText : jaText;
}

var SCRIPT_META = readSelfHeaderMeta();
var SCRIPT_VERSION = formatScriptVersion(SCRIPT_META);
var HISTORY_NAME = localText("Illustratorに合わせてリサイズ処理", "Resize to Illustrator Placement");

function readSelfHeaderMeta() {
    var meta = {
        version: "",
        releaseDate: ""
    };
    var file = null;
    try {
        file = new File($.fileName);
        file.encoding = "BINARY";
        if (!file.open("r")) return meta;
        var source = file.read(1600);
        source = String(source || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
        meta.version = readHeaderMetaValue(source, "Version");
        meta.releaseDate = readHeaderMetaValue(source, "Release-Date");
    } catch (error) {}
    try {
        if (file) file.close();
    } catch (closeError) {}
    return meta;
}

function readHeaderMetaValue(source, key) {
    var match = String(source || "").match(new RegExp("^" + key + "=([^\\n]+)(?:\\n|$)", "m"));
    return match && match[1] ? String(match[1]).replace(/^\s+|\s+$/g, "") : "";
}

function formatScriptVersion(meta) {
    var version = meta && meta.version ? String(meta.version) : "";
    var releaseDate = meta && meta.releaseDate ? String(meta.releaseDate) : "";
    if (version && releaseDate) return "Ver." + version + localText("（", " (") + releaseDate + localText("）", ")");
    if (version) return "Ver." + version;
    return "";
}

// ==== 拡大・縮小の警告しきい値 ====
var efScaleMin = 0.9;
var efScaleMax = 1.1;
var scaleMax = 2;

// ==== ターゲット解像度候補 ====
var targetPPIList = [350, 400, 600, 1200];

// ==== CustomOptions（前回設定の保存/復元） ====
var PREF_ID = "com.yamo.psAiresize_v1";
var K_VER = stringIDToTypeID("version");
var K_RADIO_INDEX = stringIDToTypeID("radioIndex");
var K_UPSCALE = stringIDToTypeID("upscaleMethod");
var K_DOWNSCALE = stringIDToTypeID("downMethod");
var K_USE_PREV = stringIDToTypeID("usePrevSettings");
var SCHEMA_VERSION = 1;

var defaultsPrefs = {
    usePrev: false,
    radioIndex: 0,
    upscaleMethod: "deepUpscale",
    downMethod: "bicubic"
};
var SMART_OBJECT_INTERP_WARNING = localText(
    "【警告】\n　含まれているスマートオブジェクトは、ここでの指定と別に環境設定＞一般で指定したリサンプル方式でリサイズされます。合成エッジが変わるなど不具合が出る可能性があります。",
    "[Warning]\nSmart objects in the document are resized using the resampling method set in Preferences > General, separately from the setting here. This may cause issues such as changed compositing edges."
);

var __HISTORY_CTX__ = null;
var __HISTORY_DID_RUN__ = false;

function hasSmartObjectRecursive(container) {
    try {
        var layers = container.layers;
        for (var i = 0; i < layers.length; i++) {
            var layer = layers[i];
            if (layer.typename === "ArtLayer") {
                if (layer.kind === LayerKind.SMARTOBJECT) return true;
            } else if (layer.typename === "LayerSet") {
                if (hasSmartObjectRecursive(layer)) return true;
            }
        }
    } catch (error) {}
    return false;
}

function containsSmartObject(doc) {
    try {
        return hasSmartObjectRecursive(doc);
    } catch (error) {
        return false;
    }
}

function runWithHistory(historyName, fn, fnName) {
    var doc = app.activeDocument;
    var lastError = null;
    __HISTORY_DID_RUN__ = false;
    try {
        doc.suspendHistory(historyName, fnName);
        return {
            ok: true
        };
    } catch (error) {
        lastError = error;
        if (__HISTORY_DID_RUN__) {
            return {
                ok: false,
                error: error
            };
        }
    }
    try {
        fn();
        return {
            ok: true
        };
    } catch (directError) {
        lastError = directError;
    }
    return {
        ok: false,
        error: lastError
    };
}

function getHistoryStatusByName(name) {
    try {
        var doc = app.activeDocument;
        var hs = doc.historyStates;
        var activeIndex = -1;
        for (var i = 0; i < hs.length; i++) {
            if (hs[i] === doc.activeHistoryState) {
                activeIndex = i;
                break;
            }
        }
        var latestIndex = -1;
        for (var j = 0; j < hs.length; j++) {
            if (hs[j].name === name) latestIndex = j;
        }
        if (latestIndex < 0) return {
            exists: false
        };
        var status = (latestIndex === activeIndex) ? "active" : ((latestIndex < activeIndex) ? "applied" : "not_applied");
        return {
            exists: true,
            status: status,
            activeIndex: activeIndex,
            latestIndex: latestIndex
        };
    } catch (error) {
        return {
            exists: false
        };
    }
}

function performResizeFromCtx() {
    __HISTORY_DID_RUN__ = true;
    var ctx = __HISTORY_CTX__;
    if (!ctx) return;
    var doc = app.activeDocument;
    var newWidthPixels = ctx.newWidthPixels;
    var newHeightPixels = ctx.newHeightPixels;
    var targetPPI = ctx.targetPPI;
    var scaleRatio = ctx.scaleRatio;
    var upscaleMethod = ctx.upscaleMethod;
    var downscaleMethod = ctx.downscaleMethod;

    // 縮小/拡大でメソッドを分岐
    if (scaleRatio < 1) {
        if (downscaleMethod === "bicubic") {
            doc.resizeImage(UnitValue(newWidthPixels, "px"), UnitValue(newHeightPixels, "px"), targetPPI, ResampleMethod.BICUBIC);
        } else if (downscaleMethod === "nearestNeighbor") {
            doc.resizeImage(UnitValue(newWidthPixels, "px"), UnitValue(newHeightPixels, "px"), targetPPI, ResampleMethod.NEARESTNEIGHBOR);
        } else {
            // 万一未知の値の場合はBICUBIC
            doc.resizeImage(UnitValue(newWidthPixels, "px"), UnitValue(newHeightPixels, "px"), targetPPI, ResampleMethod.BICUBIC);
        }
    } else {
        // 拡大時は選択された拡大メソッドで分岐
        if (upscaleMethod === "deepUpscale") {
            // ActionDescriptorでディテールを保持2.0（推奨）
            var resizeDescriptor = new ActionDescriptor();
            resizeDescriptor.putUnitDouble(charIDToTypeID('Wdth'), charIDToTypeID('#Pxl'), newWidthPixels);
            resizeDescriptor.putUnitDouble(charIDToTypeID('Hght'), charIDToTypeID('#Pxl'), newHeightPixels);
            resizeDescriptor.putUnitDouble(charIDToTypeID('Rslt'), charIDToTypeID('#Rsl'), targetPPI);
            resizeDescriptor.putBoolean(stringIDToTypeID('scaleStyles'), true);
            resizeDescriptor.putEnumerated(charIDToTypeID('Intr'), charIDToTypeID('Intp'), stringIDToTypeID('deepUpscale'));
            executeAction(charIDToTypeID('ImgS'), resizeDescriptor, DialogModes.NO);
        } else if (upscaleMethod === "preserveDetails") {
            // ResampleMethod.PRESERVEDETAILS
            doc.resizeImage(UnitValue(newWidthPixels, "px"), UnitValue(newHeightPixels, "px"), targetPPI, ResampleMethod.PRESERVEDETAILS);
        } else if (upscaleMethod === "nearestNeighbor") {
            // ResampleMethod.NEARESTNEIGHBOR
            doc.resizeImage(UnitValue(newWidthPixels, "px"), UnitValue(newHeightPixels, "px"), targetPPI, ResampleMethod.NEARESTNEIGHBOR);
        } else {
            // 万一未知の値の場合はBICUBIC
            doc.resizeImage(UnitValue(newWidthPixels, "px"), UnitValue(newHeightPixels, "px"), targetPPI, ResampleMethod.BICUBIC);
        }
    }
    // 最後に100%表示に切り替え
    app.runMenuItem(stringIDToTypeID("actualPixels"));
}

function cloneDefaultPrefs() {
    return {
        usePrev: defaultsPrefs.usePrev,
        radioIndex: defaultsPrefs.radioIndex,
        upscaleMethod: defaultsPrefs.upscaleMethod,
        downMethod: defaultsPrefs.downMethod
    };
}

function loadPrefs() {
    var prefs = cloneDefaultPrefs();
    try {
        var descriptor = app.getCustomOptions(PREF_ID);
        if (descriptor.hasKey(K_USE_PREV)) prefs.usePrev = descriptor.getBoolean(K_USE_PREV);
        if (descriptor.hasKey(K_RADIO_INDEX)) {
            var index = descriptor.getInteger(K_RADIO_INDEX);
            if (index >= 0 && index < targetPPIList.length) prefs.radioIndex = index;
        }
        if (descriptor.hasKey(K_UPSCALE)) prefs.upscaleMethod = descriptor.getString(K_UPSCALE);
        if (descriptor.hasKey(K_DOWNSCALE)) prefs.downMethod = descriptor.getString(K_DOWNSCALE);
    } catch (error) {
        // 初回起動時や設定破損時は既定値を使用
    }
    return prefs;
}

function savePrefs(prefs) {
    var descriptor = new ActionDescriptor();
    descriptor.putInteger(K_VER, SCHEMA_VERSION);
    descriptor.putBoolean(K_USE_PREV, !!prefs.usePrev);
    descriptor.putInteger(K_RADIO_INDEX, Math.max(0, Math.min(targetPPIList.length - 1, prefs.radioIndex)));
    descriptor.putString(K_UPSCALE, String(prefs.upscaleMethod));
    descriptor.putString(K_DOWNSCALE, String(prefs.downMethod));
    app.putCustomOptions(PREF_ID, descriptor, true);
}

// usePrev フラグのみを保存（他の設定値は維持）
function saveUsePrevOnly(flag) {
    var currentPrefs = loadPrefs();
    savePrefs({
        usePrev: !!flag,
        radioIndex: currentPrefs.radioIndex,
        upscaleMethod: currentPrefs.upscaleMethod,
        downMethod: currentPrefs.downMethod
    });
}

function modeToString(documentMode) {
    switch (documentMode) {
        case DocumentMode.BITMAP:
            return "Bitmap";
        case DocumentMode.GRAYSCALE:
            return "Grayscale";
        case DocumentMode.INDEXEDCOLOR:
            return "Indexed";
        case DocumentMode.RGB:
            return "RGB";
        case DocumentMode.CMYK:
            return "CMYK";
        case DocumentMode.LAB:
            return "Lab";
        case DocumentMode.MULTICHANNEL:
            return "Multichannel";
        case DocumentMode.DUOTONE:
            return "Duotone";
        default:
            return "Unknown";
    }
}

function getLinkIssueMessage(candidate) {
    if (!candidate) return "";
    var linkState = candidate.linkState ? String(candidate.linkState) : "";
    if (linkState === "missing" || linkState === "noData") {
        return localText("リンク切れの画像が含まれています。処理を中止します。", "A missing linked image is included. Processing will stop.");
    }
    if (linkState === "modified" || linkState === "outdated") {
        return localText("未更新のリンク画像が含まれています。処理を中止します。", "An outdated linked image is included. Processing will stop.");
    }
    if (linkState === "ok") return "";

    var linkStatus = Number(candidate.linkStatus);
    if (linkStatus === 1) {
        return localText("リンク切れの画像が含まれています。処理を中止します。", "A missing linked image is included. Processing will stop.");
    }
    if (linkStatus === 2 || linkStatus === 3) {
        return localText("未更新のリンク画像が含まれています。処理を中止します。", "An outdated linked image is included. Processing will stop.");
    }
    return "";
}

function validateLinkItems(items) {
    for (var i = 0; i < items.length; i++) {
        var message = getLinkIssueMessage(items[i]);
        if (message) {
            alert(message);
            return false;
        }
    }
    return true;
}

function parseBridgeTalkJson(responseText, rawResponse, appLabel) {
    var normalized = String(responseText || "").replace(/^\uFEFF/, "").replace(/^\s+|\s+$/g, "");
    try {
        return JSON.parse(normalized);
    } catch (jsonError) {
        try {
            return eval("(" + normalized + ")");
        } catch (evalError) {
            alert(appLabel + localText("応答の解析に失敗しました。", " response could not be parsed.") + "\nraw: " + rawResponse);
            return null;
        }
    }
}

function buildPaddedLabel(text) {
    var pad = "　";
    return pad + text + pad;
}

function pickLabelByValue(value, values, labels, fallback) {
    for (var i = 0; i < values.length; i++) {
        if (values[i] === value) return labels[i];
    }
    return fallback;
}

function createWarningBag() {
    return {
        redBold: [],
        defaultBold: [],
        defaultNormal: []
    };
}

function addWarning(bag, style, message) {
    if (!message || !bag || !bag[style]) return;
    bag[style].push(String(message));
}

function setMessageRow(control, message) {
    var hasMessage = !!message;
    control.text = hasMessage ? message : "";
    try {
        control.visible = hasMessage;
        control.minimumSize.height = 0;
        control.preferredSize.height = hasMessage ? -1 : 0;
        control.maximumSize.height = hasMessage ? 10000 : 0;
    } catch (error) {}
}

function renderWarningRows(rows, bag, skipRedraw, dialog) {
    setMessageRow(rows.redBold, bag.redBold.join("\n"));
    setMessageRow(rows.defaultBold, bag.defaultBold.join("\n"));
    setMessageRow(rows.defaultNormal, bag.defaultNormal.join("\n"));
    if (!skipRedraw) {
        try {
            dialog.layout.layout(true);
            dialog.update();
        } catch (error) {}
    }
}

// ==== ブラウザでURLを開くヘルパー関数 ====
function openURLInBrowser(url) {
    if (!url) return;
    try {
        var os = $.os.toLowerCase();
        if (os.indexOf("mac") >= 0) {
            app.system('/usr/bin/open "' + url + '"');
        } else if (os.indexOf("win") >= 0) {
            app.system('cmd.exe /c start "" "' + url + '"');
        } else {
            alert(localText("未対応OSです。", "Unsupported OS.") + "\n" + url);
        }
    } catch (error) {
        alert(localText("ブラウザを開けませんでした。", "Could not open the browser.") + "\n" + error);
    }
}

function toSourceLiteral(value) {
    if (value === null) return "null";
    if (typeof value === "undefined") return "undefined";
    var valueType = typeof value;
    if (valueType === "string") {
        return '"' + String(value)
            .replace(/\\/g, "\\\\")
            .replace(/"/g, '\\"')
            .replace(/\r/g, "\\r")
            .replace(/\n/g, "\\n")
            .replace(/\t/g, "\\t")
            .replace(/\f/g, "\\f")
            .replace(/\u0008/g, "\\b") + '"';
    }
    if (valueType === "number" || valueType === "boolean") {
        return String(value);
    }
    if (value instanceof Array) {
        var arrayParts = [];
        for (var arrayIndex = 0; arrayIndex < value.length; arrayIndex++) {
            arrayParts.push(toSourceLiteral(value[arrayIndex]));
        }
        return "[" + arrayParts.join(",") + "]";
    }
    var objectParts = [];
    for (var key in value) {
        if (!value.hasOwnProperty(key)) continue;
        objectParts.push(key + ":" + toSourceLiteral(value[key]));
    }
    return "({" + objectParts.join(",") + "})";
}

function sendBridgeTalkAndWait(target, body, timeoutMs) {
    var responseBody = null;
    var errorBody = null;
    var bridgeTalk = new BridgeTalk();
    bridgeTalk.target = target;
    bridgeTalk.body = body;
    bridgeTalk.onResult = function(resultEvent) {
        responseBody = resultEvent.body;
    };
    bridgeTalk.onError = function(errorEvent) {
        errorBody = errorEvent && errorEvent.body ? errorEvent.body : "unknown";
    };
    try {
        bridgeTalk.timeout = Math.max(1, Math.round((timeoutMs || 30000) / 1000));
    } catch (error) {}
    bridgeTalk.send();

    var startedAt = new Date().getTime();
    var waitMs = timeoutMs || 30000;
    while (responseBody === null && errorBody === null && (new Date().getTime() - startedAt) < waitMs) {
        try {
            BridgeTalk.pump();
        } catch (error) {}
        $.sleep(50);
    }
    if (responseBody !== null) {
        return {
            ok: true,
            body: responseBody
        };
    }
    if (errorBody !== null) {
        return {
            ok: false,
            error: errorBody
        };
    }
    return {
        ok: false,
        error: localText("タイムアウト", "Timeout")
    };
}

function buildIllustratorChooserPayload(items, initialPlacedIndex, options) {
    var dialogOptions = options || {};

    function encodeChooserText(text) {
        return encodeURI(String(text || ""));
    }

    function encodeChooserItems(sourceItems) {
        var encodedItems = [];
        var itemList = sourceItems || [];
        for (var i = 0; i < itemList.length; i++) {
            var item = itemList[i] || {};
            var encodedItem = {};
            for (var key in item) {
                if (!item.hasOwnProperty(key)) continue;
                encodedItem[key] = item[key];
            }
            encodedItem.displayFileName = encodeChooserText(item.displayFileName || item.fileName || "");
            encodedItem.displayFolderPath = encodeChooserText(item.displayFolderPath || item.folderPath || "");
            encodedItems.push(encodedItem);
        }
        return encodedItems;
    }

    return {
        items: encodeChooserItems(items),
        initialPlacedIndex: initialPlacedIndex,
        title: dialogOptions.title || localText("リンクを選択", "Select Link"),
        messageLine1: dialogOptions.messageLine1 || "",
        messageLine2: dialogOptions.messageLine2 || "",
        messageLine3: dialogOptions.messageLine3 || "",
        photoshopPath: encodeChooserText(dialogOptions.photoshopPath || ""),
        photoshopLongPixels: dialogOptions.photoshopLongPixels || 0
    };
}

function activatePhotoshopWindow() {
    try {
        BridgeTalk.bringToFront("photoshop");
    } catch (error) {}
    try {
        app.bringToFront();
    } catch (error) {}
}

function buildDisplayPathForUI(pathText) {
    var value = String(pathText || "");
    var isWindows = $.os.indexOf("Windows") >= 0;
    try {
        value = decodeURI(value);
    } catch (error) {}
    if (isWindows) {
        value = normalizeDisplaySlashes(value, "/");
        value = value.split("/").join("\\");
    } else {
        value = value.split("\\ ").join(" ");
    }
    return value;
}

function normalizeDisplaySlashes(text, separator) {
    var value = String(text || "");
    var normalized = "";
    var lastWasSeparator = false;
    var slashChar = separator || "/";
    for (var i = 0; i < value.length; i++) {
        var ch = value.charAt(i);
        var isSeparator = (ch === "/") || (ch === "\\") || (ch === "¥") || (ch === "￥") || (ch === "＼");
        if (isSeparator) {
            if (!lastWasSeparator) {
                normalized += slashChar;
                lastWasSeparator = true;
            }
        } else {
            normalized += ch;
            lastWasSeparator = false;
        }
    }
    return normalized;
}

function showFallbackLinkConfirmDialog(options) {
    activatePhotoshopWindow();
    var items = (options && options.items && options.items.length) ? options.items : [];
    var isSingleItem = items.length === 1;
    var photoshopFileName = String((options && options.photoshopFileName) || "");
    var photoshopPath = String((options && options.photoshopPath) || "");
    var hasFolderDifference = !!(options && options.hasFolderDifference);
    var hasExtensionDifference = !!(options && options.hasExtensionDifference);

    function decodeDialogText(text) {
        return buildDisplayPathForUI(text);
    }

    function splitDisplayPathInfo(pathText, fallbackFileName) {
        var value = decodeDialogText(pathText);
        var fallbackName = decodeDialogText(fallbackFileName);
        var slashIndex = Math.max(value.lastIndexOf("/"), value.lastIndexOf("\\"));
        if (slashIndex >= 0) {
            return {
                fileName: value.substring(slashIndex + 1) || fallbackName,
                folderPath: value.substring(0, slashIndex)
            };
        }
        return {
            fileName: fallbackName || value,
            folderPath: value && fallbackName && value !== fallbackName ? value : ""
        };
    }

    function addLabeledTextRow(parent, labelText, valueText, labelWidth, valueWidth) {
        var row = parent.add("group");
        row.orientation = "row";
        row.alignChildren = ["left", "center"];
        row.spacing = 0;
        var label = row.add("statictext", undefined, labelText);
        label.minimumSize.width = labelWidth;
        label.maximumSize.width = labelWidth;
        var value = row.add("statictext", undefined, valueText);
        value.minimumSize.width = valueWidth;
        return {
            row: row,
            label: label,
            value: value
        };
    }

    var dialog = new Window("dialog", localText("リンク確認", "Confirm Link"));
    dialog.orientation = "column";
    dialog.alignChildren = ["fill", "top"];
    dialog.spacing = 10;
    dialog.margins = 16;

    var line1 = dialog.add("statictext", undefined, localText("完全に一致するリンクがありません。", "No exact matching link was found."));
    line1.minimumSize.width = 360;
    var line1Detail = dialog.add("statictext", undefined, buildNameOnlyMessageLine1(hasFolderDifference, hasExtensionDifference));
    line1Detail.minimumSize.width = 360;

    if (isSingleItem) {
        var singleItem = items[0];
        var labelWidth = 80;
        var valueWidth = 360;
        var photoshopPathInfo = splitDisplayPathInfo(photoshopPath, photoshopFileName);
        var linkFileNameText = decodeDialogText(singleItem && singleItem.displayFileName ? singleItem.displayFileName : singleItem.fileName);
        var linkPathText = decodeDialogText(singleItem && singleItem.displayFolderPath ? singleItem.displayFolderPath : singleItem.folderPath);

        var photoshopPanel = dialog.add("panel", undefined, localText("Photoshop側", "Photoshop Side"));
        photoshopPanel.orientation = "column";
        photoshopPanel.alignChildren = ["fill", "top"];
        photoshopPanel.margins = 12;
        addLabeledTextRow(photoshopPanel, localText("ファイル名：", "File name: "), photoshopPathInfo.fileName, labelWidth, valueWidth);
        addLabeledTextRow(photoshopPanel, localText("パス名：", "Path: "), photoshopPathInfo.folderPath, labelWidth, valueWidth);

        var appPanel = dialog.add("panel", undefined, localText("Illustrator側", "Illustrator Side"));
        appPanel.orientation = "column";
        appPanel.alignChildren = ["fill", "top"];
        appPanel.margins = 12;
        addLabeledTextRow(appPanel, localText("ファイル名：", "File name: "), linkFileNameText, labelWidth, valueWidth);
        addLabeledTextRow(appPanel, localText("パス名：", "Path: "), linkPathText, labelWidth, valueWidth);
        var line4 = dialog.add("statictext", undefined, localText("の情報を使用しますか？", "Use this information?"));
        line4.minimumSize.width = 520;
    } else {
        var multiLine = dialog.add("statictext", undefined, localText("複数の候補があります。", "There are multiple candidates."));
        multiLine.minimumSize.width = 360;
    }

    var buttonGroup = dialog.add("group");
    buttonGroup.alignment = ["right", "center"];
    var cancelButton = buttonGroup.add("button", undefined, localText("キャンセル", "Cancel"), { name: "cancel" });
    var checkButton = buttonGroup.add("button", undefined, localText("Illustratorで確認", "Check in Illustrator"));
    var useButton = null;
    if (isSingleItem) {
        useButton = buttonGroup.add("button", undefined, localText("これを使用", "Use This"), { name: "ok" });
        dialog.defaultElement = useButton;
    } else {
        dialog.defaultElement = checkButton;
    }
    dialog.cancelElement = cancelButton;

    cancelButton.onClick = function() {
        dialog.close(0);
    };
    checkButton.onClick = function() {
        dialog.close(2);
    };
    if (useButton) {
        useButton.onClick = function() {
            dialog.close(1);
        };
    }

    try {
        dialog.center();
    } catch (error) {}

    var dialogResult = dialog.show();
    if (dialogResult === 1 || dialogResult === 2) {
        try {
            app.refresh();
        } catch (error) {}
    }
    if (dialogResult === 1) return "use";
    if (dialogResult === 2) return "check";
    return "cancel";
}

function buildNameOnlyMessageLine1(hasFolderDifference, hasExtensionDifference) {
    if (hasFolderDifference && hasExtensionDifference) {
        return localText("拡張子とパスが異なる画像がありました。", "An image with a different extension and path was found.");
    }
    if (hasExtensionDifference) {
        return localText("拡張子が異なる画像がありました。", "An image with a different extension was found.");
    }
    if (hasFolderDifference) {
        return localText("パスが異なる画像がありました。", "An image with a different path was found.");
    }
    return localText("同じ名前の画像が見つかりました。", "An image with the same name was found.");
}

function buildIllustratorNoMatchDebugMessage(parsedObject) {
    var lines = [localText("Illustratorドキュメント内に一致するリンク画像が見つかりません。", "No matching linked image was found in the Illustrator document.")];
    if (!parsedObject) return lines.join("\n");

    var target = parsedObject.debugTarget || {};
    lines.push("");
    lines.push(localText("[Photoshop画像]", "[Photoshop Image]"));
    lines.push(localText("ファイル名: ", "File name: ") + String(target.fileName || ""));
    lines.push(localText("ベース名: ", "Base name: ") + String(target.baseName || ""));
    lines.push(localText("拡張子: ", "Extension: ") + String(target.extension || ""));
    lines.push(localText("フォルダ: ", "Folder: ") + String(target.folderPath || ""));
    lines.push(localText("パス: ", "Path: ") + String(target.pathFs || ""));

    var items = (parsedObject.debugItems && parsedObject.debugItems.length) ? parsedObject.debugItems : [];
    lines.push("");
    lines.push(localText("[Illustratorリンク候補]", "[Illustrator Link Candidates]"));
    if (!items.length) {
        lines.push(localText("候補なし", "No candidates"));
        return lines.join("\n");
    }

    var maxCount = Math.min(items.length, 10);
    for (var i = 0; i < maxCount; i++) {
        var item = items[i] || {};
        lines.push(
            (i + 1) + ". " +
            localText("ファイル名=", "file name=") + String(item.fileName || "") +
            localText(" / ベース名=", " / base name=") + String(item.baseName || "") +
            localText(" / 拡張子=", " / extension=") + String(item.extension || "") +
            localText(" / フォルダ=", " / folder=") + String(item.folderPath || "")
        );
    }
    if (items.length > maxCount) {
        lines.push(localText("... 他 ", "... plus ") + String(items.length - maxCount) + localText(" 件", " more"));
    }
    return lines.join("\n");
}

function chooseIllustratorItemSync(payload) {
    var body = "(" +
        "function(){" +
        "var remoteLocaleCode = " + toSourceLiteral(currentLocaleCode()) + ";" +
        "function remoteText(jaText, enText) { return remoteLocaleCode === 'en' ? enText : jaText; }" +
        illustratorShowLinkChooser.toString() + "\n" +
        "return illustratorShowLinkChooser(" + toSourceLiteral(payload) + ");" +
        "}" +
        ")();";
    try {
        BridgeTalk.bringToFront("illustrator");
    } catch (error) {}
    var bridgeTalkResult = sendBridgeTalkAndWait("illustrator", body, 300000);
    activatePhotoshopWindow();
    if (!bridgeTalkResult.ok) {
        alert(localText("Illustratorとの通信エラー: ", "Communication error with Illustrator: ") + bridgeTalkResult.error);
        return null;
    }
    if (!bridgeTalkResult.body || bridgeTalkResult.body == "null") {
        return null;
    }
    return parseBridgeTalkJson(bridgeTalkResult.body, bridgeTalkResult.body, "Illustrator");
}

function illustratorShowLinkChooser(payload) {
    if (app.documents.length === 0) return "null";

    var doc = app.activeDocument;
    var items = (payload && payload.items && payload.items.length) ? payload.items : null;
    if (!items) return "null";
    try {
        BridgeTalk.bringToFront("illustrator");
    } catch (error) {}
    try {
        app.bringToFront();
    } catch (error) {}

    function decodeDisplayText(text) {
        var value = String(text || "");
        try {
            value = decodeURI(value);
        } catch (error) {}
        return value;
    }

    function getCandidateDisplayInfo(candidate, index) {
        return {
            fileName: candidate && candidate.displayFileName ? decodeDisplayText(candidate.displayFileName) : (candidate && candidate.fileName ? decodeDisplayText(candidate.fileName) : (remoteText("リンク ", "Link ") + (index + 1))),
            folderPath: candidate && candidate.displayFolderPath ? decodeDisplayText(candidate.displayFolderPath) : (candidate && candidate.folderPath ? decodeDisplayText(candidate.folderPath) : remoteText("(不明)", "(Unknown)"))
        };
    }

    function buildLabel(candidate, index) {
        var indexText = String(index + 1);
        if (indexText.length < 2) indexText = "0" + indexText;
        var displayInfo = getCandidateDisplayInfo(candidate, index);
        var nameText = displayInfo.fileName;
        var folderText = displayInfo.folderPath;
        return indexText + "　" + nameText + "　" + folderText;
    }

    function findPlacedItem(placedIndex) {
        var normalizedIndex = Number(placedIndex);
        if (!isFinite(normalizedIndex)) return null;
        normalizedIndex = Math.floor(normalizedIndex);
        if (normalizedIndex < 0 || normalizedIndex >= doc.placedItems.length) return null;
        try {
            return doc.placedItems[normalizedIndex];
        } catch (error) {
            return null;
        }
    }

    function centerViewOnItem(targetItem) {
        var targetBounds = null;
        try {
            targetBounds = targetItem.visibleBounds;
        } catch (error) {
            targetBounds = null;
        }
        if (!targetBounds || targetBounds.length < 4) {
            try {
                targetBounds = targetItem.geometricBounds;
            } catch (error) {
                targetBounds = null;
            }
        }
        if (!targetBounds || targetBounds.length < 4) return;
        try {
            var activeView = doc.activeView;
            var centerX = (targetBounds[0] + targetBounds[2]) / 2;
            var centerY = (targetBounds[1] + targetBounds[3]) / 2;
            activeView.centerPoint = [centerX, centerY];
        } catch (error) {}
    }

    function focusCandidate(candidate) {
        var targetItem = findPlacedItem(candidate ? candidate.placedIndex : null);
        if (!targetItem) return;
        try {
            doc.selection = null;
        } catch (error) {}
        try {
            doc.selection = [targetItem];
        } catch (error) {}
        try {
            targetItem.selected = true;
        } catch (error) {}
        centerViewOnItem(targetItem);
        try {
            app.redraw();
        } catch (error) {}
    }

    function updateDetailText(detailControls, candidate) {
        if (!detailControls) return;
        var photoshopPathText = decodeDisplayText((payload && payload.photoshopPath) ? payload.photoshopPath : "");
        var photoshopLongPixels = Number((payload && payload.photoshopLongPixels) ? payload.photoshopLongPixels : 0) || 0;
        if (!candidate) {
            detailControls.folderText.text = "";
            detailControls.statusText.text = "";
            return;
        }
        var longSidePt = Number(candidate.longSidePt) || 0;
        var effectivePpi = (photoshopLongPixels > 0 && longSidePt > 0) ? (photoshopLongPixels * 72 / longSidePt) : NaN;
        detailControls.folderText.text = remoteText("Photoshop画像パス：", "Photoshop image path: ") + (photoshopPathText || remoteText("(不明)", "(Unknown)"));
        detailControls.statusText.text = remoteText("選択した配置サイズでのppi：", "PPI at selected placed size: ") + (isFinite(effectivePpi) ? effectivePpi.toFixed(2) : "-");
    }

    var dialog = new Window("dialog", (payload && payload.title) ? payload.title : remoteText("リンクを選択", "Select Link"));
    dialog.orientation = "column";
    dialog.alignChildren = ["fill", "top"];
    dialog.spacing = 8;
    dialog.margins = 12;

    function addMessageLine(text) {
        if (!text) return null;
        var line = dialog.add("statictext", undefined, text);
        line.minimumSize.width = 820;
        return line;
    }

    addMessageLine(payload && payload.messageLine1);
    addMessageLine(payload && payload.messageLine2);
    addMessageLine(payload && payload.messageLine3);

    var infoText = dialog.add("statictext", undefined, remoteText("候補数: ", "Candidates: ") + items.length);
    infoText.minimumSize.width = 820;

    var listBox = dialog.add("listbox", undefined, [], {
        multiselect: false
    });
    listBox.preferredSize = [820, 260];

    for (var itemIndex = 0; itemIndex < items.length; itemIndex++) {
        var listItem = listBox.add("item", buildLabel(items[itemIndex], itemIndex));
        listItem.candidate = items[itemIndex];
    }

    var detailGroup = dialog.add("group");
    detailGroup.orientation = "column";
    detailGroup.alignChildren = ["fill", "top"];
    detailGroup.minimumSize.width = 820;

    var folderText = detailGroup.add("statictext", undefined, "");
    folderText.minimumSize.width = 820;
    var statusText = detailGroup.add("statictext", undefined, "");
    statusText.minimumSize.width = 820;
    var detailText = {
        folderText: folderText,
        statusText: statusText
    };

    var initialListIndex = 0;
    if (payload && payload.initialPlacedIndex != null) {
        for (var initialIndex = 0; initialIndex < items.length; initialIndex++) {
            if (Number(items[initialIndex].placedIndex) === Number(payload.initialPlacedIndex)) {
                initialListIndex = initialIndex;
                break;
            }
        }
    }
    if (listBox.items.length > 0) {
        listBox.selection = listBox.items[initialListIndex];
        updateDetailText(detailText, listBox.selection.candidate);
    }

    listBox.onChange = function() {
        if (!this.selection) return;
        var candidate = this.selection.candidate;
        updateDetailText(detailText, candidate);
        focusCandidate(candidate);
    };

    dialog.onShow = function() {
        try {
            BridgeTalk.bringToFront("illustrator");
        } catch (error) {}
        try {
            app.bringToFront();
        } catch (error) {}
        if (!listBox.selection) return;
        focusCandidate(listBox.selection.candidate);
    };

    dialog.preferredSize = [860, 430];

    var buttonGroup = dialog.add("group");
    buttonGroup.orientation = "row";
    buttonGroup.alignment = ["right", "center"];
    var cancelButton = buttonGroup.add("button", undefined, remoteText("キャンセル", "Cancel"), {
        name: "cancel"
    });
    var okButton = buttonGroup.add("button", undefined, "OK", {
        name: "ok"
    });

    cancelButton.onClick = function() {
        dialog.close(0);
    };
    okButton.onClick = function() {
        if (!listBox.selection) {
            alert(remoteText("候補を選択してください。", "Select a candidate."));
            return;
        }
        dialog.close(1);
    };

    var dialogResult = dialog.show();
    if (dialogResult !== 1 || !listBox.selection) {
        return "null";
    }
    return listBox.selection.candidate.toSource();
}

// ==== Illustrator側でアイテムを選択する関数（BridgeTalk経由） ====
function selectInIllustrator(handle) {
    function illustratorSelectByHandle(handle) {
        if (app.documents.length === 0) return;
        var doc = app.activeDocument;
        try {
            app.bringToFront();
        } catch (error) {}
        doc.selection = null;

        var targetItem = null;

        function normalizeUriPath(filePath) {
            if (!filePath) return "";
            var p = String(filePath);
            try {
                p = File(decodeURI(p)).absoluteURI;
            } catch (error) {}
            if ($.os.indexOf("Windows") >= 0) p = p.toLowerCase();
            return p;
        }

        // placedIndex のみで検索
        var directPlacedIndex = Number(handle.placedIndex);
        if (isFinite(directPlacedIndex) && directPlacedIndex >= 0 && directPlacedIndex < doc.placedItems.length) {
            try {
                targetItem = doc.placedItems[Math.floor(directPlacedIndex)];
            } catch (error) {
                targetItem = null;
            }
        }

        // fsName で検索（フォールバック）
        function normalizeFsPath(filePath) {
            if (!filePath) return "";
            var p = String(filePath);
            try {
                p = File(p).fsName;
            } catch (error) {}
            if ($.os.indexOf('Windows') >= 0) {
                if (p.length >= 4 && p.substring(0, 4) === "\\\\?\\") {
                    var rest = p.substring(4);
                    if (rest.length >= 4 && rest.substring(0, 4).toLowerCase() === "unc\\") p = "\\\\" + rest.substring(4);
                    else p = rest;
                }
                p = p.split('/').join('\\');
                p = p.replace(/\\+/g, "\\");
                p = p.toLowerCase();
            }
            return p;
        }
        if (!targetItem && handle.pathUri) {
            var targetUri = normalizeUriPath(handle.pathUri);
            for (var uriIndex = 0; uriIndex < doc.placedItems.length; uriIndex++) {
                var uriItem = doc.placedItems[uriIndex];
                var itemUri = null;
                try {
                    if (uriItem.file && uriItem.file.absoluteURI) itemUri = uriItem.file.absoluteURI;
                } catch (error) {
                    itemUri = null;
                }
                if (itemUri && normalizeUriPath(itemUri) === targetUri) {
                    targetItem = uriItem;
                    break;
                }
            }
        }
        if (!targetItem && handle.pathFs) {
            for (var i = 0; i < doc.placedItems.length; i++) {
                var item = doc.placedItems[i];
                var itemPath = null;
                try {
                    if (item.file && item.file.fsName) itemPath = item.file.fsName;
                } catch (error) {
                    itemPath = null;
                }
                if (itemPath && normalizeFsPath(itemPath) === normalizeFsPath(decodeURI(handle.pathFs))) {
                    targetItem = item;
                    break;
                }
            }
        }

        if (!targetItem) return;

        // 選択と中央表示
        try {
            doc.selection = [targetItem];
        } catch (error) {}
        try {
            targetItem.selected = true;
        } catch (error) {}
        try {
            var visibleBounds = targetItem.visibleBounds;
            if ((!visibleBounds || visibleBounds.length < 4) && targetItem.geometricBounds) {
                visibleBounds = targetItem.geometricBounds;
            }
            if (visibleBounds && visibleBounds.length >= 4) {
                var centerX = (visibleBounds[0] + visibleBounds[2]) / 2;
                var centerY = (visibleBounds[1] + visibleBounds[3]) / 2;
                var view = doc.activeView;
                view.centerPoint = [centerX, centerY];
            }
        } catch (error) {
        }
        try {
            app.redraw();
        } catch (error) {}
    }

    var chooserPayload = buildIllustratorChooserPayload(handle && handle.items ? handle.items : [], handle ? handle.placedIndex : null, {
        title: localText("Illustratorでリンクを選択", "Select Link in Illustrator"),
        messageLine1: localText("候補が複数あります。", "There are multiple candidates."),
        messageLine2: localText("選ぶと該当リンクを中央表示します。", "Selecting one centers the corresponding link."),
        photoshopPath: handle && handle.pathFs ? String(handle.pathFs) : "",
        photoshopLongPixels: handle && handle.photoshopLongPixels ? handle.photoshopLongPixels : 0
    });
    var bridgeTalk = new BridgeTalk();
    bridgeTalk.target = "illustrator";
    bridgeTalk.body = "(" +
        "function(){" +
        "var remoteLocaleCode = " + toSourceLiteral(currentLocaleCode()) + ";" +
        "function remoteText(jaText, enText) { return remoteLocaleCode === 'en' ? enText : jaText; }" +
        illustratorShowLinkChooser.toString() + "\n" +
        illustratorSelectByHandle.toString() + "\n" +
        "var __handle = " + toSourceLiteral({
            placedIndex: handle && handle.placedIndex != null ? handle.placedIndex : null,
            pathUri: String((handle && handle.pathUri) || ""),
            pathFs: encodeURI(String((handle && handle.pathFs) || "")),
            items: (handle && handle.items) ? handle.items : []
        }) + ";" +
        "if (__handle.items && __handle.items.length > 1) {" +
        "illustratorShowLinkChooser(" + toSourceLiteral(chooserPayload) + ");" +
        "} else {" +
        "illustratorSelectByHandle(__handle);" +
        "}" +
        "}" +
        ")();";
    bridgeTalk.onError = function(errorEvent) {
        alert(localText("Illustrator BridgeTalk エラー: ", "Illustrator BridgeTalk error: ") + errorEvent.body);
    };
    bridgeTalk.onResult = function(resultEvent) {
        try {
            BridgeTalk.bringToFront("illustrator");
        } catch (error) {}
    };
    try {
        BridgeTalk.bringToFront("illustrator");
    } catch (error) {}
    bridgeTalk.send();
}

// ==== メインエントリ ====
function main() {
    if (!app.documents.length) {
        alert(localText("開いているドキュメントがありません。", "No document is open."));
        return;
    }
    var activeDoc = app.activeDocument;
    var imagePath = "";
    var imageFolderPath = "";
    var imageUri = "";
    try {
        var activeFullName = activeDoc.fullName;
        imagePath = activeFullName.fsName;
        imageUri = activeFullName.absoluteURI || "";
        if (activeFullName.parent && activeFullName.parent.fsName) {
            imageFolderPath = activeFullName.parent.fsName;
        }
    } catch (error) {
        alert(localText("このドキュメントは保存されていないため、Illustratorのリンク画像と照合できません。\n保存してから実行してください。", "This document is not saved, so it cannot be matched against linked images in Illustrator.\nSave the document and run this script again."));
        return;
    }

    // BridgeTalk: Illustratorへ配置情報を問い合わせ
    var bridgeTalkBody = "(" + illustratorSideForPT.toString() + ")(" + toSourceLiteral({
        pathUri: String(imageUri || ""),
        pathFs: encodeURI(String(imagePath || "")),
        folderPath: encodeURI(String(imageFolderPath || "")),
        fileName: String(activeDoc.name || "")
    }) + ");";
    var bridgeTalkResult = sendBridgeTalkAndWait("illustrator", bridgeTalkBody, 30000);
    if (!bridgeTalkResult.ok) {
        alert(localText("Illustratorとの通信エラー: ", "Communication error with Illustrator: ") + bridgeTalkResult.error);
        return;
    }

    var responseData = bridgeTalkResult.body;
    if (responseData == "null" || !responseData) {
        alert(localText("Illustratorドキュメント内に一致するリンク画像が見つかりません。", "No matching linked image was found in the Illustrator document."));
        return;
    }

    // JSON応答のパース
    var parsedObject = parseBridgeTalkJson(responseData, responseData, "Illustrator");
    if (!parsedObject) return;
    if (parsedObject.matchType === "none") {
        alert(buildIllustratorNoMatchDebugMessage(parsedObject));
        return;
    }

    // Photoshopドキュメント情報
    var documentWidthPixels = activeDoc.width.as("px");
    var documentHeightPixels = activeDoc.height.as("px");
    var longSidePixels = Math.max(documentWidthPixels, documentHeightPixels);

    // 配置候補配列の正規化
    var candidateItemsArray = (parsedObject && parsedObject.items && parsedObject.items.length) ? parsedObject.items : null;
    if (!candidateItemsArray) {
        return;
    }
    var matchType = (parsedObject && parsedObject.matchType) ? String(parsedObject.matchType) : "exact";
    var hasFolderDifference = !!(parsedObject && parsedObject.hasFolderDifference);
    var hasExtensionDifference = !!(parsedObject && parsedObject.hasExtensionDifference);

    function findMinMaxIndices(items) {
        var maxIndex = 0;
        var minIndex = 0;
        var maxLongSidePt = -Infinity;
        var minLongSidePt = Infinity;
        for (var itemIndex = 0; itemIndex < items.length; itemIndex++) {
            var longSidePtValue = Number(items[itemIndex].longSidePt) || 0;
            if (longSidePtValue > maxLongSidePt) {
                maxLongSidePt = longSidePtValue;
                maxIndex = itemIndex;
            }
            if (longSidePtValue < minLongSidePt) {
                minLongSidePt = longSidePtValue;
                minIndex = itemIndex;
            }
        }
        return {
            maxIndex: maxIndex,
            minIndex: minIndex
        };
    }

    var candidateSizeInfo = findMinMaxIndices(candidateItemsArray);
    var defaultTargetItem = candidateItemsArray[candidateSizeInfo.maxIndex];
    var placedItemsArray = candidateItemsArray;
    var targetItem = defaultTargetItem;

    // 完全一致時のみ、候補全体のリンク状態を先に確認
    if (matchType !== "nameOnly" && !validateLinkItems(placedItemsArray)) return;

    if (matchType === "nameOnly") {
        var fallbackAction = showFallbackLinkConfirmDialog({
            items: candidateItemsArray,
            photoshopFileName: activeDoc.name,
            photoshopPath: imagePath,
            hasFolderDifference: hasFolderDifference,
            hasExtensionDifference: hasExtensionDifference
        });
        if (fallbackAction === "cancel") {
            return;
        }
        if (fallbackAction === "use" && candidateItemsArray.length === 1) {
            placedItemsArray = [defaultTargetItem];
            targetItem = defaultTargetItem;
        } else {
            var selectedItem = chooseIllustratorItemSync(buildIllustratorChooserPayload(candidateItemsArray, defaultTargetItem ? defaultTargetItem.placedIndex : null, {
                title: localText("処理するリンクを選択", "Select Link to Process"),
                messageLine1: buildNameOnlyMessageLine1(hasFolderDifference, hasExtensionDifference),
                messageLine2: localText("処理対象にするリンクを選んでください。", "Choose the link to process."),
                messageLine3: localText("選ぶと該当リンクを中央表示します。", "Selecting one centers the corresponding link."),
                photoshopPath: imagePath,
                photoshopLongPixels: longSidePixels
            }));
            if (!selectedItem) {
                return;
            }
            placedItemsArray = [selectedItem];
            targetItem = selectedItem;
        }
    } else {
        placedItemsArray = candidateItemsArray;
        targetItem = placedItemsArray[candidateSizeInfo.maxIndex];
    }

    // 処理対象配列のリンク状態チェック
    if (!validateLinkItems(placedItemsArray)) return;

    var placedSizeInfo = findMinMaxIndices(placedItemsArray);

        // 最小配置サイズのppi（最大ppi）を算出
        var minLongSidePtValue = Number(placedItemsArray[placedSizeInfo.minIndex].longSidePt) || 0;
        var minLongSideMM = minLongSidePtValue * 25.4 / 72.0;
        var minSizePpi = (minLongSideMM > 0) ? (longSidePixels / (minLongSideMM / 25.4)) : 0;

        // 処理対象（最大配置サイズ）の情報を取得
        var longSidePt = Number(targetItem.longSidePt) || 0;
        var illustratorPlacedIndex = (targetItem.placedIndex != null) ? Number(targetItem.placedIndex) : null;
        var longSideMM = longSidePt * 25.4 / 72.0;
        var placedPPI = (longSideMM > 0) ? (longSidePixels / (longSideMM / 25.4)) : 0;
        var hasSmartObject = containsSmartObject(activeDoc);
        var usesNameOnlyLinkInfo = (matchType === "nameOnly");

        // ==== リサイズ確認ダイアログ ====
        function showConfirmDialog(messageBase, placedPPI, hasSmartObject) {
            var WARN_STYLE_RED_BOLD = "redBold";
            var WARN_STYLE_DEFAULT_BOLD = "defaultBold";
            var WARN_STYLE_DEFAULT_NORMAL = "defaultNormal";
            var customOptionsPrefs = loadPrefs();
            var resolutionLabels = [];
            for (var resolutionIndex = 0; resolutionIndex < targetPPIList.length; resolutionIndex++) {
                resolutionLabels.push(String(targetPPIList[resolutionIndex]));
            }
            var upscaleMethodLabels = [
                localText("ディテールを保持2.0（推奨）", "Preserve Details 2.0 (Recommended)"),
                localText("ディテールを保持（旧）", "Preserve Details (Legacy)"),
                localText("ニアレストネイバー", "Nearest Neighbor")
            ];
            var upscaleMethodValues = [
                "deepUpscale",
                "preserveDetails",
                "nearestNeighbor"
            ];
            var downscaleMethodLabels = [
                localText("バイキュービック（滑らか）", "Bicubic (Smooth)"),
                localText("ニアレストネイバー", "Nearest Neighbor")
            ];
            var downscaleMethodValues = [
                "bicubic",
                "nearestNeighbor"
            ];
            var initialState = {
                radioIndex: 0,
                upscaleMethod: "deepUpscale",
                downMethod: "bicubic"
            };
            if (customOptionsPrefs.usePrev) {
                initialState.radioIndex = (customOptionsPrefs.radioIndex >= 0 && customOptionsPrefs.radioIndex < targetPPIList.length) ? customOptionsPrefs.radioIndex : 0;
                initialState.upscaleMethod = customOptionsPrefs.upscaleMethod || initialState.upscaleMethod;
                initialState.downMethod = customOptionsPrefs.downMethod || initialState.downMethod;
            }

            function createDialogShell(title) {
                var dlg = new Window("dialog", title);
                dlg.orientation = "column";
                dlg.alignChildren = ["fill", "top"];
                dlg.margins = 15;
                return dlg;
            }

            function buildInfoPanel(dlg, infoMessage) {
                var panelTitle = localText("画像情報", "Image Information");
                if (usesNameOnlyLinkInfo) {
                    panelTitle += localText("（ファイル名部分のみ一致したリンク情報を使用）", " (using link information matched by file name only)");
                }
                var panel = dlg.add("panel", undefined, panelTitle);
                panel.orientation = "column";
                panel.alignChildren = ["fill", "top"];
                panel.margins = [10, 12, 10, 12];
                panel.spacing = 2;

                var separatorIndex = infoMessage.indexOf("\n\n");
                var headerText = (separatorIndex >= 0) ? infoMessage.substring(0, separatorIndex) : infoMessage;
                var tailText = (separatorIndex >= 0) ? infoMessage.substring(separatorIndex + 2) : "";

                var infoText = panel.add("statictext", undefined, headerText, {
                    multiline: true
                });
                infoText.minimumSize.width = 400;

                var detailText = null;
                var extraText = null;
                if (tailText) {
                    detailText = panel.add("statictext", undefined, tailText, {
                        multiline: true
                    });
                    detailText.minimumSize.width = 400;
                    try {
                        var font = detailText.graphics.font;
                        detailText.graphics.font = ScriptUI.newFont(font.name, 'Bold', font.size);
                    } catch (error) {}
                }
                if (placedItemsArray.length > 1) {
                    extraText = panel.add("statictext", undefined, "", {
                        multiline: true
                    });
                    extraText.minimumSize.width = 400;
                    try {
                        var extraFont = extraText.graphics.font;
                        extraText.graphics.font = ScriptUI.newFont(extraFont.name, 'Bold', extraFont.size);
                    } catch (error) {}
                }
                return {
                    panel: panel,
                    infoText: infoText,
                    detailText: detailText,
                    extraText: extraText
                };
            }

            function buildRadioPanel(dlg, title, labels, initialIndex) {
                var panel = dlg.add("panel", undefined, title);
                panel.orientation = "row";
                panel.alignChildren = ["left", "center"];
                panel.spacing = 0;
                panel.margins = [10, 12, 10, 12];
                var buttons = [];
                for (var i = 0; i < labels.length; i++) {
                    var button = panel.add("radiobutton", undefined, buildPaddedLabel(labels[i]));
                    button.value = (i === initialIndex);
                    buttons.push(button);
                }
                return {
                    panel: panel,
                    buttons: buttons
                };
            }

            function buildMethodPanel(dlg, title, labels, values, initialValue) {
                var panel = dlg.add("panel", undefined, title);
                panel.orientation = "row";
                panel.alignChildren = ["left", "center"];
                panel.spacing = 0;
                panel.margins = [10, 12, 10, 12];
                var buttons = [];
                for (var i = 0; i < labels.length; i++) {
                    var button = panel.add("radiobutton", undefined, buildPaddedLabel(labels[i]));
                    button.value = (values[i] === initialValue);
                    buttons.push(button);
                }
                return {
                    panel: panel,
                    buttons: buttons
                };
            }

            function buildWarningArea(dlg) {
                var defaultNormal = dlg.add("statictext", undefined, "", {
                    multiline: true
                });
                defaultNormal.minimumSize.width = 400;
                defaultNormal.alignment = ["fill", "top"];

                var redBold = dlg.add("statictext", undefined, "", {
                    multiline: true
                });
                redBold.minimumSize.width = 400;
                redBold.alignment = ["fill", "top"];

                var defaultBold = dlg.add("statictext", undefined, "", {
                    multiline: true
                });
                defaultBold.minimumSize.width = 400;
                defaultBold.alignment = ["fill", "top"];

                try {
                    redBold.graphics.font = ScriptUI.newFont(redBold.graphics.font.name, 'Bold', redBold.graphics.font.size);
                    defaultBold.graphics.font = ScriptUI.newFont(defaultBold.graphics.font.name, 'Bold', defaultBold.graphics.font.size);
                } catch (error) {}
                try {
                    var redPen = redBold.graphics.newPen(redBold.graphics.PenType.SOLID_COLOR, [1, 0, 0, 1], 1);
                    redBold.graphics.foregroundColor = redPen;
                } catch (error) {}

                return {
                    redBold: redBold,
                    defaultBold: defaultBold,
                    defaultNormal: defaultNormal
                };
            }

            function buildUsePrevArea(dlg, prefs, upscaleLabels, upscaleValues, downscaleLabels, downscaleValues) {
                var group = dlg.add("group");
                group.alignment = ["left", "center"];
                    var checkbox = group.add("checkbox", undefined, localText("▶前回設定値を使用する", "Use previous settings"));
                checkbox.value = prefs.usePrev === true;

                var infoText = dlg.add("statictext", undefined, " ");
                infoText.minimumSize.width = 400;
                infoText.alignment = ["fill", "top"];
                try {
                    var font = infoText.graphics.font;
                    infoText.graphics.font = ScriptUI.newFont(font.name, 'Bold', font.size);
                } catch (error) {}

                function buildPrevSettingsLine() {
                    var ppiIndex = (prefs.radioIndex >= 0 && prefs.radioIndex < targetPPIList.length) ? prefs.radioIndex : 0;
                    var ppiText = String(targetPPIList[ppiIndex]);
                    var upText = pickLabelByValue(prefs.upscaleMethod, upscaleValues, upscaleLabels, upscaleLabels[0]);
                    var downText = pickLabelByValue(prefs.downMethod, downscaleValues, downscaleLabels, downscaleLabels[0]);
                    return ppiText + localText(" ppi / 拡大：", " ppi / Upscale: ") + upText + localText(" / 縮小：", " / Downscale: ") + downText;
                }

                function updateInfoLine() {
                    infoText.text = checkbox.value ? buildPrevSettingsLine() : " ";
                }

                return {
                    checkbox: checkbox,
                    infoText: infoText,
                    updateInfoLine: updateInfoLine
                };
            }

            function buildButtonRow(dlg) {
                var group = dlg.add("group");
                group.orientation = "row";
                group.alignment = "center";
                group.alignChildren = ["center", "center"];
                group.margins = [0, 15, 0, 0];

                var okButton = group.add("button", undefined, localText("処理する (S / Enter)", "Process (S / Enter)"));
                var cancelButton = group.add("button", undefined, localText("キャンセル (Esc)", "Cancel (Esc)"));
                var appButton = group.add("button", undefined, localText("Illustratorで選択 (I)", "Select in Illustrator (I)"));
                var helpButton = group.add("button", undefined, "?");
                helpButton.preferredSize = [24, 24];

                okButton.helpTip = localText("S キー または Enter で実行", "Run with S or Enter");
                cancelButton.helpTip = localText("Esc でキャンセル", "Cancel with Esc");
                appButton.helpTip = localText("I キー で Illustrator で選択", "Select in Illustrator with I");
                helpButton.helpTip = localText("このスクリプトの説明ページをブラウザで開きます", "Open this script's documentation page in the browser");
                okButton.properties = {
                    name: "ok"
                };
                cancelButton.properties = {
                    name: "cancel"
                };
                okButton.active = true;
                dlg.defaultElement = okButton;
                dlg.cancelElement = cancelButton;

                return {
                    okButton: okButton,
                    cancelButton: cancelButton,
                    appButton: appButton,
                    helpButton: helpButton
                };
            }

            function collectSelectionState(ui) {
                var selectedRadioIndex = 0;
                var selectedUpscaleMethod = "deepUpscale";
                var selectedDownscaleMethod = "bicubic";

                for (var i = 0; i < ui.resolution.buttons.length; i++) {
                    if (ui.resolution.buttons[i].value) {
                        selectedRadioIndex = i;
                        break;
                    }
                }
                for (var j = 0; j < ui.upscale.buttons.length; j++) {
                    if (ui.upscale.buttons[j].value) {
                        selectedUpscaleMethod = ui.upscale.values[j];
                        break;
                    }
                }
                for (var k = 0; k < ui.downscale.buttons.length; k++) {
                    if (ui.downscale.buttons[k].value) {
                        selectedDownscaleMethod = ui.downscale.values[k];
                        break;
                    }
                }

                return {
                    radioIndex: selectedRadioIndex,
                    ppi: targetPPIList[selectedRadioIndex],
                    upscaleMethod: selectedUpscaleMethod,
                    downMethod: selectedDownscaleMethod
                };
            }

            function applySelectionState(ui, state, skipRedraw) {
                var validIndex = (state.radioIndex >= 0 && state.radioIndex < ui.resolution.buttons.length) ? state.radioIndex : 0;
                for (var i = 0; i < ui.resolution.buttons.length; i++) ui.resolution.buttons[i].value = (i === validIndex);
                for (var j = 0; j < ui.upscale.buttons.length; j++) ui.upscale.buttons[j].value = (ui.upscale.values[j] === state.upscaleMethod);
                for (var k = 0; k < ui.downscale.buttons.length; k++) ui.downscale.buttons[k].value = (ui.downscale.values[k] === state.downMethod);
                renderDialogState(skipRedraw === true);
            }

            function setControlsEnabled(ui, isEnabled) {
                try {
                    ui.resolution.panel.enabled = isEnabled;
                    ui.upscale.panel.enabled = isEnabled;
                    ui.downscale.panel.enabled = isEnabled;
                } catch (error) {}
                for (var i = 0; i < ui.resolution.buttons.length; i++) ui.resolution.buttons[i].enabled = isEnabled;
                for (var j = 0; j < ui.upscale.buttons.length; j++) ui.upscale.buttons[j].enabled = isEnabled;
                for (var k = 0; k < ui.downscale.buttons.length; k++) ui.downscale.buttons[k].enabled = isEnabled;
            }

            function computeDialogState(selectionState) {
                var scaleRatio = selectionState.ppi / placedPPI;
                var scalePercent = scaleRatio * 100;
                var warningBag = createWarningBag();
                addWarning(warningBag, WARN_STYLE_DEFAULT_NORMAL, hasSmartObject ? SMART_OBJECT_INTERP_WARNING : "");
                addWarning(warningBag, WARN_STYLE_RED_BOLD, historyWarningMessage);
                try {
                    if (activeDoc && activeDoc.mode == DocumentMode.BITMAP) {
                        addWarning(warningBag, WARN_STYLE_RED_BOLD, localText("【注意：キャンセル推奨】\n　2値画像のリサイズは、モアレが発生しやすいため推奨しません。\n　リサンプルする場合は2,400ppi以下、600ppi以上を選択してください。", "[Caution: cancel recommended]\nResizing bitmap images is not recommended because moire is likely to occur.\nIf resampling, choose 2,400 ppi or lower and 600 ppi or higher."));
                    }
                } catch (error) {}
                if (scaleRatio >= efScaleMin && scaleRatio <= efScaleMax) {
                    addWarning(warningBag, WARN_STYLE_RED_BOLD, localText("【注意：キャンセル推奨】\n　拡大率が ", "[Caution: cancel recommended]\nScale is ") + scalePercent.toFixed(2) + localText("% です。無駄な拡縮で、余計な画像劣化の可能性があります。", "%. This may be unnecessary scaling and can cause extra image degradation."));
                }
                if (scaleRatio > scaleMax) {
                    addWarning(warningBag, WARN_STYLE_RED_BOLD, localText("【警告：キャンセル推奨】\n　拡大率が ", "[Warning: cancel recommended]\nScale exceeds ") + (scaleMax * 100).toFixed(0) + localText("% を超えています。\n　Photoshop以外の手段を検討してください。", "%. Consider a method other than Photoshop."));
                }
                try {
                    if (typeof minSizePpi !== "undefined" && isFinite(minSizePpi) &&
                        typeof placedPPI !== "undefined" && isFinite(placedPPI) && placedPPI > 0 &&
                        placedItemsArray && placedItemsArray.length > 1) {
                        var postResizeMinPpi = minSizePpi * (selectionState.ppi / placedPPI);
                        var minAllowedPpi = selectionState.ppi * efScaleMin;
                        var maxAllowedPpi = selectionState.ppi * efScaleMax;
                        if (postResizeMinPpi < minAllowedPpi || postResizeMinPpi > maxAllowedPpi) {
                            addWarning(
                                warningBag,
                                WARN_STYLE_DEFAULT_BOLD,
                                localText("【注意】\n　他の配置画像の実効解像度が ", "[Caution]\nThe effective resolution of another placed image will become ") + postResizeMinPpi.toFixed(2) + localText(" ppi になり、指定解像度から外れます。\n　画像ファイルを分けることを推奨します。", " ppi, outside the selected resolution. Using separate image files is recommended.")
                            );
                        }
                    }
                } catch (error) {}
                return {
                    scaleText: localText("拡縮率: ", "Scale: ") + scalePercent.toFixed(2) + " %",
                    warningBag: warningBag,
                    postResizeMinPpi: (typeof minSizePpi !== "undefined" && isFinite(minSizePpi) &&
                        typeof placedPPI !== "undefined" && isFinite(placedPPI) && placedPPI > 0 &&
                        placedItemsArray && placedItemsArray.length > 1)
                        ? (minSizePpi * (selectionState.ppi / placedPPI))
                        : NaN
                };
            }

            function renderDialogState(skipRedraw) {
                var computed = computeDialogState(collectSelectionState(ui));
                ui.scaleText.text = computed.scaleText;
                if (ui.info && ui.info.extraText) {
                    ui.info.extraText.text =
                        localText("配置点数: ", "Placed items: ") + placedItemsArray.length + "\n" +
                        localText("最小画像の処理後のppi: ", "Post-process PPI of smallest image: ") + (isFinite(computed.postResizeMinPpi) ? computed.postResizeMinPpi.toFixed(2) : "-") + "\n" +
                        localText("※最大サイズの画像を処理します。", "The largest image size will be processed.");
                }
                renderWarningRows(ui.warningRows, computed.warningBag, skipRedraw === true, dialog);
            }

            var dialog = createDialogShell(localText("Illustratorに合わせて画像リサイズ ", "Resize Image to Illustrator Placement ") + (typeof SCRIPT_VERSION !== "undefined" ? SCRIPT_VERSION : ""));
            var ui = {};
            ui.info = buildInfoPanel(dialog, messageBase);

            ui.resolution = buildRadioPanel(dialog, localText("指定解像度", "Target Resolution"), resolutionLabels, initialState.radioIndex);
            ui.upscale = buildMethodPanel(dialog, localText("拡大メソッド", "Upscale Method"), upscaleMethodLabels, upscaleMethodValues, initialState.upscaleMethod);
            ui.downscale = buildMethodPanel(dialog, localText("縮小メソッド", "Downscale Method"), downscaleMethodLabels, downscaleMethodValues, initialState.downMethod);
            ui.upscale.values = upscaleMethodValues;
            ui.downscale.values = downscaleMethodValues;

            var scaleText = dialog.add("statictext", undefined, "");
            scaleText.minimumSize.width = 400;
            try {
                var scaleFont = scaleText.graphics.font;
                scaleText.graphics.font = ScriptUI.newFont(scaleFont.name, "Bold", scaleFont.size);
            } catch (error) {}
            ui.scaleText = scaleText;
            ui.warningRows = buildWarningArea(dialog);

            var historyWarningMessage = "";
            try {
                var historyStatus = getHistoryStatusByName(HISTORY_NAME);
                if (historyStatus && historyStatus.exists && (historyStatus.status === "active" || historyStatus.status === "applied")) {
                    historyWarningMessage = localText("【注意：キャンセル推奨】\n　すでにリサイズを実行済みです！実際の配置と異なる可能性があります。\n　ヒストリーを削除するか保存して開き直し、リンクを更新してから実行してください", "[Caution: cancel recommended]\nResize has already been run. The result may differ from the actual placement.\nDelete the history state, or save and reopen the image, update the link, then run again.");
                }
            } catch (error) {}

            var usePrevArea = buildUsePrevArea(
                dialog,
                customOptionsPrefs,
                upscaleMethodLabels,
                upscaleMethodValues,
                downscaleMethodLabels,
                downscaleMethodValues
            );
            var buttonRow = buildButtonRow(dialog);

            for (var i = 0; i < ui.resolution.buttons.length; i++) {
                ui.resolution.buttons[i].onClick = renderDialogState;
            }

            usePrevArea.checkbox.onClick = function() {
                if (usePrevArea.checkbox.value) applySelectionState(ui, customOptionsPrefs);
                setControlsEnabled(ui, !usePrevArea.checkbox.value);
                usePrevArea.updateInfoLine();
            };
            setControlsEnabled(ui, !usePrevArea.checkbox.value);

            function savePrefsAndClose(exitCode, saveAll) {
                try {
                    if (saveAll) {
                        var selectedValues = collectSelectionState(ui);
                        savePrefs({
                            usePrev: usePrevArea.checkbox.value === true,
                            radioIndex: selectedValues.radioIndex,
                            upscaleMethod: selectedValues.upscaleMethod,
                            downMethod: selectedValues.downMethod
                        });
                    } else {
                        saveUsePrevOnly(usePrevArea.checkbox.value);
                    }
                } catch (error) {}
                try {
                    dialog.close(exitCode);
                } catch (error) {
                    dialog.close();
                }
            }

            buttonRow.okButton.onClick = function() {
                savePrefsAndClose(1, true);
            };
            buttonRow.cancelButton.onClick = function() {
                savePrefsAndClose(0, false);
            };
            buttonRow.appButton.onClick = function() {
                savePrefsAndClose(0, false);
                var selectionHandle = illustratorSelectionHandle || {
                    placedIndex: null,
                    pathUri: imageUri,
                    pathFs: imagePath
                };
                selectInIllustrator(selectionHandle);
            };
            buttonRow.helpButton.onClick = function() {
                openURLInBrowser("https://gist.github.com/Yamonov/b63d9c67402ef7af4c17ab33caccce31");
                savePrefsAndClose(0, false);
            };

            dialog.addEventListener("keydown", function(keyEvent) {
                try {
                    var keyName = String(keyEvent.keyName || "").toUpperCase();
                    if (keyName === "S") {
                        buttonRow.okButton.notify("onClick");
                        keyEvent.preventDefault();
                    } else if (keyName === "I") {
                        buttonRow.appButton.notify("onClick");
                        keyEvent.preventDefault();
                    } else if (keyName === "ENTER" || keyName === "RETURN") {
                        buttonRow.okButton.notify("onClick");
                        keyEvent.preventDefault();
                    }
                } catch (error) {}
            });

            renderWarningRows(ui.warningRows, createWarningBag(), true, dialog);
            renderDialogState(true);
            usePrevArea.updateInfoLine();
            dialog.preferredSize = [460, 360];
            try {
                dialog.center();
            } catch (error) {}

            var isOk = (dialog.show() === 1);
            if (isOk) {
                var selectedValues = collectSelectionState(ui);
                return {
                    ppi: selectedValues.ppi,
                    method: selectedValues.upscaleMethod,
                    downMethod: selectedValues.downMethod,
                    usePrev: !!usePrevArea.checkbox.value,
                    cancelled: false
                };
            }
            return {
                usePrev: !!usePrevArea.checkbox.value,
                cancelled: true
            };
        }

        // ダイアログに表示する情報の整形（ファイル名・フォルダ・色情報→配置サイズ・ppi）
        // 画像情報収集（カラーモード/プロファイル/ファイル名/フォルダ）
        var photoshopFileName = activeDoc.name;
        var photoshopFilePath;
        try {
            photoshopFilePath = activeDoc.fullName.parent.fsName;
        } catch (error) {
            photoshopFilePath = localText("(未保存)", "(Unsaved)");
        } // 表示はフォルダのみ（ファイル名は除外）
        var photoshopColorProfile;
        try {
            photoshopColorProfile = activeDoc.colorProfileName;
        } catch (error) {
            photoshopColorProfile = localText("(不明)", "(Unknown)");
        }
        var photoshopColorMode = modeToString(activeDoc.mode);
        // Illustrator側選択用ハンドル（UI内 I ボタンで使用）
        var illustratorSelectionHandle = {
            placedIndex: illustratorPlacedIndex,
            pathUri: imageUri,
            pathFs: imagePath,
            items: candidateItemsArray,
            photoshopLongPixels: longSidePixels
        };
        // ダイアログに表示する基本メッセージ（配置サイズとppi）
        var messageBase;
        if (placedItemsArray.length > 1) {
            messageBase =
                localText("ファイル名: ", "File name: ") + photoshopFileName + "\n" +
                localText("フォルダ: ", "Folder: ") + photoshopFilePath + "\n" +
                localText("カラーモード：", "Color mode: ") + photoshopColorMode + localText("（", " (") + photoshopColorProfile + localText("）", ")") + "\n" +
                "\n" +
                localText("処理対象の配置サイズ（長辺）: ", "Target placed size (long side): ") + longSideMM.toFixed(2) + " mm\n" +
                localText("処理対象の実効ppi: ", "Target effective PPI: ") + placedPPI.toFixed(2) + "\n";
        } else {
            messageBase =
                localText("ファイル名: ", "File name: ") + photoshopFileName + "\n" +
                localText("フォルダ: ", "Folder: ") + photoshopFilePath + "\n" +
                localText("カラーモード：", "Color mode: ") + photoshopColorMode + localText("（", " (") + photoshopColorProfile + localText("）", ")") + "\n" +
                "\n" +
                localText("処理対象の配置サイズ（長辺）: ", "Target placed size (long side): ") + longSideMM.toFixed(2) + " mm\n" +
                localText("処理対象の実効ppi: ", "Target effective PPI: ") + placedPPI.toFixed(2) + "\n";
        }

        // 解像度選択ダイアログを表示し、ユーザーの選択を取得
        var dialogResult = showConfirmDialog(messageBase, placedPPI, hasSmartObject);
        // ダイアログクローズ時にも usePrev を保存
        try {
            if (dialogResult && dialogResult.hasOwnProperty('usePrev')) saveUsePrevOnly(dialogResult.usePrev);
        } catch (error) {}

        // キャンセル・クローズ時は処理を中止
        if (!dialogResult || dialogResult.cancelled) {
            return;
        }

        var targetPPI = dialogResult.ppi;
        var upscaleMethod = dialogResult.method;
        var downscaleMethod = dialogResult.downMethod;
        var scaleRatio = targetPPI / placedPPI;

        // 長辺を拡縮率に応じてリサイズ（縦横比維持）
        var newWidthPixels, newHeightPixels;
        if (documentWidthPixels >= documentHeightPixels) {
            newWidthPixels = longSidePixels * scaleRatio;
            newHeightPixels = documentHeightPixels * scaleRatio;
        } else {
            newHeightPixels = longSidePixels * scaleRatio;
            newWidthPixels = documentWidthPixels * scaleRatio;
        }

    __HISTORY_CTX__ = {
        newWidthPixels: newWidthPixels,
        newHeightPixels: newHeightPixels,
        targetPPI: targetPPI,
        scaleRatio: scaleRatio,
        upscaleMethod: upscaleMethod,
        downscaleMethod: downscaleMethod
    };
    var resizeResult = runWithHistory(HISTORY_NAME, performResizeFromCtx, "performResizeFromCtx()");
    __HISTORY_CTX__ = null;
    if (!resizeResult || resizeResult.ok !== true) {
        alert(localText("リサイズ処理に失敗しました。", "Resize failed.") + "\n" + (resizeResult && resizeResult.error ? resizeResult.error : localText("原因不明のエラー", "Unknown error")));
    }

}

// ===== Illustrator側：対象パスの配置アイテムを探索し一致した候補を返す =====
function illustratorSideForPT(targetInfo) {
    var isWindows = $.os.indexOf("Windows") >= 0;
    var PATH_SEPARATOR_PATTERN = new RegExp("[/\\\\\\u00A5\\uFFE5\\uFF3C]");
    var PATH_SEPARATOR_REPEAT_PATTERN = new RegExp("[/\\\\\\u00A5\\uFFE5\\uFF3C]+", "g");
    var BACKSLASH_REPEAT_PATTERN = new RegExp("\\\\+", "g");

    function normalizePathSeparatorsForSplit(pathText) {
        return String(pathText || "").replace(PATH_SEPARATOR_REPEAT_PATTERN, "\\");
    }

    function containsPathSeparator(text) {
        return PATH_SEPARATOR_PATTERN.test(String(text || ""));
    }

    function decodeUriSafe(text) {
        var value = String(text || "");
        try {
            return decodeURI(value);
        } catch (error) {}
        return value;
    }

    function normalizeDisplaySlashesLocal(text, separator) {
        var value = String(text || "");
        var normalized = "";
        var lastWasSeparator = false;
        var slashChar = separator || "/";
        for (var i = 0; i < value.length; i++) {
            var ch = value.charAt(i);
            var isSeparator = (ch === "/") || (ch === "\\") || (ch === "¥") || (ch === "￥") || (ch === "＼");
            if (isSeparator) {
                if (!lastWasSeparator) {
                    normalized += slashChar;
                    lastWasSeparator = true;
                }
            } else {
                normalized += ch;
                lastWasSeparator = false;
            }
        }
        return normalized;
    }

    function normalizeDisplayPath(pathText) {
        var value = decodeUriSafe(pathText);
        if (isWindows) {
            value = normalizeDisplaySlashesLocal(value, "/");
            value = value.split("/").join("\\");
            return value;
        }
        return String(value || "").split("\\ ").join(" ");
    }

    function buildDisplayPathInfo(rawFolderPath, rawFileName) {
        return {
            fileName: normalizeDisplayPath(rawFileName),
            folderPath: normalizeDisplayPath(rawFolderPath)
        };
    }

    function normalizeUriPath(filePath) {
        if (!filePath) return "";
        var normalizedUri = String(filePath);
        if (isWindows) {
            normalizedUri = decodeUriSafe(normalizedUri);
            normalizedUri = normalizedUri.split("/").join("\\");
            normalizedUri = normalizedUri.replace(BACKSLASH_REPEAT_PATTERN, "\\");
            normalizedUri = normalizedUri.toLowerCase();
        }
        return normalizedUri;
    }

    function normalizeRawPath(filePath) {
        if (!filePath) return "";
        var normalizedPath = decodeUriSafe(filePath);
        if (/^file:/i.test(normalizedPath)) {
            try {
                normalizedPath = File(normalizedPath).fsName;
            } catch (error) {}
        }
        if (isWindows) {
            if (normalizedPath.length >= 4 && normalizedPath.substring(0, 4) === "\\\\?\\") {
                var restOfPath = normalizedPath.substring(4);
                if (restOfPath.length >= 4 && restOfPath.substring(0, 4).toLowerCase() === "unc\\") {
                    normalizedPath = "\\\\" + restOfPath.substring(4);
                } else {
                    normalizedPath = restOfPath;
                }
            }
            normalizedPath = normalizedPath.split("/").join("\\");
            normalizedPath = normalizedPath.replace(BACKSLASH_REPEAT_PATTERN, "\\");
            normalizedPath = normalizedPath.toLowerCase();
        }
        return normalizedPath;
    }

    function readPlacedFile(item) {
        try {
            return item.file;
        } catch (error) {
            return null;
        }
    }

    function readFileFsName(fileObject) {
        try {
            return fileObject && fileObject.fsName ? String(fileObject.fsName) : "";
        } catch (error) {
            return "";
        }
    }

    function readFileAbsoluteURI(fileObject) {
        try {
            return fileObject && fileObject.absoluteURI ? String(fileObject.absoluteURI) : "";
        } catch (error) {
            return "";
        }
    }

    function readFileName(fileObject) {
        try {
            return fileObject && fileObject.name ? String(fileObject.name) : "";
        } catch (error) {
            return "";
        }
    }

    function readFileFolderPath(fileObject) {
        try {
            return fileObject && fileObject.parent && fileObject.parent.fsName ? String(fileObject.parent.fsName) : "";
        } catch (error) {
            return "";
        }
    }

    function splitPathInfo(filePath) {
        var normalizedPath = normalizePathSeparatorsForSplit(filePath);
        var slashIndex = normalizedPath.lastIndexOf("\\");
        var folderPath = (slashIndex >= 0) ? normalizedPath.substring(0, slashIndex) : "";
        var fileName = (slashIndex >= 0) ? normalizedPath.substring(slashIndex + 1) : normalizedPath;
        var dotIndex = fileName.lastIndexOf(".");
        var baseName = (dotIndex > 0) ? fileName.substring(0, dotIndex) : fileName;
        var extension = (dotIndex > 0) ? fileName.substring(dotIndex + 1) : "";
        if (isWindows) {
            folderPath = folderPath.toLowerCase();
            fileName = fileName.toLowerCase();
            baseName = baseName.toLowerCase();
            extension = extension.toLowerCase();
        }
        return {
            folderPath: folderPath,
            fileName: fileName,
            baseName: baseName,
            extension: extension
        };
    }

    function buildNameOnlyPathInfo(normalizedPath, rawFolderPath, rawFileName) {
        var pathInfo = splitPathInfo(normalizedPath);
        var splitLooksValid = !!pathInfo.baseName;
        if (splitLooksValid && rawFolderPath && !pathInfo.folderPath) {
            splitLooksValid = false;
        }
        if (splitLooksValid && containsPathSeparator(pathInfo.fileName)) {
            splitLooksValid = false;
        }
        if (splitLooksValid) return pathInfo;

        var folderPath = decodeUriSafe(rawFolderPath);
        var fileName = decodeUriSafe(rawFileName);
        folderPath = normalizePathSeparatorsForSplit(folderPath);
        var dotIndex = fileName.lastIndexOf(".");
        var baseName = (dotIndex > 0) ? fileName.substring(0, dotIndex) : fileName;
        var extension = (dotIndex > 0) ? fileName.substring(dotIndex + 1) : "";
        if (isWindows) {
            folderPath = folderPath.replace(BACKSLASH_REPEAT_PATTERN, "\\");
            folderPath = folderPath.toLowerCase();
            fileName = fileName.toLowerCase();
            baseName = baseName.toLowerCase();
            extension = extension.toLowerCase();
        }
        return {
            folderPath: folderPath,
            fileName: fileName,
            baseName: baseName,
            extension: extension
        };
    }

    function getLongSidePt(item) {
        var baseWidthPt = 0;
        var baseHeightPt = 0;
        try {
            var boundingBox = item.boundingBox;
            if (boundingBox && boundingBox.length >= 4) {
                baseWidthPt = Math.abs(boundingBox[2] - boundingBox[0]);
                baseHeightPt = Math.abs(boundingBox[1] - boundingBox[3]);
            }
        } catch (error) {}
        try {
            var matrix = item.matrix;
            var scaleX = Math.sqrt(matrix.mValueA * matrix.mValueA + matrix.mValueB * matrix.mValueB);
            var scaleY = Math.sqrt(matrix.mValueC * matrix.mValueC + matrix.mValueD * matrix.mValueD);
            var widthPt = baseWidthPt * scaleX;
            var heightPt = baseHeightPt * scaleY;
            if (widthPt > 0 && heightPt > 0) {
                return Math.max(widthPt, heightPt);
            }
        } catch (error) {}
        return 0;
    }

    function stateFromStatusText(value) {
        var text = String(value || "").toLowerCase();
        if (text.indexOf("nodata") >= 0 || text.indexOf("missing") >= 0 || text.indexOf("notfound") >= 0) return "missing";
        if (text.indexOf("datamodified") >= 0 || text.indexOf("modified") >= 0 || text.indexOf("outdated") >= 0) return "modified";
        if (text.indexOf("datafromfile") >= 0 || text.indexOf("normal") >= 0 || text.indexOf("ok") >= 0) return "ok";
        return "";
    }

    function normalizeRasterLinkState(value) {
        if (typeof value === "undefined" || value === null) return "";
        var textState = stateFromStatusText(value);
        if (textState) return textState;
        var numberValue = Number(value);
        if (numberValue === 1) return "missing";
        if (numberValue === 2) return "ok";
        if (numberValue === 3) return "modified";
        if (numberValue === 0) return "ok";
        return "";
    }

    function normalizeLegacyLinkStatus(value) {
        if (typeof value === "undefined" || value === null) return "";
        var textState = stateFromStatusText(value);
        if (textState) return textState;
        var numberValue = Number(value);
        if (numberValue === 0) return "ok";
        if (numberValue === 1) return "missing";
        if (numberValue === 2 || numberValue === 3) return "modified";
        return "";
    }

    function linkValueForResult(value) {
        var numberValue = Number(value);
        if (isFinite(numberValue)) return numberValue;
        return String(value || "");
    }

    function readLinkInfo(item, fileObject) {
        try {
            if (typeof item.status !== "undefined") {
                return {
                    raw: linkValueForResult(item.status),
                    state: normalizeRasterLinkState(item.status) || "ok"
                };
            }
        } catch (error) {}
        try {
            if (typeof item.linkStatus !== "undefined") {
                return {
                    raw: linkValueForResult(item.linkStatus),
                    state: normalizeLegacyLinkStatus(item.linkStatus) || "ok"
                };
            }
        } catch (legacyError) {}
        try {
            if (fileObject && typeof fileObject.exists !== "undefined" && fileObject.exists === false) {
                return {
                    raw: "fileMissing",
                    state: "missing"
                };
            }
        } catch (existsError) {}
        return {
            raw: 0,
            state: "ok"
        };
    }

    function buildItemPathData(item, fileObject, knownNormalizedPath) {
        var resolvedFileObject = fileObject || readPlacedFile(item);
        var normalizedPath = knownNormalizedPath || normalizeRawPath(readFileFsName(resolvedFileObject));
        var fileName = readFileName(resolvedFileObject);
        var folderPath = readFileFolderPath(resolvedFileObject);
        var pathInfo = buildNameOnlyPathInfo(normalizedPath, folderPath, fileName);
        var displayPathInfo = buildDisplayPathInfo(folderPath, fileName);
        return {
            fileObject: resolvedFileObject,
            normalizedPath: normalizedPath,
            fileName: fileName,
            folderPath: folderPath,
            pathInfo: pathInfo,
            displayPathInfo: displayPathInfo
        };
    }

    function createCandidate(item, placedIndex, pathData) {
        var pathInfo = pathData.pathInfo || {};
        var fileName = pathData.fileName || pathInfo.fileName || "";
        var folderPath = pathData.folderPath || pathInfo.folderPath || "";
        var displayPathInfo = pathData.displayPathInfo || {};
        var displayFileName = displayPathInfo.fileName || fileName;
        var displayFolderPath = displayPathInfo.folderPath || folderPath;
        var linkInfo = readLinkInfo(item, pathData.fileObject);
        return {
            longSidePt: getLongSidePt(item),
            linkStatus: linkInfo.raw,
            linkState: linkInfo.state,
            placedIndex: placedIndex,
            pathFs: pathData.normalizedPath || "",
            fileName: fileName,
            folderPath: folderPath,
            extension: pathInfo.extension || "",
            displayFileName: displayFileName,
            displayFolderPath: displayFolderPath
        };
    }

    function createDebugItem(placedIndex, pathInfo, rawFileName, rawFolderPath, normalizedPath) {
        return {
            placedIndex: placedIndex,
            fileName: rawFileName || pathInfo.fileName || "",
            folderPath: rawFolderPath || pathInfo.folderPath || "",
            baseName: pathInfo.baseName || "",
            extension: pathInfo.extension || "",
            pathFs: normalizedPath || ""
        };
    }

    function getExactMatchInfo(fileObject) {
        var normalizedItemPath = normalizeRawPath(readFileFsName(fileObject));
        if (normalizedTargetPath && normalizedItemPath && normalizedItemPath === normalizedTargetPath) {
            return {
                matched: true,
                normalizedPath: normalizedItemPath
            };
        }
        if (normalizedTargetPath && normalizedItemPath) {
            return {
                matched: false,
                normalizedPath: normalizedItemPath
            };
        }

        var normalizedItemUri = normalizeUriPath(readFileAbsoluteURI(fileObject));
        if (normalizedTargetUri && normalizedItemUri && normalizedItemUri === normalizedTargetUri) {
            return {
                matched: true,
                normalizedPath: normalizedItemPath
            };
        }

        return {
            matched: false,
            normalizedPath: normalizedItemPath
        };
    }

    function collectExactItems(placedItems) {
        var items = [];
        for (var i = 0; i < placedItems.length; i++) {
            var item = placedItems[i];
            var fileObject = readPlacedFile(item);
            if (!fileObject) continue;

            var matchInfo = getExactMatchInfo(fileObject);
            if (!matchInfo.matched) continue;

            var pathData = buildItemPathData(item, fileObject, matchInfo.normalizedPath);
            items.push(createCandidate(item, i, pathData));
        }
        return items;
    }

    function collectNameOnlyItems(placedItems) {
        var result = {
            items: [],
            hasFolderDifference: false,
            hasExtensionDifference: false
        };
        if (!targetPathInfo.baseName) return result;

        for (var i = 0; i < placedItems.length; i++) {
            var item = placedItems[i];
            var fileObject = readPlacedFile(item);
            if (!fileObject) continue;

            var pathData = buildItemPathData(item, fileObject, "");
            var itemPathInfo = pathData.pathInfo;
            if (!itemPathInfo.baseName) continue;
            if (targetPathInfo.baseName !== itemPathInfo.baseName) continue;

            if (targetPathInfo.folderPath !== itemPathInfo.folderPath) {
                result.hasFolderDifference = true;
            }
            if (targetPathInfo.extension !== itemPathInfo.extension) {
                result.hasExtensionDifference = true;
            }

            result.items.push(createCandidate(item, i, pathData));
        }

        return result;
    }

    function buildDebugItems(placedItems) {
        var items = [];
        for (var i = 0; i < placedItems.length; i++) {
            var item = placedItems[i];
            var pathData = buildItemPathData(item, readPlacedFile(item), "");
            items.push(createDebugItem(i, pathData.pathInfo, pathData.fileName, pathData.folderPath, pathData.normalizedPath));
        }
        return items;
    }

    if (app.documents.length === 0) return "null";

    var targetUri = targetInfo && targetInfo.pathUri ? String(targetInfo.pathUri) : "";
    var targetFs = targetInfo && targetInfo.pathFs ? decodeURI(String(targetInfo.pathFs)) : "";
    var targetFileName = targetInfo && targetInfo.fileName ? String(targetInfo.fileName) : "";
    var targetFolderPath = targetInfo && targetInfo.folderPath ? decodeURI(String(targetInfo.folderPath)) : "";
    var normalizedTargetUri = normalizeUriPath(targetUri);
    var normalizedTargetPath = normalizeRawPath(targetFs);
    var targetPathInfo = buildNameOnlyPathInfo(normalizedTargetPath, targetFolderPath, targetFileName);

    var doc = app.activeDocument;
    var placedItems = doc.placedItems;

    var exactItems = collectExactItems(placedItems);
    if (exactItems.length) {
        return ({
            matchType: "exact",
            items: exactItems,
            hasFolderDifference: false,
            hasExtensionDifference: false
        }).toSource();
    }

    var nameOnlyResult = collectNameOnlyItems(placedItems);
    if (!nameOnlyResult.items.length) {
        return ({
            matchType: "none",
            debugTarget: {
                fileName: targetFileName || targetPathInfo.fileName || "",
                folderPath: targetFolderPath || targetPathInfo.folderPath || "",
                baseName: targetPathInfo.baseName || "",
                extension: targetPathInfo.extension || "",
                pathFs: normalizedTargetPath || ""
            },
            debugItems: buildDebugItems(placedItems)
        }).toSource();
    }
    return ({
        matchType: "nameOnly",
        items: nameOnlyResult.items,
        hasFolderDifference: nameOnlyResult.hasFolderDifference,
        hasExtensionDifference: nameOnlyResult.hasExtensionDifference
    }).toSource();
}

// ===== 実行開始 =====
main();
