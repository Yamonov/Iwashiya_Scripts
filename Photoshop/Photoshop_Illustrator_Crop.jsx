#target photoshop

/*
<javascriptresource>
<name>Illustratorに合わせてクロップ</name>
<category>YPresets</category>
</javascriptresource>

SCRIPTMETA-BEGIN
Script-ID=org.iwashi.Photoshop_Illustrator_Crop
Version=0.7
Meta-URL=https://github.com/Yamonov/Iwashiya_Scripts/tree/main/Photoshop
Name=イラレのトリムに合わせて伸ばす
Author=Murakami Yoshiteru
Release-Date=2026-05-13
Target-App=Photoshop
Edit-Password-SHA256=NJOxNZvbDD0QAIkb:604294d41963ebe3df93705102088a3b10bbab9f06c0b462fd5c82cb9fb328e3
Description-BEGIN
Photoshopで開いている画像を、Illustrator上のクリッピングマスクに応じてクロップします。
クリッピングマスクが画像内に収まる部分にはガイドを追加し、画像が足りない部分はキャンバスを拡張します。
処理後のXMPにはIllustratorのクリッピングマスク由来のデータであることを記録します。
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

// --- NFC/NFD 正規化ヘルパ ---
function toNFCJa(s) {
    if (!s) return s;
    var map = {
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
        "A\u0303": "Ã",
        "N\u0303": "Ñ",
        "O\u0303": "Õ",
        "a\u0303": "ã",
        "n\u0303": "ñ",
        "o\u0303": "õ",
        "A\u030A": "Å",
        "a\u030A": "å",
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
        "Z\u0307": "Ż",
        "z\u0307": "ż",
        "A\u0328": "Ą",
        "E\u0328": "Ę",
        "a\u0328": "ą",
        "e\u0328": "ę",
        "C\u0327": "Ç",
        "c\u0327": "ç"
    };
    var out = String(s);
    for (var k in map) out = out.split(k).join(map[k]);
    return out;
}
// 実体解決 + fsName + NFC化
function _normPathLocal(p) {
    try {
        var f = new File(p);
        try {
            f = f.resolve();
        } catch (_e) {}
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
var NFC_HELPER_SRC = toNFCJa.toString();
function _normPathLocalNoNFC(p) {
    try {
        var f = new File(p);
        try {
            f = f.resolve();
        } catch (_e) {}
        return f.fsName;
    } catch (e) {
        try {
            return String(p);
        } catch (e2) {
            return String(p);
        }
    }
}
function _matchLinkPathLocal(linkFilePath, rawTargetPath, targetNorm) {
    if (String(linkFilePath || "") === String(rawTargetPath || "")) return true;
    var lnkNorm = _normPath(linkFilePath);
    return (lnkNorm === targetNorm);
}
function _decodeAndNormalizePathLocal(encodedPath) {
    var decoded = decodeURIComponent(encodedPath);
    decoded = toNFCJa(decoded);
    try {
        decoded = _normPath(decoded);
    } catch (_e) {}
    return decoded;
}
function _decodePathRawLocal(encodedPath) {
    var decoded = decodeURIComponent(encodedPath);
    return toNFCJa(decoded);
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
var NORM_HELPER_SRC_ID = _normPathLocalNoNFC.toString();
var MATCH_LINK_HELPER_SRC = _matchLinkPathLocal.toString();
var DECODE_NORM_HELPER_SRC = _decodeAndNormalizePathLocal.toString();
var DECODE_RAW_HELPER_SRC = _decodePathRawLocal.toString();
var DECODE_URI_SAFE_TEXT_SRC = decodeUriSafeText.toString();
var NORMALIZE_DISPLAY_SLASHES_SRC = normalizeDisplaySlashes.toString();
var TO_SOURCE_LITERAL_SRC = toSourceLiteral.toString();
var REPLACEMENT_XMP_NAMESPACE_URI = "http://ns.yamo.jp/photoshop/illustrator-crop-replacement-data/1.0/";
var REPLACEMENT_XMP_PREFIX = "yamoAiCrop:";
var REPLACEMENT_XMP_PROPERTY = "PhotoshopIllustratorCrop_ReplacementData";
var REPLACEMENT_DATA_VERSION = 1;
var REPLACEMENT_DATA_UNIT = "mm";
var SOURCE_PIXEL_TOLERANCE = 0;
var SOURCE_RATIO_PIXEL_TOLERANCE = 3;
var SOURCE_FALLBACK_PPI_ERROR_TOLERANCE = 0.25;
var SOURCE_FALLBACK_MIN_PIXEL_TOLERANCE = 1;

// Photoshopでファイルを開いているか確認
if (app.documents.length > 0) {
    mainProcess();
}

function mainProcess() {
    // 単位の保存と設定
    var doc = app.activeDocument;
    var originalRulerUnits = preferences.rulerUnits;
    preferences.rulerUnits = Units.PIXELS;

    try {
        var canvasWidth = doc.width.value;
        var canvasHeight = doc.height.value;
        var responseObject = requestCropDataFromIllustrator(doc);
        if (!handleIllustratorResponse(responseObject)) {
            return;
        }
        executeCropHistory(doc, responseObject.adjustments || [], canvasWidth, canvasHeight);
        tryWriteReplacementMetadata(doc, responseObject);
    } finally {
        // 単位を元に戻す
        preferences.rulerUnits = originalRulerUnits;
    }
}

var __cropHistoryContext = null;

function executeCropHistory(doc, adjustments, canvasWidth, canvasHeight) {
    __cropHistoryContext = {
        docId: doc.id,
        adjustments: adjustments,
        canvasWidth: canvasWidth,
        canvasHeight: canvasHeight
    };
    try {
        doc.suspendHistory(localText("画像伸ばし", "Extend Image"), "applyCropHistoryContext()");
    } finally {
        __cropHistoryContext = null;
    }
}

function tryWriteReplacementMetadata(doc, responseObject) {
    try {
        writeReplacementMetadata(doc, responseObject);
    } catch (_replacementMetadataError) {}
}

function writeReplacementMetadata(doc, responseObject) {
    var replacementData = extractReplacementData(responseObject);
    if (!replacementData) {
        return false;
    }

    loadReplacementXMPLibrary();
    XMPMeta.registerNamespace(REPLACEMENT_XMP_NAMESPACE_URI, REPLACEMENT_XMP_PREFIX);

    var xmp = getDocumentXMP(doc);
    xmp.setProperty(
        REPLACEMENT_XMP_NAMESPACE_URI,
        REPLACEMENT_XMP_PROPERTY,
        stringifyReplacementPayload(replacementData)
    );
    doc.xmpMetadata.rawData = xmp.serialize();
    return true;
}

function extractReplacementData(responseObject) {
    if (!responseObject || responseObject.status !== "ok") {
        return null;
    }
    if (!responseObject.selected || !responseObject.selected.replacementData) {
        return null;
    }
    return responseObject.selected.replacementData;
}

function loadReplacementXMPLibrary() {
    if (ExternalObject.AdobeXMPScript === undefined) {
        ExternalObject.AdobeXMPScript = new ExternalObject("lib:AdobeXMPScript");
    }
}

function getDocumentXMP(doc) {
    var rawData = "";
    try {
        rawData = doc.xmpMetadata.rawData;
    } catch (_rawDataError) {}
    return rawData ? new XMPMeta(rawData) : new XMPMeta();
}

function stringifyReplacementPayload(payload) {
    if (typeof JSON !== "undefined" && JSON.stringify) {
        return JSON.stringify(payload);
    }
    return stringifyJSONValue(payload);
}

function stringifyJSONValue(value) {
    var valueType = typeof value;
    if (value === null) return "null";
    if (valueType === "number" || valueType === "boolean") return String(value);
    if (valueType === "string") return "\"" + escapeJSONString(value) + "\"";
    if (value instanceof Array) {
        var arrayParts = [];
        for (var idx = 0; idx < value.length; idx++) {
            arrayParts.push(stringifyJSONValue(value[idx]));
        }
        return "[" + arrayParts.join(",") + "]";
    }

    var objectParts = [];
    for (var key in value) {
        if (!value.hasOwnProperty(key)) continue;
        objectParts.push("\"" + escapeJSONString(key) + "\":" + stringifyJSONValue(value[key]));
    }
    return "{" + objectParts.join(",") + "}";
}

function escapeJSONString(text) {
    return String(text)
        .replace(/\\/g, "\\\\")
        .replace(/"/g, "\\\"")
        .replace(/\r/g, "\\r")
        .replace(/\n/g, "\\n")
        .replace(/\t/g, "\\t");
}

function applyCropHistoryContext() {
    if (!__cropHistoryContext) {
        return;
    }
    var doc = app.activeDocument;
    try {
        if (doc.id !== __cropHistoryContext.docId) {
            return;
        }
    } catch (_docIdError) {}

    applyAdjustmentsToDocument(
        doc,
        __cropHistoryContext.adjustments || [],
        __cropHistoryContext.canvasWidth,
        __cropHistoryContext.canvasHeight
    );
}

function requestCropDataFromIllustrator(doc) {
    var encodedFilePath = "";
    try {
        encodedFilePath = encodeURIComponent(_normPathLocal(doc.fullName.fsName));
    } catch (pathError) {
        return {
            status: "error",
            message: localText(
                "保存されていないドキュメントでは実行できません。保存してから実行してください。",
                "This script cannot run on an unsaved document. Save the document and run it again."
            )
        };
    }
    var illustratorResponse = sendToIllustrator(
        encodedFilePath,
        String(doc.name || ""),
        getDocumentPixelSize(doc)
    );
    activatePhotoshop();
    var responseObject = parseBridgeTalkResponse(illustratorResponse);
    if (responseObject) {
        responseObject = resolveMultipleCropCandidates(doc, responseObject);
        return responseObject;
    }
    return {
        status: "error",
        message: localText("Illustrator応答の解析に失敗しました。", "Failed to parse the Illustrator response.") + "\r" + illustratorResponse
    };
}

function resolveMultipleCropCandidates(doc, responseObject) {
    if (!responseObject || responseObject.status !== "ok") {
        return responseObject;
    }
    if (!(responseObject.candidates instanceof Array) || responseObject.candidates.length <= 1) {
        return responseObject;
    }

    var selectedCandidate = chooseCropCandidateIllustrator(
        buildCropCandidateChooserPayload(doc, responseObject)
    );
    if (!selectedCandidate) {
        return { status: "cancel" };
    }

    responseObject.selectedIndex = selectedCandidate.index;
    responseObject.selected = selectedCandidate;
    responseObject.adjustments = selectedCandidate.adjustments;
    return responseObject;
}

function buildCropCandidateChooserPayload(doc, responseObject) {
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
            encodedItem.linkName = encodeChooserText(item.linkName || "");
            encodedItem.rawFileName = encodeChooserText(item.rawFileName || "");
            encodedItem.rawFilePath = encodeChooserText(item.rawFilePath || "");
            encodedItem.rawFolderPath = encodeChooserText(item.rawFolderPath || "");
            encodedItems.push(encodedItem);
        }
        return encodedItems;
    }

    return {
        items: encodeChooserItems(responseObject.candidates || []),
        initialPlacedIndex: responseObject.candidates.length ? responseObject.candidates[0].placedIndex : null,
        title: localText("リンクを選択", "Select Link"),
        messageLines: buildCropCandidateDialogMessages(responseObject),
        photoshopPathRaw: encodeChooserText(doc && doc.fullName ? doc.fullName.fsName : "")
    };
}

function buildCropCandidateDialogMessages(responseObject) {
    var candidates = responseObject && responseObject.candidates ? responseObject.candidates : [];
    var linkName = candidates.length ? String(candidates[0].linkName || "") : "";
    var messageLines = [
        localText("「", "\"") + linkName + localText("」が複数配置されています。", "\" is placed multiple times."),
        localText("トリミングを取得するものを選んでください。", "Choose the placed item to read trimming from."),
        localText("※リストを選択すると該当画像を表示します", "Selecting an item in the list shows the corresponding image.")
    ];
    if (!responseObject || responseObject.matchType !== "nameOnly") {
        return messageLines;
    }
    messageLines.push(localText("同名ファイルから候補を見つけています。", "Candidates were found from files with the same name."));
    if (responseObject.hasFolderDifference) {
        messageLines.push(localText("元画像とフォルダが異なる候補が含まれます。", "Some candidates are in a different folder from the source image."));
    }
    if (responseObject.hasExtensionDifference) {
        messageLines.push(localText("元画像と拡張子が異なる候補が含まれます。", "Some candidates use a different extension from the source image."));
    }
    return messageLines;
}

function chooseCropCandidateInIllustratorSide(payload) {
    /*__INJECT_TO_NFC_JA__*/
    if (app.documents.length === 0) return "null";
    var doc = app.activeDocument;
    var items = (payload && payload.items && payload.items.length) ? payload.items : null;
    if (!items) return "null";
    var isWindows = $.os.indexOf("Windows") >= 0;

    function buildDialogDisplayPath(pathText) {
        var value = decodeUriSafeText(pathText);
        if (isWindows) {
            value = normalizeDisplaySlashes(value, "/");
            return value.split("/").join("\\");
        }
        return value.split("\\ ").join(" ");
    }

    function splitDisplayPathInfo(pathText, fallbackFileName) {
        var value = buildDialogDisplayPath(pathText);
        var fallbackName = buildDialogDisplayPath(fallbackFileName);
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

    function getCandidateDisplayInfo(candidate, index) {
        if (candidate && candidate.rawFilePath) {
            return splitDisplayPathInfo(candidate.rawFilePath, candidate.rawFileName);
        }
        return {
            fileName: candidate && candidate.linkName ? buildDialogDisplayPath(candidate.linkName) : (remoteText("リンク ", "Link ") + (index + 1)),
            folderPath: candidate && candidate.rawFolderPath ? buildDialogDisplayPath(candidate.rawFolderPath) : remoteText("(不明)", "(Unknown)")
        };
    }

    function buildCandidateDialogLabel(candidate, index) {
        var indexText = String(index + 1);
        if (indexText.length < 2) {
            indexText = "0" + indexText;
        }
        var displayInfo = getCandidateDisplayInfo(candidate, index);
        return indexText + "　" + displayInfo.fileName + "　" + displayInfo.folderPath;
    }

    function buildCandidateDetailPathText(rawPath) {
        return remoteText("Photoshop画像パス：", "Photoshop image path: ") + buildDialogDisplayPath(rawPath);
    }

    function clearCandidateDetailText(detailControls) {
        detailControls.pathText.text = "";
    }

    function updateCandidateDetailText(detailControls, candidate) {
        if (!detailControls) return;
        if (!candidate) {
            clearCandidateDetailText(detailControls);
            return;
        }
        detailControls.pathText.text = buildCandidateDetailPathText((payload && payload.photoshopPathRaw) ? payload.photoshopPathRaw : "");
    }

    function findPlacedItem(candidate) {
        var placedIndex = Number(candidate ? candidate.placedIndex : NaN);
        if (!isFinite(placedIndex)) return null;
        placedIndex = Math.floor(placedIndex);
        if (placedIndex < 0 || placedIndex >= doc.placedItems.length) return null;
        try {
            return doc.placedItems[placedIndex];
        } catch (_findPlacedError) {
            return null;
        }
    }

    function centerViewOnItem(targetItem) {
        var bounds = null;
        try {
            bounds = targetItem.visibleBounds;
        } catch (_visibleBoundsError) {
            bounds = null;
        }
        if (!bounds || bounds.length < 4) {
            try {
                bounds = targetItem.geometricBounds;
            } catch (_geometricBoundsError) {
                bounds = null;
            }
        }
        if (!bounds || bounds.length < 4) return;
        try {
            doc.activeView.centerPoint = [
                (Number(bounds[0]) + Number(bounds[2])) / 2,
                (Number(bounds[1]) + Number(bounds[3])) / 2
            ];
        } catch (_centerError) {}
    }

    function focusCandidate(candidate) {
        var item = findPlacedItem(candidate);
        if (!item) return;
        try {
            doc.selection = null;
        } catch (_clearSelectionError) {}
        try {
            doc.selection = [item];
        } catch (_selectArrayError) {}
        try {
            item.selected = true;
        } catch (_selectedError) {}
        centerViewOnItem(item);
        try {
            app.redraw();
        } catch (_redrawError) {}
    }

    var dialog = new Window("dialog", (payload && payload.title) ? payload.title : remoteText("リンクを選択", "Select Link"));
    dialog.orientation = "column";
    dialog.alignChildren = ["fill", "top"];
    dialog.spacing = 8;
    dialog.margins = 12;

    var messageLines = (payload && payload.messageLines && payload.messageLines.length) ? payload.messageLines : [];
    for (var messageIndex = 0; messageIndex < messageLines.length; messageIndex++) {
        var line = dialog.add("statictext", undefined, String(messageLines[messageIndex] || ""));
        line.minimumSize.width = 820;
    }

    var infoText = dialog.add("statictext", undefined, remoteText("候補数: ", "Candidates: ") + items.length);
    infoText.minimumSize.width = 820;

    var listBox = dialog.add("listbox", undefined, [], {
        multiselect: false
    });
    listBox.preferredSize = [820, 260];
    for (var itemIndex = 0; itemIndex < items.length; itemIndex++) {
        var listItem = listBox.add("item", buildCandidateDialogLabel(items[itemIndex], itemIndex));
        listItem.candidate = items[itemIndex];
    }

    var detailGroup = dialog.add("group");
    detailGroup.orientation = "column";
    detailGroup.alignChildren = ["fill", "top"];
    detailGroup.minimumSize.width = 820;
    var pathText = detailGroup.add("statictext", undefined, "");
    pathText.minimumSize.width = 820;
    var detailControls = {
        pathText: pathText
    };

    listBox.onChange = function() {
        if (!this.selection) return;
        updateCandidateDetailText(detailControls, this.selection.candidate);
        focusCandidate(this.selection.candidate);
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
        updateCandidateDetailText(detailControls, listBox.selection.candidate);
    }

    dialog.onShow = function() {
        try {
            BridgeTalk.bringToFront("illustrator");
        } catch (_bringToFrontError) {}
        try {
            app.bringToFront();
        } catch (_appBringToFrontError) {}
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

function chooseCropCandidateIllustrator(payload) {
    var body = "(" +
        "function(){" +
        buildInjectedIllustratorFunctionSource(chooseCropCandidateInIllustratorSide) + "\n" +
        "return chooseCropCandidateInIllustratorSide(" + toSourceLiteral(payload) + ");" +
        "}" +
        ")();";
    try {
        BridgeTalk.bringToFront("illustrator");
    } catch (_bringToFrontError) {}
    var responseText = sendBridgeTalkAndWait("illustrator", body, 300000);
    activatePhotoshop();
    if (!responseText || responseText == "null") {
        return null;
    }
    var responseObject = parseBridgeTalkResponse(responseText);
    if (!responseObject) {
        alert(localText("Illustrator応答の解析に失敗しました。", "Failed to parse the Illustrator response.") + "\nraw: " + responseText);
        return null;
    }
    if (responseObject.status === "error") {
        alert(responseObject.message || localText("Illustrator通信エラーが発生しました。", "An Illustrator communication error occurred."));
        return null;
    }
    return responseObject;
}

function handleIllustratorResponse(responseObject) {
    if (!responseObject) {
        alert(localText("Illustrator応答の解析に失敗しました。", "Failed to parse the Illustrator response."));
        return false;
    }
    if (responseObject.status === "cancel") {
        return false;
    }
    if (responseObject.status !== "ok") {
        alert(responseObject.message || localText("Illustrator側でエラーが発生しました。", "An error occurred on the Illustrator side."));
        return false;
    }
    if (!validateSourcePixelSize(responseObject, app.activeDocument)) {
        return false;
    }
    if (responseObject.matchType === "nameOnly" && responseObject.matchCount === 1 && responseObject.selected) {
        var fallbackAction = showFallbackLinkConfirmDialog({
            items: [responseObject.selected],
            photoshopFileName: app.activeDocument ? app.activeDocument.name : "",
            photoshopPath: app.activeDocument && app.activeDocument.fullName ? app.activeDocument.fullName.fsName : "",
            hasFolderDifference: responseObject.hasFolderDifference,
            hasExtensionDifference: responseObject.hasExtensionDifference
        });
        if (fallbackAction === "use") {
            return true;
        }
        if (fallbackAction === "check") {
            showMatchedLinkInIllustrator(responseObject.selected);
            return false;
        }
        return false;
    }
    return true;
}

function validateSourcePixelSize(responseObject, doc) {
    var sourcePixelSize = extractSourcePixelSize(responseObject);
    var sourcePixelTolerance = extractSourcePixelTolerance(responseObject);
    var docPixelSize = getDocumentPixelSize(doc);
    if (!sourcePixelSize || !docPixelSize) {
        return true;
    }
    if (isPixelSizeWithinTolerance(sourcePixelSize.width, docPixelSize.width, sourcePixelTolerance.width) &&
            isPixelSizeWithinTolerance(sourcePixelSize.height, docPixelSize.height, sourcePixelTolerance.height)) {
        return true;
    }

    if (!isPixelRatioCompatible(sourcePixelSize, docPixelSize)) {
        alert(
            localText("Illustrator上の配置画像と、Photoshopで開いている画像の縦横比が一致しません。", "The aspect ratio of the image placed in Illustrator does not match the image open in Photoshop.") + "\n" +
            localText("配置画像: ", "Placed image: ") + sourcePixelSize.width + " x " + sourcePixelSize.height + " px\n" +
            localText("Photoshop画像: ", "Photoshop image: ") + docPixelSize.width + " x " + docPixelSize.height + " px"
        );
        return false;
    }

    if (!confirm(
            localText("Illustrator上の配置画像と、Photoshopで開いている画像のピクセル数が一致しません。", "The pixel dimensions of the image placed in Illustrator do not match the image open in Photoshop.") + "\n" +
            localText("配置画像: ", "Placed image: ") + sourcePixelSize.width + " x " + sourcePixelSize.height + " px\n" +
            localText("Photoshop画像: ", "Photoshop image: ") + docPixelSize.width + " x " + docPixelSize.height + " px\n\n" +
            localText("配置サイズに相当するピクセル数へ変換して、処理を続けますか？", "Convert to the pixel dimensions corresponding to the placed size and continue?")
        )) {
        return false;
    }

    responseObject.adjustments = scaleAdjustmentsForPixelSize(
        responseObject.adjustments,
        sourcePixelSize,
        docPixelSize
    );
    return true;
}

function extractSourcePixelSize(responseObject) {
    var selected = responseObject && responseObject.selected ? responseObject.selected : null;
    var sourcePixelSize = selected && selected.sourcePixelSize ? selected.sourcePixelSize : null;
    if (!sourcePixelSize) {
        return null;
    }
    if (!isFinite(Number(sourcePixelSize.width)) || !isFinite(Number(sourcePixelSize.height))) {
        return null;
    }
    return {
        width: Math.round(Number(sourcePixelSize.width)),
        height: Math.round(Number(sourcePixelSize.height))
    };
}

function getDocumentPixelSize(doc) {
    if (!doc) {
        return null;
    }
    try {
        return {
            width: Math.round(Number(doc.width.value)),
            height: Math.round(Number(doc.height.value))
        };
    } catch (_docPixelSizeError) {}
    return null;
}

function extractSourcePixelTolerance(responseObject) {
    var selected = responseObject && responseObject.selected ? responseObject.selected : null;
    var tolerance = selected && selected.sourcePixelTolerance ? selected.sourcePixelTolerance : null;
    if (!tolerance) {
        return {
            width: SOURCE_PIXEL_TOLERANCE,
            height: SOURCE_PIXEL_TOLERANCE
        };
    }
    return {
        width: Math.max(0, Math.round(Number(tolerance.width) || 0)),
        height: Math.max(0, Math.round(Number(tolerance.height) || 0))
    };
}

function isPixelSizeWithinTolerance(expectedValue, actualValue, toleranceValue) {
    return Math.abs(Number(expectedValue) - Number(actualValue)) <= Number(toleranceValue);
}

function isPixelRatioCompatible(sourcePixelSize, docPixelSize) {
    var scaledHeight = Number(sourcePixelSize.height) * Number(docPixelSize.width) / Number(sourcePixelSize.width);
    var scaledWidth = Number(sourcePixelSize.width) * Number(docPixelSize.height) / Number(sourcePixelSize.height);

    return Math.abs(scaledHeight - Number(docPixelSize.height)) <= SOURCE_RATIO_PIXEL_TOLERANCE &&
        Math.abs(scaledWidth - Number(docPixelSize.width)) <= SOURCE_RATIO_PIXEL_TOLERANCE;
}

function scaleAdjustmentsForPixelSize(rawAdjustments, sourcePixelSize, docPixelSize) {
    var adjustmentSides = toAdjustmentSides(rawAdjustments);
    var scaleX = Number(docPixelSize.width) / Number(sourcePixelSize.width);
    var scaleY = Number(docPixelSize.height) / Number(sourcePixelSize.height);

    return [
        scaleAdjustmentValue(adjustmentSides.top, scaleY),
        scaleAdjustmentValue(adjustmentSides.left, scaleX),
        scaleAdjustmentValue(adjustmentSides.bottom, scaleY),
        scaleAdjustmentValue(adjustmentSides.right, scaleX)
    ];
}

function scaleAdjustmentValue(rawValue, scale) {
    var text = String(rawValue || 0);
    var prefix = "";
    var value = 0;

    if (text.indexOf("g") === 0) {
        prefix = "g";
        value = Number(text.slice(1)) || 0;
    } else {
        value = Number(text) || 0;
    }

    value = Math.max(0, Math.round(value * Number(scale)));
    return prefix ? (prefix + value) : value;
}

function parseBridgeTalkResponse(responseText) {
    return parseJsonResponse(responseText);
}

function showMatchedLinkInIllustrator(selectedCandidate) {
    if (!selectedCandidate) {
        return;
    }
    var illustratorFunction = function(request) {
        /*__INJECT_TO_NFC_JA__*/
        var targetPath = request && request.targetPath ? String(request.targetPath) : "";
        var directPlacedIndex = Number(request && request.placedIndex);
        var decodedRawPath = _decodePathRaw(targetPath);
        var decodedNormPath = _decodeAndNormalizePath(targetPath);
        if (app.documents.length === 0) {
            return "null";
        }
        var doc = app.activeDocument;
        var placedItems = doc.placedItems;
        var selectedItem = null;
        if (isFinite(directPlacedIndex) && directPlacedIndex >= 0 && directPlacedIndex < placedItems.length) {
            try {
                selectedItem = placedItems[Math.floor(directPlacedIndex)];
            } catch (_directPlacedError) {
                selectedItem = null;
            }
        }
        for (var idx = 0; idx < placedItems.length; idx++) {
            if (selectedItem) {
                break;
            }
            var placedItem = placedItems[idx];
            var placedPath = "";
            try {
                placedPath = placedItem.file && placedItem.file.fsName ? placedItem.file.fsName : "";
            } catch (_fileError) {
                placedPath = "";
            }
            if (!_matchLinkPath(placedPath, decodedRawPath, decodedNormPath)) {
                continue;
            }
            selectedItem = placedItem;
        }
        if (!selectedItem) {
            return "null";
        }
        try {
            doc.selection = null;
        } catch (_clearSelectionError) {}
        try {
            doc.selection = [selectedItem];
        } catch (_selectArrayError) {}
        try {
            selectedItem.selected = true;
        } catch (_selectedError) {}
        try {
            var bounds = selectedItem.visibleBounds;
            if ((!bounds || bounds.length < 4) && selectedItem.geometricBounds) {
                bounds = selectedItem.geometricBounds;
            }
            if (bounds && bounds.length >= 4) {
                doc.activeView.centerPoint = [
                    (Number(bounds[0]) + Number(bounds[2])) / 2,
                    (Number(bounds[1]) + Number(bounds[3])) / 2
                ];
            }
        } catch (_centerError) {}
        try {
            app.redraw();
        } catch (_redrawError) {}
        return "ok";
    };
    sendBridgeTalkNoWait("illustrator", buildBridgeTalkInvocationBody(illustratorFunction, {
        targetPath: encodeURIComponent(String(selectedCandidate.rawFilePath || "")),
        placedIndex: selectedCandidate.placedIndex
    }));
    try {
        BridgeTalk.bringToFront("illustrator");
    } catch (_bringToFrontError) {}
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

function buildDisplayPathForUI(pathText) {
    var value = String(pathText || "");
    var isWindows = $.os.indexOf("Windows") >= 0;
    try {
        value = decodeURI(value);
    } catch (_decodeError) {}
    if (isWindows) {
        value = normalizeDisplaySlashes(value, "/");
        value = value.split("/").join("\\");
    } else {
        value = value.split("\\ ").join(" ");
    }
    return value;
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

function decodeUriSafeText(text) {
    var value = String(text || "");
    try {
        return decodeURI(value);
    } catch (_decodeError) {}
    return value;
}

function findLastPathSeparatorIndex(pathText) {
    var value = String(pathText || "");
    return Math.max(value.lastIndexOf("/"), value.lastIndexOf("\\"));
}

function splitPathTextForDisplay(pathText, fallbackFileName) {
    var value = buildDisplayPathForUI(pathText);
    var fallbackName = buildDisplayPathForUI(fallbackFileName);
    var slashIndex = findLastPathSeparatorIndex(value);
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

function addDialogLabeledTextRow(parent, labelText, valueText, labelWidth, valueWidth) {
    var row = parent.add("group");
    row.orientation = "row";
    row.alignChildren = ["left", "center"];
    row.spacing = 0;
    var label = row.add("statictext", undefined, labelText);
    label.minimumSize.width = labelWidth;
    label.maximumSize.width = labelWidth;
    var value = row.add("statictext", undefined, valueText);
    value.minimumSize.width = valueWidth;
    return { row: row, label: label, value: value };
}

function createFallbackLinkDialog() {
    var dialog = new Window("dialog", localText("リンク確認", "Confirm Link"));
    dialog.orientation = "column";
    dialog.alignChildren = ["fill", "top"];
    dialog.spacing = 10;
    dialog.margins = 16;
    return dialog;
}

function addFallbackDialogHeader(dialog, hasFolderDifference, hasExtensionDifference) {
    var line1 = dialog.add("statictext", undefined, localText("完全に一致するリンクがありません。", "No exact matching link was found."));
    line1.minimumSize.width = 360;
    var line1Detail = dialog.add("statictext", undefined, buildNameOnlyMessageLine1(hasFolderDifference, hasExtensionDifference));
    line1Detail.minimumSize.width = 360;
    return {
        line1: line1,
        line1Detail: line1Detail
    };
}

function addFallbackDialogInfoPanel(dialog, title, info, labelWidth, valueWidth) {
    var panel = dialog.add("panel", undefined, title);
    panel.orientation = "column";
    panel.alignChildren = ["fill", "top"];
    panel.margins = 12;
    addDialogLabeledTextRow(panel, localText("ファイル名：", "File name: "), info.fileName, labelWidth, valueWidth);
    addDialogLabeledTextRow(panel, localText("パス名：", "Path: "), info.folderPath, labelWidth, valueWidth);
    return panel;
}

function buildFallbackDialogLinkInfo(options) {
    if (options.linkPath) {
        return splitPathTextForDisplay(options.linkPath, options.linkFileName);
    }
    return {
        fileName: buildDisplayPathForUI(options.linkFileName),
        folderPath: buildDisplayPathForUI(options.linkFolderPath)
    };
}

function addFallbackDialogSingleItemSection(dialog, options) {
    var labelWidth = 80;
    var valueWidth = 360;
    var photoshopInfo = splitPathTextForDisplay(options.photoshopPath, options.photoshopFileName);
    var linkInfo = buildFallbackDialogLinkInfo(options);

    addFallbackDialogInfoPanel(dialog, localText("Photoshop側", "Photoshop Side"), photoshopInfo, labelWidth, valueWidth);
    addFallbackDialogInfoPanel(dialog, localText("Illustrator側", "Illustrator Side"), linkInfo, labelWidth, valueWidth);

    var line4 = dialog.add("statictext", undefined, localText("の情報を使用しますか？", "Use this information?"));
    line4.minimumSize.width = 520;
    return line4;
}

function addFallbackDialogButtons(dialog, isSingleItem) {
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
    return {
        cancelButton: cancelButton,
        checkButton: checkButton,
        useButton: useButton
    };
}

function bindFallbackDialogButtons(dialog, buttons) {
    buttons.cancelButton.onClick = function() { dialog.close(0); };
    buttons.checkButton.onClick = function() { dialog.close(2); };
    if (buttons.useButton) {
        buttons.useButton.onClick = function() { dialog.close(1); };
    }
}

function resolveFallbackDialogResult(dialogResult) {
    if (dialogResult === 1) return "use";
    if (dialogResult === 2) return "check";
    return "cancel";
}

function showFallbackLinkConfirmDialog(options) {
    activatePhotoshop();
    var items = (options && options.items && options.items.length) ? options.items : [];
    var isSingleItem = items.length === 1;
    var photoshopFileName = String((options && options.photoshopFileName) || "");
    var photoshopPath = String((options && options.photoshopPath) || "");
    var hasFolderDifference = !!(options && options.hasFolderDifference);
    var hasExtensionDifference = !!(options && options.hasExtensionDifference);
    var dialog = createFallbackLinkDialog();
    addFallbackDialogHeader(dialog, hasFolderDifference, hasExtensionDifference);

    if (isSingleItem) {
        var singleItem = items[0];
        addFallbackDialogSingleItemSection(dialog, {
            photoshopFileName: photoshopFileName,
            photoshopPath: photoshopPath,
            linkFileName: singleItem && (singleItem.rawFileName || singleItem.linkName || ""),
            linkPath: singleItem && (singleItem.rawFilePath || ""),
            linkFolderPath: singleItem && (singleItem.rawFolderPath || singleItem.folderPath || "")
        });
    }

    var buttons = addFallbackDialogButtons(dialog, isSingleItem);
    bindFallbackDialogButtons(dialog, buttons);

    try { dialog.center(); } catch (_centerError) {}

    var dialogResult = dialog.show();
    if (dialogResult === 1 || dialogResult === 2) {
        try { app.refresh(); } catch (_refreshError) {}
    }
    return resolveFallbackDialogResult(dialogResult);
}

function buildBridgeTalkInvocationBody(illustratorFunction, requestData) {
    var injected = buildInjectedIllustratorFunctionSource(illustratorFunction);
    return "(" + injected + ")(" + toSourceLiteral(requestData || {}) + ");";
}

function sendBridgeTalkAndWait(target, body, timeoutMs) {
    var bridgeTalk = new BridgeTalk();
    var responseBody = null;
    var errorBody = null;
    bridgeTalk.target = target;
    bridgeTalk.body = body;
    bridgeTalk.onResult = function(response) {
        responseBody = response.body;
    };
    bridgeTalk.onError = function(err) {
        errorBody = buildBridgeTalkErrorResponse(err);
    };
    bridgeTalk.send();

    return waitForBridgeTalkResponse(function() {
        if (responseBody !== null) {
            return responseBody;
        }
        if (errorBody !== null) {
            return errorBody;
        }
        return null;
    }, timeoutMs);
}

function sendBridgeTalkNoWait(target, body) {
    var bridgeTalk = new BridgeTalk();
    bridgeTalk.target = target;
    bridgeTalk.body = body;
    bridgeTalk.send();
}

// ───────────────────────────────────────────────────────────
// IllustratorをBridgeTalkで呼び出す（同期待機）
function sendToIllustrator(encodedPath, targetFileName, sourcePixelSize) {
    var illustratorFunction = function(request) {
            var isWindows = $.os.indexOf("Windows") >= 0;
            /*__INJECT_TO_NFC_JA__*/
            var encodedKey = request && request.encodedKey ? String(request.encodedKey) : "";
            var targetFileNameText = request && request.targetFileNameText ? String(request.targetFileNameText) : "";
            var decodedRawKey = _decodePathRaw(encodedKey);
            var decodedNormKey = _decodeAndNormalizePath(encodedKey);
            var sourcePixels = {
                width: Math.max(1, Math.round(Number(request && request.sourcePixelWidth) || 0)),
                height: Math.max(1, Math.round(Number(request && request.sourcePixelHeight) || 0))
            };

            if (app.documents.length === 0) {
                return toSourceLiteral({
                    status: "error",
                    message: remoteText("ドキュメントが開かれていません。", "No document is open.")
                });
            }

            try {
                return toSourceLiteral(runCropSelection());
            } catch (e) {
                return toSourceLiteral(buildErrorResponse(remoteText("Illustrator側エラー: ", "Illustrator-side error: ") + e));
            }

            function runCropSelection() {
                var matchingResult = collectMatchingResult();
                if (matchingResult.errorMessage) {
                    return buildErrorResponse(matchingResult.errorMessage);
                }

                var prepared = prepareMatchingCandidates(matchingResult);
                if (prepared.errorMessage) {
                    return buildErrorResponse(prepared.errorMessage);
                }
                if (!prepared.candidates.length) {
                    return buildLinkNotFoundResponse();
                }

                return buildSelectionResponse(prepared.candidates, matchingResult);
            }

            function collectMatchingResult() {
                return collectMatchingPlacedItems(app.activeDocument.placedItems, createLinkMatchContext(decodedRawKey, decodedNormKey));
            }

            function createLinkMatchContext(rawKey, normKey) {
                var targetRawPathInfo = buildNameOnlyPathInfo(rawKey, rawKey);
                return {
                    rawKey: rawKey,
                    normKey: normKey,
                    targetRawPathInfo: targetRawPathInfo,
                    targetFileNameInfo: splitFileNameInfo(targetFileNameText || targetRawPathInfo.fileName),
                    targetPathInfo: buildNameOnlyPathInfo(normKey, rawKey)
                };
            }

            function prepareMatchingCandidates(matchingResult) {
                var result = {
                    candidates: [],
                    errorMessage: ""
                };
                if (!matchingResult.items.length) {
                    return result;
                }
                for (var idx = 0; idx < matchingResult.items.length; idx++) {
                    try {
                        result.candidates.push(buildCandidate(matchingResult.items[idx], idx));
                    } catch (candidateError) {
                        if (!result.errorMessage) {
                            result.errorMessage = String(candidateError);
                        }
                    }
                }
                if (!result.candidates.length && result.errorMessage) {
                    return result;
                }
                result.errorMessage = "";
                sortCandidates(result.candidates);
                updateCandidateLabels(result.candidates);
                return result;
            }

            function buildSelectionResponse(candidates, matchingResult) {
                if (candidates.length === 1) {
                    return buildSuccessResponse(candidates, serializeCandidate(candidates[0]), matchingResult);
                }
                return buildCandidateListResponse(candidates, matchingResult);
            }

            function buildSuccessResponse(candidates, selected, matchingResult) {
                var response = buildMatchResponseBase(matchingResult);
                response.status = "ok";
                response.matchCount = candidates.length;
                response.selectedIndex = selected.index;
                response.selected = selected;
                response.adjustments = selected.adjustments;
                return response;
            }

            function buildCandidateListResponse(candidates, matchingResult) {
                var response = buildMatchResponseBase(matchingResult);
                response.status = "ok";
                response.matchCount = candidates.length;
                response.candidates = serializeCandidates(candidates);
                return response;
            }

            function buildMatchResponseBase(matchingResult) {
                return {
                    status: "ok",
                    matchType: matchingResult.matchType,
                    hasFolderDifference: matchingResult.hasFolderDifference,
                    hasExtensionDifference: matchingResult.hasExtensionDifference
                };
            }

            function serializeCandidates(candidates) {
                var serialized = [];
                for (var idx = 0; idx < candidates.length; idx++) {
                    serialized.push(serializeCandidate(candidates[idx]));
                }
                return serialized;
            }

            function buildErrorResponse(message) {
                return {
                    status: "error",
                    message: message
                };
            }

            function buildLinkNotFoundResponse() {
                return buildErrorResponse(remoteText("この画像はIllustratorドキュメント中に存在しません。", "This image does not exist in the Illustrator document."));
            }

            function getNumber(value) {
                var num = Number(value);
                return isNaN(num) ? 0 : num;
            }

            function normalizePathSeparatorsForSplit(pathText) {
                return String(pathText || "").replace(new RegExp("[/\\\\\\u00A5\\uFFE5\\uFF3C]+", "g"), "\\");
            }

            function containsPathSeparator(text) {
                return new RegExp("[/\\\\\\u00A5\\uFFE5\\uFF3C]").test(String(text || ""));
            }

            function splitPathInfo(filePath) {
                var normalizedPath = normalizePathSeparatorsForSplit(filePath);
                var slashIndex = normalizedPath.lastIndexOf("\\");
                var folderPath = (slashIndex >= 0) ? normalizedPath.substring(0, slashIndex) : "";
                var fileName = (slashIndex >= 0) ? normalizedPath.substring(slashIndex + 1) : normalizedPath;
                var fileNameParts = splitFileNameParts(fileName);
                if (isWindows) {
                    folderPath = folderPath.toLowerCase();
                    fileNameParts = splitFileNameParts(fileName.toLowerCase());
                }
                return {
                    folderPath: folderPath,
                    fileName: fileNameParts.fileName,
                    baseName: fileNameParts.baseName,
                    extension: fileNameParts.extension
                };
            }

            function splitFileNameInfo(fileName) {
                var normalizedFileName = decodeUriSafeText(fileName);
                normalizedFileName = String(normalizedFileName || "");
                if (containsPathSeparator(normalizedFileName)) {
                    normalizedFileName = splitPathInfo(normalizedFileName).fileName;
                }
                if (isWindows) {
                    normalizedFileName = normalizedFileName.toLowerCase();
                }
                return splitFileNameParts(normalizedFileName);
            }

            function splitFileNameParts(fileName) {
                var normalizedFileName = String(fileName || "");
                var dotIndex = normalizedFileName.lastIndexOf(".");
                return {
                    fileName: normalizedFileName,
                    baseName: (dotIndex > 0) ? normalizedFileName.substring(0, dotIndex) : normalizedFileName,
                    extension: (dotIndex > 0) ? normalizedFileName.substring(dotIndex + 1) : ""
                };
            }

            function buildNameOnlyPathInfo(normalizedPath, rawPath) {
                var pathInfo = splitPathInfo(normalizedPath);
                var rawValue = decodeUriSafeText(rawPath);
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

            function readPlacedFile(item) {
                try {
                    return item.file;
                } catch (_fileError) {
                    return null;
                }
            }

            function readFileFsName(fileObject) {
                try {
                    return fileObject && fileObject.fsName ? String(fileObject.fsName) : "";
                } catch (_fsNameError) {
                    return "";
                }
            }

            function readFileName(fileObject) {
                try {
                    return fileObject && fileObject.name ? String(fileObject.name) : "";
                } catch (_nameError) {
                    return "";
                }
            }

            function readFileFolderPath(fileObject) {
                try {
                    return fileObject && fileObject.parent && fileObject.parent.fsName ? String(fileObject.parent.fsName) : "";
                } catch (_folderError) {
                    return "";
                }
            }

            function buildItemPathData(item, fileObject, knownNormalizedPath) {
                var resolvedFileObject = fileObject || readPlacedFile(item);
                var rawFsName = readFileFsName(resolvedFileObject);
                var normalizedPath = knownNormalizedPath || (rawFsName ? _normPath(rawFsName) : "");
                var fileName = readFileName(resolvedFileObject);
                var folderPath = readFileFolderPath(resolvedFileObject);
                var pathInfo = buildNameOnlyPathInfo(normalizedPath, normalizedPath || fileName);
                return {
                    fileObject: resolvedFileObject,
                    normalizedPath: normalizedPath,
                    fileName: fileName || pathInfo.fileName,
                    folderPath: folderPath || pathInfo.folderPath,
                    pathInfo: pathInfo
                };
            }

            function collectMatchingPlacedItems(placedItems, context) {
                var exactResult = collectExactPlacedItems(placedItems, context);
                if (exactResult.errorMessage || exactResult.items.length > 0) {
                    return exactResult;
                }
                return collectNameOnlyPlacedItems(placedItems, context);
            }

            function collectExactPlacedItems(placedItems, context) {
                var rawExactItems = [];
                for (var idx = 0; idx < placedItems.length; idx++) {
                    var item = placedItems[idx];
                    var fileObject = readPlacedFile(item);
                    var itemPath = readFileFsName(fileObject);
                    if (String(itemPath || "") !== String(context.rawKey || "")) {
                        continue;
                    }
                    rawExactItems.push(buildMatchingItemEntry(item, idx, buildItemPathData(item, fileObject, itemPath)));
                }
                if (rawExactItems.length) {
                    return buildReadyMatchResult(rawExactItems, "exact", false, false);
                }

                var normalizedExactItems = [];
                for (var normIdx = 0; normIdx < placedItems.length; normIdx++) {
                    var normItem = placedItems[normIdx];
                    var normFileObject = readPlacedFile(normItem);
                    var normPathData = buildItemPathData(normItem, normFileObject, "");
                    if (!isNameOnlyMatchingPathInfo(normPathData.pathInfo, context.targetFileNameInfo)) {
                        continue;
                    }
                    if (!_matchLinkPath(normPathData.normalizedPath, context.rawKey, context.normKey)) {
                        continue;
                    }
                    normalizedExactItems.push(buildMatchingItemEntry(normItem, normIdx, normPathData));
                }
                return buildReadyMatchResult(normalizedExactItems, "exact", false, false);
            }

            function collectNameOnlyPlacedItems(placedItems, context) {
                var nameOnlyItems = [];
                var hasFolderDifference = false;
                var hasExtensionDifference = false;
                var skippedNotReady = false;
                for (var nameIdx = 0; nameIdx < placedItems.length; nameIdx++) {
                    var nameItem = placedItems[nameIdx];
                    var pathData = buildItemPathData(nameItem, readPlacedFile(nameItem), "");
                    if (!isNameOnlyMatchingPathInfo(pathData.pathInfo, context.targetFileNameInfo)) {
                        continue;
                    }
                    if (!isItemReady(nameItem, pathData.fileObject)) {
                        skippedNotReady = true;
                        continue;
                    }
                    var differences = collectNameOnlyDifferences(pathData, context);
                    hasFolderDifference = hasFolderDifference || differences.hasFolderDifference;
                    hasExtensionDifference = hasExtensionDifference || differences.hasExtensionDifference;
                    nameOnlyItems.push(buildMatchingItemEntry(nameItem, nameIdx, pathData));
                }

                if (!nameOnlyItems.length && skippedNotReady) {
                    return buildLinkStatusError("nameOnly", false, false);
                }
                return buildMatchResult(nameOnlyItems, "nameOnly", hasFolderDifference, hasExtensionDifference);
            }

            function collectNameOnlyDifferences(pathData, context) {
                return {
                    hasFolderDifference: context.targetPathInfo.folderPath !== pathData.pathInfo.folderPath,
                    hasExtensionDifference: context.targetFileNameInfo.extension !== pathData.pathInfo.extension
                };
            }

            function buildMatchingItemEntry(item, placedIndex, pathData) {
                return {
                    item: item,
                    placedIndex: placedIndex,
                    pathData: pathData
                };
            }

            function buildMatchResult(items, matchType, hasFolderDifference, hasExtensionDifference) {
                return {
                    items: items,
                    matchType: (matchType === "nameOnly" && items.length > 0) ? "nameOnly" : "exact",
                    hasFolderDifference: hasFolderDifference,
                    hasExtensionDifference: hasExtensionDifference,
                    errorMessage: ""
                };
            }

            function buildReadyMatchResult(itemEntries, matchType, hasFolderDifference, hasExtensionDifference) {
                for (var readyIndex = 0; readyIndex < itemEntries.length; readyIndex++) {
                    if (!isItemReady(itemEntries[readyIndex].item, itemEntries[readyIndex].pathData.fileObject)) {
                        return buildLinkStatusError(matchType, hasFolderDifference, hasExtensionDifference);
                    }
                }
                return buildMatchResult(itemEntries, matchType, hasFolderDifference, hasExtensionDifference);
            }

            function buildLinkStatusError(matchType, hasFolderDifference, hasExtensionDifference) {
                return {
                    items: [],
                    matchType: matchType,
                    hasFolderDifference: hasFolderDifference,
                    hasExtensionDifference: hasExtensionDifference,
                    errorMessage: remoteText("リンクが更新されていないため、正確なトリミングを取得できません。\nIllustratorでリンクパネルを確認してください。", "The link is not updated, so accurate trimming cannot be read.\nCheck the Links panel in Illustrator.")
                };
            }

            function isNameOnlyMatchingPathInfo(pathInfo, targetFileNameInfo) {
                if (!targetFileNameInfo.baseName || !pathInfo || !pathInfo.baseName) {
                    return false;
                }
                return pathInfo.baseName === targetFileNameInfo.baseName;
            }

            function isItemReady(item, fileObject) {
                var state = readLinkState(item, fileObject);
                return state !== "missing" && state !== "modified";
            }

            function readLinkState(item, fileObject) {
                try {
                    if (typeof item.status !== "undefined") {
                        return normalizeLinkState(item.status);
                    }
                } catch (_statusError) {}
                try {
                    if (typeof item.linkStatus !== "undefined") {
                        return normalizeLinkState(item.linkStatus);
                    }
                } catch (_linkStatusError) {}
                try {
                    if (fileObject && typeof fileObject.exists !== "undefined" && fileObject.exists === false) {
                        return "missing";
                    }
                } catch (_existsError) {}
                return "ok";
            }

            function normalizeLinkState(value) {
                var text = String(value || "").toLowerCase();
                if (text.indexOf("nodata") >= 0 || text.indexOf("missing") >= 0 || text.indexOf("notfound") >= 0) return "missing";
                if (text.indexOf("datamodified") >= 0 || text.indexOf("modified") >= 0 || text.indexOf("outdated") >= 0) return "modified";
                if (text.indexOf("datafromfile") >= 0 || text.indexOf("normal") >= 0 || text.indexOf("ok") >= 0) return "ok";
                var numberValue = Number(value);
                if (numberValue === 1) return "missing";
                if (numberValue === 2 || numberValue === 0) return "ok";
                if (numberValue === 3) return "modified";
                return "ok";
            }

            function buildCandidate(itemEntry, index) {
                var item = itemEntry.item;
                var pathData = itemEntry.pathData;
                var maskItem = findClippingMaskForPlacedItem(item);
                if (!maskItem) {
                    throw new Error(remoteText("一致した配置画像がクリッピングマスク内にありません。", "The matching placed image is not inside a clipping mask."));
                }

                var imageGeometry = buildGeometryFromQuadPoints(getPlacedItemQuad(item));
                var maskQuad = getMaskQuad(maskItem);
                var localMaskBounds = getProjectedBounds(projectPoints(maskQuad, imageGeometry));
                var effectivePpi = buildEffectivePpi(imageGeometry);
                var geometry = buildCandidateGeometry(localMaskBounds, imageGeometry, effectivePpi, item, maskItem, itemEntry.placedIndex);
                var metrics = collectCandidateMetrics(item, maskItem, maskQuad, effectivePpi);

                return {
                    index: index,
                    placedIndex: itemEntry.placedIndex,
                    pageName: metrics.pageName,
                    linkName: pathData.fileName,
                    rawFileName: pathData.fileName,
                    rawFilePath: pathData.normalizedPath,
                    rawFolderPath: pathData.folderPath,
                    hScale: metrics.hScale,
                    vScale: metrics.vScale,
                    effectivePpi: metrics.effectivePpi,
                    itemBounds: metrics.itemBounds,
                    parentBounds: metrics.parentBounds,
                    frameWidthMM: metrics.frameWidthMM,
                    frameHeightMM: metrics.frameHeightMM,
                    sortScale: metrics.sortScale,
                    adjustments: geometry.adjustments,
                    frameLocalBounds: geometry.frameLocalBounds,
                    targetQuadInFrame: geometry.targetQuadInFrame,
                    replacementData: geometry.replacementData,
                    sourcePixelSize: geometry.sourcePixelSize,
                    sourcePixelTolerance: geometry.sourcePixelTolerance,
                    label: ""
                };
            }

            function collectCandidateMetrics(item, maskItem, maskQuad, effectivePpi) {
                var itemBounds = getBestBounds(item);
                var maskBounds = quadToBounds(maskQuad);
                var maskWidthPt = Math.abs(maskBounds[2] - maskBounds[0]);
                var maskHeightPt = Math.abs(maskBounds[1] - maskBounds[3]);
                return {
                    pageName: getArtboardLabel(),
                    hScale: getScaleFromMatrix(item, "x"),
                    vScale: getScaleFromMatrix(item, "y"),
                    effectivePpi: [getNumber(effectivePpi[0]), getNumber(effectivePpi[1])],
                    itemBounds: toNumberArray(itemBounds),
                    parentBounds: toNumberArray(maskBounds),
                    frameWidthMM: ptToMm(maskWidthPt),
                    frameHeightMM: ptToMm(maskHeightPt),
                    sortScale: Math.max(maskWidthPt, maskHeightPt)
                };
            }

            function getArtboardLabel() {
                try {
                    var doc = app.activeDocument;
                    var activeIndex = doc.artboards.getActiveArtboardIndex();
                    return doc.artboards[activeIndex].name || (remoteText("アートボード ", "Artboard ") + String(activeIndex + 1));
                } catch (_artboardError) {
                    return "Illustrator";
                }
            }

            function getScaleFromMatrix(item, axis) {
                try {
                    var matrix = item.matrix;
                    if (axis === "x") {
                        return Math.sqrt(matrix.mValueA * matrix.mValueA + matrix.mValueB * matrix.mValueB) * 100;
                    }
                    return Math.sqrt(matrix.mValueC * matrix.mValueC + matrix.mValueD * matrix.mValueD) * 100;
                } catch (_matrixError) {
                    return 100;
                }
            }

            function buildEffectivePpi(imageGeometry) {
                return [
                    imageGeometry.width > 0 ? sourcePixels.width * 72 / imageGeometry.width : 0,
                    imageGeometry.height > 0 ? sourcePixels.height * 72 / imageGeometry.height : 0
                ];
            }

            function buildCandidateGeometry(localMaskBounds, imageGeometry, effectivePpi, item, maskItem, placedIndex) {
                var adjustments = buildAdjustmentsFromProjectedBounds(localMaskBounds, imageGeometry, effectivePpi);
                return {
                    frameLocalBounds: localMaskBounds,
                    targetQuadInFrame: buildTargetQuadInImage(localMaskBounds, imageGeometry),
                    adjustments: adjustments,
                    replacementData: buildReplacementData(localMaskBounds, imageGeometry, item, maskItem, placedIndex),
                    sourcePixelSize: {
                        width: sourcePixels.width,
                        height: sourcePixels.height
                    },
                    sourcePixelTolerance: {
                        width: SOURCE_PIXEL_TOLERANCE,
                        height: SOURCE_PIXEL_TOLERANCE
                    }
                };
            }

            function buildReplacementData(localMaskBounds, imageGeometry, item, maskItem, placedIndex) {
                var expandedRect = getExpandedLocalRect(localMaskBounds, imageGeometry);
                var trimmedRect = buildTrimmedLocalRect(localMaskBounds);
                return {
                    version: REPLACEMENT_DATA_VERSION,
                    unit: REPLACEMENT_DATA_UNIT,
                    sourceApp: "Illustrator",
                    sourceKind: "IllustratorClippingMask",
                    coordinateSpace: "image-local",
                    documentName: String(app.activeDocument.name || ""),
                    placedIndex: placedIndex,
                    maskTypename: safeTypename(maskItem),
                    rotation: getRotationAngle(item),
                    imageSize: {
                        w: ptToMm(imageGeometry.width),
                        h: ptToMm(imageGeometry.height)
                    },
                    maskLocalBounds: rectToMmObject(trimmedRect),
                    mode1: buildReplacementMode(expandedRect),
                    mode2: buildReplacementMode(trimmedRect)
                };
            }

            function buildReplacementMode(localRect) {
                return {
                    x: ptToMm(getNumber(localRect.left)),
                    y: ptToMm(getNumber(localRect.top)),
                    w: ptToMm(getNumber(localRect.right - localRect.left)),
                    h: ptToMm(getNumber(localRect.bottom - localRect.top))
                };
            }

            function rectToMmObject(localRect) {
                return {
                    left: ptToMm(getNumber(localRect.left)),
                    top: ptToMm(getNumber(localRect.top)),
                    right: ptToMm(getNumber(localRect.right)),
                    bottom: ptToMm(getNumber(localRect.bottom))
                };
            }

            function safeTypename(item) {
                try {
                    return String(item.typename || "");
                } catch (_typenameError) {
                    return "";
                }
            }

            function getRotationAngle(item) {
                try {
                    var matrix = item.matrix;
                    return Math.atan2(Number(matrix.mValueB) || 0, Number(matrix.mValueA) || 0) * 180 / Math.PI;
                } catch (_rotationError) {
                    return 0;
                }
            }

            function buildTrimmedLocalRect(localMaskBounds) {
                return {
                    left: localMaskBounds.minX,
                    top: localMaskBounds.minY,
                    right: localMaskBounds.maxX,
                    bottom: localMaskBounds.maxY
                };
            }

            function getExpandedLocalRect(localMaskBounds, imageGeometry) {
                return {
                    left: Math.min(0, localMaskBounds.minX),
                    top: Math.min(0, localMaskBounds.minY),
                    right: Math.max(imageGeometry.width, localMaskBounds.maxX),
                    bottom: Math.max(imageGeometry.height, localMaskBounds.maxY)
                };
            }

            function buildTargetQuadInImage(localMaskBounds, imageGeometry) {
                return projectPoints(localRectToDocumentQuad(getExpandedLocalRect(localMaskBounds, imageGeometry), imageGeometry), imageGeometry);
            }

            function localRectToDocumentQuad(localRect, imageGeometry) {
                return [
                    localPointToDocumentPoint(localRect.left, localRect.top, imageGeometry),
                    localPointToDocumentPoint(localRect.right, localRect.top, imageGeometry),
                    localPointToDocumentPoint(localRect.right, localRect.bottom, imageGeometry),
                    localPointToDocumentPoint(localRect.left, localRect.bottom, imageGeometry)
                ];
            }

            function localPointToDocumentPoint(localX, localY, imageGeometry) {
                return [
                    imageGeometry.topLeft[0] + imageGeometry.axisX[0] * localX + imageGeometry.axisY[0] * localY,
                    imageGeometry.topLeft[1] + imageGeometry.axisX[1] * localX + imageGeometry.axisY[1] * localY
                ];
            }

            function findClippingMaskForPlacedItem(item) {
                var parent = null;
                try {
                    parent = item.parent;
                } catch (_parentError) {
                    parent = null;
                }
                if (!parent) return null;

                var mask = null;
                if (safeTypename(parent) === "GroupItem") {
                    mask = findClippingMaskInContainer(parent);
                    if (mask) return mask;
                }

                try {
                    if (parent.parent && parent.parent !== parent && safeTypename(parent.parent) === "GroupItem") {
                        return findClippingMaskInContainer(parent.parent);
                    }
                } catch (_grandParentError) {}
                return null;
            }

            function findClippingMaskInContainer(container) {
                var mask = findClippingPathInCollection(container.pathItems);
                if (mask) return mask;
                try {
                    var compoundItems = container.compoundPathItems;
                    for (var idx = 0; idx < compoundItems.length; idx++) {
                        mask = findClippingPathInCollection(compoundItems[idx].pathItems);
                        if (mask) return mask;
                    }
                } catch (_compoundError) {}
                return null;
            }

            function findClippingPathInCollection(pathItems) {
                if (!pathItems) return null;
                try {
                    for (var idx = 0; idx < pathItems.length; idx++) {
                        var pathItem = pathItems[idx];
                        try {
                            if (pathItem.clipping) return pathItem;
                        } catch (_clippingError) {}
                    }
                } catch (_collectionError) {}
                return null;
            }

            function getPlacedItemQuad(item) {
                var matrixQuad = getMatrixPlacedItemQuad(item);
                if (matrixQuad) return matrixQuad;
                return boundsToQuad(getPlacedItemBounds(item));
            }

            function getMaskQuad(maskItem) {
                var pathQuad = getPathQuad(maskItem);
                if (pathQuad) return pathQuad;
                return boundsToQuad(getBestBounds(maskItem));
            }

            function getPathQuad(pathItem) {
                var points = [];
                try {
                    var pathPoints = pathItem.pathPoints;
                    for (var idx = 0; idx < pathPoints.length; idx++) {
                        var anchor = pathPoints[idx].anchor;
                        if (anchor && anchor.length >= 2) {
                            points.push([getNumber(anchor[0]), getNumber(anchor[1])]);
                        }
                    }
                } catch (_pathPointsError) {
                    points = [];
                }
                if (points.length < 4) return null;
                return orderQuadPoints(points);
            }

            function getMatrixPlacedItemQuad(item) {
                try {
                    var matrix = item.matrix;
                    var box = item.boundingBox;
                    var bounds = getPlacedItemBounds(item);
                    if (!matrix || !box || box.length < 4 || !bounds || bounds.length < 4) return null;

                    var scaleX = vectorLength([getNumber(matrix.mValueA), getNumber(matrix.mValueB)]);
                    var scaleY = vectorLength([getNumber(matrix.mValueC), getNumber(matrix.mValueD)]);
                    var width = Math.abs(getNumber(box[2]) - getNumber(box[0])) * scaleX;
                    var height = Math.abs(getNumber(box[1]) - getNumber(box[3])) * scaleY;
                    if (width <= 0 || height <= 0) return null;

                    var axisX = normalizeVector([getNumber(matrix.mValueA), -getNumber(matrix.mValueB)]);
                    var axisY = normalizeVector([-getNumber(matrix.mValueC), getNumber(matrix.mValueD)]);
                    if (!vectorLength(axisX) || !vectorLength(axisY)) return null;

                    var center = getBoundsCenter(bounds);
                    var halfX = scalePoint(axisX, width / 2);
                    var halfY = scalePoint(axisY, height / 2);
                    return [
                        subtractPoints(subtractPoints(center, halfX), halfY),
                        subtractPoints(addPoints(center, halfX), halfY),
                        addPoints(addPoints(center, halfX), halfY),
                        addPoints(subtractPoints(center, halfX), halfY)
                    ];
                } catch (_matrixQuadError) {
                    return null;
                }
            }

            function getBoundsCenter(bounds) {
                return [
                    (getNumber(bounds[0]) + getNumber(bounds[2])) / 2,
                    (getNumber(bounds[1]) + getNumber(bounds[3])) / 2
                ];
            }

            function scalePoint(point, scale) {
                return [getNumber(point[0]) * scale, getNumber(point[1]) * scale];
            }

            function addPoints(a, b) {
                return [getNumber(a[0]) + getNumber(b[0]), getNumber(a[1]) + getNumber(b[1])];
            }

            function getPlacedItemBounds(item) {
                try {
                    var geometricBounds = item.geometricBounds;
                    if (geometricBounds && geometricBounds.length >= 4) return geometricBounds;
                } catch (_geometricBoundsError) {}
                try {
                    var visibleBounds = item.visibleBounds;
                    if (visibleBounds && visibleBounds.length >= 4) return visibleBounds;
                } catch (_visibleBoundsError) {}
                return [0, 0, 0, 0];
            }

            function getBestBounds(item) {
                try {
                    var visibleBounds = item.visibleBounds;
                    if (visibleBounds && visibleBounds.length >= 4) return visibleBounds;
                } catch (_visibleBoundsError) {}
                try {
                    var geometricBounds = item.geometricBounds;
                    if (geometricBounds && geometricBounds.length >= 4) return geometricBounds;
                } catch (_geometricBoundsError) {}
                return [0, 0, 0, 0];
            }

            function boundsToQuad(bounds) {
                return [
                    [getNumber(bounds[0]), getNumber(bounds[1])],
                    [getNumber(bounds[2]), getNumber(bounds[1])],
                    [getNumber(bounds[2]), getNumber(bounds[3])],
                    [getNumber(bounds[0]), getNumber(bounds[3])]
                ];
            }

            function orderQuadPoints(points) {
                var uniquePoints = points.slice(0);
                var topLeft = findPointByScore(uniquePoints, function(point) { return point[0] - point[1]; }, "min");
                var topRight = findPointByScore(uniquePoints, function(point) { return point[0] + point[1]; }, "max");
                var bottomRight = findPointByScore(uniquePoints, function(point) { return point[0] - point[1]; }, "max");
                var bottomLeft = findPointByScore(uniquePoints, function(point) { return point[0] + point[1]; }, "min");
                return [topLeft, topRight, bottomRight, bottomLeft];
            }

            function findPointByScore(points, scoreFn, mode) {
                var best = points[0] || [0, 0];
                var bestScore = scoreFn(best);
                for (var idx = 1; idx < points.length; idx++) {
                    var score = scoreFn(points[idx]);
                    if ((mode === "min" && score < bestScore) || (mode === "max" && score > bestScore)) {
                        bestScore = score;
                        best = points[idx];
                    }
                }
                return [getNumber(best[0]), getNumber(best[1])];
            }

            function buildGeometryFromQuadPoints(quadPoints) {
                var ordered = quadPoints;
                var horizontalVector = subtractPoints(ordered[1], ordered[0]);
                var verticalVector = subtractPoints(ordered[3], ordered[0]);
                return {
                    topLeft: ordered[0],
                    axisX: normalizeVector(horizontalVector),
                    axisY: normalizeVector(verticalVector),
                    width: vectorLength(horizontalVector),
                    height: vectorLength(verticalVector)
                };
            }

            function projectPoints(points, geometry) {
                var projectedPoints = [];
                for (var idx = 0; idx < points.length; idx++) {
                    projectedPoints.push(projectPoint(points[idx], geometry));
                }
                return projectedPoints;
            }

            function getProjectedBounds(projectedPoints) {
                var localXs = [];
                var localYs = [];
                for (var idx = 0; idx < projectedPoints.length; idx++) {
                    localXs.push(projectedPoints[idx][0]);
                    localYs.push(projectedPoints[idx][1]);
                }
                return {
                    minX: arrayMin(localXs),
                    maxX: arrayMax(localXs),
                    minY: arrayMin(localYs),
                    maxY: arrayMax(localYs)
                };
            }

            function projectPoint(point, geometry) {
                var delta = subtractPoints(point, geometry.topLeft);
                return [
                    dotProduct(delta, geometry.axisX),
                    dotProduct(delta, geometry.axisY)
                ];
            }

            function buildAdjustmentsFromProjectedBounds(localBounds, imageGeometry, effectivePpi) {
                return {
                    top: toAdjustmentValue(localBounds.minY, effectivePpi[1], "min"),
                    left: toAdjustmentValue(localBounds.minX, effectivePpi[0], "min"),
                    bottom: toAdjustmentValue(localBounds.maxY - imageGeometry.height, effectivePpi[1], "max"),
                    right: toAdjustmentValue(localBounds.maxX - imageGeometry.width, effectivePpi[0], "max")
                };
            }

            function toAdjustmentValue(deltaPt, ppi, mode) {
                var px = Math.round(getNumber(ppi) / 72 * Math.abs(getNumber(deltaPt)));
                if (px <= 0) {
                    return 0;
                }
                if (mode === "min") {
                    return deltaPt < 0 ? px : "g" + px;
                }
                return deltaPt > 0 ? px : "g" + px;
            }

            function arrayMin(values) {
                var min = values.length ? values[0] : 0;
                for (var idx = 1; idx < values.length; idx++) {
                    if (values[idx] < min) min = values[idx];
                }
                return min;
            }

            function arrayMax(values) {
                var max = values.length ? values[0] : 0;
                for (var idx = 1; idx < values.length; idx++) {
                    if (values[idx] > max) max = values[idx];
                }
                return max;
            }

            function subtractPoints(a, b) {
                return [getNumber(a[0]) - getNumber(b[0]), getNumber(a[1]) - getNumber(b[1])];
            }

            function vectorLength(vector) {
                return Math.sqrt(vector[0] * vector[0] + vector[1] * vector[1]);
            }

            function normalizeVector(vector) {
                var length = vectorLength(vector);
                if (!length) {
                    return [0, 0];
                }
                return [vector[0] / length, vector[1] / length];
            }

            function dotProduct(a, b) {
                return getNumber(a[0]) * getNumber(b[0]) + getNumber(a[1]) * getNumber(b[1]);
            }

            function quadToBounds(quad) {
                var xs = [];
                var ys = [];
                for (var idx = 0; idx < quad.length; idx++) {
                    xs.push(getNumber(quad[idx][0]));
                    ys.push(getNumber(quad[idx][1]));
                }
                return [arrayMin(xs), arrayMax(ys), arrayMax(xs), arrayMin(ys)];
            }

            function ptToMm(value) {
                return getNumber(value) * 25.4 / 72;
            }

            function toNumberArray(values) {
                var result = [];
                for (var idx = 0; idx < values.length; idx++) {
                    result.push(getNumber(values[idx]));
                }
                return result;
            }

            function zeroPad(value, digits) {
                var text = String(value);
                while (text.length < digits) {
                    text = "0" + text;
                }
                return text;
            }

            function formatMM(value) {
                return getNumber(value).toFixed(2);
            }

            function makeCandidateLabel(order, pageName, frameWidthMM, frameHeightMM) {
                var orderLabel = zeroPad(order, 2);
                return orderLabel + remoteText("：", ": ") + pageName + remoteText("（", " (") +
                    formatMM(frameWidthMM) + "mm × " + formatMM(frameHeightMM) + remoteText("mm）", "mm)");
            }

            function sortCandidates(list) {
                list.sort(function(a, b) {
                    return a.sortScale - b.sortScale;
                });
            }

            function updateCandidateLabels(list) {
                for (var idx = 0; idx < list.length; idx++) {
                    list[idx].label = makeCandidateLabel(idx + 1, list[idx].pageName, list[idx].frameWidthMM, list[idx].frameHeightMM);
                }
            }

            function serializeCandidate(candidate) {
                var serialized = buildSerializedCandidateCore(candidate);
                serialized.label = candidate.label;
                return serialized;
            }

            function buildSerializedCandidateCore(candidate) {
                return {
                    index: candidate.index,
                    placedIndex: candidate.placedIndex,
                    pageName: candidate.pageName,
                    linkName: candidate.linkName,
                    rawFileName: candidate.rawFileName,
                    rawFilePath: candidate.rawFilePath,
                    rawFolderPath: candidate.rawFolderPath,
                    hScale: candidate.hScale,
                    vScale: candidate.vScale,
                    effectivePpi: candidate.effectivePpi,
                    itemBounds: candidate.itemBounds,
                    parentBounds: candidate.parentBounds,
                    frameWidthMM: candidate.frameWidthMM,
                    frameHeightMM: candidate.frameHeightMM,
                    sortScale: candidate.sortScale,
                    adjustments: serializeAdjustments(candidate.adjustments),
                    frameLocalBounds: candidate.frameLocalBounds,
                    targetQuadInFrame: candidate.targetQuadInFrame,
                    replacementData: candidate.replacementData,
                    sourcePixelSize: candidate.sourcePixelSize,
                    sourcePixelTolerance: candidate.sourcePixelTolerance
                };
            }

            function serializeAdjustments(adjustments) {
                return [
                    adjustments.top,
                    adjustments.left,
                    adjustments.bottom,
                    adjustments.right
                ];
            }
        };

    return sendBridgeTalkAndWait("illustrator", buildBridgeTalkBody(illustratorFunction, encodedPath, targetFileName, sourcePixelSize), 300000);
}

function buildBridgeTalkBody(illustratorFunction, encodedPath, targetFileName, sourcePixelSize) {
    sourcePixelSize = sourcePixelSize || {};
    return buildBridgeTalkInvocationBody(illustratorFunction, {
        encodedKey: encodedPath,
        targetFileNameText: String(targetFileName || ""),
        sourcePixelWidth: Number(sourcePixelSize.width) || 0,
        sourcePixelHeight: Number(sourcePixelSize.height) || 0
    });
}

function buildInjectedIllustratorFunctionSource(illustratorFunction) {
    return illustratorFunction.toString().replace(
        "/*__INJECT_TO_NFC_JA__*/",
        "var toNFCJa = " + NFC_HELPER_SRC + ";\n" +
        "var normalizeDisplaySlashes = " + NORMALIZE_DISPLAY_SLASHES_SRC + ";\n" +
        "var decodeUriSafeText = " + DECODE_URI_SAFE_TEXT_SRC + ";\n" +
        "var toSourceLiteral = " + TO_SOURCE_LITERAL_SRC + ";\n" +
        "var remoteLocaleCode = " + toSourceLiteral(currentLocaleCode()) + ";\n" +
        "function remoteText(jaText, enText) { return remoteLocaleCode === \"en\" ? enText : jaText; }\n" +
        "var _normPath = " + NORM_HELPER_SRC_ID + ";\n" +
        "var _matchLinkPath = " + MATCH_LINK_HELPER_SRC + ";\n" +
        "var _decodeAndNormalizePath = " + DECODE_NORM_HELPER_SRC + ";\n" +
        "var _decodePathRaw = " + DECODE_RAW_HELPER_SRC + ";\n" +
        "var REPLACEMENT_DATA_VERSION = " + REPLACEMENT_DATA_VERSION + ";\n" +
        "var REPLACEMENT_DATA_UNIT = " + toSourceLiteral(REPLACEMENT_DATA_UNIT) + ";\n" +
        "var SOURCE_PIXEL_TOLERANCE = " + SOURCE_PIXEL_TOLERANCE + ";\n" +
        "var SOURCE_FALLBACK_PPI_ERROR_TOLERANCE = " + SOURCE_FALLBACK_PPI_ERROR_TOLERANCE + ";\n" +
        "var SOURCE_FALLBACK_MIN_PIXEL_TOLERANCE = " + SOURCE_FALLBACK_MIN_PIXEL_TOLERANCE + ";"
    );
}

function buildBridgeTalkErrorResponse(err) {
    return toSourceLiteral({
        status: "error",
        message: localText("BridgeTalkエラー: ", "BridgeTalk error: ") + String(err && err.body ? err.body : "unknown")
    });
}

function waitForBridgeTalkResponse(getResponse, timeoutMs) {
    var start = new Date().getTime();
    timeoutMs = timeoutMs || 300000;

    while (getResponse() === null && (new Date().getTime() - start) < timeoutMs) {
        try { BridgeTalk.pump(); } catch (_e) {}
        $.sleep(50);
    }

    return getResponse() === null
        ? toSourceLiteral({ status: "error", message: localText("Illustratorから応答がありません（タイムアウト）", "No response from Illustrator (timeout)") })
        : getResponse();
}

function applyAdjustmentsToDocument(doc, rawAdjustments, canvasWidth, canvasHeight) {
    var normalized = normalizeAdjustments(rawAdjustments, canvasWidth, canvasHeight);
    if (hasCanvasExpansion(normalized.expand)) {
        prepareBackgroundLayerForCanvasExpansion(doc);
    }
    doc.guides.removeAll();
    addGuides(doc.guides, normalized.guides);

    doc.resizeCanvas(
        canvasWidth + normalized.expand.left,
        canvasHeight + normalized.expand.top,
        AnchorPosition.BOTTOMRIGHT
    );
    doc.resizeCanvas(
        canvasWidth + normalized.expand.left + normalized.expand.right,
        canvasHeight + normalized.expand.top + normalized.expand.bottom,
        AnchorPosition.TOPLEFT
    );
}

function hasCanvasExpansion(expand) {
    if (!expand) return false;
    return Number(expand.top) > 0 ||
        Number(expand.left) > 0 ||
        Number(expand.bottom) > 0 ||
        Number(expand.right) > 0;
}

function prepareBackgroundLayerForCanvasExpansion(doc) {
    try {
        doc.backgroundLayer.isBackgroundLayer = false;
    } catch (_backgroundError) {}
}

function normalizeAdjustments(rawAdjustments, canvasWidth, canvasHeight) {
    var adjustmentSides = toAdjustmentSides(rawAdjustments);
    var expand = createEmptyAdjustmentSides();
    var guides = [];
    var sideConfigs = buildAdjustmentSideConfigs(canvasWidth, canvasHeight);

    for (var idx = 0; idx < sideConfigs.length; idx++) {
        var config = sideConfigs[idx];
        var parsed = parseAdjustmentValue(adjustmentSides[config.name]);
        if (parsed.type === "expand") {
            expand[config.name] = parsed.value;
        } else if (parsed.value > 0) {
            guides.push({
                direction: config.direction,
                position: config.position(parsed.value)
            });
        }
    }

    return {
        expand: expand,
        guides: guides
    };
}

function createEmptyAdjustmentSides() {
    return {
        top: 0,
        left: 0,
        bottom: 0,
        right: 0
    };
}

function buildAdjustmentSideConfigs(canvasWidth, canvasHeight) {
    return [
        {
            name: "top",
            direction: Direction.HORIZONTAL,
            position: function(value) { return value; }
        },
        {
            name: "left",
            direction: Direction.VERTICAL,
            position: function(value) { return value; }
        },
        {
            name: "bottom",
            direction: Direction.HORIZONTAL,
            position: function(value) { return canvasHeight - value; }
        },
        {
            name: "right",
            direction: Direction.VERTICAL,
            position: function(value) { return canvasWidth - value; }
        }
    ];
}

function toAdjustmentSides(rawAdjustments) {
    if (rawAdjustments && !(rawAdjustments instanceof Array) && typeof rawAdjustments === "object") {
        return {
            top: rawAdjustments.top,
            left: rawAdjustments.left,
            bottom: rawAdjustments.bottom,
            right: rawAdjustments.right
        };
    }

    rawAdjustments = rawAdjustments || [];
    return {
        top: rawAdjustments[0],
        left: rawAdjustments[1],
        bottom: rawAdjustments[2],
        right: rawAdjustments[3]
    };
}

function parseAdjustmentValue(rawValue) {
    var text = String(rawValue || 0);
    if (text.indexOf("g") === 0) {
        return {
            type: "guide",
            value: Math.max(0, Number(text.slice(1)) || 0)
        };
    }

    return {
        type: "expand",
        value: Math.max(0, parseInt(text, 10) || 0)
    };
}

function addGuides(guides, guideItems) {
    for (var idx = 0; idx < guideItems.length; idx++) {
        var guide = guideItems[idx];
        guides.add(guide.direction, UnitValue(guide.position, "px"));
    }
}

function parseJsonResponse(text) {
    var normalized = normalizeJsonResponseText(text);
    if (!normalized) return null;
    var parsed = tryParseJsonText(normalized);
    if (parsed.ok) {
        return parsed.value;
    }
    var extracted = extractJsonObjectText(normalized);
    if (extracted !== normalized) {
        parsed = tryParseJsonText(extracted);
        if (parsed.ok) {
            return parsed.value;
        }
    }
    return null;
}

function normalizeJsonResponseText(text) {
    return String(text || "")
        .replace(/^\uFEFF/, "")
        .replace(/\u0000/g, "")
        .replace(/^\s+|\s+$/g, "");
}

function tryParseJsonText(text) {
    if (typeof JSON !== "undefined" && JSON && typeof JSON.parse === "function") {
        try {
            return { ok: true, value: JSON.parse(text) };
        } catch (_jsonParseError) {}
    }

    try {
        return { ok: true, value: (new Function("return (" + text + ");"))() };
    } catch (_functionParseError) {}

    return { ok: false, value: null };
}

function extractJsonObjectText(text) {
    var start = text.indexOf("{");
    var end = text.lastIndexOf("}");
    if (start < 0 || end < start) {
        return text;
    }
    return text.substring(start, end + 1);
}

function activatePhotoshop() {
    try {
        BridgeTalk.bringToFront("photoshop");
        return;
    } catch (e) {}

    try {
        app.bringToFront();
    } catch (e2) {}
}
