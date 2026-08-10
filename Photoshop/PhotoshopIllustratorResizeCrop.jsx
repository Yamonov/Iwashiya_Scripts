#target photoshop

/*
<javascriptresource>
<name>Illustratorに合わせてリサイズ・トリミング</name>
<category>YPresets</category>
</javascriptresource>

SCRIPTMETA-BEGIN
Script-ID=org.iwashi.Photoshop_Illustrator_Resize
Version=2.0
Meta-URL=https://github.com/Yamonov/Iwashiya_Scripts/tree/main/Photoshop
Name=Illustrator配置に合わせてリサイズ・トリミング
Author=Murakami Yoshiteru
Release-Date=2026-08-10
Target-App=Photoshop
Description-BEGIN
Photoshopで開いている画像を、Illustratorドキュメント上の配置サイズに合わせてリサイズします。

配置したIllustratorドキュメントを開いておき、Photoshopから実行してください。

トリミング処理は「伸ばし/トリミングを行わない」「伸ばして、トリム部分にガイドを引く（画像を削りません）」
「伸ばして、トリム部分を切り抜く（クリッピングマスク外を削除します）」から選択できます。
ガイドを引く場合も切り抜く場合も、Illustratorのクリッピングマスク情報をXMPメタデータに記録します。
伸ばし処理後は、Illustrator側のスクリプトで処理してください。

拡張子やパスの違う画像ファイルでも処理できますが、同一性の担保はご自身で行ってください。
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
var HISTORY_NAME = localText("Illustratorに合わせてリサイズ・トリミング処理", "Resize and Trim to Illustrator Placement");
var TRIMMING_MODE_NONE = "none";
var TRIMMING_MODE_GUIDES = "extendWithGuides";
var TRIMMING_MODE_CROP = "extendAndCrop";
var ILLUSTRATOR_BASE_TARGET = "illustrator";
var REPLACEMENT_XMP_NAMESPACE_URI = "http://ns.yamo.jp/photoshop/illustrator-crop-replacement-data/1.0/";
var REPLACEMENT_XMP_PREFIX = "yamoAiCrop:";
var REPLACEMENT_XMP_PROPERTY = "PhotoshopIllustratorCrop_ReplacementData";
var REPLACEMENT_DATA_VERSION = 1;
var REPLACEMENT_DATA_UNIT = "mm";

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

// ==== CustomOptions（旧 Illustrator Resize の設定を継承） ====
var PREF_ID_ILLUSTRATOR_RESIZE = "com.yamo.psAiresize_v1";
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

function getPhotoshopDocumentId(doc) {
    try {
        return Number(doc.id);
    } catch (_documentIdError) { }
    return NaN;
}

function createPhotoshopDocumentSession(doc) {
    if (!doc) {
        throw new Error(localText(
            "処理対象のPhotoshopドキュメントを取得できません。",
            "The target Photoshop document could not be obtained."
        ));
    }
    var documentId = getPhotoshopDocumentId(doc);
    if (!isFinite(documentId)) {
        throw new Error(localText(
            "処理対象のPhotoshopドキュメントIDを取得できません。",
            "The target Photoshop document ID could not be obtained."
        ));
    }
    var documentPath = "";
    try {
        documentPath = _normPathLocal(doc.fullName.fsName);
    } catch (_documentPathError) { }
    return {
        documentRef: doc,
        documentId: documentId,
        documentPath: documentPath,
        documentName: String(doc.name || ""),
        initialWidthPx: Math.round(doc.width.as("px")),
        initialHeightPx: Math.round(doc.height.as("px")),
        initialResolution: Number(doc.resolution)
    };
}

function assertPhotoshopDocumentSession(session) {
    if (!session || !session.documentRef || !isFinite(Number(session.documentId))) {
        throw new Error(localText(
            "処理対象のPhotoshopドキュメント情報が失われました。",
            "The target Photoshop document information is no longer available."
        ));
    }
    if (!app.documents.length) {
        throw new Error(localText(
            "処理対象のPhotoshopドキュメントが閉じられました。",
            "The target Photoshop document was closed."
        ));
    }
    var activeDocumentId = getPhotoshopDocumentId(app.activeDocument);
    if (activeDocumentId !== Number(session.documentId)) {
        throw new Error(localText(
            "処理対象のPhotoshopドキュメントが切り替わりました。",
            "The target Photoshop document changed."
        ));
    }
    var referenceId = getPhotoshopDocumentId(session.documentRef);
    if (referenceId !== Number(session.documentId)) {
        throw new Error(localText(
            "処理対象のPhotoshopドキュメントを確認できません。",
            "The target Photoshop document could not be verified."
        ));
    }
    if (session.documentPath) {
        var currentPath = "";
        try { currentPath = _normPathLocal(session.documentRef.fullName.fsName); } catch (_pathError) {}
        if (!currentPath || currentPath !== String(session.documentPath)) {
            throw new Error(localText(
                "処理対象のPhotoshopドキュメントの保存先が変更されています。",
                "The target Photoshop document path has changed."
            ));
        }
    }
    if (Math.round(session.documentRef.width.as("px")) !== Number(session.initialWidthPx) ||
            Math.round(session.documentRef.height.as("px")) !== Number(session.initialHeightPx) ||
            Math.abs(Number(session.documentRef.resolution) - Number(session.initialResolution)) > 0.000001) {
        throw new Error(localText(
            "処理対象のPhotoshopドキュメントの寸法または解像度が変更されています。",
            "The target Photoshop document dimensions or resolution have changed."
        ));
    }
    if (session.documentRef.saved !== true) {
        throw new Error(localText(
            "処理対象のPhotoshopドキュメントに未保存の変更があります。",
            "The target Photoshop document has unsaved changes."
        ));
    }
    return session.documentRef;
}

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

function runWithHistory(session, historyName, fnName) {
    var doc = assertPhotoshopDocumentSession(session);
    __HISTORY_DID_RUN__ = false;
    try {
        doc.suspendHistory(historyName, fnName);
        if (__HISTORY_DID_RUN__ !== true) {
            throw new Error(localText(
                "履歴処理を開始できませんでした。",
                "The history operation could not be started."
            ));
        }
        return {
            ok: true
        };
    } catch (e) {
        return {
            ok: false,
            error: e
        };
    }
}

function restoreHistoryStateAfterFailure(doc, historyState) {
    if (!doc || !historyState) return false;
    try {
        doc.activeHistoryState = historyState;
        return true;
    } catch (_historyRestoreError) { }
    return false;
}

function snapshotDocumentGuides(doc) {
    if (!doc) return null;
    var snapshot = [];
    try {
        for (var index = 0; index < doc.guides.length; index++) {
            snapshot.push({
                direction: doc.guides[index].direction,
                position: Number(doc.guides[index].coordinate.as("px"))
            });
        }
    } catch (_guideSnapshotError) {
        return null;
    }
    return snapshot;
}

function restoreDocumentGuides(doc, snapshot) {
    if (!doc || !(snapshot instanceof Array)) return false;
    try {
        for (var removeIndex = doc.guides.length - 1; removeIndex >= 0; removeIndex--) {
            doc.guides[removeIndex].remove();
        }
        for (var addIndex = 0; addIndex < snapshot.length; addIndex++) {
            var guide = snapshot[addIndex];
            if (!guide || !isFinite(Number(guide.position))) return false;
            doc.guides.add(guide.direction, UnitValue(Number(guide.position), "px"));
        }
        return doc.guides.length === snapshot.length;
    } catch (_guideRestoreError) { }
    return false;
}

function getHistoryStatusByName(doc, name) {
    try {
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
    if (!ctx || !ctx.photoshopSession) {
        throw new Error(localText(
            "処理対象のPhotoshopドキュメント情報がありません。",
            "The target Photoshop document information is unavailable."
        ));
    }
    var doc = assertPhotoshopDocumentSession(ctx.photoshopSession);
    var newWidthPx = ctx.newWidthPx;
    var newHeightPx = ctx.newHeightPx;
    var targetPPI = ctx.targetPPI;
    var scaleRatio = ctx.scaleRatio;
    var upscaleMethod = ctx.upscaleMethod;
    var downscaleMethod = ctx.downscaleMethod;
    var trimmingMode = ctx.trimmingMode || TRIMMING_MODE_NONE;

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
    if (trimmingMode !== TRIMMING_MODE_NONE) {
        if (!ctx.cropResponse) {
            throw new Error(localText("トリミング情報を取得できませんでした。", "Trimming information could not be obtained."));
        }
        CropIntegration.applyMode(
            doc,
            ctx.cropResponse,
            trimmingMode,
            Math.round(doc.width.as("px")),
            Math.round(doc.height.as("px"))
        );
        ctx.cropResponse.__integrationMetadataChangeAttempted = true;
        if (!CropIntegration.writeMetadata(doc, ctx.cropResponse)) {
            throw new Error(localText(
                "XMPタグの埋め込みに失敗しました。",
                "The XMP tag could not be embedded."
            ));
        }
    }

    // リサイズとトリミングの完了後に100%表示へ切替
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
        var d = app.getCustomOptions(PREF_ID_ILLUSTRATOR_RESIZE);
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
    app.putCustomOptions(PREF_ID_ILLUSTRATOR_RESIZE, d, true);
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
            return localText("モノクロ2階調", "Bitmap");
        case DocumentMode.GRAYSCALE:
            return localText("グレースケール", "Grayscale");
        case DocumentMode.INDEXEDCOLOR:
            return localText("インデックスカラー", "Indexed Color");
        case DocumentMode.RGB:
            return "RGB";
        case DocumentMode.CMYK:
            return "CMYK";
        case DocumentMode.LAB:
            return "Lab";
        case DocumentMode.MULTICHANNEL:
            return localText("マルチチャンネル", "Multichannel");
        case DocumentMode.DUOTONE:
            return localText("ダブルトーン", "Duotone");
        default:
            return localText("不明", "Unknown");
    }
}

function parseBridgeTalkJson(responseText, rawResponse, appLabel) {
    var parsed = parseJsonResponse(responseText);
    if (parsed) return parsed;
    alert(appLabel + localText("応答の解析に失敗しました。\n元の応答: ", " response could not be parsed.\nRaw response: ") + rawResponse);
    return null;
}

function parseJsonResponse(text) {
    var normalized = normalizeJsonResponseText(text);
    if (!normalized) return null;
    var parsed = tryParseJsonText(normalized);
    if (parsed.ok) return parsed.value;

    var extracted = extractJsonObjectText(normalized);
    if (extracted !== normalized) {
        parsed = tryParseJsonText(extracted);
        if (parsed.ok) return parsed.value;
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
            return {ok: true, value: JSON.parse(text)};
        } catch (_jsonParseError) {}
    }

    try {
        return {ok: true, value: (new Function("return (" + text + ");"))()};
    } catch (_functionParseError) {}

    return {ok: false, value: null};
}

function extractJsonObjectText(text) {
    var start = text.indexOf("{");
    var end = text.lastIndexOf("}");
    if (start < 0 || end < start) return text;
    return text.substring(start, end + 1);
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
        errorBody = errorEvent && errorEvent.body
            ? errorEvent.body
            : localText("不明なエラー", "Unknown error");
    };
    try {
        bridgeTalk.timeout = Math.max(1, Math.round((timeoutMs || 30000) / 1000));
    } catch (error) {}
    var sendStarted = false;
    try {
        sendStarted = bridgeTalk.send() !== false;
    } catch (sendError) {
        return {
            ok: false,
            error: String(sendError)
        };
    }
    if (!sendStarted) {
        return {
            ok: false,
            error: localText("BridgeTalkメッセージを送信できませんでした。", "The BridgeTalk message could not be sent.")
        };
    }

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

function getIllustratorMajorFromSpecifier(specifier) {
    var match = String(specifier || "").match(/illustrator(?:beta|prerelease)?-(\d+)/i);
    return match ? Number(match[1]) : NaN;
}

function getRunningIllustratorTargets() {
    var targets = [];
    var seenSpecifiers = {};
    var seenApplications = {};

    function getApplicationKey(target) {
        var applicationPath = "";
        try {
            applicationPath = _normPathLocal(BridgeTalk.getAppPath(target));
        } catch (_applicationPathError) { }
        if ($.os.indexOf("Windows") >= 0) applicationPath = applicationPath.toLowerCase();
        if (applicationPath) return "path:" + applicationPath;
        var canonicalSpecifier = String(target).toLowerCase().match(
            /^(illustrator(?:beta|prerelease)?-\d+(?:\.\d+)?)/
        );
        return "specifier:" + (canonicalSpecifier ? canonicalSpecifier[1] : String(target).toLowerCase());
    }

    function addRunningTarget(value) {
        var target = String(value || "");
        if (!/^illustrator(?:beta|prerelease)?-/i.test(target) || seenSpecifiers[target]) return;
        seenSpecifiers[target] = true;
        var running = false;
        try { running = BridgeTalk.isRunning(target) === true; } catch (_runningError) { }
        if (!running) return;
        var applicationKey = getApplicationKey(target);
        if (seenApplications[applicationKey]) return;
        seenApplications[applicationKey] = true;
        targets.push(target);
    }

    function addTargetList(values) {
        if (!values || typeof values.length === "undefined") return;
        for (var index = 0; index < values.length; index++) {
            addRunningTarget(values[index]);
        }
    }

    // version/localeを含むspecifierを優先し、API差のある環境だけ段階的にfallbackする。
    try { addTargetList(BridgeTalk.getTargets(null, null)); } catch (_targetsTwoArgsError) { }
    if (!targets.length) {
        try { addTargetList(BridgeTalk.getTargets(null)); } catch (_targetsOneArgError) { }
    }
    if (!targets.length) {
        try { addTargetList(BridgeTalk.getTargets()); } catch (_targetsNoArgError) { }
    }

    var latestSpecifier = "";
    try {
        latestSpecifier = String(BridgeTalk.getSpecifier(ILLUSTRATOR_BASE_TARGET) || "");
    } catch (_specifierError) { }
    if (!targets.length) addRunningTarget(latestSpecifier);

    var latestMajor = getIllustratorMajorFromSpecifier(latestSpecifier);
    if (!targets.length && isFinite(latestMajor) && latestMajor >= 1) {
        for (var major = latestMajor; major >= 1; major--) {
            addRunningTarget(ILLUSTRATOR_BASE_TARGET + "-" + major);
        }
    }

    targets.sort(function(a, b) {
        return getIllustratorMajorFromSpecifier(b) - getIllustratorMajorFromSpecifier(a);
    });
    return targets;
}

var pendingIllustratorForegroundRequests = [];

function releaseIllustratorForegroundRequest(request) {
    for (var requestIndex = pendingIllustratorForegroundRequests.length - 1; requestIndex >= 0; requestIndex--) {
        if (pendingIllustratorForegroundRequests[requestIndex] === request) {
            pendingIllustratorForegroundRequests.splice(requestIndex, 1);
        }
    }
}

function getCanonicalIllustratorMajorSpecifier(specifier) {
    var match = String(specifier || "").match(/^(illustrator(?:beta|prerelease)?)-(\d+)/i);
    if (!match) return "";
    return String(match[1]).toLowerCase() + "-" + String(match[2]);
}

function requestIllustratorForegroundAfterScript(target) {
    if (!target) return false;
    try {
        if (BridgeTalk.isRunning(target) !== true) return false;
    } catch (_runningError) {
        return false;
    }

    var request = null;
    try {
        var foregroundSpecifier = getCanonicalIllustratorMajorSpecifier(target);
        if (!foregroundSpecifier) return false;
        request = new BridgeTalk();
        request.target = target;
        request.body = "(function(){" +
            "$.sleep(150);" +
            "var __showTransientActivationDialog = " + showTransientActivationDialog.toString() + ";" +
            "var __foregroundDocument = null;" +
            "try { if (app.documents.length > 0) __foregroundDocument = app.activeDocument; } catch (_documentReadError) {}" +
            "try { if (__foregroundDocument) __foregroundDocument.activate(); } catch (_documentActivationError) {}" +
            "try { BridgeTalk.bringToFront(" + toSourceLiteral(foregroundSpecifier) + "); } catch (_applicationActivationError) {}" +
            "__showTransientActivationDialog('Illustrator');" +
            "try { if (__foregroundDocument) __foregroundDocument.activate(); } catch (_finalDocumentActivationError) {}" +
            "return 'ok';" +
            "})();";
        request.timeout = 5;
        var releaseRequest = function() {
            releaseIllustratorForegroundRequest(request);
        };
        request.onResult = releaseRequest;
        request.onError = releaseRequest;
        request.onTimeout = releaseRequest;

        pendingIllustratorForegroundRequests.push(request);
        while (pendingIllustratorForegroundRequests.length > 16) {
            pendingIllustratorForegroundRequests.shift();
        }
        // Adobeは即時送信できずキューへ入れた場合もfalseを返すため、解放せず応答/タイムアウトを待つ。
        request.send();
        return true;
    } catch (_foregroundRequestError) {
        if (request) releaseIllustratorForegroundRequest(request);
    }
    return false;
}

function requestInitialIllustratorCandidates(illustratorFunctionSource, imagePath, imageName) {
    var targets = getRunningIllustratorTargets();
    if (!targets.length) {
        return {
            ok: false,
            error: localText(
                "起動中のIllustratorが見つかりません。対象ドキュメントを開いてから実行してください。",
                "No running Illustrator application was found. Open the target document and run the script again."
            )
        };
    }

    var exactItems = [];
    var nameOnlyItems = [];
    var hasFolderDifference = false;
    var hasExtensionDifference = false;
    var communicationErrors = [];

    function appendItems(responseObject, bridgeTarget) {
        if (!responseObject || !responseObject.items || !responseObject.items.length) return;
        var destination = responseObject.matchType === "nameOnly" ? nameOnlyItems : exactItems;
        for (var itemIndex = 0; itemIndex < responseObject.items.length; itemIndex++) {
            var item = responseObject.items[itemIndex] || {};
            item.bridgeTarget = bridgeTarget;
            destination.push(item);
        }
        hasFolderDifference = hasFolderDifference || !!responseObject.hasFolderDifference;
        hasExtensionDifference = hasExtensionDifference || !!responseObject.hasExtensionDifference;
    }

    for (var targetIndex = 0; targetIndex < targets.length; targetIndex++) {
        var bridgeTarget = targets[targetIndex];
        var requestBody = "(" + illustratorFunctionSource + ")(" + toSourceLiteral({
            action: "discover",
            pathFs: String(imagePath || ""),
            fileName: String(imageName || ""),
            bridgeTarget: bridgeTarget
        }) + ");";
        var bridgeResult = sendBridgeTalkAndWait(bridgeTarget, requestBody, 30000);
        if (!bridgeResult.ok) {
            communicationErrors.push(bridgeTarget + ": " + bridgeResult.error);
            continue;
        }
        if (!bridgeResult.body || bridgeResult.body === "null") continue;
        var responseObject = parseBridgeTalkJson(bridgeResult.body, bridgeResult.body, bridgeTarget);
        if (!responseObject) {
            communicationErrors.push(bridgeTarget + ": " + localText("応答を解析できません。", "The response could not be parsed."));
            continue;
        }
        if (responseObject.status !== "ok") {
            communicationErrors.push(bridgeTarget + ": " + String(responseObject.message || localText("配置情報を取得できません。", "Placement information could not be obtained.")));
            continue;
        }
        appendItems(responseObject, bridgeTarget);
    }

    if (communicationErrors.length) {
        return {
            ok: false,
            error: localText(
                "一部のIllustratorから配置情報を取得できませんでした。",
                "Placement information could not be obtained from one or more Illustrator applications."
            ) + "\n" + communicationErrors.join("\n")
        };
    }

    var selectedItems = exactItems.length ? exactItems : nameOnlyItems;
    if (!selectedItems.length) {
        return {
            ok: true,
            value: null
        };
    }
    return {
        ok: true,
        value: {
            matchType: exactItems.length ? "exact" : "nameOnly",
            hasFolderDifference: hasFolderDifference,
            hasExtensionDifference: hasExtensionDifference,
            items: selectedItems
        }
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

// 通常のモーダルを短時間だけ表示し、実行中のAdobeアプリの前面化を促す。
// onActivateが発生しない環境でも手動で閉じられるよう、OKを残す。
function showTransientActivationDialog(title) {
    var activationDialog = null;
    try {
        activationDialog = new Window("dialog", String(title || ""));
        activationDialog.preferredSize = [150, 70];
        var activationButton = activationDialog.add("button", undefined, "OK", { name: "ok" });
        activationDialog.defaultElement = activationButton;
        activationDialog.cancelElement = activationButton;
        activationButton.onClick = function() { activationDialog.close(); };
        var activationHandled = false;
        activationDialog.onActivate = function() {
            if (activationHandled) return;
            activationHandled = true;
            try { activationDialog.update(); } catch (_dialogUpdateError) { }
            $.sleep(75);
            try { activationDialog.close(); } catch (_dialogCloseError) { }
        };
        try { if (activationDialog.center) activationDialog.center(); } catch (_dialogCenterError) { }
        activationDialog.show();
        return true;
    } catch (_dialogError) {
        try { if (activationDialog) activationDialog.close(); } catch (_dialogCleanupError) { }
    }
    return false;
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
        var linkFileNameText = decodeDialogText(singleItem && singleItem.fileName);
        var linkPathText = decodeDialogText(singleItem && singleItem.folderPath);

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

function findLargestIllustratorCandidateIndex(items) {
    var maxIndex = 0;
    var maxLongMM = -Infinity;
    for (var itemIndex = 0; itemIndex < items.length; itemIndex++) {
        var itemLongMM = Number(items[itemIndex].placedLongMM) || 0;
        if (itemLongMM > maxLongMM) {
            maxLongMM = itemLongMM;
            maxIndex = itemIndex;
        }
    }
    return maxIndex;
}

function finalizeIllustratorResizeFlow(ctx) {
    if (!ctx || !ctx.targetItem) return;
    var doc = null;
    try {
        doc = assertPhotoshopDocumentSession(ctx.photoshopSession);
    } catch (documentSessionError) {
        alert(documentSessionError);
        return;
    }
    var docWidthPx = ctx.docWidthPx;
    var docHeightPx = ctx.docHeightPx;
    var currentPPI = ctx.currentPPI;
    var longPx = ctx.longPx;
    var candidateItemsArray = ctx.candidateItemsArray;
    var targetItem = ctx.targetItem;

    var comparisonItems = candidateItemsArray && candidateItemsArray.length ? candidateItemsArray : [targetItem];
    var hScale = targetItem.hScale;
    var vScale = targetItem.vScale;
    var placedWmm = targetItem.placedWmm;
    var placedHmm = targetItem.placedHmm;
    var placedLongMM = Math.max(placedWmm, placedHmm);
    var effectivePPI = targetItem.effectivePPI;
    var minPlacedPPI = Infinity;
    var maxPlacedPPI = -Infinity;
    for (var comparisonIndex = 0; comparisonIndex < comparisonItems.length; comparisonIndex++) {
        var comparisonPPI = Number(comparisonItems[comparisonIndex].effectivePPI);
        if (!isFinite(comparisonPPI) || comparisonPPI <= 0) continue;
        if (comparisonPPI < minPlacedPPI) minPlacedPPI = comparisonPPI;
        if (comparisonPPI > maxPlacedPPI) maxPlacedPPI = comparisonPPI;
    }
    if (!isFinite(minPlacedPPI)) minPlacedPPI = effectivePPI;
    if (!isFinite(maxPlacedPPI)) maxPlacedPPI = effectivePPI;
    var scaleDiff = Math.abs(hScale - vScale);
    var isUniformScale = scaleDiff <= 0.01;

    function calcRequiredPixels(lengthMM, ppi) {
        return Number(lengthMM) * Number(ppi) / 25.4;
    }

    var ppiLine = isUniformScale
        ? localText("画像ppi: ", "Image ppi: ") + currentPPI + localText("（実効ppi: ", " (effective ppi: ") + effectivePPI.toFixed(2) + localText("）", ")") + "\n"
        : localText("画像ppi: ", "Image ppi: ") + currentPPI + localText("（実効ppi(最小): ", " (effective ppi, minimum: ") + effectivePPI.toFixed(2) + localText("）", ")") + "\n";
    var scaleLine = isUniformScale
        ? localText("配置スケール: ", "Placed scale: ") + hScale.toFixed(3) + " %\n"
        : localText("配置スケール: H ", "Placed scale: H ") + hScale.toFixed(3) + " % / V " + vScale.toFixed(3) + " %\n";
    var messageBase = localText("Illustrator配置サイズ(長辺): ", "Illustrator placed size (long side): ") + placedLongMM.toFixed(2) + " mm\n" +
        ppiLine +
        scaleLine +
        localText("画像ピクセル: ", "Image pixels: ") + longPx + "\n";

    var illustratorSelectionHandle = buildPlacementHandle(targetItem);

    var hasSmartObject = containsSmartObject(doc);
    var dialogResult = showConfirmDialog(
        doc,
        messageBase,
        placedWmm,
        placedHmm,
        docWidthPx,
        docHeightPx,
        hasSmartObject,
        effectivePPI,
        minPlacedPPI,
        maxPlacedPPI,
        ctx.matchedItemCount || 1,
        illustratorSelectionHandle,
        ctx.matchType === "nameOnly",
        targetItem.trimmingAvailable === true,
        String(targetItem.trimmingReason || "")
    );
    try {
        if (dialogResult && dialogResult.hasOwnProperty('usePrev')) saveUsePrevOnly(dialogResult.usePrev);
    } catch (_) { }
    if (dialogResult && dialogResult.showIllustratorTarget) {
        requestIllustratorForegroundAfterScript(dialogResult.showIllustratorTarget);
        return;
    }
    if (!dialogResult || dialogResult.cancelled) return;
    var targetPPI = dialogResult.ppi;
    var upscaleMethod = dialogResult.method;
    var downscaleMethod = dialogResult.downMethod;
    var trimmingMode = dialogResult.trimmingMode || TRIMMING_MODE_NONE;
    // Illustratorは初回探索時のスナップショットを正とし、OK後は再通信しない。
    var cropResponse = {
        status: "ok",
        selected: targetItem
    };
    if (trimmingMode !== TRIMMING_MODE_NONE &&
            (!targetItem.trimmingAvailable || !targetItem.normalizedMaskBounds || !targetItem.replacementData)) {
        alert(targetItem.trimmingReason
            ? targetItem.trimmingReason
            : localText(
                "この配置ではトリミング処理を実行できません。",
                "Trimming cannot be performed for this placement."
            ));
        return;
    }
    var reqWpx = calcRequiredPixels(placedWmm, targetPPI);
    var reqHpx = calcRequiredPixels(placedHmm, targetPPI);
    var scaleRatio = Math.max(reqWpx / docWidthPx, reqHpx / docHeightPx);
    var newWidthPx = Math.round(docWidthPx * scaleRatio);
    var newHeightPx = Math.round(docHeightPx * scaleRatio);
    try {
        assertPhotoshopDocumentSession(ctx.photoshopSession);
    } catch (documentCheckError) {
        alert(documentCheckError);
        return;
    }

    if (trimmingMode !== TRIMMING_MODE_NONE) {
        try {
            getCropIntegration();
            if (!CropIntegration.setProcessingMode(cropResponse, trimmingMode)) {
                throw new Error(localText(
                    "XMP配置情報に処理方法を記録できません。",
                    "The processing method could not be recorded in the XMP placement data."
                ));
            }
            if (!CropIntegration.preflightMetadata(doc, cropResponse)) {
                throw new Error(localText("XMP配置情報がありません。", "XMP placement data is unavailable."));
            }
        } catch (xmpPreflightError) {
            alert(
                localText(
                    "XMPタグを準備できないため、画像処理を中止しました。",
                    "Image processing was cancelled because the XMP tag could not be prepared."
                ) + "\n" + xmpPreflightError
            );
            return;
        }
    }

    __HISTORY_CTX__ = {
        photoshopSession: ctx.photoshopSession,
        newWidthPx: newWidthPx,
        newHeightPx: newHeightPx,
        targetPPI: targetPPI,
        scaleRatio: scaleRatio,
        upscaleMethod: upscaleMethod,
        downscaleMethod: downscaleMethod,
        trimmingMode: trimmingMode,
        cropResponse: cropResponse
    };
    var historyStateBeforeProcess = null;
    try {
        historyStateBeforeProcess = doc.activeHistoryState;
    } catch (_historySnapshotError) { }
    var guidesBeforeProcess = snapshotDocumentGuides(doc);
    var resizeResult = runWithHistory(ctx.photoshopSession, HISTORY_NAME, "performResizeFromCtx()");
    __HISTORY_CTX__ = null;
    if (!resizeResult || resizeResult.ok !== true) {
        var restoredAfterProcessError = restoreHistoryStateAfterFailure(doc, historyStateBeforeProcess);
        var metadataRestoredAfterProcessError = true;
        if (cropResponse && cropResponse.__integrationMetadataChangeAttempted === true) {
            metadataRestoredAfterProcessError = CropIntegration.restoreMetadata(doc, cropResponse);
        }
        var guidesRestoredAfterProcessError = restoreDocumentGuides(doc, guidesBeforeProcess);
        alert(
            localText("リサイズ・トリミング処理に失敗しました。", "Resize and trimming failed.") + "\n" +
            (resizeResult && resizeResult.error ? resizeResult.error : localText("原因不明のエラー", "Unknown error")) +
            (restoredAfterProcessError && metadataRestoredAfterProcessError && guidesRestoredAfterProcessError
                ? localText("\n処理前の状態に戻しました。", "\nThe document was restored to its pre-process state.")
                : localText("\n完全には処理前の状態へ戻せませんでした。ヒストリーパネルとファイル情報を確認してください。", "\nThe document could not be fully restored. Check the History panel and File Info."))
        );
        return;
    }
}

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
            var resolvedFile = f.resolve();
            if (resolvedFile) f = resolvedFile;
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
var NORM_HELPER_SRC_ID = _normPathLocal.toString();

function buildPlacementHandle(candidate) {
    return {
        bridgeTarget: candidate.bridgeTarget || "",
        documentIndex: candidate.documentIndex,
        documentName: candidate.documentName || "",
        documentPath: candidate.documentPath || "",
        itemUuid: candidate.itemUuid || "",
        linkPath: candidate.linkPath || "",
        matchType: candidate.matchType || "exact",
        geometryFingerprint: candidate.geometryFingerprint || null
    };
}

// 対象アプリ内の候補選択には、配置を一意に解決する情報だけを渡す。
// 既に取得済みのgeometry fingerprintやマスク点列は再送・再検証しない。
function buildChooserPlacementHandle(candidate) {
    return {
        bridgeTarget: candidate.bridgeTarget || "",
        documentName: candidate.documentName || "",
        documentPath: candidate.documentPath || "",
        itemUuid: candidate.itemUuid || "",
        linkPath: candidate.linkPath || "",
        matchType: candidate.matchType || "exact"
    };
}

function hasValidPlacementGeometryFingerprint(fingerprint) {
    if (!fingerprint || Number(fingerprint.schema) !== 1 || !fingerprint.itemUuid) return false;
    var quad = fingerprint.imageQuad;
    if (!(quad instanceof Array) || quad.length !== 4) return false;
    for (var pointIndex = 0; pointIndex < quad.length; pointIndex++) {
        var point = quad[pointIndex];
        if (!(point instanceof Array) || point.length < 2 ||
                !isFinite(Number(point[0])) || !isFinite(Number(point[1]))) {
            return false;
        }
    }
    return true;
}

function groupCandidateItemsByBridgeTarget(items) {
    var groups = [];
    for (var itemIndex = 0; items && itemIndex < items.length; itemIndex++) {
        var item = items[itemIndex];
        var bridgeTarget = String(item && item.bridgeTarget ? item.bridgeTarget : "");
        var group = null;
        for (var groupIndex = 0; groupIndex < groups.length; groupIndex++) {
            if (groups[groupIndex].bridgeTarget === bridgeTarget) {
                group = groups[groupIndex];
                break;
            }
        }
        if (!group) {
            group = {
                bridgeTarget: bridgeTarget,
                applicationVersion: String(item && item.applicationVersion ? item.applicationVersion : ""),
                items: []
            };
            groups.push(group);
        } else if (!group.applicationVersion && item && item.applicationVersion) {
            group.applicationVersion = String(item.applicationVersion);
        }
        group.items.push(item);
    }
    return groups;
}

function buildCandidateTargetGroupLabel(group, applicationName) {
    var bridgeTarget = String(group && group.bridgeTarget ? group.bridgeTarget : "");
    var displayName = String(applicationName || "Adobe");
    if (/^illustratorbeta-/i.test(bridgeTarget)) displayName += " Beta";
    else if (/^illustratorprerelease-/i.test(bridgeTarget)) displayName += " Prerelease";

    var version = String(group && group.applicationVersion ? group.applicationVersion : "");
    if (version) displayName += " " + version;
    else if (bridgeTarget) displayName += " (" + bridgeTarget + ")";

    var itemCount = group && group.items ? group.items.length : 0;
    return displayName + " — " + itemCount + localText(
        "件",
        itemCount === 1 ? " placement" : " placements"
    );
}

function chooseCandidateTargetGroupInPhotoshop(groups, defaultItem, applicationName) {
    if (!groups || !groups.length) return null;
    if (groups.length === 1) return groups[0];

    var dialog = new Window("dialog", localText("対象バージョンを選択", "Select Application Version"));
    dialog.orientation = "column";
    dialog.alignChildren = ["fill", "top"];
    dialog.spacing = 8;
    dialog.margins = 12;

    var labels = [];
    var initialIndex = 0;
    for (var groupIndex = 0; groupIndex < groups.length; groupIndex++) {
        var group = groups[groupIndex];
        labels.push(buildCandidateTargetGroupLabel(group, applicationName));
        for (var itemIndex = 0; group.items && itemIndex < group.items.length; itemIndex++) {
            if (group.items[itemIndex] === defaultItem) initialIndex = groupIndex;
        }
    }

    var contentWidth = 360;
    for (var labelIndex = 0; labelIndex < labels.length; labelIndex++) {
        try {
            contentWidth = Math.max(contentWidth,
                Math.ceil(Number(dialog.graphics.measureString(labels[labelIndex])[0])) + 34);
        } catch (_measureTargetLabelError) { }
    }
    var prompt = dialog.add("statictext", undefined, localText(
        "候補が複数の" + applicationName + "バージョンで見つかりました。先に対象バージョンを選択してください。",
        "Matching placements were found in multiple " + applicationName + " versions. Select the target version first."
    ), {multiline: true});
    prompt.preferredSize = [contentWidth, 34];

    var listBox = dialog.add("listbox", undefined, [], {multiselect: false});
    listBox.preferredSize = [contentWidth, 28 + Math.max(2, Math.min(8, groups.length)) * 22];
    for (var rowIndex = 0; rowIndex < groups.length; rowIndex++) {
        var row = listBox.add("item", labels[rowIndex]);
        row.targetGroup = groups[rowIndex];
    }
    listBox.selection = listBox.items[initialIndex];

    var buttonGroup = dialog.add("group");
    buttonGroup.alignment = ["right", "center"];
    var cancelButton = buttonGroup.add("button", undefined, localText("キャンセル", "Cancel"), {name: "cancel"});
    var okButton = buttonGroup.add("button", undefined, "OK", {name: "ok"});
    dialog.defaultElement = okButton;
    dialog.cancelElement = cancelButton;
    cancelButton.onClick = function() { dialog.close(0); };
    okButton.onClick = function() {
        if (!listBox.selection) return;
        dialog.close(1);
    };

    if (dialog.show() !== 1 || !listBox.selection) return null;
    return listBox.selection.targetGroup;
}

// 同じIllustratorプロセス内の候補を、そのIllustrator自身のダイアログで選択する。
// BridgeTalk応答後はOK/キャンセルのどちらでもPhotoshopへ戻してから呼び出し元へ返す。
function chooseInitialIllustratorCandidateInTarget(items, initialItem, warningLines, photoshopFileName) {
    if (!items || !items.length) return null;

    var bridgeTarget = String(items[0].bridgeTarget || "");
    if (!bridgeTarget) {
        alert(localText(
            "対象のIllustratorを確認できません。",
            "The target Illustrator application could not be verified."
        ));
        return null;
    }

    var chooserEntries = [];
    var initialIndex = 0;
    for (var itemIndex = 0; itemIndex < items.length; itemIndex++) {
        var candidate = items[itemIndex];
        if (String(candidate.bridgeTarget || "") !== bridgeTarget) {
            alert(localText(
                "異なるIllustratorバージョンの候補を同時に表示できません。",
                "Candidates from different Illustrator versions cannot be shown together."
            ));
            return null;
        }
        chooserEntries.push({
            index: itemIndex,
            placement: buildChooserPlacementHandle(candidate),
            pageName: candidate.pageName || "",
            displayWidthMM: candidate.displayWidthMM,
            displayHeightMM: candidate.displayHeightMM
        });
        if (initialItem &&
                String(candidate.itemUuid || "") === String(initialItem.itemUuid || "") &&
                String(candidate.documentPath || "") === String(initialItem.documentPath || "")) {
            initialIndex = itemIndex;
        }
    }

    var bridgeResult = sendIllustratorAdapterRequest(bridgeTarget, {
        action: "choose",
        candidates: chooserEntries,
        initialIndex: initialIndex,
        warningLines: warningLines || [],
        photoshopFileName: String(photoshopFileName || "")
    }, 86400000);

    // 対象側のモーダルが閉じた後、結果にかかわらずPhotoshopへ操作を戻す。
    activatePhotoshopWindow();
    showTransientActivationDialog("Photoshop");

    if (!bridgeResult.ok) {
        alert(localText("Illustrator通信エラー: ", "Illustrator communication error: ") + bridgeResult.error);
        return null;
    }
    var response = parseBridgeTalkJson(bridgeResult.body, bridgeResult.body, "Illustrator");
    if (response && response.status === "cancel") return null;
    if (!response || response.status !== "ok") {
        alert(response && response.message
            ? response.message
            : localText(
                "Illustratorで処理対象を選択できませんでした。",
                "The placement to process could not be selected in Illustrator."
            ));
        return null;
    }

    var selectedIndex = Number(response.selectedIndex);
    if (!isFinite(selectedIndex) || Math.floor(selectedIndex) !== selectedIndex ||
            selectedIndex < 0 || selectedIndex >= items.length) {
        alert(localText(
            "Illustratorから返された選択結果が正しくありません。",
            "The selection returned by Illustrator is invalid."
        ));
        return null;
    }
    var selectedItem = items[selectedIndex];
    var returnedPlacement = response.placement || null;
    if (!returnedPlacement ||
            String(returnedPlacement.bridgeTarget || "") !== bridgeTarget ||
            String(returnedPlacement.documentPath || "") !== String(selectedItem.documentPath || "") ||
            String(returnedPlacement.documentName || "") !== String(selectedItem.documentName || "") ||
            String(returnedPlacement.itemUuid || "") !== String(selectedItem.itemUuid || "") ||
            String(returnedPlacement.linkPath || "") !== String(selectedItem.linkPath || "")) {
        alert(localText(
            "Illustratorから返された配置情報が選択候補と一致しません。",
            "The placement returned by Illustrator does not match the selected candidate."
        ));
        return null;
    }
    return selectedItem;
}

function main() {
    if (!app.documents.length) {
        alert(localText("開いているドキュメントがありません。", "No document is open."));
        return;
    }
    var doc = app.activeDocument;
    var isSaved = false;
    try { isSaved = doc.saved === true; } catch (_savedStateError) {}
    if (!isSaved) {
        alert(localText(
            "未保存の変更があるドキュメントでは実行できません。保存し、Illustratorのリンクを更新してから実行してください。",
            "This script cannot run while the document has unsaved changes. Save it, update the link in Illustrator, and run the script again."
        ));
        return;
    }

    var photoshopSession = null;
    try {
        photoshopSession = createPhotoshopDocumentSession(doc);
    } catch (documentSessionError) {
        alert(documentSessionError);
        return;
    }
    if (!photoshopSession.documentPath) {
        alert(localText(
            "ドキュメントの保存先を取得できません。保存してから実行してください。",
            "The document path could not be obtained. Save the document and run the script again."
        ));
        return;
    }

    var imgPath = photoshopSession.documentPath;
    var docWidthPx = photoshopSession.initialWidthPx;
    var docHeightPx = photoshopSession.initialHeightPx;
    var currentPPI = photoshopSession.initialResolution;
    var illustratorSideSrc = buildInjectedIllustratorAdapterSource();

    var initialResult = requestInitialIllustratorCandidates(illustratorSideSrc, imgPath, doc.name);
    if (!initialResult.ok) {
        alert(localText("Illustrator通信エラー: ", "Illustrator communication error: ") + initialResult.error);
        return;
    }
    var obj = initialResult.value;
    if (!obj || !obj.items || !obj.items.length) {
        alert(localText("Illustratorで該当リンク画像が見つかりません。", "The matching linked image was not found in Illustrator."));
        return;
    }

    var matchedItems = obj.items;
    var matchType = String(obj.matchType || "exact");
    var hasFolderDifference = !!obj.hasFolderDifference;
    var hasExtensionDifference = !!obj.hasExtensionDifference;

    var longPx = Math.max(docWidthPx, docHeightPx);
    for (var itemIndex = 0; itemIndex < matchedItems.length; itemIndex++) {
        var item = matchedItems[itemIndex];
        var itemPlacedWmm = Number(item.placedWmm);
        var itemPlacedHmm = Number(item.placedHmm);
        if (!isFinite(itemPlacedWmm) || !isFinite(itemPlacedHmm) ||
                itemPlacedWmm <= 0 || itemPlacedHmm <= 0) {
            alert(localText(
                "Illustratorから配置画像の実寸を取得できませんでした。",
                "The placed image dimensions could not be obtained from Illustrator."
            ));
            return;
        }
        if (!hasValidPlacementGeometryFingerprint(item.geometryFingerprint)) {
            alert(localText(
                "Illustratorから配置画像とクリッピングマスクの位置・変形情報を取得できませんでした。",
                "The placed-image and clipping-mask geometry could not be obtained from Illustrator."
            ));
            return;
        }
        item.hScale = Math.abs(Number(item.hScale));
        item.vScale = Math.abs(Number(item.vScale));
        item.placedWmm = itemPlacedWmm;
        item.placedHmm = itemPlacedHmm;
        item.placedLongMM = Math.max(itemPlacedWmm, itemPlacedHmm);
        item.effectivePPI = Math.min(
            docWidthPx * 25.4 / itemPlacedWmm,
            docHeightPx * 25.4 / itemPlacedHmm
        );
        item.matchType = matchType;
        item.hasFolderDifference = hasFolderDifference;
        item.hasExtensionDifference = hasExtensionDifference;
    }

    var allCandidateItems = matchedItems;
    var defaultTargetItem = allCandidateItems[findLargestIllustratorCandidateIndex(allCandidateItems)];
    var targetGroups = groupCandidateItemsByBridgeTarget(allCandidateItems);
    var selectedTargetGroup = chooseCandidateTargetGroupInPhotoshop(targetGroups, defaultTargetItem, "Illustrator");
    if (!selectedTargetGroup) return;

    var candidateItemsArray = selectedTargetGroup.items;
    defaultTargetItem = candidateItemsArray[findLargestIllustratorCandidateIndex(candidateItemsArray)];
    var selectedTargetItem = defaultTargetItem;

    if (matchType === "nameOnly" && candidateItemsArray.length === 1) {
        var fallbackAction = showFallbackLinkConfirmDialog({
            items: candidateItemsArray,
            photoshopFileName: doc.name,
            photoshopPath: imgPath,
            hasFolderDifference: hasFolderDifference,
            hasExtensionDifference: hasExtensionDifference
        });
        if (fallbackAction === "check") {
            selectInIllustrator(buildPlacementHandle(selectedTargetItem), true);
            return;
        }
        if (fallbackAction !== "use") return;
    } else if (candidateItemsArray.length > 1) {
        var candidateWarnings = [];
        if (matchType === "nameOnly") {
            candidateWarnings.push(buildNameOnlyMessageLine1(hasFolderDifference, hasExtensionDifference));
            candidateWarnings.push(localText(
                "同名候補から処理対象を一件選択してください。",
                "Select one placement from the same-name candidates."
            ));
        } else {
            candidateWarnings.push(localText(
                "同じ画像が複数のIllustrator配置で見つかりました。",
                "The same image was found in multiple Illustrator placements."
            ));
        }
        selectedTargetItem = chooseInitialIllustratorCandidateInTarget(
            candidateItemsArray,
            defaultTargetItem,
            candidateWarnings,
            doc.name
        );
        if (!selectedTargetItem) return;
    }

    finalizeIllustratorResizeFlow({
        photoshopSession: photoshopSession,
        docWidthPx: docWidthPx,
        docHeightPx: docHeightPx,
        currentPPI: currentPPI,
        longPx: longPx,
        candidateItemsArray: candidateItemsArray,
        targetItem: selectedTargetItem,
        matchedItemCount: candidateItemsArray.length,
        matchType: matchType
    });
}

// Illustrator側: 探索・再検証・プレビューを一つのアダプターで処理する。
function illustratorAdapter(request) {
    /*__INJECT_HELPERS__*/

    var GEOMETRY_EPSILON = 0.000000000001;
    var GEOMETRY_TOLERANCE_PT = 0.01;
    var action = String(request && request.action ? request.action : "discover");

    try {
        if (!app.documents.length && action === "discover") {
            return toSourceLiteral({
                status: "ok",
                matchType: "exact",
                hasFolderDifference: false,
                hasExtensionDifference: false,
                items: []
            });
        }
        if (!app.documents.length) {
            return toSourceLiteral(errorResponse(remoteText(
                "Illustratorドキュメントが開かれていません。",
                "No Illustrator document is open."
            )));
        }
        if (action === "discover") return toSourceLiteral(discoverCandidates());
        if (action === "choose") return toSourceLiteral(chooseCandidateResponse());
        if (action === "preview") return toSourceLiteral(previewCandidateResponse());
        return toSourceLiteral(errorResponse(remoteText(
            "Illustratorへの要求が正しくありません。",
            "The Illustrator request is invalid."
        )));
    } catch (error) {
        return toSourceLiteral(errorResponse(
            remoteText("Illustrator側エラー: ", "Illustrator-side error: ") + error
        ));
    }

    function discoverCandidates() {
        var targetPath = normalizePath(request && request.pathFs);
        var targetNameInfo = splitFileName(request && request.fileName);
        if (!targetPath && !targetNameInfo.baseName) {
            return errorResponse(remoteText(
                "Photoshop画像のパスを確認できません。",
                "The Photoshop image path could not be verified."
            ));
        }

        var exactEntries = [];
        var nameEntries = [];
        var firstExactCandidateError = "";
        var firstNameCandidateError = "";
        var exactMatchCount = 0;
        var nameMatchCount = 0;
        var hasFolderDifference = false;
        var hasExtensionDifference = false;

        for (var documentIndex = 0; documentIndex < app.documents.length; documentIndex++) {
            var document = app.documents[documentIndex];
            var placedItems = document.placedItems;
            for (var placedIndex = 0; placedIndex < placedItems.length; placedIndex++) {
                var item = placedItems[placedIndex];
                var fileInfo = readPlacedFileInfo(item);
                if (!fileInfo.baseName) continue;
                var isExact = !!targetPath && fileInfo.normalizedPath === targetPath;
                var isNameOnly = !isExact && targetNameInfo.baseName &&
                    fileInfo.baseName === targetNameInfo.baseName;
                if (!isExact && !isNameOnly) continue;
                if (isExact) exactMatchCount++;
                else nameMatchCount++;

                try {
                    var candidate = buildCandidateSnapshot(
                        document,
                        documentIndex,
                        item,
                        placedIndex,
                        fileInfo
                    );
                    if (isExact) {
                        exactEntries.push(candidate);
                    } else {
                        nameEntries.push(candidate);
                        hasFolderDifference = hasFolderDifference ||
                            fileInfo.folderPath !== splitPath(targetPath).folderPath;
                        hasExtensionDifference = hasExtensionDifference ||
                            fileInfo.extension !== targetNameInfo.extension;
                    }
                } catch (candidateError) {
                    if (isExact && !firstExactCandidateError) {
                        firstExactCandidateError = String(candidateError);
                    } else if (!isExact && !firstNameCandidateError) {
                        firstNameCandidateError = String(candidateError);
                    }
                }
            }
        }

        var items = exactEntries.length ? exactEntries : nameEntries;
        if (exactMatchCount > 0 && firstExactCandidateError) {
            return errorResponse(firstExactCandidateError);
        }
        if (exactMatchCount === 0 && nameMatchCount > 0 && firstNameCandidateError) {
            return errorResponse(firstNameCandidateError);
        }
        if (!items.length) {
            return {
                status: "ok",
                matchType: "exact",
                hasFolderDifference: false,
                hasExtensionDifference: false,
                items: []
            };
        }
        sortCandidates(items);
        return {
            status: "ok",
            matchType: exactEntries.length ? "exact" : "nameOnly",
            hasFolderDifference: exactEntries.length ? false : hasFolderDifference,
            hasExtensionDifference: exactEntries.length ? false : hasExtensionDifference,
            items: items
        };
    }

    function chooseCandidateResponse() {
        var entries = request && request.candidates instanceof Array
            ? request.candidates
            : [];
        if (!entries.length) {
            return errorResponse(remoteText(
                "選択するIllustrator配置がありません。",
                "There are no Illustrator placements to select."
            ));
        }

        var initialIndex = Number(request && request.initialIndex);
        if (!isFinite(initialIndex) || Math.floor(initialIndex) !== initialIndex ||
                initialIndex < 0 || initialIndex >= entries.length) {
            initialIndex = 0;
        }

        var dialog = new Window("dialog", remoteText("処理する配置を選択", "Select Placement to Process"));
        dialog.orientation = "column";
        dialog.alignChildren = ["fill", "top"];
        dialog.spacing = 8;
        dialog.margins = 12;

        var columnTitles = [
            remoteText("連番", "No."),
            remoteText("アートボード", "Artboard"),
            remoteText("サイズ", "Size")
        ];
        var orderValues = [columnTitles[0]];
        var pageValues = [columnTitles[1]];
        var sizeValues = [columnTitles[2]];
        var rowData = [];
        for (var entryIndex = 0; entryIndex < entries.length; entryIndex++) {
            var entry = entries[entryIndex] || {};
            var order = String(entryIndex + 1);
            if (order.length < 2) order = "0" + order;
            var pageText = entry.pageName ? String(entry.pageName) : "-";
            var sizeText = "-";
            if (isFinite(Number(entry.displayWidthMM)) && isFinite(Number(entry.displayHeightMM))) {
                sizeText = Number(entry.displayWidthMM).toFixed(2) + " × " +
                    Number(entry.displayHeightMM).toFixed(2) + " mm";
            }
            rowData.push({order: order, page: pageText, size: sizeText});
            orderValues.push(order);
            pageValues.push(pageText);
            sizeValues.push(sizeText);
        }

        function measureColumnWidth(values, minimumWidth) {
            var width = Number(minimumWidth) || 0;
            for (var valueIndex = 0; valueIndex < values.length; valueIndex++) {
                var textValue = String(values[valueIndex] || "");
                var measuredWidth = textValue.length * 7;
                try { measuredWidth = Number(dialog.graphics.measureString(textValue)[0]); } catch (_measureError) { }
                if (isFinite(measuredWidth)) width = Math.max(width, Math.ceil(measuredWidth) + 24);
            }
            return Math.ceil(width);
        }

        var columnWidths = [
            measureColumnWidth(orderValues, 54),
            measureColumnWidth(pageValues, 100),
            measureColumnWidth(sizeValues, 180)
        ];
        var contentWidth = Math.max(440,
            columnWidths[0] + columnWidths[1] + columnWidths[2] + 34);
        var warningLines = request && request.warningLines instanceof Array
            ? request.warningLines
            : [];
        for (var lineIndex = 0; lineIndex < warningLines.length; lineIndex++) {
            var messageLine = dialog.add("statictext", undefined,
                String(warningLines[lineIndex] || ""), {multiline: true});
            messageLine.preferredSize = [contentWidth, 34];
        }
        var explanation = dialog.add("statictext", undefined, remoteText(
            "ここで選択した同じ配置を、リサイズ・ガイド・切り抜き・XMPに使用します。",
            "The same selected placement will be used for resizing, guides, cropping, and XMP."
        ), {multiline: true});
        explanation.preferredSize = [contentWidth, 34];
        var fileNameText = dialog.add("statictext", undefined,
            remoteText("ファイル名：", "File name: ") +
                String(request && request.photoshopFileName ? request.photoshopFileName : "-"),
            {multiline: true});
        fileNameText.preferredSize = [contentWidth, 34];

        var listBox = dialog.add("listbox", undefined, [], {
            multiselect: false,
            numberOfColumns: 3,
            showHeaders: true,
            columnTitles: columnTitles,
            columnWidths: columnWidths
        });
        var visibleRowCount = Math.max(4, Math.min(8, entries.length));
        listBox.preferredSize = [contentWidth, 28 + visibleRowCount * 22];
        for (var rowIndex = 0; rowIndex < entries.length; rowIndex++) {
            var row = listBox.add("item", rowData[rowIndex].order);
            row.subItems[0].text = rowData[rowIndex].page;
            row.subItems[1].text = rowData[rowIndex].size;
            row.entry = entries[rowIndex];
        }
        listBox.selection = listBox.items[initialIndex];

        var lastPreviewedIndex = -1;
        function previewChooserEntry(selectedEntry, reportError) {
            var handle = selectedEntry && selectedEntry.placement
                ? selectedEntry.placement
                : null;
            if (!handle) {
                if (reportError !== false) alert(remoteText(
                    "選択したIllustrator配置情報がありません。",
                    "The selected Illustrator placement information is unavailable."
                ));
                return false;
            }
            try {
                var resolved = resolvePlacementHandle(handle);
                if (!resolved) throw new Error(remoteText(
                    "選択したIllustrator配置が見つかりません。",
                    "The selected Illustrator placement could not be found."
                ));
                previewCandidate(resolved.document, resolved.item);
                lastPreviewedIndex = Number(selectedEntry.index);
                return true;
            } catch (previewError) {
                lastPreviewedIndex = -1;
                if (reportError !== false) alert(String(previewError));
            }
            return false;
        }

        listBox.onChange = function() {
            if (!this.selection || !this.selection.entry) return;
            previewChooserEntry(this.selection.entry, true);
        };

        var selectedEntry = null;
        var buttonGroup = dialog.add("group");
        buttonGroup.alignment = ["right", "center"];
        var cancelButton = buttonGroup.add("button", undefined,
            remoteText("キャンセル", "Cancel"), {name: "cancel"});
        var okButton = buttonGroup.add("button", undefined, "OK", {name: "ok"});
        dialog.defaultElement = okButton;
        dialog.cancelElement = cancelButton;
        cancelButton.onClick = function() { dialog.close(0); };
        okButton.onClick = function() {
            if (!listBox.selection || !listBox.selection.entry) {
                alert(remoteText("候補を選択してください。", "Select a candidate."));
                return;
            }
            var entryToUse = listBox.selection.entry;
            if (lastPreviewedIndex !== Number(entryToUse.index) &&
                    !previewChooserEntry(entryToUse, true)) {
                return;
            }
            selectedEntry = entryToUse;
            dialog.close(1);
        };

        // 最初の候補も、対象側のダイアログを出す前に同じ直接プレビュー経路へ通す。
        previewChooserEntry(entries[initialIndex], true);
        try { if (dialog.center) dialog.center(); } catch (_dialogCenterError) { }
        var dialogResult = dialog.show();
        if (dialogResult !== 1 || !selectedEntry) return {status: "cancel"};
        return {
            status: "ok",
            selectedIndex: Number(selectedEntry.index),
            placement: selectedEntry.placement
        };
    }

    function previewCandidateResponse() {
        var handle = request && request.placement ? request.placement : null;
        if (!handle) {
            return errorResponse(remoteText(
                "選択したIllustrator配置情報がありません。",
                "The selected Illustrator placement information is unavailable."
            ));
        }
        var resolved = resolvePlacementHandle(handle);
        if (!resolved) {
            return errorResponse(remoteText(
                "選択したIllustrator配置が見つかりません。",
                "The selected Illustrator placement could not be found."
            ));
        }
        var current = buildCandidateSnapshot(
            resolved.document,
            resolved.documentIndex,
            resolved.item,
            resolved.placedIndex,
            readPlacedFileInfo(resolved.item)
        );
        if (!fingerprintsEqual(handle.geometryFingerprint, current.geometryFingerprint)) {
            return errorResponse(remoteText(
                "選択したIllustrator配置の位置または変形が変更されています。",
                "The position or transform of the selected Illustrator placement has changed."
            ));
        }
        previewCandidate(resolved.document, resolved.item);
        return {
            status: "ok",
            matchType: String(handle.matchType || "exact"),
            selected: current,
            normalizedMaskBounds: current.normalizedMaskBounds,
            replacementData: current.replacementData,
            items: [current]
        };
    }

    function resolvePlacementHandle(handle) {
        var matches = [];
        var expectedLinkPath = normalizePath(handle.linkPath || "");
        for (var documentIndex = 0; documentIndex < app.documents.length; documentIndex++) {
            var document = app.documents[documentIndex];
            if (!documentMatchesHandle(document, handle)) continue;
            var item = getItemByUuid(document, handle.itemUuid);
            if (!item || safeTypename(item) !== "PlacedItem") continue;
            var fileInfo = readPlacedFileInfo(item);
            if (expectedLinkPath && fileInfo.normalizedPath !== expectedLinkPath) continue;
            matches.push({
                document: document,
                documentIndex: documentIndex,
                item: item,
                placedIndex: findPlacedItemIndex(document, item)
            });
        }
        return matches.length === 1 ? matches[0] : null;
    }

    function documentMatchesHandle(document, handle) {
        var expectedPath = normalizePath(handle.documentPath || "");
        var actualPath = getDocumentPath(document);
        if (expectedPath) return actualPath === expectedPath;
        return toNFCJa(String(document.name || "")) === toNFCJa(String(handle.documentName || ""));
    }

    function getItemByUuid(document, uuid) {
        var value = String(uuid || "");
        if (!value) return null;
        try {
            var direct = document.getPageItemFromUuid(value);
            if (direct && String(direct.uuid || "") === value &&
                    safeTypename(direct) === "PlacedItem") {
                return direct;
            }
        } catch (_uuidLookupError) { }
        var items = document.placedItems;
        for (var index = 0; index < items.length; index++) {
            try {
                if (String(items[index].uuid || "") === value) return items[index];
            } catch (_itemUuidError) { }
        }
        return null;
    }

    function findPlacedItemIndex(document, item) {
        var items = document.placedItems;
        var uuid = getItemUuid(item);
        for (var index = 0; index < items.length; index++) {
            if (getItemUuid(items[index]) === uuid) return index;
        }
        return -1;
    }

    function buildCandidateSnapshot(document, documentIndex, item, placedIndex, fileInfo) {
        var itemUuid = getItemUuid(item);
        if (!itemUuid) {
            throw new Error(remoteText(
                "配置画像のUUIDを取得できません。Illustrator 2020以降が必要です。",
                "The placed-image UUID could not be obtained. Illustrator 2020 or later is required."
            ));
        }
        var linkState = readLinkState(item, fileInfo.fileObject);
        if (linkState !== "ok") {
            throw new Error(linkState === "missing"
                ? remoteText("リンク切れ画像です。", "The linked image is missing.")
                : remoteText("リンクが更新されていません。", "The link is not updated."));
        }

        var placedGeometry = readPlacedItemGeometry(item);
        var imageQuad = placedGeometry.quad;
        var imageGeometry = placedGeometry.local;

        var maskDescriptor = findClippingMaskForPlacedItem(item);
        var trimmingAvailable = maskDescriptor.status === "ok";
        var trimmingReason = maskDescriptor.reason || "";
        var localMaskBounds = null;
        var normalizedMaskBounds = null;
        var replacementData = null;
        var footprintBounds = quadBounds(imageQuad);

        if (trimmingAvailable) {
            var maskSegments = getMaskBezierSegments(maskDescriptor);
            localMaskBounds = getBezierBounds(maskSegments, imageGeometry);
            normalizedMaskBounds = buildNormalizedMaskBounds(localMaskBounds, imageGeometry);
            replacementData = buildReplacementData(
                localMaskBounds,
                imageGeometry,
                item,
                maskDescriptor,
                placedIndex,
                document,
                placedGeometry.matrix
            );
            footprintBounds = getBezierBounds(maskSegments, null);
            if (!isFitterCompatibleGeometry(imageGeometry)) {
                trimmingAvailable = false;
                trimmingReason = remoteText(
                    "シアーを含む配置はIllustrator側の置換処理と一致しないため、トリミング処理を選択できません。",
                    "Trimming is unavailable because a sheared placement cannot be reproduced by the Illustrator-side replacement process."
                );
            }
        }

        var artboard = chooseCandidateArtboard(document, footprintBounds);
        var displayBounds = localMaskBounds || {
            minX: 0,
            maxX: imageGeometry.width,
            minY: 0,
            maxY: imageGeometry.height
        };
        var geometryFingerprint = buildGeometryFingerprint(
            item,
            fileInfo,
            placedGeometry,
            maskDescriptor,
            normalizedMaskBounds
        );

        return {
            applicationVersion: String(app.version || ""),
            documentIndex: documentIndex,
            documentName: String(document.name || ""),
            documentPath: getDocumentPath(document),
            itemUuid: itemUuid,
            placedIndex: placedIndex,
            linkPath: fileInfo.normalizedPath,
            fileName: fileInfo.fileName,
            folderPath: fileInfo.folderPath,
            hScale: imageGeometry.width / placedGeometry.sourceWidth * 100,
            vScale: imageGeometry.height / placedGeometry.sourceHeight * 100,
            placedWmm: ptToMm(imageGeometry.width),
            placedHmm: ptToMm(imageGeometry.height),
            placedLongMM: ptToMm(Math.max(imageGeometry.width, imageGeometry.height)),
            displayWidthMM: ptToMm(displayBounds.maxX - displayBounds.minX),
            displayHeightMM: ptToMm(displayBounds.maxY - displayBounds.minY),
            pageName: artboard.label,
            trimmingAvailable: trimmingAvailable,
            trimmingReason: trimmingReason,
            normalizedMaskBounds: normalizedMaskBounds,
            replacementData: replacementData,
            geometryFingerprint: geometryFingerprint
        };
    }

    function readPlacedItemGeometry(item) {
        var box = readNumberArray(item.boundingBox, 4, remoteText(
            "配置画像のboundingBoxを取得できません。",
            "The placed-image boundingBox could not be obtained."
        ));
        var bounds = readNumberArray(item.geometricBounds, 4, remoteText(
            "配置画像の中心位置を取得できません。",
            "The placed-image center position could not be obtained."
        ));
        var matrixObject = item.matrix;
        if (!matrixObject) {
            throw new Error(remoteText(
                "配置画像の変形行列を取得できません。",
                "The placed-image transform could not be obtained."
            ));
        }
        var width = Math.abs(box[2] - box[0]);
        var height = Math.abs(box[1] - box[3]);
        if (width <= GEOMETRY_EPSILON || height <= GEOMETRY_EPSILON) {
            throw new Error(remoteText(
                "配置画像の元寸法が正しくありません。",
                "The placed-image source dimensions are invalid."
            ));
        }

        var matrix = readMatrixValues(matrixObject);
        var quad = getPlacedItemQuad(width, height, bounds, matrix);
        var localGeometry = buildGeometryFromQuad(quad[0], quad[1], quad[3]);
        validateImageGeometry(bounds, quad);
        return {
            boundingBox: box,
            centerBounds: bounds,
            matrix: matrix,
            sourceWidth: width,
            sourceHeight: height,
            quad: quad,
            local: localGeometry
        };
    }

    function getPlacedItemQuad(width, height, bounds, matrix) {
        // Illustratorの実機検証済み規則。boundingBoxは元寸法、matrixは軸方向、
        // geometricBoundsは現在位置の中心だけに使用する。
        var edgeX = [width * matrix.a, width * -matrix.b];
        var edgeY = [height * -matrix.c, height * matrix.d];
        var center = [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2];
        var topLeft = subtractPoints(center, scalePoint(addPoints(edgeX, edgeY), 0.5));
        var topRight = addPoints(topLeft, edgeX);
        var bottomLeft = addPoints(topLeft, edgeY);
        return [topLeft, topRight, addPoints(topRight, edgeY), bottomLeft];
    }

    function buildGeometryFromQuad(topLeft, topRight, bottomLeft) {
        var basisX = subtractPoints(topRight, topLeft);
        var basisY = subtractPoints(bottomLeft, topLeft);
        var determinant = basisX[0] * basisY[1] - basisX[1] * basisY[0];
        var width = vectorLength(basisX);
        var height = vectorLength(basisY);
        if (Math.abs(determinant) <= 0.000000000001 * Math.max(1, width * height)) {
            throw new Error(remoteText(
                "配置画像の変形行列を逆変換できません。",
                "The placed-image transform cannot be inverted."
            ));
        }
        return {
            topLeft: [getNumber(topLeft[0]), getNumber(topLeft[1])],
            basisX: basisX,
            basisY: basisY,
            axisX: normalizeVector(basisX),
            axisY: normalizeVector(basisY),
            width: width,
            height: height,
            determinant: determinant
        };
    }

    function projectPoint(point, geometry) {
        var delta = subtractPoints(point, geometry.topLeft);
        var coefficientX = (delta[0] * geometry.basisY[1] -
            delta[1] * geometry.basisY[0]) / geometry.determinant;
        var coefficientY = (geometry.basisX[0] * delta[1] -
            geometry.basisX[1] * delta[0]) / geometry.determinant;
        return [coefficientX * geometry.width, coefficientY * geometry.height];
    }

    function projectPoints(points, geometry) {
        var projected = [];
        for (var index = 0; index < points.length; index++) {
            projected.push(projectPoint(points[index], geometry));
        }
        return projected;
    }

    function getProjectedBounds(projectedPoints) {
        if (!projectedPoints || !projectedPoints.length) {
            throw new Error(remoteText("投影点がありません。", "No projected points are available."));
        }
        var xs = [];
        var ys = [];
        for (var index = 0; index < projectedPoints.length; index++) {
            xs.push(getNumber(projectedPoints[index][0]));
            ys.push(getNumber(projectedPoints[index][1]));
        }
        return {
            minX: arrayMin(xs),
            maxX: arrayMax(xs),
            minY: arrayMin(ys),
            maxY: arrayMax(ys)
        };
    }

    function buildNormalizedMaskBounds(localBounds, imageGeometry) {
        if (!localBounds || imageGeometry.width <= 0 || imageGeometry.height <= 0) {
            throw new Error(remoteText(
                "正規化する配置寸法が正しくありません。",
                "The placement dimensions to normalize are invalid."
            ));
        }
        return {
            minX: getNumber(localBounds.minX) / imageGeometry.width,
            maxX: getNumber(localBounds.maxX) / imageGeometry.width,
            minY: getNumber(localBounds.minY) / imageGeometry.height,
            maxY: getNumber(localBounds.maxY) / imageGeometry.height
        };
    }

    function validateImageGeometry(actual, quad) {
        var expected = quadBounds(quad);
        var actualWidth = Math.abs(actual[2] - actual[0]);
        var actualHeight = Math.abs(actual[1] - actual[3]);
        var expectedWidth = expected.maxX - expected.minX;
        var expectedHeight = expected.maxY - expected.minY;
        if (!numbersNear(actualWidth, expectedWidth, GEOMETRY_TOLERANCE_PT) ||
                !numbersNear(actualHeight, expectedHeight, GEOMETRY_TOLERANCE_PT)) {
            throw new Error(remoteText(
                "配置画像の親グループ変形を安全に解決できません。画像自体の変形へ適用し直してください。",
                "The parent-group transform of the placed image cannot be resolved safely. Apply the transform to the placed image itself."
            ));
        }
    }

    function isFitterCompatibleGeometry(imageGeometry) {
        var dot = imageGeometry.axisX[0] * imageGeometry.axisY[0] +
            imageGeometry.axisX[1] * imageGeometry.axisY[1];
        return Math.abs(dot) <= 0.000001;
    }

    function findClippingMaskForPlacedItem(item) {
        var found = [];
        var ancestor = null;
        try { ancestor = item.parent; } catch (_parentError) { ancestor = null; }
        var depth = 0;
        while (ancestor && depth < 64) {
            if (safeTypename(ancestor) === "GroupItem" && isClippedGroup(ancestor)) {
                found.push(findMaskInDirectChildren(ancestor));
            }
            var next = null;
            try { next = ancestor.parent; } catch (_ancestorError) { next = null; }
            if (!next || next === ancestor) break;
            ancestor = next;
            depth++;
        }
        if (!found.length) {
            return {
                status: "none",
                reason: remoteText(
                    "クリッピングマスクがないため、トリミング処理は選択できません。",
                    "Trimming is unavailable because there is no clipping mask."
                ),
                group: null,
                maskRoot: null,
                paths: []
            };
        }
        for (var index = 0; index < found.length; index++) {
            if (found[index].status !== "ok") return found[index];
        }
        if (found.length > 1) {
            return {
                status: "unsupported",
                reason: remoteText(
                    "多重クリッピングマスクは安全に処理できません。",
                    "Nested clipping masks cannot be processed safely."
                ),
                group: null,
                maskRoot: null,
                paths: []
            };
        }
        return found[0];
    }

    function findMaskInDirectChildren(group) {
        var roots = [];
        var pageItems = group.pageItems;
        for (var index = 0; index < pageItems.length; index++) {
            var child = pageItems[index];
            if (!hasDirectParent(child, group)) continue;
            var type = safeTypename(child);
            if (type === "PathItem" && isClippingPath(child)) {
                roots.push({root: child, paths: [child]});
            } else if (type === "CompoundPathItem") {
                var compoundPaths = collectCompoundClippingPaths(child);
                if (compoundPaths.length) roots.push({root: child, paths: compoundPaths});
            }
        }
        if (roots.length !== 1) {
            return {
                status: "unsupported",
                reason: roots.length
                    ? remoteText("独立したクリッピングパスが複数あります。", "Multiple independent clipping paths were found.")
                    : remoteText("クリッピングパスを確認できません。", "The clipping path could not be verified."),
                group: group,
                maskRoot: null,
                paths: []
            };
        }
        var paths = roots[0].paths;
        for (var pathIndex = 0; pathIndex < paths.length; pathIndex++) {
            if (!isClosedPath(paths[pathIndex])) {
                return {
                    status: "unsupported",
                    reason: remoteText(
                        "開いたクリッピングパスは安全に処理できません。",
                        "An open clipping path cannot be processed safely."
                    ),
                    group: group,
                    maskRoot: roots[0].root,
                    paths: []
                };
            }
        }
        return {
            status: "ok",
            reason: "",
            group: group,
            maskRoot: roots[0].root,
            paths: paths
        };
    }

    function getMaskBezierSegments(maskDescriptor) {
        var segments = [];
        var paths = maskDescriptor && maskDescriptor.paths ? maskDescriptor.paths : [];
        for (var pathIndex = 0; pathIndex < paths.length; pathIndex++) {
            var path = paths[pathIndex];
            var points = path.pathPoints;
            if (!points || points.length < 2 || !isClosedPath(path)) {
                throw new Error(remoteText(
                    "クリッピングパスの曲線情報を取得できません。",
                    "The clipping-path curve information could not be obtained."
                ));
            }
            for (var pointIndex = 0; pointIndex < points.length; pointIndex++) {
                var nextIndex = (pointIndex + 1) % points.length;
                segments.push([
                    readPoint(points[pointIndex].anchor),
                    readPoint(points[pointIndex].rightDirection),
                    readPoint(points[nextIndex].leftDirection),
                    readPoint(points[nextIndex].anchor)
                ]);
            }
        }
        if (!segments.length) {
            throw new Error(remoteText(
                "クリッピングパスの線分がありません。",
                "The clipping path has no segments."
            ));
        }
        return segments;
    }

    function getBezierBounds(segments, imageGeometry) {
        var result = null;
        for (var index = 0; index < segments.length; index++) {
            var segment = imageGeometry ? projectPoints(segments[index], imageGeometry) : segments[index];
            result = mergeBounds(result, getCubicBounds(segment));
        }
        if (!result) throw new Error(remoteText("マスク範囲を取得できません。", "The mask bounds could not be obtained."));
        return result;
    }

    function getCubicBounds(segment) {
        var xParameters = [0, 1];
        var yParameters = [0, 1];
        appendCubicRoots(xParameters, segment[0][0], segment[1][0], segment[2][0], segment[3][0]);
        appendCubicRoots(yParameters, segment[0][1], segment[1][1], segment[2][1], segment[3][1]);
        var xs = [];
        var ys = [];
        var index;
        for (index = 0; index < xParameters.length; index++) {
            xs.push(evaluateCubic(segment[0][0], segment[1][0], segment[2][0], segment[3][0], xParameters[index]));
        }
        for (index = 0; index < yParameters.length; index++) {
            ys.push(evaluateCubic(segment[0][1], segment[1][1], segment[2][1], segment[3][1], yParameters[index]));
        }
        return {
            minX: arrayMin(xs),
            maxX: arrayMax(xs),
            minY: arrayMin(ys),
            maxY: arrayMax(ys)
        };
    }

    function appendCubicRoots(values, p0, p1, p2, p3) {
        var a = 3 * (-p0 + 3 * p1 - 3 * p2 + p3);
        var b = 2 * (3 * p0 - 6 * p1 + 3 * p2);
        var c = -3 * p0 + 3 * p1;
        var scale = Math.max(1, Math.abs(a), Math.abs(b), Math.abs(c));
        var epsilon = GEOMETRY_EPSILON * scale;
        if (Math.abs(a) <= epsilon) {
            if (Math.abs(b) <= epsilon) return;
            appendUnitRoot(values, -c / b);
            return;
        }
        var discriminant = b * b - 4 * a * c;
        if (discriminant < -epsilon * scale) return;
        if (discriminant < 0) discriminant = 0;
        var squareRoot = Math.sqrt(discriminant);
        appendUnitRoot(values, (-b + squareRoot) / (2 * a));
        appendUnitRoot(values, (-b - squareRoot) / (2 * a));
    }

    function appendUnitRoot(values, value) {
        if (!(value > 0 && value < 1)) return;
        for (var index = 0; index < values.length; index++) {
            if (Math.abs(values[index] - value) <= GEOMETRY_EPSILON) return;
        }
        values.push(value);
    }

    function evaluateCubic(p0, p1, p2, p3, t) {
        var inverse = 1 - t;
        return inverse * inverse * inverse * p0 +
            3 * inverse * inverse * t * p1 +
            3 * inverse * t * t * p2 +
            t * t * t * p3;
    }

    function buildReplacementData(localMaskBounds, imageGeometry, item, maskDescriptor, placedIndex, document, matrix) {
        var expanded = {
            left: Math.min(0, localMaskBounds.minX),
            top: Math.min(0, localMaskBounds.minY),
            right: Math.max(imageGeometry.width, localMaskBounds.maxX),
            bottom: Math.max(imageGeometry.height, localMaskBounds.maxY)
        };
        var trimmed = {
            left: localMaskBounds.minX,
            top: localMaskBounds.minY,
            right: localMaskBounds.maxX,
            bottom: localMaskBounds.maxY
        };
        return {
            version: REPLACEMENT_DATA_VERSION,
            unit: REPLACEMENT_DATA_UNIT,
            sourceApp: "Illustrator",
            sourceKind: "IllustratorClippingMask",
            coordinateSpace: "image-local",
            documentName: String(document.name || ""),
            placedIndex: placedIndex,
            placedItemUuid: getItemUuid(item),
            maskTypename: safeTypename(maskDescriptor.maskRoot),
            rotation: getRotationAngle(matrix),
            imageSize: {
                w: ptToMm(imageGeometry.width),
                h: ptToMm(imageGeometry.height)
            },
            maskLocalBounds: rectToMm(trimmed),
            mode1: rectModeToMm(expanded),
            mode2: rectModeToMm(trimmed)
        };
    }

    function rectToMm(rect) {
        return {
            left: ptToMm(rect.left),
            top: ptToMm(rect.top),
            right: ptToMm(rect.right),
            bottom: ptToMm(rect.bottom)
        };
    }

    function rectModeToMm(rect) {
        return {
            x: ptToMm(rect.left),
            y: ptToMm(rect.top),
            w: ptToMm(rect.right - rect.left),
            h: ptToMm(rect.bottom - rect.top)
        };
    }

    function getRotationAngle(matrix) {
        return Math.atan2(matrix.b, matrix.a) * 180 / Math.PI;
    }

    function buildGeometryFingerprint(item, fileInfo, placedGeometry, maskDescriptor, normalizedBounds) {
        var maskPaths = [];
        if (maskDescriptor.status === "ok") {
            for (var pathIndex = 0; pathIndex < maskDescriptor.paths.length; pathIndex++) {
                var path = maskDescriptor.paths[pathIndex];
                var pathPoints = path.pathPoints;
                var points = [];
                for (var pointIndex = 0; pointIndex < pathPoints.length; pointIndex++) {
                    points.push({
                        anchor: readPoint(pathPoints[pointIndex].anchor),
                        left: readPoint(pathPoints[pointIndex].leftDirection),
                        right: readPoint(pathPoints[pointIndex].rightDirection)
                    });
                }
                maskPaths.push({
                    uuid: getItemUuid(path),
                    closed: isClosedPath(path),
                    points: points
                });
            }
        }
        return {
            schema: 1,
            linkPath: fileInfo.normalizedPath,
            itemUuid: getItemUuid(item),
            boundingBox: placedGeometry.boundingBox,
            matrixLinear: [
                placedGeometry.matrix.a,
                placedGeometry.matrix.b,
                placedGeometry.matrix.c,
                placedGeometry.matrix.d
            ],
            imageQuad: placedGeometry.quad,
            maskStatus: maskDescriptor.status,
            clipGroupUuid: getItemUuid(maskDescriptor.group),
            maskRootUuid: getItemUuid(maskDescriptor.maskRoot),
            maskPaths: maskPaths,
            normalizedMaskBounds: normalizedBounds
        };
    }

    function fingerprintsEqual(expected, actual) {
        if (!expected || !actual) return false;
        return valuesEqual(expected, actual);
    }

    function valuesEqual(first, second) {
        if (typeof first === "number" || typeof second === "number") {
            return numbersNear(Number(first), Number(second), 0.0000001);
        }
        if (first === null || second === null || typeof first !== "object" || typeof second !== "object") {
            return String(first) === String(second);
        }
        var firstIsArray = typeof first.length === "number";
        var secondIsArray = typeof second.length === "number";
        if (firstIsArray !== secondIsArray) return false;
        var key;
        if (firstIsArray) {
            if (first.length !== second.length) return false;
            for (var index = 0; index < first.length; index++) {
                if (!valuesEqual(first[index], second[index])) return false;
            }
            return true;
        }
        for (key in first) {
            if (first.hasOwnProperty(key) && !valuesEqual(first[key], second[key])) return false;
        }
        for (key in second) {
            if (second.hasOwnProperty(key) && typeof first[key] === "undefined") return false;
        }
        return true;
    }

    function chooseCandidateArtboard(document, bounds) {
        var best = null;
        for (var index = 0; index < document.artboards.length; index++) {
            var artboard = document.artboards[index];
            var rect = readNumberArray(artboard.artboardRect, 4, "");
            var artboardBounds = rectBounds(rect);
            var overlap = rectangleOverlapArea(bounds, artboardBounds);
            var distance = centerDistanceSquared(bounds, artboardBounds);
            if (!best || overlap > best.overlap ||
                    (numbersNear(overlap, best.overlap, GEOMETRY_EPSILON) && distance < best.distance)) {
                best = {
                    index: index,
                    name: String(artboard.name || ""),
                    overlap: overlap,
                    distance: distance
                };
            }
        }
        if (!best || best.overlap <= GEOMETRY_EPSILON) {
            return {index: -1, name: "", label: remoteText("アートボード外", "Outside artboards")};
        }
        return {
            index: best.index,
            name: best.name,
            label: best.name || (remoteText("アートボード ", "Artboard ") + String(best.index + 1))
        };
    }

    function previewCandidate(document, item) {
        try { document.activate(); } catch (_activateDocumentError) { }
        try { document.selection = null; } catch (_clearSelectionError) { }
        var selectionItem = item;
        var maskDescriptor = findClippingMaskForPlacedItem(item);
        if (maskDescriptor.status === "ok" && maskDescriptor.group) selectionItem = maskDescriptor.group;
        try { selectionItem.selected = true; } catch (_selectError) { }
        var bounds = null;
        var previewView = null;
        try { bounds = selectionItem.geometricBounds; } catch (_previewBoundsError) { bounds = null; }
        try { previewView = document.activeView; } catch (_previewViewError) { previewView = null; }
        if (bounds && bounds.length >= 4) {
            fitPreviewViewToBounds(previewView, bounds);
            try {
                previewView.centerPoint = [
                    (Number(bounds[0]) + Number(bounds[2])) / 2,
                    (Number(bounds[1]) + Number(bounds[3])) / 2
                ];
            } catch (_centerViewError) { }
        }
        try { app.redraw(); } catch (_redrawError) { }
    }

    function fitPreviewViewToBounds(view, targetBounds) {
        if (!view || !targetBounds || targetBounds.length < 4) return false;
        var viewBounds = null;
        try { viewBounds = view.bounds; } catch (_viewBoundsError) { viewBounds = null; }
        if (!viewBounds || viewBounds.length < 4) return false;
        var currentZoom = Number(view.zoom);
        var viewWidth = Math.abs(Number(viewBounds[2]) - Number(viewBounds[0]));
        var viewHeight = Math.abs(Number(viewBounds[1]) - Number(viewBounds[3]));
        var targetWidth = Math.abs(Number(targetBounds[2]) - Number(targetBounds[0]));
        var targetHeight = Math.abs(Number(targetBounds[1]) - Number(targetBounds[3]));
        if (!isFinite(currentZoom) || currentZoom <= 0 ||
                !isFinite(viewWidth) || !isFinite(viewHeight) ||
                !isFinite(targetWidth) || !isFinite(targetHeight) ||
                viewWidth <= 0 || viewHeight <= 0 || targetWidth <= 0 || targetHeight <= 0) {
            return false;
        }
        var fitRatio = Math.min(viewWidth / targetWidth, viewHeight / targetHeight) * 0.8;
        var fittedZoom = currentZoom * fitRatio;
        try {
            // Illustratorでは1.0が100%。小さな配置の過拡大を200%で抑える。
            view.zoom = Math.max(0.0001, Math.min(2, fittedZoom));
            return true;
        } catch (_zoomError) { }
        return false;
    }

    function sortCandidates(items) {
        items.sort(function(first, second) {
            if (first.documentName !== second.documentName) {
                return first.documentName < second.documentName ? -1 : 1;
            }
            if (first.pageName !== second.pageName) {
                return first.pageName < second.pageName ? -1 : 1;
            }
            return Number(first.placedLongMM) - Number(second.placedLongMM);
        });
    }

    function readPlacedFileInfo(item) {
        var fileObject = null;
        try { fileObject = item.file; } catch (_fileError) { fileObject = null; }
        var rawPath = "";
        var rawFileName = "";
        try { rawPath = fileObject && fileObject.fsName ? String(fileObject.fsName) : ""; } catch (_pathError) { }
        try { rawFileName = fileObject && fileObject.name ? String(fileObject.name) : ""; } catch (_nameError) { }
        var normalizedPath = normalizePath(rawPath);
        var pathInfo = splitPath(normalizedPath);
        var decodedFileName = "";
        try { decodedFileName = File.decode(rawFileName); } catch (_fileDecodeError) {
            try { decodedFileName = decodeURI(rawFileName); } catch (_uriDecodeError) { decodedFileName = rawFileName; }
        }
        var fileInfo = splitFileName(pathInfo.fileName || decodedFileName);
        return {
            fileObject: fileObject,
            normalizedPath: normalizedPath,
            folderPath: pathInfo.folderPath,
            fileName: fileInfo.fileName,
            baseName: fileInfo.baseName,
            extension: fileInfo.extension
        };
    }

    function normalizePath(value) {
        if (!value) return "";
        try { return _normPath(String(value)); } catch (_normalizeError) { return String(value); }
    }

    function splitPath(value) {
        var normalized = String(value || "").replace(/\\/g, "/");
        var slash = normalized.lastIndexOf("/");
        return {
            folderPath: slash >= 0 ? normalized.substring(0, slash) : "",
            fileName: slash >= 0 ? normalized.substring(slash + 1) : normalized
        };
    }

    function splitFileName(value) {
        var fileName = String(value || "");
        var dot = fileName.lastIndexOf(".");
        var baseName = dot > 0 ? fileName.substring(0, dot) : fileName;
        var extension = dot > 0 ? fileName.substring(dot + 1) : "";
        if ($.os.indexOf("Windows") >= 0) {
            fileName = fileName.toLowerCase();
            baseName = baseName.toLowerCase();
            extension = extension.toLowerCase();
        }
        return {fileName: fileName, baseName: baseName, extension: extension};
    }

    function getDocumentPath(document) {
        try { return normalizePath(document.fullName.fsName); } catch (_documentPathError) { return ""; }
    }

    function getItemUuid(item) {
        if (!item) return "";
        try { return String(item.uuid || ""); } catch (_uuidError) { return ""; }
    }

    function readNumberArray(value, minimumLength, message) {
        if (!value || value.length < minimumLength) {
            throw new Error(message || remoteText("数値配列を取得できません。", "A numeric array could not be obtained."));
        }
        var result = [];
        for (var index = 0; index < minimumLength; index++) {
            var numberValue = Number(value[index]);
            if (!isFinite(numberValue)) {
                throw new Error(message || remoteText("数値が正しくありません。", "A numeric value is invalid."));
            }
            result.push(numberValue);
        }
        return result;
    }

    function readMatrixValues(matrix) {
        var properties = ["mValueA", "mValueB", "mValueC", "mValueD"];
        var values = [];
        for (var index = 0; index < properties.length; index++) {
            var value = Number(matrix[properties[index]]);
            if (!isFinite(value)) {
                throw new Error(remoteText(
                    "配置画像の変形行列が正しくありません。",
                    "The placed-image transform is invalid."
                ));
            }
            values.push(value);
        }
        return {
            a: values[0],
            b: values[1],
            c: values[2],
            d: values[3]
        };
    }

    function readPoint(value) {
        return readNumberArray(value, 2, remoteText(
            "パスの座標を取得できません。",
            "A path coordinate could not be obtained."
        ));
    }

    function readLinkState(item, fileObject) {
        try {
            var statusText = String(item.status || "").toLowerCase();
            if (statusText.indexOf("nodata") >= 0 || statusText.indexOf("missing") >= 0) return "missing";
            if (statusText.indexOf("modified") >= 0 || statusText.indexOf("outdated") >= 0) return "modified";
            var statusNumber = Number(item.status);
            if (statusNumber === 1) return "missing";
            if (statusNumber === 3) return "modified";
        } catch (_statusError) { }
        try { if (fileObject && fileObject.exists === false) return "missing"; } catch (_existsError) { }
        return "ok";
    }

    function collectCompoundClippingPaths(compound) {
        var paths = [];
        var hasClippingFlag = false;
        try {
            for (var index = 0; index < compound.pathItems.length; index++) {
                var path = compound.pathItems[index];
                if (isClippingPath(path)) hasClippingFlag = true;
                paths.push(path);
            }
        } catch (_compoundError) { return []; }
        return hasClippingFlag ? paths : [];
    }

    function hasDirectParent(item, parent) {
        try { return item.parent === parent; } catch (_parentCompareError) { return false; }
    }

    function isClippedGroup(group) {
        try { return group.clipped === true; } catch (_clippedError) { return false; }
    }

    function isClippingPath(path) {
        try { return path.clipping === true; } catch (_clippingError) { return false; }
    }

    function isClosedPath(path) {
        try { return path.closed === true; } catch (_closedError) { return false; }
    }

    function safeTypename(item) {
        try { return String(item && item.typename ? item.typename : ""); } catch (_typeError) { return ""; }
    }

    function quadBounds(quad) {
        return getProjectedBounds(quad);
    }

    function rectBounds(rect) {
        return {
            minX: Math.min(rect[0], rect[2]),
            maxX: Math.max(rect[0], rect[2]),
            minY: Math.min(rect[1], rect[3]),
            maxY: Math.max(rect[1], rect[3])
        };
    }

    function rectangleOverlapArea(first, second) {
        var width = Math.max(0, Math.min(first.maxX, second.maxX) - Math.max(first.minX, second.minX));
        var height = Math.max(0, Math.min(first.maxY, second.maxY) - Math.max(first.minY, second.minY));
        return width * height;
    }

    function centerDistanceSquared(first, second) {
        var dx = (first.minX + first.maxX - second.minX - second.maxX) / 2;
        var dy = (first.minY + first.maxY - second.minY - second.maxY) / 2;
        return dx * dx + dy * dy;
    }

    function mergeBounds(first, second) {
        if (!first) return second;
        return {
            minX: Math.min(first.minX, second.minX),
            maxX: Math.max(first.maxX, second.maxX),
            minY: Math.min(first.minY, second.minY),
            maxY: Math.max(first.maxY, second.maxY)
        };
    }

    function getNumber(value) {
        var numberValue = Number(value);
        return isFinite(numberValue) ? numberValue : 0;
    }

    function addPoints(first, second) {
        return [getNumber(first[0]) + getNumber(second[0]), getNumber(first[1]) + getNumber(second[1])];
    }

    function subtractPoints(first, second) {
        return [getNumber(first[0]) - getNumber(second[0]), getNumber(first[1]) - getNumber(second[1])];
    }

    function scalePoint(point, scale) {
        return [getNumber(point[0]) * Number(scale), getNumber(point[1]) * Number(scale)];
    }

    function vectorLength(vector) {
        return Math.sqrt(vector[0] * vector[0] + vector[1] * vector[1]);
    }

    function normalizeVector(vector) {
        var length = vectorLength(vector);
        if (length <= 0.000000000001) {
            throw new Error(remoteText("長さ0の変形軸です。", "A transform axis has zero length."));
        }
        return [vector[0] / length, vector[1] / length];
    }

    function arrayMin(values) {
        var result = values[0];
        for (var index = 1; index < values.length; index++) if (values[index] < result) result = values[index];
        return result;
    }

    function arrayMax(values) {
        var result = values[0];
        for (var index = 1; index < values.length; index++) if (values[index] > result) result = values[index];
        return result;
    }

    function numbersNear(first, second, tolerance) {
        var scale = Math.max(1, Math.abs(Number(first)), Math.abs(Number(second)));
        return Math.abs(Number(first) - Number(second)) <= Number(tolerance) + scale * 0.0000001;
    }

    function ptToMm(value) {
        return getNumber(value) * 25.4 / 72;
    }

    function errorResponse(message) {
        return {status: "error", message: String(message || "")};
    }
}
// IllustratorアダプターをBridgeTalk本文へ埋め込む。
function buildInjectedIllustratorAdapterSource() {
    return illustratorAdapter.toString().replace(
        "/*__INJECT_HELPERS__*/",
        "var toSourceLiteral = " + toSourceLiteral.toString() + ";\n" +
        "var toNFCJa = " + NFC_HELPER_SRC + ";\n" +
        "var _normPath = " + NORM_HELPER_SRC_ID + ";\n" +
        "var remoteLocaleCode = " + toSourceLiteral(currentLocaleCode()) + ";\n" +
        "function remoteText(jaText, enText) { return remoteLocaleCode === 'en' ? enText : jaText; }\n" +
        "var REPLACEMENT_DATA_VERSION = " + REPLACEMENT_DATA_VERSION + ";\n" +
        "var REPLACEMENT_DATA_" + "UNIT = " + toSourceLiteral(REPLACEMENT_DATA_UNIT) + ";"
    );
}

function sendIllustratorAdapterRequest(bridgeTarget, requestData, timeoutMs) {
    if (!bridgeTarget || !/^illustrator(?:beta|prerelease)?-/i.test(String(bridgeTarget))) {
        return {
            ok: false,
            error: localText(
                "対象のIllustratorバージョンを確認できません。",
                "The target Illustrator version could not be verified."
            )
        };
    }
    var running = false;
    try { running = BridgeTalk.isRunning(bridgeTarget) === true; } catch (_runningError) { }
    if (!running) {
        return {
            ok: false,
            error: localText(
                "対象のIllustratorが終了しています。",
                "The target Illustrator application is no longer running."
            )
        };
    }
    var body = "(" + buildInjectedIllustratorAdapterSource() + ")(" +
        toSourceLiteral(requestData || {}) + ");";
    return sendBridgeTalkAndWait(bridgeTarget, body, timeoutMs || 30000);
}

// Photoshopの明示的な「Illustratorで表示」操作に応じ、配置を表示する。
function selectInIllustrator(handle, bringApplicationToFront) {
    if (!handle || !handle.bridgeTarget) {
        alert(localText(
            "対象のIllustratorを確認できません。",
            "The target Illustrator application could not be verified."
        ));
        return false;
    }
    var bridgeResult = sendIllustratorAdapterRequest(handle.bridgeTarget, {
        action: "preview",
        placement: handle
    }, 15000);
    if (bringApplicationToFront !== true) activatePhotoshopWindow();
    if (!bridgeResult.ok) {
        alert(localText("Illustrator通信エラー: ", "Illustrator communication error: ") + bridgeResult.error);
        return false;
    }
    var response = parseBridgeTalkJson(bridgeResult.body, bridgeResult.body, "Illustrator");
    if (!response || response.status !== "ok") {
        alert(response && response.message
            ? response.message
            : localText("Illustratorで配置を表示できませんでした。", "The placement could not be shown in Illustrator."));
        return false;
    }
    if (bringApplicationToFront === true) {
        requestIllustratorForegroundAfterScript(handle.bridgeTarget);
    }
    return true;
}


function showConfirmDialog(doc, messageBase, placedWmm, placedHmm, docWidthPx, docHeightPx, hasSmartObject, placedPPI, minPlacedPPI, maxPlacedPPI, matchedItemCount, selectionHandle, usesNameOnlyLinkInfo, trimmingAvailable, trimmingReason) {
    var WARN_STYLE_RED_BOLD = "redBold";
    var WARN_STYLE_DEFAULT_BOLD = "defaultBold";
    var WARN_STYLE_DEFAULT_NORMAL = "defaultNormal";
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

    function buildTrimmingPanel(dlg) {
        var labels = [
            localText("伸ばし/トリミングを行わない", "Do not extend or trim"),
            localText("伸ばして、トリム部分にガイドを引く（画像を削りません）", "Extend and add guides at the trim edges (no image pixels are deleted)"),
            localText("伸ばして、トリム部分を切り抜く（クリッピングマスク外を削除します）", "Extend and crop to the trim area (deletes image content outside the clipping mask)")
        ];
        var values = [
            TRIMMING_MODE_NONE,
            TRIMMING_MODE_GUIDES,
            TRIMMING_MODE_CROP
        ];
        var panel = dlg.add("panel", undefined, localText("トリミング", "Trimming"));
        panel.orientation = "column";
        panel.alignChildren = ["left", "top"];
        panel.spacing = 4;
        panel.margins = [10, 12, 10, 12];

        var buttons = [];
        for (var i = 0; i < labels.length; i++) {
            var button = panel.add("radiobutton", undefined, labels[i]);
            button.value = (i === 0);
            buttons.push(button);
        }
        if (trimmingAvailable !== true) {
            buttons[1].enabled = false;
            buttons[2].enabled = false;
        }

        var xmpDescriptionGroup = panel.add("group");
        xmpDescriptionGroup.orientation = "row";
        xmpDescriptionGroup.alignChildren = ["left", "top"];
        xmpDescriptionGroup.margins = [20, 4, 0, 0];
        xmpDescriptionGroup.add(
            "statictext",
            undefined,
            localText(
                "伸ばし処理はxmpタグを埋め込みます。Illustrator側のスクリプトで処理してください",
                "Extending the image embeds an XMP tag. Use the Illustrator-side script to process the image."
            )
        );

        return {
            panel: panel,
            buttons: buttons,
            values: values
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
        var checkbox = group.add("checkbox", undefined, localText("▶前回設定値を使用する（トリミング選択以外）", "Use previous settings (except the trimming selection)"));
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
        var appButton = group.add("button", undefined, localText("Illustratorで表示 (I)", "Show in Illustrator (I)"));
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
        var selectedTrimmingMode = TRIMMING_MODE_NONE;

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
        for (var trimmingIndex = 0; trimmingIndex < ui.trimming.buttons.length; trimmingIndex++) {
            if (ui.trimming.buttons[trimmingIndex].value) {
                selectedTrimmingMode = ui.trimming.values[trimmingIndex];
                break;
            }
        }

        return {
            radioIndex: selectedRadioIndex,
            ppi: targetPPIList[selectedRadioIndex],
            method: selectedUpscaleMethod,
            downMethod: selectedDownscaleMethod,
            trimmingMode: selectedTrimmingMode
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
        var requiredW = placedWmm * selectionState.ppi / 25.4;
        var requiredH = placedHmm * selectionState.ppi / 25.4;
        var scale = Math.max(requiredW / docWidthPx, requiredH / docHeightPx);
        var scalePct = scale * 100;
        var warningBag = createWarningBag();
        if (trimmingAvailable !== true) {
            addWarning(
                warningBag,
                WARN_STYLE_DEFAULT_BOLD,
                trimmingReason || localText(
                    "この配置ではトリミング処理を選択できません。",
                    "Trimming is unavailable for this placement."
                )
            );
        }
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
        var hasPostResizePpiRange = matchedItemCount > 1 &&
            isFinite(placedPPI) && placedPPI > 0 &&
            isFinite(minPlacedPPI) && isFinite(maxPlacedPPI);
        var postResizeMinPpi = hasPostResizePpiRange
            ? minPlacedPPI * (selectionState.ppi / placedPPI)
            : NaN;
        var postResizeMaxPpi = hasPostResizePpiRange
            ? maxPlacedPPI * (selectionState.ppi / placedPPI)
            : NaN;
        if (hasPostResizePpiRange) {
            var minAllowedPpi = selectionState.ppi * efScaleMin;
            var maxAllowedPpi = selectionState.ppi * efScaleMax;
            if (postResizeMinPpi < minAllowedPpi || postResizeMaxPpi > maxAllowedPpi) {
                var postResizeRangeText = Math.abs(postResizeMaxPpi - postResizeMinPpi) < 0.01
                    ? postResizeMinPpi.toFixed(2)
                    : postResizeMinPpi.toFixed(2) + "–" + postResizeMaxPpi.toFixed(2);
                addWarning(
                    warningBag,
                    WARN_STYLE_DEFAULT_BOLD,
                    localText("【注意】\n　配置画像の処理後の実効解像度範囲が ", "[Caution]\nThe post-process effective-resolution range of the placed images will be ") + postResizeRangeText + localText(" ppi になり、指定解像度から外れます。\n　画像ファイルを分けることを推奨します。", " ppi, outside the selected resolution. Using separate image files is recommended.")
                );
            }
        }
        return {
            scaleText: localText("拡縮率: ", "Scale: ") + scalePct.toFixed(2) + " %",
            warningBag: warningBag,
            postResizeMinPpi: postResizeMinPpi,
            postResizeMaxPpi: postResizeMaxPpi
        };
    }

    function renderDialogState(skipRedraw) {
        var computed = computeDialogState(collectSelectionState(ui), historyWarning);
        ui.scaleText.text = computed.scaleText;
        if (ui.info && ui.info.extraText) {
            var postResizeRangeText = "-";
            if (isFinite(computed.postResizeMinPpi) && isFinite(computed.postResizeMaxPpi)) {
                postResizeRangeText = Math.abs(computed.postResizeMaxPpi - computed.postResizeMinPpi) < 0.01
                    ? computed.postResizeMinPpi.toFixed(2)
                    : computed.postResizeMinPpi.toFixed(2) + "–" + computed.postResizeMaxPpi.toFixed(2);
            }
            ui.info.extraText.text =
                localText("配置点数: ", "Placed items: ") + matchedItemCount + "\n" +
                localText("処理後の実効ppi範囲: ", "Post-process effective-PPI range: ") + postResizeRangeText + "\n" +
                localText("※選択した配置を基準に処理します。", "The selected placement is used for processing.");
        }
        renderWarningRows(ui.warningRows, computed.warningBag, skipRedraw === true, dlg);
    }

    var dlg = createDialogShell(localText("Illustratorに合わせて画像リサイズ・トリミング ", "Resize and Trim Image to Illustrator Placement ") + SCRIPT_VERSION);
    var ui = {};
    ui.info = buildInfoPanel(dlg, messageBase);

    ui.resolution = buildRadioPanel(dlg, localText("指定解像度", "Target Resolution"), resolutionLabels, initialState.radioIndex);
    ui.upscale = buildMethodPanel(dlg, localText("拡大メソッド", "Upscale Method"), methodLabels, methodValues, initialState.upscaleMethod);
    ui.downscale = buildMethodPanel(dlg, localText("縮小メソッド", "Downscale Method"), downMethodLabels, downMethodValues, initialState.downMethod);
    ui.upscale.values = methodValues;
    ui.downscale.values = downMethodValues;
    ui.trimming = buildTrimmingPanel(dlg);

    var scaleText = dlg.add("statictext", undefined, "");
    scaleText.minimumSize.width = 400;
    try {
        scaleText.graphics.font = ScriptUI.newFont(scaleText.graphics.font.name, "Bold", scaleText.graphics.font.size);
    } catch (e) { }
    ui.scaleText = scaleText;
    ui.warningRows = buildWarningArea(dlg);

    var historyWarning = "";
    try {
        var historyStatus = getHistoryStatusByName(doc, HISTORY_NAME);
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
    var showIllustratorTarget = "";
    buttonRow.appButton.onClick = function () {
        if (selectionHandle && selectInIllustrator(selectionHandle, false)) {
            showIllustratorTarget = String(selectionHandle.bridgeTarget || "");
            savePrefsAndClose(2, false);
        }
    };
    buttonRow.helpButton.onClick = function () {
        openURLInBrowser("https://gist.github.com/Yamonov/b63d9c67402ef7af4c17ab33caccce31");
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

    var dialogResult = dlg.show();
    var ok = (dialogResult === 1);
    if (ok) {
        var selectedState = collectSelectionState(ui);
        return {
            ppi: selectedState.ppi,
            method: selectedState.method,
            downMethod: selectedState.downMethod,
            trimmingMode: selectedState.trimmingMode,
            usePrev: !!usePrevArea.checkbox.value,
            cancelled: false
        };
    }
    if (dialogResult === 2 && showIllustratorTarget) {
        return {
            usePrev: !!usePrevArea.checkbox.value,
            cancelled: true,
            showIllustratorTarget: showIllustratorTarget
        };
    }
    return {
        usePrev: !!usePrevArea.checkbox.value,
        cancelled: true
    };
}

var CropIntegration = null;

function getCropIntegration() {
    if (CropIntegration) {
        return CropIntegration;
    }
    var integration = createCropIntegration();
    if (!integration) {
        throw new Error(localText(
            "トリミング処理の初期化に失敗しました。",
            "Trimming initialization failed."
        ));
    }
    CropIntegration = integration;
    return CropIntegration;
}

function createCropIntegration() {
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

function setReplacementProcessingMode(responseObject, trimmingMode) {
    if (trimmingMode !== TRIMMING_MODE_GUIDES &&
            trimmingMode !== TRIMMING_MODE_CROP) {
        return false;
    }
    var replacementData = extractReplacementData(responseObject);
    if (!replacementData) {
        return false;
    }
    replacementData.processingMode = trimmingMode;
    return true;
}

function loadReplacementXMPLibrary() {
    if (ExternalObject.AdobeXMPScript === undefined) {
        ExternalObject.AdobeXMPScript = new ExternalObject("lib:AdobeXMPScript");
    }
}

function getDocumentXMP(doc) {
    var rawData = doc.xmpMetadata.rawData;
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
function extractNormalizedMaskBounds(responseObject) {
    var selected = responseObject && responseObject.selected ? responseObject.selected : null;
    var bounds = selected && selected.normalizedMaskBounds
        ? selected.normalizedMaskBounds
        : (responseObject ? responseObject.normalizedMaskBounds : null);
    if (!bounds) {
        return null;
    }
    var normalized = {
        minX: Number(bounds.minX),
        maxX: Number(bounds.maxX),
        minY: Number(bounds.minY),
        maxY: Number(bounds.maxY)
    };
    if (!isFinite(normalized.minX) || !isFinite(normalized.maxX) ||
            !isFinite(normalized.minY) || !isFinite(normalized.maxY) ||
            normalized.maxX < normalized.minX || normalized.maxY < normalized.minY) {
        return null;
    }
    return normalized;
}

function buildPixelAdjustmentsFromResponse(responseObject, canvasWidth, canvasHeight) {
    var normalizedBounds = extractNormalizedMaskBounds(responseObject);
    var widthPx = Math.round(Number(canvasWidth));
    var heightPx = Math.round(Number(canvasHeight));
    if (!normalizedBounds || !isFinite(widthPx) || !isFinite(heightPx) ||
            widthPx < 1 || heightPx < 1) {
        return null;
    }
    return [
        toPixelAdjustmentValue(normalizedBounds.minY, heightPx, "min"),
        toPixelAdjustmentValue(normalizedBounds.minX, widthPx, "min"),
        toPixelAdjustmentValue(normalizedBounds.maxY, heightPx, "max"),
        toPixelAdjustmentValue(normalizedBounds.maxX, widthPx, "max")
    ];
}

function toPixelAdjustmentValue(normalizedBoundary, pixelSize, mode) {
    var rawBoundary = Number(normalizedBoundary) * Number(pixelSize);
    var size = Math.round(Number(pixelSize));
    if (!isFinite(rawBoundary) || !isFinite(size) || size < 1) {
        return 0;
    }
    var delta = mode === "min" ? rawBoundary : rawBoundary - size;
    var magnitude = Math.abs(delta);
    var pixels = Math.floor(magnitude + 0.5 + Math.max(1, magnitude) * 0.000000000001);
    if (pixels < 1) return 0;
    if (mode === "min") {
        return delta < 0 ? pixels : "g" + pixels;
    }
    return delta > 0 ? pixels : "g" + pixels;
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

function createEmptyAdjustmentSides() {
    return {
        top: 0,
        left: 0,
        bottom: 0,
        right: 0
    };
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
        if (!hasEquivalentGuide(guides, guide)) {
            guides.add(guide.direction, UnitValue(guide.position, "px"));
        }
    }
}

function hasEquivalentGuide(guides, candidate) {
    var candidatePosition = Number(candidate.position);
    for (var idx = 0; idx < guides.length; idx++) {
        try {
            var existing = guides[idx];
            if (existing.direction === candidate.direction &&
                    Math.abs(Number(existing.coordinate.as("px")) - candidatePosition) < 0.5) {
                return true;
            }
        } catch (_guideReadError) {}
    }
    return false;
}

function buildOperationSides(rawAdjustments) {
    var rawSides = toAdjustmentSides(rawAdjustments);
    var expand = createEmptyAdjustmentSides();
    var trim = createEmptyAdjustmentSides();
    var names = ["top", "left", "bottom", "right"];

    for (var idx = 0; idx < names.length; idx++) {
        var name = names[idx];
        var parsed = parseAdjustmentValue(rawSides[name]);
        if (parsed.type === "expand") {
            expand[name] = parsed.value;
        } else {
            trim[name] = parsed.value;
        }
    }

    return {
        expand: expand,
        trim: trim
    };
}

function resizeCanvasPixels(doc, width, height, anchor) {
    var safeWidth = Math.round(Number(width));
    var safeHeight = Math.round(Number(height));
    if (!isFinite(safeWidth) || !isFinite(safeHeight) || safeWidth < 1 || safeHeight < 1) {
        throw new Error(localText(
            "トリミング後の画像サイズが不正です。",
            "The image dimensions after trimming are invalid."
        ));
    }
    doc.resizeCanvas(
        UnitValue(safeWidth, "px"),
        UnitValue(safeHeight, "px"),
        anchor
    );
}

function expandCanvasForOperation(doc, expand, canvasWidth, canvasHeight) {
    var expandedWidth = canvasWidth + expand.left + expand.right;
    var expandedHeight = canvasHeight + expand.top + expand.bottom;

    if (hasCanvasExpansion(expand)) {
        prepareBackgroundLayerForCanvasExpansion(doc);
    }

    if (expand.left > 0 || expand.top > 0) {
        resizeCanvasPixels(
            doc,
            canvasWidth + expand.left,
            canvasHeight + expand.top,
            AnchorPosition.BOTTOMRIGHT
        );
    }
    if (expand.right > 0 || expand.bottom > 0) {
        resizeCanvasPixels(
            doc,
            expandedWidth,
            expandedHeight,
            AnchorPosition.TOPLEFT
        );
    }

    return {
        width: expandedWidth,
        height: expandedHeight
    };
}

function applyGuideAdjustmentsToDocument(doc, rawAdjustments, canvasWidth, canvasHeight) {
    var sides = buildOperationSides(rawAdjustments);
    var expand = sides.expand;
    var trim = sides.trim;
    expandCanvasForOperation(doc, expand, canvasWidth, canvasHeight);

    var guideItems = [];
    if (trim.top > 0) {
        guideItems.push({
            direction: Direction.HORIZONTAL,
            position: expand.top + trim.top
        });
    }
    if (trim.left > 0) {
        guideItems.push({
            direction: Direction.VERTICAL,
            position: expand.left + trim.left
        });
    }
    if (trim.bottom > 0) {
        guideItems.push({
            direction: Direction.HORIZONTAL,
            position: expand.top + canvasHeight - trim.bottom
        });
    }
    if (trim.right > 0) {
        guideItems.push({
            direction: Direction.VERTICAL,
            position: expand.left + canvasWidth - trim.right
        });
    }
    addGuides(doc.guides, guideItems);
}

function cropDocumentPixelsDestructively(left, top, right, bottom, canvasWidth, canvasHeight) {
    left = Math.round(Number(left));
    top = Math.round(Number(top));
    right = Math.round(Number(right));
    bottom = Math.round(Number(bottom));

    if (!isFinite(left) || !isFinite(top) || !isFinite(right) || !isFinite(bottom) ||
            left < 0 || top < 0 || right > canvasWidth || bottom > canvasHeight ||
            right <= left || bottom <= top) {
        throw new Error(localText(
            "クリッピングマスクに合わせたトリミング範囲を作成できません。",
            "A valid crop area matching the clipping mask could not be created."
        ));
    }

    var cropDescriptor = new ActionDescriptor();
    var rectangleDescriptor = new ActionDescriptor();
    rectangleDescriptor.putUnitDouble(charIDToTypeID("Top "), charIDToTypeID("#Pxl"), top);
    rectangleDescriptor.putUnitDouble(charIDToTypeID("Left"), charIDToTypeID("#Pxl"), left);
    rectangleDescriptor.putUnitDouble(charIDToTypeID("Btom"), charIDToTypeID("#Pxl"), bottom);
    rectangleDescriptor.putUnitDouble(charIDToTypeID("Rght"), charIDToTypeID("#Pxl"), right);
    cropDescriptor.putObject(charIDToTypeID("T   "), charIDToTypeID("Rctn"), rectangleDescriptor);
    cropDescriptor.putUnitDouble(charIDToTypeID("Angl"), charIDToTypeID("#Ang"), 0);
    cropDescriptor.putBoolean(charIDToTypeID("Dlt "), true);
    executeAction(charIDToTypeID("Crop"), cropDescriptor, DialogModes.NO);
}

function applyCropAdjustmentsToDocument(doc, rawAdjustments, canvasWidth, canvasHeight) {
    var sides = buildOperationSides(rawAdjustments);
    var expand = sides.expand;
    var trim = sides.trim;
    var expandedSize = expandCanvasForOperation(doc, expand, canvasWidth, canvasHeight);
    var cropLeft = trim.left;
    var cropTop = trim.top;
    var cropRight = expandedSize.width - trim.right;
    var cropBottom = expandedSize.height - trim.bottom;

    if (trim.top > 0 || trim.left > 0 || trim.bottom > 0 || trim.right > 0) {
        cropDocumentPixelsDestructively(
            cropLeft,
            cropTop,
            cropRight,
            cropBottom,
            expandedSize.width,
            expandedSize.height
        );
    }
}

function applyMode(doc, responseObject, trimmingMode, canvasWidth, canvasHeight) {
    var targetPixelSize = {
        width: Math.round(Number(canvasWidth)),
        height: Math.round(Number(canvasHeight))
    };
    var adjustedValues = buildPixelAdjustmentsFromResponse(
        responseObject,
        targetPixelSize.width,
        targetPixelSize.height
    );
    if (!adjustedValues) {
        throw new Error(localText(
            "Illustratorのクリッピングマスク情報をピクセル座標へ変換できませんでした。",
            "The Illustrator clipping-mask geometry could not be converted to pixel coordinates."
        ));
    }

    var originalRulerUnits = preferences.rulerUnits;
    preferences.rulerUnits = Units.PIXELS;
    try {
        if (trimmingMode === TRIMMING_MODE_GUIDES) {
            applyGuideAdjustmentsToDocument(
                doc,
                adjustedValues,
                targetPixelSize.width,
                targetPixelSize.height
            );
            return;
        }
        if (trimmingMode === TRIMMING_MODE_CROP) {
            applyCropAdjustmentsToDocument(
                doc,
                adjustedValues,
                targetPixelSize.width,
                targetPixelSize.height
            );
            return;
        }
        throw new Error(localText(
            "不明なトリミング設定です。",
            "The trimming option is unknown."
        ));
    } finally {
        preferences.rulerUnits = originalRulerUnits;
    }
}

function writeMetadata(doc, responseObject) {
    return writeReplacementMetadata(doc, responseObject);
}

function restoreMetadata(doc, responseObject) {
    if (!doc || !responseObject || typeof responseObject.__integrationOriginalXmpRawData === "undefined") {
        return false;
    }
    try {
        doc.xmpMetadata.rawData = responseObject.__integrationOriginalXmpRawData;
        return true;
    } catch (_metadataRestoreError) { }
    return false;
}

function preflightMetadata(doc, responseObject) {
    var replacementData = extractReplacementData(responseObject);
    if (!replacementData) {
        return false;
    }

    loadReplacementXMPLibrary();
    XMPMeta.registerNamespace(REPLACEMENT_XMP_NAMESPACE_URI, REPLACEMENT_XMP_PREFIX);
    var originalRawData = doc.xmpMetadata.rawData || "";
    var xmp = originalRawData ? new XMPMeta(originalRawData) : new XMPMeta();
    xmp.setProperty(
        REPLACEMENT_XMP_NAMESPACE_URI,
        REPLACEMENT_XMP_PROPERTY,
        stringifyReplacementPayload(replacementData)
    );
    var preparedRawData = xmp.serialize();
    if (!preparedRawData) {
        return false;
    }
    responseObject.__integrationOriginalXmpRawData = originalRawData;
    return true;
}

return {
    applyMode: applyMode,
    setProcessingMode: setReplacementProcessingMode,
    preflightMetadata: preflightMetadata,
    restoreMetadata: restoreMetadata,
    writeMetadata: writeMetadata
};
}


// 実行開始
main();
