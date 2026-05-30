/*
<javascriptresource>
<name>InDesignに合わせてリサイズ</name>
<category>YPresets</category>
</javascriptresource>

SCRIPTMETA-BEGIN
Script-ID=org.iwashi.Photoshop_InDesign_Resize
Version=1.6.5
Meta-URL=https://github.com/Yamonov/Iwashiya_Scripts/tree/main/InDesgin
Name=InDesign配置に合わせてリサイズ
Author=Murakami Yoshiteru
Release-Date=2026-05-13
Target-App=Photoshop
Edit-Password-SHA256=K3RqUgaTYxSqtAnu:f25b1b6c1522be5933887f5f5b3e1f561825d4e16415ab00698735f72d9a4cb6
Description-BEGIN
Photoshopで開いている画像を、InDesignドキュメント上の配置サイズに合わせてリサイズします。

配置したInDesignドキュメントを開いておき、Photoshopから実行してください。

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
var HISTORY_NAME = localText("InDesignに合わせてリサイズ処理", "Resize to InDesign Placement");

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
    } catch (error) { }
    try {
        if (file) file.close();
    } catch (closeError) { }
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

// 設定値: ユーザー選択可能なppi候補と注意/上限しきい値
var targetPPIList = [350, 400, 600, 1200];
var efScaleMin = 0.9;
var efScaleMax = 1.1;
var scaleMax = 2;

// ==== CustomOptions（前回設定の保存/復元: InDesign 連携版） ====
var PREF_ID_IDRESIZE = "com.yamo.psIDresize_v1"; // 指定識別子
var K_VER_ID = stringIDToTypeID("version");
var K_RADIO_INDEX_ID = stringIDToTypeID("radioIndex"); // targetPPIList のインデックス
var K_UPSCALE_ID = stringIDToTypeID("upscaleMethod"); // methodValues の文字列
var K_DOWNSCALE_ID = stringIDToTypeID("downMethod"); // downMethodValues の文字列
var K_USE_PREV_ID = stringIDToTypeID("usePrevSettings"); // 前回設定値を使用（bool）
var SCHEMA_VERSION_ID = 1;

var defaultsPrefsID = {
    usePrev: false,
    radioIndex: 0, // PPI リスト先頭
    upscaleMethod: "deepUpscale", // 既定アップスケール
    downMethod: "bicubic" // 既定ダウンスケール
};
var SMART_OBJECT_INTERP_WARNING = localText(
    "【警告】\n　含まれているスマートオブジェクトは、ここでの指定と別に環境設定＞一般で指定したリサンプル方式でリサイズされます。\n　合成エッジが変わるなど不具合が出る可能性があります。",
    "[Warning]\nSmart objects in the document are resized using the resampling method set in Preferences > General, separately from the setting here.\nThis may cause issues such as changed compositing edges."
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
    } catch (e) { }
    return false;
}

function containsSmartObject(doc) {
    try {
        return hasSmartObjectRecursive(doc);
    } catch (e) {
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
    } catch (e) {
        lastError = e;
        if (__HISTORY_DID_RUN__) {
            return {
                ok: false,
                error: e
            };
        }
    }
    try {
        fn();
        return {
            ok: true
        };
    } catch (e3) {
        lastError = e3;
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
    } catch (e) {
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
    var newWidthPx = ctx.newWidthPx;
    var newHeightPx = ctx.newHeightPx;
    var targetPPI = ctx.targetPPI;
    var scaleRatio = ctx.scaleRatio;
    var upscaleMethod = ctx.upscaleMethod;
    var downscaleMethod = ctx.downscaleMethod;

    if (scaleRatio < 1) {
        // 縮小
        if (downscaleMethod === "bicubic") {
            doc.resizeImage(UnitValue(newWidthPx, "px"), UnitValue(newHeightPx, "px"), targetPPI, ResampleMethod.BICUBIC);
        } else if (downscaleMethod === "nearestNeighbor") {
            doc.resizeImage(UnitValue(newWidthPx, "px"), UnitValue(newHeightPx, "px"), targetPPI, ResampleMethod.NEARESTNEIGHBOR);
        } else {
            doc.resizeImage(UnitValue(newWidthPx, "px"), UnitValue(newHeightPx, "px"), targetPPI, ResampleMethod.BICUBIC);
        }
    } else {
        // 拡大
        if (upscaleMethod === "deepUpscale") {
            var desc = new ActionDescriptor();
            desc.putUnitDouble(charIDToTypeID('Wdth'), charIDToTypeID('#Pxl'), newWidthPx);
            desc.putUnitDouble(charIDToTypeID('Hght'), charIDToTypeID('#Pxl'), newHeightPx);
            desc.putUnitDouble(charIDToTypeID('Rslt'), charIDToTypeID('#Rsl'), targetPPI);
            desc.putBoolean(stringIDToTypeID('scaleStyles'), true);
            desc.putEnumerated(charIDToTypeID('Intr'), charIDToTypeID('Intp'), stringIDToTypeID('deepUpscale'));
            executeAction(charIDToTypeID('ImgS'), desc, DialogModes.NO);
        } else if (upscaleMethod === "preserveDetails") {
            doc.resizeImage(UnitValue(newWidthPx, "px"), UnitValue(newHeightPx, "px"), targetPPI, ResampleMethod.PRESERVEDETAILS);
        } else if (upscaleMethod === "nearestNeighbor") {
            doc.resizeImage(UnitValue(newWidthPx, "px"), UnitValue(newHeightPx, "px"), targetPPI, ResampleMethod.NEARESTNEIGHBOR);
        } else {
            doc.resizeImage(UnitValue(newWidthPx, "px"), UnitValue(newHeightPx, "px"), targetPPI, ResampleMethod.BICUBIC);
        }
    }
    // 完了後は100%表示に切替
    app.runMenuItem(stringIDToTypeID("actualPixels"));
}

function cloneDefaultPrefs() {
    return {
        usePrev: defaultsPrefsID.usePrev,
        radioIndex: defaultsPrefsID.radioIndex,
        upscaleMethod: defaultsPrefsID.upscaleMethod,
        downMethod: defaultsPrefsID.downMethod
    };
}

function loadPrefs() {
    var p = cloneDefaultPrefs();
    try {
        var d = app.getCustomOptions(PREF_ID_IDRESIZE);
        if (d.hasKey(K_USE_PREV_ID)) p.usePrev = d.getBoolean(K_USE_PREV_ID);
        if (d.hasKey(K_RADIO_INDEX_ID)) {
            var idx = d.getInteger(K_RADIO_INDEX_ID);
            if (idx >= 0 && idx < targetPPIList.length) p.radioIndex = idx;
        }
        if (d.hasKey(K_UPSCALE_ID)) p.upscaleMethod = d.getString(K_UPSCALE_ID);
        if (d.hasKey(K_DOWNSCALE_ID)) p.downMethod = d.getString(K_DOWNSCALE_ID);
    } catch (e) {
        /* 初回/破損は既定 */
    }
    return p;
}

function savePrefs(p) {
    var d = new ActionDescriptor();
    d.putInteger(K_VER_ID, SCHEMA_VERSION_ID);
    d.putBoolean(K_USE_PREV_ID, !!p.usePrev);
    d.putInteger(K_RADIO_INDEX_ID, Math.max(0, Math.min(targetPPIList.length - 1, p.radioIndex)));
    d.putString(K_UPSCALE_ID, String(p.upscaleMethod));
    d.putString(K_DOWNSCALE_ID, String(p.downMethod));
    app.putCustomOptions(PREF_ID_IDRESIZE, d, true);
}

// 「前回設定値を使用」だけを保存（他は維持）
function saveUsePrevOnly(flag) {
    var cur = loadPrefs();
    savePrefs({
        usePrev: !!flag,
        radioIndex: cur.radioIndex,
        upscaleMethod: cur.upscaleMethod,
        downMethod: cur.downMethod
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
    } catch (e) { }
}

function renderWarningRows(rows, bag, skipRedraw, dialog) {
    setMessageRow(rows.redBold, bag.redBold.join("\n"));
    setMessageRow(rows.defaultBold, bag.defaultBold.join("\n"));
    setMessageRow(rows.defaultNormal, bag.defaultNormal.join("\n"));
    if (!skipRedraw) {
        try {
            dialog.layout.layout(true);
            dialog.update();
        } catch (e) { }
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

        var appPanel = dialog.add("panel", undefined, localText("InDesign側", "InDesign Side"));
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
    var checkButton = buttonGroup.add("button", undefined, localText("InDesignで確認", "Check in InDesign"));
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

function buildInDesignChooserPayload(items, initialLinkIndex, options) {
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
            encodedItem.fileName = encodeChooserText(item.fileName || "");
            encodedItem.folderPath = encodeChooserText(item.folderPath || "");
            encodedItem.displayFileName = encodeChooserText(item.displayFileName || "");
            encodedItem.displayFolderPath = encodeChooserText(item.displayFolderPath || "");
            encodedItem.rawFileName = encodeChooserText(item.rawFileName || "");
            encodedItem.rawFilePath = encodeChooserText(item.rawFilePath || "");
            encodedItems.push(encodedItem);
        }
        return encodedItems;
    }

    return {
        items: encodeChooserItems(items),
        initialLinkIndex: initialLinkIndex,
        title: dialogOptions.title || localText("リンクを選択", "Select Link"),
        messageLine1: dialogOptions.messageLine1 || "",
        messageLine2: dialogOptions.messageLine2 || "",
        messageLine3: dialogOptions.messageLine3 || "",
        photoshopPathRaw: encodeChooserText(dialogOptions.photoshopPathRaw || "")
    };
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

function findInDesignMinMaxIndices(items) {
    var maxIndex = 0;
    var minIndex = 0;
    var maxLongMM = -Infinity;
    var minLongMM = Infinity;
    for (var itemIndex = 0; itemIndex < items.length; itemIndex++) {
        var itemLongMM = Number(items[itemIndex].placedLongMM) || 0;
        if (itemLongMM > maxLongMM) {
            maxLongMM = itemLongMM;
            maxIndex = itemIndex;
        }
        if (itemLongMM < minLongMM) {
            minLongMM = itemLongMM;
            minIndex = itemIndex;
        }
    }
    return {
        maxIndex: maxIndex,
        minIndex: minIndex
    };
}

function finalizeInDesignResizeFlow(ctx) {
    if (!ctx || !ctx.targetItems || !ctx.targetItems.length || !ctx.targetItem) return;
    var doc = app.activeDocument;
    var docWidthPx = ctx.docWidthPx;
    var docHeightPx = ctx.docHeightPx;
    var currentPPI = ctx.currentPPI;
    var longPx = ctx.longPx;
    var imgPath = ctx.imgPath;
    var candidateItemsArray = ctx.candidateItemsArray;
    var targetItems = ctx.targetItems;
    var targetItem = ctx.targetItem;

    for (var targetLinkIndex = 0; targetLinkIndex < targetItems.length; targetLinkIndex++) {
        var targetLinkStatus = targetItems[targetLinkIndex].linkStatus;
        if (targetLinkStatus === 1) {
            alert(localText("リンク切れ画像です。", "The linked image is missing."));
            return;
        } else if (targetLinkStatus === 2) {
            alert(localText("リンクが更新されていません。", "The link is not updated."));
            return;
        }
    }

    var targetSizeInfo = findInDesignMinMaxIndices(targetItems);
    var smallestItem = targetItems[targetSizeInfo.minIndex];
    var hScale = targetItem.hScale;
    var vScale = targetItem.vScale;
    var placedWmm = targetItem.placedWmm;
    var placedHmm = targetItem.placedHmm;
    var placedLongMM = Math.max(placedWmm, placedHmm);
    var effectivePPI = targetItem.effectivePPI;
    var minSizePpi = smallestItem.effectivePPI;
    var scaleDiff = Math.abs(hScale - vScale);
    var isUniformScale = scaleDiff <= 0.01;

    function calcRequiredPx(longMM, ppi) {
        return Math.round(longMM * ppi / 25.4);
    }

    var ppiLine = isUniformScale
        ? localText("画像ppi: ", "Image ppi: ") + currentPPI + localText("（実効ppi: ", " (effective ppi: ") + effectivePPI.toFixed(2) + localText("）", ")") + "\n"
        : localText("画像ppi: ", "Image ppi: ") + currentPPI + localText("（実効ppi(最小): ", " (effective ppi, minimum: ") + effectivePPI.toFixed(2) + localText("）", ")") + "\n";
    var scaleLine = isUniformScale
        ? localText("配置スケール: ", "Placed scale: ") + hScale.toFixed(3) + " %\n"
        : localText("配置スケール: H ", "Placed scale: H ") + hScale.toFixed(3) + " % / V " + vScale.toFixed(3) + " %\n";
    var messageBase = localText("InDesign配置サイズ(長辺): ", "InDesign placed size (long side): ") + placedLongMM.toFixed(2) + " mm\n" +
        ppiLine +
        scaleLine +
        localText("画像ピクセル: ", "Image pixels: ") + longPx + "\n";

    var inDesignSelectionHandle = {
        linkIndex: (targetItem.linkIndex != null) ? Number(targetItem.linkIndex) : null,
        pathFs: encodeURI(imgPath),
        items: candidateItemsArray
    };

    var hasSmartObject = containsSmartObject(doc);
    var dialogResult = showConfirmDialog(messageBase, placedWmm, placedHmm, docWidthPx, docHeightPx, imgPath, hasSmartObject, effectivePPI, minSizePpi, targetItems.length, inDesignSelectionHandle, ctx.matchType === "nameOnly");
    try {
        if (dialogResult && dialogResult.hasOwnProperty('usePrev')) saveUsePrevOnly(dialogResult.usePrev);
    } catch (_) { }
    if (!dialogResult || dialogResult.cancelled) return;
    var targetPPI = dialogResult.ppi;
    var upscaleMethod = dialogResult.method;
    var downscaleMethod = dialogResult.downMethod;

    var reqWpx = calcRequiredPx(placedWmm, targetPPI);
    var reqHpx = calcRequiredPx(placedHmm, targetPPI);
    var scaleRatio = Math.max(reqWpx / docWidthPx, reqHpx / docHeightPx);
    var newWidthPx = Math.round(docWidthPx * scaleRatio);
    var newHeightPx = Math.round(docHeightPx * scaleRatio);

    __HISTORY_CTX__ = {
        newWidthPx: newWidthPx,
        newHeightPx: newHeightPx,
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

function continueInDesignNameOnlyFlow(ctx) {
    if (!ctx) return;
    var fallbackAction = showFallbackLinkConfirmDialog({
        items: ctx.candidateItemsArray,
        photoshopFileName: app.activeDocument.name,
        photoshopPath: ctx.imgPath,
        hasFolderDifference: ctx.hasFolderDifference,
        hasExtensionDifference: ctx.hasExtensionDifference
    });
    if (fallbackAction === "cancel") return;
    if (fallbackAction === "use" && ctx.candidateItemsArray.length === 1) {
        ctx.targetItems = [ctx.defaultTargetItem];
        ctx.targetItem = ctx.defaultTargetItem;
    } else {
        var selectedItem = chooseInDesignItemSync(buildInDesignChooserPayload(ctx.candidateItemsArray, ctx.defaultTargetItem ? ctx.defaultTargetItem.linkIndex : null, {
            title: localText("処理するリンクを選択", "Select Link to Process"),
            messageLine1: buildNameOnlyMessageLine1(ctx.hasFolderDifference, ctx.hasExtensionDifference),
            messageLine2: localText("処理対象にするリンクを選んでください。", "Choose the link to process."),
            messageLine3: localText("選ぶと該当リンクを中央表示します。", "Selecting one centers the corresponding link."),
            photoshopPathRaw: ctx.imgPath
        }));
        if (!selectedItem) return;
        ctx.targetItems = [selectedItem];
        ctx.targetItem = selectedItem;
    }
    finalizeInDesignResizeFlow(ctx);
}

// 日本語向け＋欧文の簡易NFC正規化（結合濁点/半濁点＋欧文合成文字を合成文字へ）
function toNFCJa(s) {
    if (!s) return s;
    var map = {
        // ===== Japanese: dakuten / handakuten =====
        "カ\u3099": "ガ",
        "キ\u3099": "ギ",
        "ク\u3099": "グ",
        "ケ\u3099": "ゲ",
        "コ\u3099": "ゴ",
        "サ\u3099": "ザ",
        "シ\u3099": "ジ",
        "ス\u3099": "ズ",
        "セ\u3099": "ゼ",
        "ソ\u3099": "ゾ",
        "タ\u3099": "ダ",
        "チ\u3099": "ヂ",
        "ツ\u3099": "ヅ",
        "テ\u3099": "デ",
        "ト\u3099": "ド",
        "ハ\u3099": "バ",
        "ヒ\u3099": "ビ",
        "フ\u3099": "ブ",
        "ヘ\u3099": "ベ",
        "ホ\u3099": "ボ",
        "ウ\u3099": "ヴ",
        "ワ\u3099": "ヷ",
        "ヰ\u3099": "ヸ",
        "ヱ\u3099": "ヹ",
        "ヲ\u3099": "ヺ",
        "ハ\u309A": "パ",
        "ヒ\u309A": "ピ",
        "フ\u309A": "プ",
        "ヘ\u309A": "ペ",
        "ホ\u309A": "ポ",
        "か\u3099": "が",
        "き\u3099": "ぎ",
        "く\u3099": "ぐ",
        "け\u3099": "げ",
        "こ\u3099": "ご",
        "さ\u3099": "ざ",
        "し\u3099": "じ",
        "す\u3099": "ず",
        "せ\u3099": "ぜ",
        "そ\u3099": "ぞ",
        "た\u3099": "だ",
        "ち\u3099": "ぢ",
        "つ\u3099": "づ",
        "て\u3099": "で",
        "と\u3099": "ど",
        "は\u3099": "ば",
        "ひ\u3099": "び",
        "ふ\u3099": "ぶ",
        "へ\u3099": "べ",
        "ほ\u3099": "ぼ",
        "う\u3099": "ゔ",
        "は\u309A": "ぱ",
        "ひ\u309A": "ぴ",
        "ふ\u309A": "ぷ",
        "へ\u309A": "ぺ",
        "ほ\u309A": "ぽ",

        // ===== Latin: acute U+0301 =====
        "A\u0301": "Á",
        "E\u0301": "É",
        "I\u0301": "Í",
        "O\u0301": "Ó",
        "U\u0301": "Ú",
        "Y\u0301": "Ý",
        "a\u0301": "á",
        "e\u0301": "é",
        "i\u0301": "í",
        "o\u0301": "ó",
        "u\u0301": "ú",
        "y\u0301": "ý",
        // grave U+0300
        "A\u0300": "À",
        "E\u0300": "È",
        "I\u0300": "Ì",
        "O\u0300": "Ò",
        "U\u0300": "Ù",
        "a\u0300": "à",
        "e\u0300": "è",
        "i\u0300": "ì",
        "o\u0300": "ò",
        "u\u0300": "ù",
        // circumflex U+0302
        "A\u0302": "Â",
        "E\u0302": "Ê",
        "I\u0302": "Î",
        "O\u0302": "Ô",
        "U\u0302": "Û",
        "a\u0302": "â",
        "e\u0302": "ê",
        "i\u0302": "î",
        "o\u0302": "ô",
        "u\u0302": "û",
        // diaeresis U+0308 (umlaut – e.g., ü)
        "A\u0308": "Ä",
        "E\u0308": "Ë",
        "I\u0308": "Ï",
        "O\u0308": "Ö",
        "U\u0308": "Ü",
        "Y\u0308": "Ÿ",
        "a\u0308": "ä",
        "e\u0308": "ë",
        "i\u0308": "ï",
        "o\u0308": "ö",
        "u\u0308": "ü",
        "y\u0308": "ÿ",
        // tilde U+0303
        "A\u0303": "Ã",
        "N\u0303": "Ñ",
        "O\u0303": "Õ",
        "a\u0303": "ã",
        "n\u0303": "ñ",
        "o\u0303": "õ",
        // ring above U+030A (e.g., å)
        "A\u030A": "Å",
        "a\u030A": "å",
        // macron U+0304 (āēīōū)
        "A\u0304": "Ā",
        "E\u0304": "Ē",
        "I\u0304": "Ī",
        "O\u0304": "Ō",
        "U\u0304": "Ū",
        "a\u0304": "ā",
        "e\u0304": "ē",
        "i\u0304": "ī",
        "o\u0304": "ō",
        "u\u0304": "ū",
        // caron U+030C (čšžřň etc.)
        "C\u030C": "Č",
        "D\u030C": "Ď",
        "E\u030C": "Ě",
        "N\u030C": "Ň",
        "R\u030C": "Ř",
        "S\u030C": "Š",
        "T\u030C": "Ť",
        "Z\u030C": "Ž",
        "c\u030C": "č",
        "d\u030C": "ď",
        "e\u030C": "ě",
        "n\u030C": "ň",
        "r\u030C": "ř",
        "s\u030C": "š",
        "t\u030C": "ť",
        "z\u030C": "ž",
        // dot above U+0307 (ż)
        "Z\u0307": "Ż",
        "z\u0307": "ż",
        // ogonek U+0328 (ą ę)
        "A\u0328": "Ą",
        "E\u0328": "Ę",
        "a\u0328": "ą",
        "e\u0328": "ę",
        // cedilla U+0327 (ç)
        "C\u0327": "Ç",
        "c\u0327": "ç"
    };
    var out = String(s);
    for (var k in map) {
        out = out.split(k).join(map[k]);
    }
    return out;
}
// 上の正規化関数をBridgeTalk本文に埋め込むためのソース文字列
var NFC_HELPER_SRC = toNFCJa.toString();
// パス正規化: toNFCJa + File.resolve + fsName を統一的に適用する関数
function _normPathLocal(p) {
    try {
        var f = new File(p);
        try {
            f = f.resolve();
        } catch (_e) { };
        var s = f.fsName;
        return toNFCJa(s);
    } catch (e) {
        try {
            return toNFCJa(String(p));
        } catch (e2) {
            return String(p);
        }
    }
}
var NORM_HELPER_SRC = _normPathLocal.toString();

// InDesign側用: NFC処理なしのパス正規化
function _normPathLocalNoNFC(p) {
    try {
        var f = new File(p);
        try {
            f = f.resolve();
        } catch (_e) { };
        return f.fsName;
    } catch (e) {
        try {
            return String(p);
        } catch (e2) {
            return String(p);
        }
    }
}
var NORM_HELPER_SRC_ID = _normPathLocalNoNFC.toString();

function splitSimpleFileNameInfo(fileName) {
    var value = String(fileName || "");
    var lastSlashIndex = Math.max(value.lastIndexOf("/"), value.lastIndexOf("\\"));
    if (lastSlashIndex >= 0) {
        value = value.substring(lastSlashIndex + 1);
    }
    var dotIndex = value.lastIndexOf(".");
    return {
        fileName: value,
        baseName: (dotIndex > 0) ? value.substring(0, dotIndex) : value,
        extension: (dotIndex > 0) ? value.substring(dotIndex + 1) : ""
    };
}

function main() {
    // 前提チェック: ドキュメント未オープンなら中止
    if (!app.documents.length) {
        alert(localText("開いているドキュメントがありません。", "No document is open."));
        return;
    }
    var doc = app.activeDocument;
    var imgPath = "";
    try {
        imgPath = _normPathLocal(doc.fullName.fsName); // 送信前に toNFCJa + resolve + fsName で正規化
    } catch (pathError) {
        alert(localText("保存されていないドキュメントでは実行できません。保存してから実行してください。", "This script cannot run on an unsaved document. Save the document and run it again."));
        return;
    }
    var docWidthPx = doc.width.as("px");
    var docHeightPx = doc.height.as("px");
    var currentPPI = doc.resolution;

    var idSideSrc = inDesignSide.toString()
        .replace("/*__INJECT_HELPERS__*/",
            "var _normPath = " + NORM_HELPER_SRC_ID + ";\n" +
            "var _matchLinkPath = " + MATCH_LINK_HELPER_SRC + ";\n" +
            "var _decodeAndNormalizePath = " + DECODE_NORM_HELPER_SRC + ";\n" +
            "var _decodePathRaw = " + DECODE_RAW_HELPER_SRC + ";");
    var btBody = "(" + idSideSrc + ")(" + toSourceLiteral({
        pathFs: encodeURI(imgPath),
        fileName: String(doc.name || "")
    }) + ");"; // InDesign側関数を文字列化し、エンコード済みパスを引数に即時実行
    var btResult = sendBridgeTalkAndWait("indesign", btBody, 30000);
    if (!btResult.ok) {
        alert(localText("InDesign通信エラー: ", "InDesign communication error: ") + btResult.error);
        return;
    }

    var data = btResult.body;
    if (!data || data == "null") {
        alert(localText("InDesignで該当リンク画像が見つかりません。", "The matching linked image was not found in InDesign."));
        return;
    }
    var obj = parseBridgeTalkJson(data, data, "InDesign");
    if (!obj) return;
    var matchedItems = (obj && obj.items && obj.items.length) ? obj.items : null;
    if (!matchedItems) {
        matchedItems = [{
            hScale: obj.hScale,
            vScale: obj.vScale,
            linkStatus: obj.linkStatus,
            linkIndex: obj.linkIndex
        }];
    }
    var matchType = (obj && obj.matchType) ? String(obj.matchType) : "exact";
    var hasFolderDifference = !!(obj && obj.hasFolderDifference);
    var hasExtensionDifference = !!(obj && obj.hasExtensionDifference);
    if (matchType === "nameOnly") {
        var targetNameInfo = splitSimpleFileNameInfo(doc.name);
        var normalizedDocPath = String(imgPath || "").replace(/[\/\\¥￥＼]+/g, "/");
        var lastDocSlash = normalizedDocPath.lastIndexOf("/");
        var docFolder = (lastDocSlash >= 0) ? normalizedDocPath.substring(0, lastDocSlash) : "";
        var filteredItems = [];
        for (var matchedIndex = 0; matchedIndex < matchedItems.length; matchedIndex++) {
            var candidateItem = matchedItems[matchedIndex] || {};
            var candidateNameInfo = splitSimpleFileNameInfo(candidateItem.rawFileName || candidateItem.fileName || "");
            if (!targetNameInfo.baseName || !candidateNameInfo.baseName) continue;
            if (targetNameInfo.baseName !== candidateNameInfo.baseName) continue;
            filteredItems.push(candidateItem);
        }
        matchedItems = filteredItems;
        if (!matchedItems.length) {
            alert(localText("同名のリンク候補を特定できませんでした。", "Could not identify the same-name link candidate."));
            return;
        }
        hasFolderDifference = false;
        hasExtensionDifference = false;
        for (var filteredIndex = 0; filteredIndex < matchedItems.length; filteredIndex++) {
            var filteredItem = matchedItems[filteredIndex] || {};
            var filteredNameInfo = splitSimpleFileNameInfo(filteredItem.rawFileName || filteredItem.fileName || "");
            var filteredPath = String(filteredItem.rawFilePath || filteredItem.filePath || "");
            var normalizedFilteredPath = filteredPath.replace(/[\/\\¥￥＼]+/g, "/");
            var lastFilteredSlash = normalizedFilteredPath.lastIndexOf("/");
            var filteredFolder = (lastFilteredSlash >= 0) ? normalizedFilteredPath.substring(0, lastFilteredSlash) : "";
            if (filteredFolder !== docFolder) hasFolderDifference = true;
            if (filteredNameInfo.extension !== targetNameInfo.extension) hasExtensionDifference = true;
        }
    }

    var longPx = Math.max(docWidthPx, docHeightPx);

    for (var itemIndex = 0; itemIndex < matchedItems.length; itemIndex++) {
        var item = matchedItems[itemIndex];
        var itemPlacedWmm = docWidthPx * (item.hScale / 100) / currentPPI * 25.4;
        var itemPlacedHmm = docHeightPx * (item.vScale / 100) / currentPPI * 25.4;
        var itemLongMM = Math.max(itemPlacedWmm, itemPlacedHmm);
        item.placedWmm = itemPlacedWmm;
        item.placedHmm = itemPlacedHmm;
        item.placedLongMM = itemLongMM;
        item.effectivePPI = Math.min(
            docWidthPx * 25.4 / itemPlacedWmm,
            docHeightPx * 25.4 / itemPlacedHmm
        );
    }

    var candidateItemsArray = matchedItems;
    var candidateSizeInfo = findInDesignMinMaxIndices(candidateItemsArray);
    var defaultTargetItem = candidateItemsArray[candidateSizeInfo.maxIndex];
    var flowCtx = {
        docWidthPx: docWidthPx,
        docHeightPx: docHeightPx,
        currentPPI: currentPPI,
        longPx: longPx,
        imgPath: imgPath,
        candidateItemsArray: candidateItemsArray,
        defaultTargetItem: defaultTargetItem,
        targetItems: candidateItemsArray,
        targetItem: defaultTargetItem,
        matchType: matchType,
        hasFolderDifference: hasFolderDifference,
        hasExtensionDifference: hasExtensionDifference
    };

    if (matchType !== "nameOnly") {
        for (var linkIndex = 0; linkIndex < candidateItemsArray.length; linkIndex++) {
            var linkStatus = candidateItemsArray[linkIndex].linkStatus;
            if (linkStatus === 1) {
                alert(localText("リンク切れ画像です。", "The linked image is missing."));
                return;
            } else if (linkStatus === 2) {
                alert(localText("リンクが更新されていません。", "The link is not updated."));
                return;
            }
        }
    }

    if (matchType === "nameOnly") {
        continueInDesignNameOnlyFlow(flowCtx);
        return;
    }

    finalizeInDesignResizeFlow(flowCtx);
}

// InDesign側で使用する共通関数: リンクパス一致判定
// この関数は文字列化されてInDesign側に送られる
function _matchLinkPath(linkFilePath, rawTargetPath, targetNorm) {
    if (String(linkFilePath || "") === String(rawTargetPath || "")) return true;
    var lnkNorm = _normPath(linkFilePath);
    return (lnkNorm === targetNorm);
}
var MATCH_LINK_HELPER_SRC = _matchLinkPath.toString();

// InDesign側で使用する共通関数: パスのデコードと正規化
function _decodeAndNormalizePath(encodedPath) {
    var decoded = decodeURI(encodedPath);
    try {
        decoded = _normPath(decoded);
    } catch (_e) { }
    return decoded;
}
var DECODE_NORM_HELPER_SRC = _decodeAndNormalizePath.toString();

// InDesign側で使用する共通関数: パスのデコード（正規化なし）
function _decodePathRaw(encodedPath) {
    var decoded = decodeURI(encodedPath);
    return decoded;
}
var DECODE_RAW_HELPER_SRC = _decodePathRaw.toString();

// InDesign側: 一致するリンク一覧を返す
function inDesignSide(targetInfo) {
    /*__INJECT_HELPERS__*/
    var isWindows = $.os.indexOf("Windows") >= 0;
    var encodedPath = targetInfo && targetInfo.pathFs ? String(targetInfo.pathFs) : "";
    var decodedRaw = _decodePathRaw(encodedPath); // 生文字列（NFCのみ）
    var decodedNorm = _decodeAndNormalizePath(encodedPath); // 正規化済み
    if (app.documents.length === 0) return null;

    var PATH_SEPARATOR_PATTERN = new RegExp("[/\\\\\\u00A5\\uFFE5\\uFF3C]");
    var PATH_SEPARATOR_REPEAT_PATTERN = new RegExp("[/\\\\\\u00A5\\uFFE5\\uFF3C]+", "g");

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

    function splitFileNameInfo(fileName) {
        var normalizedFileName = decodeUriSafe(fileName);
        normalizedFileName = String(normalizedFileName || "");
        if (containsPathSeparator(normalizedFileName)) {
            normalizedFileName = splitPathInfo(normalizedFileName).fileName;
        }
        var dotIndex = normalizedFileName.lastIndexOf(".");
        var baseName = (dotIndex > 0) ? normalizedFileName.substring(0, dotIndex) : normalizedFileName;
        var extension = (dotIndex > 0) ? normalizedFileName.substring(dotIndex + 1) : "";
        if (isWindows) {
            normalizedFileName = normalizedFileName.toLowerCase();
            baseName = baseName.toLowerCase();
            extension = extension.toLowerCase();
        }
        return {
            fileName: normalizedFileName,
            baseName: baseName,
            extension: extension
        };
    }

    function buildNameOnlyPathInfo(normalizedPath, rawPath) {
        var pathInfo = splitPathInfo(normalizedPath);
        var rawValue = decodeUriSafe(rawPath);
        var fallbackPathInfo = splitPathInfo(rawValue);
        var splitLooksValid = !!pathInfo.baseName;
        if (splitLooksValid && fallbackPathInfo.folderPath && !pathInfo.folderPath) {
            splitLooksValid = false;
        }
        if (splitLooksValid && containsPathSeparator(pathInfo.fileName)) {
            splitLooksValid = false;
        }
        return splitLooksValid ? pathInfo : fallbackPathInfo;
    }

    function trimTrailingDisplaySlash(pathText) {
        var value = String(pathText || "");
        while (value.length > 1 && value.charAt(value.length - 1) === "/") {
            value = value.substring(0, value.length - 1);
        }
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
        var normalizedDisplayPath = decodeUriSafe(pathText);
        normalizedDisplayPath = String(normalizedDisplayPath || "");
        if (isWindows) {
            normalizedDisplayPath = normalizeDisplaySlashesLocal(normalizedDisplayPath, "/");
            return normalizedDisplayPath;
        }
        return normalizedDisplayPath.split("\\ ").join(" ");
    }

    function buildDisplayPathInfo(rawPath, rawFileName) {
        var normalizedDisplayPath = normalizeDisplayPath(rawPath);
        var normalizedDisplayFileName = normalizeDisplayPath(rawFileName);
        if (normalizedDisplayPath && normalizedDisplayFileName) {
            var comparePath = normalizedDisplayPath.toLowerCase();
            var compareFileName = normalizedDisplayFileName.toLowerCase();
            if (comparePath.length >= compareFileName.length &&
                comparePath.substring(comparePath.length - compareFileName.length) === compareFileName) {
                return {
                    folderPath: trimTrailingDisplaySlash(normalizedDisplayPath.substring(0, normalizedDisplayPath.length - normalizedDisplayFileName.length)),
                    fileName: normalizedDisplayFileName
                };
            }
        }
        var slashIndex = normalizedDisplayPath.lastIndexOf("/");
        return {
            folderPath: (slashIndex >= 0) ? normalizedDisplayPath.substring(0, slashIndex) : "",
            fileName: normalizedDisplayFileName || ((slashIndex >= 0) ? normalizedDisplayPath.substring(slashIndex + 1) : normalizedDisplayPath)
        };
    }

    function getLinkStatusCode(link) {
        if (link.status == LinkStatus.NORMAL) return 0;
        if (link.status == LinkStatus.LINK_MISSING) return 1;
        return 2;
    }

    function getLinkScaleInfo(link) {
        var parent = link.parent;
        var h = 0;
        var v = 0;
        if (link.status == LinkStatus.NORMAL) {
            try {
                h = parent.horizontalScale;
                v = parent.verticalScale;
            } catch (_scaleError) {
                h = 0;
                v = 0;
            }
        }
        return {
            hScale: h,
            vScale: v
        };
    }

    function buildItemObject(entry, hScale, vScale, pathInfo, displayPathInfo, resolvedPath) {
        var displayFileName = (displayPathInfo && displayPathInfo.fileName) ? displayPathInfo.fileName : pathInfo.fileName;
        var displayFolderPath = (displayPathInfo && displayPathInfo.folderPath) ? displayPathInfo.folderPath : pathInfo.folderPath;
        var linkStatus = entry.status;
        if (linkStatus == null) {
            linkStatus = getLinkStatusCode(entry.link);
            entry.status = linkStatus;
        }
        return {
            hScale: hScale,
            vScale: vScale,
            linkStatus: linkStatus,
            linkIndex: entry.linkIndex,
            fileName: displayFileName,
            folderPath: displayFolderPath,
            displayFileName: displayFileName,
            displayFolderPath: displayFolderPath,
            filePath: String(resolvedPath || entry.rawFilePath || ""),
            rawFileName: entry.rawFileName,
            rawFilePath: entry.rawFilePath
        };
    }

    function buildLinkEntry(linkIndex, link) {
        var rawFilePath = String(link.filePath || "");
        var rawFileName = String(link.name || "");
        return {
            link: link,
            linkIndex: linkIndex,
            status: null,
            rawFileName: rawFileName,
            rawFilePath: rawFilePath,
            rawPathInfo: null,
            normalizedFilePath: null,
            normalizedPathInfo: null,
            fileNameInfo: splitFileNameInfo(rawFileName)
        };
    }

    function getEntryRawPathInfo(entry) {
        if (!entry.rawPathInfo) {
            entry.rawPathInfo = buildNameOnlyPathInfo(entry.rawFilePath, entry.rawFilePath);
        }
        return entry.rawPathInfo;
    }

    function getEntryNormalizedPath(entry) {
        if (entry.normalizedFilePath == null) {
            entry.normalizedFilePath = _normPath(entry.rawFilePath);
        }
        return entry.normalizedFilePath;
    }

    function getEntryNormalizedPathInfo(entry) {
        if (!entry.normalizedPathInfo) {
            entry.normalizedPathInfo = buildNameOnlyPathInfo(getEntryNormalizedPath(entry), entry.rawFilePath);
        }
        return entry.normalizedPathInfo;
    }

    function buildResolvedItem(entry, pathInfo, resolvedPath) {
        var scaleInfo = getLinkScaleInfo(entry.link);
        return buildItemObject(
            entry,
            scaleInfo.hScale,
            scaleInfo.vScale,
            pathInfo,
            buildDisplayPathInfo(entry.rawFilePath, entry.rawFileName),
            resolvedPath
        );
    }

    var doc = app.activeDocument;
    var links = doc.links;
    var targetRawPathInfo = buildNameOnlyPathInfo(decodedRaw, decodedRaw);
    var targetFileNameInfo = splitFileNameInfo(targetInfo && targetInfo.fileName ? String(targetInfo.fileName) : targetRawPathInfo.fileName);
    var targetPathInfo = buildNameOnlyPathInfo(decodedNorm, decodedRaw);
    var exactEntries = [];
    var linkEntries = [];
    var hasFolderDifference = false;
    var hasExtensionDifference = false;
    for (var i = 0; i < links.length; i++) {
        var entry = buildLinkEntry(i, links[i]);
        if (entry.rawFilePath === decodedRaw) {
            exactEntries.push(entry);
            continue;
        }
        linkEntries.push(entry);
    }
    if (exactEntries.length) {
        var exactItems = [];
        for (var exactIndex = 0; exactIndex < exactEntries.length; exactIndex++) {
            exactItems.push(buildResolvedItem(exactEntries[exactIndex], getEntryRawPathInfo(exactEntries[exactIndex]), exactEntries[exactIndex].rawFilePath));
        }
        return ({
            matchType: "exact",
            hasFolderDifference: false,
            hasExtensionDifference: false,
            items: exactItems
        }).toSource();
    }
    var nameOnlyItems = [];
    var candidateEntries = [];
    if (targetFileNameInfo.baseName) {
        for (var rawIndex = 0; rawIndex < linkEntries.length; rawIndex++) {
            var fileNameInfo = linkEntries[rawIndex].fileNameInfo;
            if (fileNameInfo.baseName && fileNameInfo.baseName === targetFileNameInfo.baseName) {
                candidateEntries.push(linkEntries[rawIndex]);
            }
        }
    }
    var normalizedExactEntries = [];
    for (var normalizedExactIndex = 0; normalizedExactIndex < candidateEntries.length; normalizedExactIndex++) {
        var exactCandidateEntry = candidateEntries[normalizedExactIndex];
        if (exactCandidateEntry.rawFilePath === decodedRaw || getEntryNormalizedPath(exactCandidateEntry) === decodedNorm) {
            normalizedExactEntries.push(exactCandidateEntry);
        }
    }
    if (normalizedExactEntries.length) {
        var normalizedExactItems = [];
        for (var normalizedItemIndex = 0; normalizedItemIndex < normalizedExactEntries.length; normalizedItemIndex++) {
            var normalizedEntry = normalizedExactEntries[normalizedItemIndex];
            normalizedExactItems.push(buildResolvedItem(normalizedEntry, getEntryNormalizedPathInfo(normalizedEntry), getEntryNormalizedPath(normalizedEntry)));
        }
        return ({
            matchType: "exact",
            hasFolderDifference: false,
            hasExtensionDifference: false,
            items: normalizedExactItems
        }).toSource();
    }
    for (var candidateIndex = 0; candidateIndex < candidateEntries.length; candidateIndex++) {
        var candidateEntry = candidateEntries[candidateIndex];
        var normalizedLinkPath = getEntryNormalizedPath(candidateEntry);
        var pathInfo = getEntryNormalizedPathInfo(candidateEntry);
        if (!targetFileNameInfo.baseName || !candidateEntry.fileNameInfo.baseName) continue;
        if (targetFileNameInfo.baseName !== candidateEntry.fileNameInfo.baseName) continue;
        if (targetPathInfo.folderPath !== pathInfo.folderPath) hasFolderDifference = true;
        if (targetFileNameInfo.extension !== candidateEntry.fileNameInfo.extension) hasExtensionDifference = true;
        nameOnlyItems.push(buildResolvedItem(candidateEntry, pathInfo, normalizedLinkPath));
    }
    if (nameOnlyItems.length) {
        return ({
            matchType: "nameOnly",
            hasFolderDifference: hasFolderDifference,
            hasExtensionDifference: hasExtensionDifference,
            items: nameOnlyItems
        }).toSource();
    }
    return null; // 一致するリンクなし
}

// InDesign側: リンクを選択・表示する関数（InDesignで表示ボタン用）
function showInInDesignSide(handle) {
    /*__INJECT_HELPERS__*/
    var encodedPath = handle && handle.pathFs ? String(handle.pathFs) : "";
    var decodedRaw = _decodePathRaw(encodedPath); // 生文字列（NFCのみ）
    var decodedNorm = _decodeAndNormalizePath(encodedPath); // 正規化済み
    if (app.documents.length === 0) throw new Error('InDesign: ドキュメントが開かれていません');
    var doc = app.activeDocument;
    var links = doc.links;
    var bestItem = null;
    var bestScale = -1;
    var directLinkIndex = Number(handle && handle.linkIndex);
    if (isFinite(directLinkIndex) && directLinkIndex >= 0 && directLinkIndex < links.length) {
        try {
            bestItem = links[Math.floor(directLinkIndex)].parent;
        } catch (_directLinkError) {
            bestItem = null;
        }
    }
    for (var i = 0; i < links.length; i++) {
        if (bestItem) break;
        var lk = links[i];
        var matched = _matchLinkPath(lk.filePath, decodedRaw, decodedNorm);
        if (matched) {
            if (lk.status != LinkStatus.NORMAL) continue;
            var it = lk.parent;
            var h = 0;
            var v = 0;
            try {
                h = it.horizontalScale;
                v = it.verticalScale;
            } catch (_scaleError) {
                h = 0;
                v = 0;
            }
            var scale = Math.max(h, v);
            if (scale > bestScale) {
                bestScale = scale;
                bestItem = it;
            }
        }
    }
    if (bestItem) {
        var win = null;
        try {
            if (doc.layoutWindows.length > 0) {
                win = doc.layoutWindows[0];
            }
            if (bestItem.parentPage && win) {
                win.activePage = bestItem.parentPage;
            }
        } catch (_pageError) { }
        bestItem.select();
        try {
            if (win) {
                if (!fitSelection(win)) {
                    try {
                        win.zoom(ZoomOptions.FIT_PAGE);
                    } catch (_fitPageError) { }
                }
            }
        } catch (_z) { }
        return;
    }
    throw new Error('InDesign: リンクが見つかりません: ' + decodedRaw);

    function fitSelection(win) {
        try {
            var fitSelectionAction = app.menuActions.itemByName("$ID/Fit Selection in Window");
            if (fitSelectionAction && fitSelectionAction.isValid) {
                fitSelectionAction.invoke();
                return true;
            }
        } catch (_menuError) { }

        try {
            win.zoom(ZoomOptions.FIT_SPREAD);
            return true;
        } catch (_spreadError) { }

        return false;
    }
}

function chooseInInDesignSide(payload) {
    if (app.documents.length === 0) return "null";
    var doc = app.activeDocument;
    var items = (payload && payload.items && payload.items.length) ? payload.items : null;
    if (!items) return "null";
    var isWindows = $.os.indexOf("Windows") >= 0;
    try {
        BridgeTalk.bringToFront("indesign");
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

    function normalizeWindowsDisplayPath(text) {
        var value = decodeDisplayText(text);
        if (!isWindows) return value;
        return normalizeDisplaySlashesLocal(value, "/");
    }

    function buildDisplayInfoFromRawPath(rawPath, rawFileName) {
        var trailingSeparatorPattern = new RegExp("/+$", "g");
        var filePathText = normalizeWindowsDisplayPath(rawPath);
        var fileNameText = decodeDisplayText(rawFileName);
        if (isWindows) {
            fileNameText = normalizeDisplaySlashesLocal(fileNameText, "/");
            if (fileNameText.indexOf("/") >= 0) {
                fileNameText = fileNameText.substring(fileNameText.lastIndexOf("/") + 1);
            }
        }
        if (filePathText && fileNameText) {
            var comparePath = filePathText.toLowerCase();
            var compareFileName = fileNameText.toLowerCase();
            if (comparePath.length >= compareFileName.length &&
                comparePath.substring(comparePath.length - compareFileName.length) === compareFileName) {
                return {
                    fileName: isWindows ? fileNameText.split("/").join("\\") : fileNameText,
                    folderPath: (isWindows ? filePathText.substring(0, filePathText.length - fileNameText.length).replace(trailingSeparatorPattern, "").split("/").join("\\") : filePathText.substring(0, filePathText.length - fileNameText.length).replace(trailingSeparatorPattern, ""))
                };
            }
        }
        var slashIndex = filePathText.lastIndexOf("/");
        return {
            fileName: isWindows
                ? (fileNameText || ((slashIndex >= 0) ? filePathText.substring(slashIndex + 1) : filePathText)).split("/").join("\\")
                : (fileNameText || ((slashIndex >= 0) ? filePathText.substring(slashIndex + 1) : filePathText)),
            folderPath: isWindows
                ? ((slashIndex >= 0) ? filePathText.substring(0, slashIndex) : "").split("/").join("\\")
                : ((slashIndex >= 0) ? filePathText.substring(0, slashIndex) : "")
        };
    }

    function getCandidateDisplayInfo(candidate, index) {
        if (candidate && candidate.rawFilePath) {
            return buildDisplayInfoFromRawPath(candidate.rawFilePath, candidate.rawFileName);
        }
        return {
            fileName: candidate && candidate.displayFileName ? decodeDisplayText(candidate.displayFileName) : (candidate && candidate.fileName ? decodeDisplayText(candidate.fileName) : (remoteText("リンク ", "Link ") + (index + 1))),
            folderPath: candidate && candidate.displayFolderPath ? decodeDisplayText(candidate.displayFolderPath) : (candidate && candidate.folderPath ? decodeDisplayText(candidate.folderPath) : remoteText("(不明)", "(Unknown)"))
        };
    }

    function getPhotoshopDisplayPath() {
        var photoshopPathText = normalizeWindowsDisplayPath((payload && payload.photoshopPathRaw) ? payload.photoshopPathRaw : "");
        return isWindows ? photoshopPathText.split("/").join("\\") : photoshopPathText;
    }

    function fitSelection(win) {
        try {
            var fitSelectionAction = app.menuActions.itemByName("$ID/Fit Selection in Window");
            if (fitSelectionAction && fitSelectionAction.isValid) {
                fitSelectionAction.invoke();
                return true;
            }
        } catch (_menuError) {}
        try {
            win.zoom(ZoomOptions.FIT_SPREAD);
            return true;
        } catch (_spreadError) {}
        return false;
    }

    function findLink(candidate) {
        var linkIndex = Number(candidate ? candidate.linkIndex : NaN);
        if (!isFinite(linkIndex)) return null;
        linkIndex = Math.floor(linkIndex);
        if (linkIndex < 0 || linkIndex >= doc.links.length) return null;
        try {
            return doc.links[linkIndex];
        } catch (error) {
            return null;
        }
    }

    function focusCandidate(candidate) {
        var link = findLink(candidate);
        if (!link) return;
        var item = null;
        try {
            item = link.parent;
        } catch (error) {
            item = null;
        }
        if (!item) return;
        var win = null;
        try {
            if (doc.layoutWindows.length > 0) win = doc.layoutWindows[0];
            if (item.parentPage && win) win.activePage = item.parentPage;
        } catch (error) {}
        try {
            item.select();
        } catch (error) {}
        try {
            if (win && !fitSelection(win)) {
                try {
                    win.zoom(ZoomOptions.FIT_PAGE);
                } catch (_fitPageError) {}
            }
        } catch (error) {}
    }

    function buildLabel(candidate, index) {
        var indexText = String(index + 1);
        if (indexText.length < 2) indexText = "0" + indexText;
        var displayInfo = getCandidateDisplayInfo(candidate, index);
        var nameText = displayInfo.fileName;
        var folderText = displayInfo.folderPath;
        return indexText + "　" + nameText + "　" + folderText;
    }

    function updateDetailText(detailControls, candidate) {
        if (!detailControls) return;
        var photoshopPathText = getPhotoshopDisplayPath();
        if (!candidate) {
            detailControls.pathText.text = "";
            detailControls.ppiText.text = "";
            return;
        }
        var effectivePpi = Number(candidate.effectivePPI) || NaN;
        detailControls.pathText.text = remoteText("Photoshop画像パス：", "Photoshop image path: ") + (photoshopPathText || remoteText("(不明)", "(Unknown)"));
        detailControls.ppiText.text = remoteText("選択した配置サイズでのppi：", "PPI at selected placed size: ") + (isFinite(effectivePpi) ? effectivePpi.toFixed(2) : "-");
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
    var pathText = detailGroup.add("statictext", undefined, "");
    pathText.minimumSize.width = 820;
    var ppiText = detailGroup.add("statictext", undefined, "");
    ppiText.minimumSize.width = 820;
    var detailControls = {
        pathText: pathText,
        ppiText: ppiText
    };

    listBox.onChange = function() {
        if (!this.selection) return;
        updateDetailText(detailControls, this.selection.candidate);
        focusCandidate(this.selection.candidate);
    };

    var initialListIndex = 0;
    if (payload && payload.initialLinkIndex != null) {
        for (var initialIndex = 0; initialIndex < items.length; initialIndex++) {
            if (Number(items[initialIndex].linkIndex) === Number(payload.initialLinkIndex)) {
                initialListIndex = initialIndex;
                break;
            }
        }
    }
    if (listBox.items.length > 0) {
        listBox.selection = listBox.items[initialListIndex];
        updateDetailText(detailControls, listBox.selection.candidate);
    }

    dialog.onShow = function() {
        try {
            BridgeTalk.bringToFront("indesign");
        } catch (error) {}
        try {
            app.bringToFront();
        } catch (error) {}
        if (!listBox.selection) return;
        focusCandidate(listBox.selection.candidate);
    };

    var buttonGroup = dialog.add("group");
    buttonGroup.orientation = "row";
    buttonGroup.alignment = ["right", "center"];
    var cancelButton = buttonGroup.add("button", undefined, remoteText("キャンセル", "Cancel"), { name: "cancel" });
    var okButton = buttonGroup.add("button", undefined, "OK", { name: "ok" });

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

    dialog.preferredSize = [860, 430];
    var dialogResult = dialog.show();
    if (dialogResult !== 1 || !listBox.selection) {
        return "null";
    }
    return listBox.selection.candidate.toSource();
}

function chooseInDesignItemSync(payload) {
    var body = "(" +
        "function(){" +
        "var remoteLocaleCode = " + toSourceLiteral(currentLocaleCode()) + ";" +
        "function remoteText(jaText, enText) { return remoteLocaleCode === 'en' ? enText : jaText; }" +
        chooseInInDesignSide.toString() + "\n" +
        "return chooseInInDesignSide(" + toSourceLiteral(payload) + ");" +
        "}" +
        ")();";
    try {
        BridgeTalk.bringToFront("indesign");
    } catch (error) {}
    var bridgeTalkResult = sendBridgeTalkAndWait("indesign", body, 300000);
    activatePhotoshopWindow();
    if (!bridgeTalkResult.ok) {
        alert(localText("InDesign通信エラー: ", "InDesign communication error: ") + bridgeTalkResult.error);
        return null;
    }
    if (!bridgeTalkResult.body || bridgeTalkResult.body == "null") {
        return null;
    }
    return parseBridgeTalkJson(bridgeTalkResult.body, bridgeTalkResult.body, "InDesign");
}

function selectInInDesign(handle) {
    var chooserPayload = buildInDesignChooserPayload(handle && handle.items ? handle.items : [], handle ? handle.linkIndex : null, {
        title: localText("InDesignでリンクを選択", "Select Link in InDesign"),
        messageLine1: localText("候補が複数あります。", "There are multiple candidates."),
        messageLine2: localText("選ぶと該当リンクを中央表示します。", "Selecting one centers the corresponding link."),
        photoshopPathRaw: handle && handle.pathFs ? String(handle.pathFs) : ""
    });
    var btShow = new BridgeTalk();
    btShow.target = "indesign";
    btShow.onResult = function() {
        try {
            BridgeTalk.bringToFront("indesign");
        } catch (_bringToFrontError) {}
    };
    btShow.onError = function(e) {
        alert(localText("InDesign通信エラー: ", "InDesign communication error: ") + e.body);
    };
    var showSrc = showInInDesignSide.toString()
        .replace("/*__INJECT_HELPERS__*/",
            "var _normPath = " + NORM_HELPER_SRC_ID + ";\n" +
            "var _matchLinkPath = " + MATCH_LINK_HELPER_SRC + ";\n" +
            "var _decodeAndNormalizePath = " + DECODE_NORM_HELPER_SRC + ";\n" +
            "var _decodePathRaw = " + DECODE_RAW_HELPER_SRC + ";");
    btShow.body = "(" +
        "function(){" +
        "var remoteLocaleCode = " + toSourceLiteral(currentLocaleCode()) + ";" +
        "function remoteText(jaText, enText) { return remoteLocaleCode === 'en' ? enText : jaText; }" +
        chooseInInDesignSide.toString() + "\n" +
        showSrc + "\n" +
        "var __handle = " + toSourceLiteral(handle || {}) + ";" +
        "if (__handle.items && __handle.items.length > 1) {" +
        "chooseInInDesignSide(" + toSourceLiteral(chooserPayload) + ");" +
        "} else {" +
        "showInInDesignSide(__handle);" +
        "}" +
        "}" +
        ")();";
    try {
        BridgeTalk.bringToFront("indesign");
    } catch (_bringToFrontBeforeSendError) {}
    btShow.send();
}

// リサイズ確認ダイアログ: 画像情報（非ボールド）+ 配置情報（ボールド）+ ppi/メソッド選択 + 警告
function showConfirmDialog(messageBase, placedWmm, placedHmm, docWidthPx, docHeightPx, imgPath, hasSmartObject, placedPPI, minSizePpi, matchedItemCount, selectionHandle, usesNameOnlyLinkInfo) {
    var WARN_STYLE_RED_BOLD = "redBold";
    var WARN_STYLE_DEFAULT_BOLD = "defaultBold";
    var WARN_STYLE_DEFAULT_NORMAL = "defaultNormal";
    var doc = app.activeDocument;
    var prefs = loadPrefs();
    var resolutionLabels = [];
    for (var resolutionIndex = 0; resolutionIndex < targetPPIList.length; resolutionIndex++) {
        resolutionLabels.push(String(targetPPIList[resolutionIndex]));
    }
    var methodLabels = [
        localText("ディテールを保持2.0（推奨）", "Preserve Details 2.0 (Recommended)"),
        localText("ディテールを保持（旧）", "Preserve Details (Legacy)"),
        localText("ニアレストネイバー", "Nearest Neighbor")
    ];
    var methodValues = [
        "deepUpscale",
        "preserveDetails",
        "nearestNeighbor"
    ];
    var downMethodLabels = [
        localText("バイキュービック（滑らか）", "Bicubic (Smooth)"),
        localText("ニアレストネイバー", "Nearest Neighbor")
    ];
    var downMethodValues = [
        "bicubic",
        "nearestNeighbor"
    ];
    var initialState = {
        radioIndex: 0,
        upscaleMethod: "deepUpscale",
        downMethod: "bicubic"
    };
    if (prefs.usePrev) {
        initialState.radioIndex = (prefs.radioIndex >= 0 && prefs.radioIndex < targetPPIList.length) ? prefs.radioIndex : 0;
        initialState.upscaleMethod = prefs.upscaleMethod || initialState.upscaleMethod;
        initialState.downMethod = prefs.downMethod || initialState.downMethod;
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

        var fileNamePS = doc.name;
        var filePathPS;
        try {
            filePathPS = doc.fullName.parent.fsName;
        } catch (e) {
            filePathPS = localText("(未保存)", "(Unsaved)");
        }
        var colorProfilePS;
        try {
            colorProfilePS = doc.colorProfileName;
        } catch (e) {
            colorProfilePS = localText("(不明)", "(Unknown)");
        }
        var headInfo =
            localText("ファイル名: ", "File name: ") + fileNamePS + "\n" +
            localText("フォルダ: ", "Folder: ") + filePathPS + "\n" +
            localText("カラーモード：", "Color mode: ") + modeToString(doc.mode) + localText("（", " (") + colorProfilePS + localText("）", ")");
        var infoText = panel.add("statictext", undefined, headInfo, {
            multiline: true
        });
        infoText.minimumSize.width = 400;
        try {
            infoText.minimumSize.height = infoText.preferredSize.height;
            infoText.maximumSize.height = infoText.preferredSize.height;
        } catch (e) { }

        var messageText = panel.add("statictext", undefined, infoMessage, {
            multiline: true
        });
        messageText.minimumSize.width = 400;
        try {
            messageText.minimumSize.height = messageText.preferredSize.height;
            messageText.maximumSize.height = messageText.preferredSize.height;
            messageText.graphics.font = ScriptUI.newFont(messageText.graphics.font.name, "Bold", messageText.graphics.font.size);
        } catch (e) { }

        var extraText = null;
        if (matchedItemCount > 1) {
            extraText = panel.add("statictext", undefined, "", {
                multiline: true
            });
            extraText.minimumSize.width = 400;
            try {
                extraText.graphics.font = ScriptUI.newFont(extraText.graphics.font.name, "Bold", extraText.graphics.font.size);
            } catch (e) { }
        }

        return {
            panel: panel,
            infoText: infoText,
            messageText: messageText,
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
            redBold.graphics.font = ScriptUI.newFont(redBold.graphics.font.name, "Bold", redBold.graphics.font.size);
            defaultBold.graphics.font = ScriptUI.newFont(defaultBold.graphics.font.name, "Bold", defaultBold.graphics.font.size);
        } catch (e) { }
        try {
            var redPen = redBold.graphics.newPen(redBold.graphics.PenType.SOLID_COLOR, [1, 0, 0, 1], 1);
            redBold.graphics.foregroundColor = redPen;
        } catch (e) { }
        return {
            redBold: redBold,
            defaultBold: defaultBold,
            defaultNormal: defaultNormal
        };
    }

    function buildUsePrevArea(dlg, currentPrefs) {
        var group = dlg.add("group");
        group.alignment = ["left", "center"];
        var checkbox = group.add("checkbox", undefined, localText("▶前回設定値を使用する", "Use previous settings"));
        checkbox.value = currentPrefs.usePrev === true;

        var infoText = dlg.add("statictext", undefined, " ");
        infoText.minimumSize.width = 400;
        infoText.alignment = ["fill", "top"];
        try {
            var font = infoText.graphics.font;
            infoText.graphics.font = ScriptUI.newFont(font.name, "Bold", font.size);
        } catch (e) { }

        function buildPrevSettingsLine() {
            var ppiIndex = (currentPrefs.radioIndex >= 0 && currentPrefs.radioIndex < targetPPIList.length) ? currentPrefs.radioIndex : 0;
            var ppiText = String(targetPPIList[ppiIndex]);
            var upText = pickLabelByValue(currentPrefs.upscaleMethod, methodValues, methodLabels, methodLabels[0]);
            var downText = pickLabelByValue(currentPrefs.downMethod, downMethodValues, downMethodLabels, downMethodLabels[0]);
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
        group.alignment = "center";
        group.margins = [0, 15, 0, 0];
        var okButton = group.add("button", undefined, localText("処理する (Enter)", "Process (Enter)"));
        var cancelButton = group.add("button", undefined, localText("キャンセル (Esc)", "Cancel (Esc)"));
        var appButton = group.add("button", undefined, localText("InDesignで表示 (I)", "Show in InDesign (I)"));
        var helpButton = group.add("button", undefined, "?");

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
            method: selectedUpscaleMethod,
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
        } catch (e) { }
        for (var i = 0; i < ui.resolution.buttons.length; i++) ui.resolution.buttons[i].enabled = isEnabled;
        for (var j = 0; j < ui.upscale.buttons.length; j++) ui.upscale.buttons[j].enabled = isEnabled;
        for (var k = 0; k < ui.downscale.buttons.length; k++) ui.downscale.buttons[k].enabled = isEnabled;
    }

    function computeDialogState(selectionState, historyWarning) {
        var requiredW = Math.round(placedWmm * selectionState.ppi / 25.4);
        var requiredH = Math.round(placedHmm * selectionState.ppi / 25.4);
        var scale = Math.max(requiredW / docWidthPx, requiredH / docHeightPx);
        var scalePct = scale * 100;
        var warningBag = createWarningBag();
        addWarning(warningBag, WARN_STYLE_DEFAULT_NORMAL, hasSmartObject ? SMART_OBJECT_INTERP_WARNING : "");
        if (placedWmm > 0 && placedHmm > 0) {
            var effW = docWidthPx * 25.4 / placedWmm;
            var effH = docHeightPx * 25.4 / placedHmm;
            if (Math.abs(effW - effH) > 0.01) {
                addWarning(warningBag, WARN_STYLE_DEFAULT_NORMAL, localText("※縦横比が異なるため、実効PPIの最小値が", "Because the aspect ratio differs, the minimum effective PPI will be ") + selectionState.ppi + localText("になるようにします。", "."));
            }
        }
        addWarning(warningBag, WARN_STYLE_RED_BOLD, historyWarning);

        var isBitmap = false;
        try {
            if (doc && doc.mode == DocumentMode.BITMAP) isBitmap = true;
        } catch (e) { }
        if (isBitmap) {
            addWarning(warningBag, WARN_STYLE_RED_BOLD, localText("【注意：キャンセル推奨】\n　2値画像のリサイズは、モアレが発生しやすいため推奨しません。\n　リサンプルする場合は2,400ppi以下、600ppi以上を選択してください。", "[Caution: cancel recommended]\nResizing bitmap images is not recommended because moire is likely to occur.\nIf resampling, choose 2,400 ppi or lower and 600 ppi or higher."));
        } else {
            if (scale >= efScaleMin && scale <= efScaleMax) {
                addWarning(warningBag, WARN_STYLE_RED_BOLD, localText("【注意：キャンセルを推奨】\n　拡大率が ", "[Caution: cancel recommended]\nScale is ") + scalePct.toFixed(2) + localText("% です。無駄な拡縮で、余計な画像劣化の可能性があります。", "%. This may be unnecessary scaling and can cause extra image degradation."));
            }
            if (scale > scaleMax) {
                addWarning(warningBag, WARN_STYLE_RED_BOLD, localText("【警告：キャンセルを推奨】\n　拡大率が ", "[Warning: cancel recommended]\nScale exceeds ") + (scaleMax * 100).toFixed(0) + localText("% を超えています。\n　Photoshop以外の手段を検討してください。", "%. Consider a method other than Photoshop."));
            }
        }
        if (matchedItemCount > 1 && isFinite(placedPPI) && placedPPI > 0 && isFinite(minSizePpi)) {
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
        return {
            scaleText: localText("拡縮率: ", "Scale: ") + scalePct.toFixed(2) + " %",
            warningBag: warningBag,
            postResizeMinPpi: (matchedItemCount > 1 && isFinite(placedPPI) && placedPPI > 0 && isFinite(minSizePpi))
                ? (minSizePpi * (selectionState.ppi / placedPPI))
                : NaN
        };
    }

    function renderDialogState(skipRedraw) {
        var computed = computeDialogState(collectSelectionState(ui), historyWarning);
        ui.scaleText.text = computed.scaleText;
        if (ui.info && ui.info.extraText) {
            ui.info.extraText.text =
                localText("配置点数: ", "Placed items: ") + matchedItemCount + "\n" +
                localText("最小画像の処理後のppi: ", "Post-process PPI of smallest image: ") + (isFinite(computed.postResizeMinPpi) ? computed.postResizeMinPpi.toFixed(2) : "-") + "\n" +
                localText("※最大サイズの画像を処理します。", "The largest image size will be processed.");
        }
        renderWarningRows(ui.warningRows, computed.warningBag, skipRedraw === true, dlg);
    }

    var dlg = createDialogShell(localText("InDesignに合わせて画像リサイズ ", "Resize Image to InDesign Placement ") + SCRIPT_VERSION);
    var ui = {};
    ui.info = buildInfoPanel(dlg, messageBase);

    ui.resolution = buildRadioPanel(dlg, localText("指定解像度", "Target Resolution"), resolutionLabels, initialState.radioIndex);
    ui.upscale = buildMethodPanel(dlg, localText("拡大メソッド", "Upscale Method"), methodLabels, methodValues, initialState.upscaleMethod);
    ui.downscale = buildMethodPanel(dlg, localText("縮小メソッド", "Downscale Method"), downMethodLabels, downMethodValues, initialState.downMethod);
    ui.upscale.values = methodValues;
    ui.downscale.values = downMethodValues;

    var scaleText = dlg.add("statictext", undefined, "");
    scaleText.minimumSize.width = 400;
    try {
        scaleText.graphics.font = ScriptUI.newFont(scaleText.graphics.font.name, "Bold", scaleText.graphics.font.size);
    } catch (e) { }
    ui.scaleText = scaleText;
    ui.warningRows = buildWarningArea(dlg);

    var historyWarning = "";
    try {
        var historyStatus = getHistoryStatusByName(HISTORY_NAME);
        if (historyStatus && historyStatus.exists && (historyStatus.status === "active" || historyStatus.status === "applied")) {
            historyWarning = localText("【注意：キャンセル推奨】\n　すでにリサイズを実行済みです！実際の配置と異なる可能性があります。\n　ヒストリーを削除するか画像を保存して開き直し、リンクを更新してから実行してください", "[Caution: cancel recommended]\nResize has already been run. The result may differ from the actual placement.\nDelete the history state, or save and reopen the image, update the link, then run again.");
        }
    } catch (e) { }

    var usePrevArea = buildUsePrevArea(dlg, prefs);
    var buttonRow = buildButtonRow(dlg);

    for (var i = 0; i < ui.resolution.buttons.length; i++) {
        ui.resolution.buttons[i].onClick = renderDialogState;
    }

    usePrevArea.checkbox.onClick = function () {
        if (usePrevArea.checkbox.value) applySelectionState(ui, prefs);
        setControlsEnabled(ui, !usePrevArea.checkbox.value);
        usePrevArea.updateInfoLine();
    };
    setControlsEnabled(ui, !usePrevArea.checkbox.value);

    function savePrefsAndClose(exitCode, saveAll) {
        try {
            if (saveAll) {
                var selected = collectSelectionState(ui);
                savePrefs({
                    usePrev: usePrevArea.checkbox.value === true,
                    radioIndex: selected.radioIndex,
                    upscaleMethod: selected.method,
                    downMethod: selected.downMethod
                });
            } else {
                saveUsePrevOnly(usePrevArea.checkbox.value);
            }
        } catch (e) { }
        try {
            dlg.close(exitCode);
        } catch (e2) {
            dlg.close();
        }
    }

    buttonRow.okButton.onClick = function () {
        savePrefsAndClose(1, true);
    };
    buttonRow.cancelButton.onClick = function () {
        savePrefsAndClose(0, false);
    };
    buttonRow.appButton.onClick = function () {
        selectInInDesign(selectionHandle || {
            linkIndex: null,
            pathFs: encodeURI(imgPath),
            items: []
        });
        savePrefsAndClose(2, false);
    };
    buttonRow.helpButton.onClick = function () {
        openURLInBrowser("https://gist.github.com/Yamonov/d06d117b56445e52b30764b9c994356c");
        savePrefsAndClose(0, false);
    };

    dlg.addEventListener("keydown", function (k) {
        try {
            var n = String(k.keyName || "").toUpperCase();
            if (n === "ENTER" || n === "RETURN") {
                buttonRow.okButton.notify("onClick");
                k.preventDefault();
            } else if (n === "I") {
                buttonRow.appButton.notify("onClick");
                k.preventDefault();
            }
        } catch (e) { }
    });

    renderWarningRows(ui.warningRows, createWarningBag(), true, dlg);
    renderDialogState(true);
    usePrevArea.updateInfoLine();

    var ok = (dlg.show() === 1);
    if (ok) {
        var selectedState = collectSelectionState(ui);
        return {
            ppi: selectedState.ppi,
            method: selectedState.method,
            downMethod: selectedState.downMethod,
            usePrev: !!usePrevArea.checkbox.value,
            cancelled: false
        };
    }
    return {
        usePrev: !!usePrevArea.checkbox.value,
        cancelled: true
    };
}

// 実行開始
main();
