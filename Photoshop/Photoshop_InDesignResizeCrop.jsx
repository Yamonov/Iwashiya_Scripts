#target photoshop

/*
<javascriptresource>
<name>InDesignに合わせてリサイズ・トリミング</name>
<category>YPresets</category>
</javascriptresource>

SCRIPTMETA-BEGIN
Script-ID=org.iwashi.Photoshop_InDesign_Resize
Version=2.0
Meta-URL=https://github.com/Yamonov/Iwashiya_Scripts/tree/main/Photoshop
Name=InDesign配置に合わせてリサイズ・トリミング
Author=Murakami Yoshiteru
Release-Date=2026-08-09
Target-App=Photoshop
Description-BEGIN
Photoshopで開いている画像を、InDesignドキュメント上の配置サイズに合わせてリサイズします。

配置したInDesignドキュメントを開いておき、Photoshopから実行してください。

トリミング処理は「伸ばし/トリミングを行わない」「伸ばして、トリム部分にガイドを引く（画像を削りません）」
「伸ばして、トリム部分を切り抜く（フレーム外を削除します）」から選択できます。
ガイドを引く場合も切り抜く場合も、InDesignの配置フレーム情報をXMPメタデータに記録します。
伸ばし処理後は、InDesign側のスクリプトで処理してください。

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
var HISTORY_NAME = localText("InDesignに合わせてリサイズ・トリミング処理", "Resize and Trim to InDesign Placement");
var TRIMMING_MODE_NONE = "none";
var TRIMMING_MODE_GUIDES = "extendWithGuides";
var TRIMMING_MODE_CROP = "extendAndCrop";
var INDESIGN_BASE_TARGET = "indesign";

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
var PREF_ID_IDRESIZECROP = "com.yamo.psIDresizeCrop_v1"; // 統合版専用識別子
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
        var d = app.getCustomOptions(PREF_ID_IDRESIZECROP);
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
    app.putCustomOptions(PREF_ID_IDRESIZECROP, d, true);
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
    var normalized = String(responseText || "").replace(/^\uFEFF/, "").replace(/^\s+|\s+$/g, "");
    try {
        return JSON.parse(normalized);
    } catch (jsonError) {
        try {
            return eval("(" + normalized + ")");
        } catch (evalError) {
            alert(appLabel + localText("応答の解析に失敗しました。\n元の応答: ", " response could not be parsed.\nRaw response: ") + rawResponse);
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

function getInDesignMajorFromSpecifier(specifier) {
    var match = String(specifier || "").match(/indesign-(\d+)/i);
    return match ? Number(match[1]) : NaN;
}

function getRunningInDesignTargets() {
    var latestSpecifier = "";
    try {
        latestSpecifier = String(BridgeTalk.getSpecifier(INDESIGN_BASE_TARGET) || "");
    } catch (_specifierError) { }
    var latestMajor = getInDesignMajorFromSpecifier(latestSpecifier);
    if (!isFinite(latestMajor) || latestMajor < 1) {
        return [];
    }

    var targets = [];
    for (var major = latestMajor; major >= 1; major--) {
        var target = INDESIGN_BASE_TARGET + "-" + major;
        var appPath = "";
        try {
            appPath = String(BridgeTalk.getAppPath(target) || "");
        } catch (_appPathError) { }
        if (!appPath) continue;
        var isRunning = false;
        try {
            isRunning = BridgeTalk.isRunning(target) === true;
        } catch (_runningError) { }
        if (!isRunning) continue;
        targets.push(target);
    }
    return targets;
}

function bringInDesignTargetToFront(target) {
    if (!target) return false;
    try {
        BridgeTalk.bringToFront(target);
        return true;
    } catch (_bringToFrontError) { }
    return false;
}

function requestInitialInDesignCandidates(inDesignFunctionSource, imagePath, imageName) {
    var targets = getRunningInDesignTargets();
    if (!targets.length) {
        return {
            ok: false,
            error: localText(
                "起動中のInDesignが見つかりません。対象ドキュメントを開いてから実行してください。",
                "No running InDesign application was found. Open the target document and run the script again."
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
        var documentInfo = responseObject.documentInfo || {};
        var destination = responseObject.matchType === "nameOnly" ? nameOnlyItems : exactItems;
        for (var itemIndex = 0; itemIndex < responseObject.items.length; itemIndex++) {
            var item = responseObject.items[itemIndex] || {};
            item.bridgeTarget = bridgeTarget;
            if (!item.applicationVersion) item.applicationVersion = String(documentInfo.applicationVersion || "");
            if (item.documentId == null) item.documentId = documentInfo.documentId;
            if (!item.documentName) item.documentName = String(documentInfo.documentName || "");
            if (!item.documentPath) item.documentPath = String(documentInfo.documentPath || "");
            destination.push(item);
        }
        hasFolderDifference = hasFolderDifference || !!responseObject.hasFolderDifference;
        hasExtensionDifference = hasExtensionDifference || !!responseObject.hasExtensionDifference;
    }

    for (var targetIndex = 0; targetIndex < targets.length; targetIndex++) {
        var bridgeTarget = targets[targetIndex];
        var requestBody = "(" + inDesignFunctionSource + ")(" + toSourceLiteral({
            pathFs: encodeURIComponent(imagePath),
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
        appendItems(responseObject, bridgeTarget);
    }

    if (communicationErrors.length) {
        return {
            ok: false,
            error: localText(
                "一部のInDesignから配置情報を取得できませんでした。",
                "Placement information could not be obtained from one or more InDesign applications."
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
function showTransientActivationDialog(titleText) {
    var activationDialog = null;
    try {
        activationDialog = new Window("dialog", String(titleText || ""));
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

var TRANSIENT_ACTIVATION_DIALOG_HELPER_SRC = showTransientActivationDialog.toString();

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

function findLargestInDesignCandidateIndex(items) {
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

function finalizeInDesignResizeFlow(ctx) {
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
    var imgPath = ctx.imgPath;
    var candidateItemsArray = ctx.candidateItemsArray;
    var targetItem = ctx.targetItem;

    if (targetItem.linkStatus === 1) {
        alert(localText("リンク切れ画像です。", "The linked image is missing."));
        return;
    } else if (targetItem.linkStatus === 2) {
        alert(localText("リンクが更新されていません。", "The link is not updated."));
        return;
    }

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
    var messageBase = localText("InDesign配置サイズ(長辺): ", "InDesign placed size (long side): ") + placedLongMM.toFixed(2) + " mm\n" +
        ppiLine +
        scaleLine +
        localText("画像ピクセル: ", "Image pixels: ") + longPx + "\n";

    var inDesignSelectionHandle = buildPlacementHandle(targetItem);

    var hasSmartObject = containsSmartObject(doc);
    var dialogResult = showConfirmDialog(doc, messageBase, placedWmm, placedHmm, docWidthPx, docHeightPx, imgPath, hasSmartObject, effectivePPI, minPlacedPPI, maxPlacedPPI, ctx.matchedItemCount || 1, inDesignSelectionHandle, ctx.matchType === "nameOnly");
    try {
        if (dialogResult && dialogResult.hasOwnProperty('usePrev')) saveUsePrevOnly(dialogResult.usePrev);
    } catch (_) { }
    if (!dialogResult || dialogResult.cancelled) return;
    var targetPPI = dialogResult.ppi;
    var upscaleMethod = dialogResult.method;
    var downscaleMethod = dialogResult.downMethod;
    var trimmingMode = dialogResult.trimmingMode || TRIMMING_MODE_NONE;
    var cropResponse = null;
    var reqWpx = calcRequiredPixels(placedWmm, targetPPI);
    var reqHpx = calcRequiredPixels(placedHmm, targetPPI);
    var scaleRatio = Math.max(reqWpx / docWidthPx, reqHpx / docHeightPx);
    var newWidthPx = Math.round(docWidthPx * scaleRatio);
    var newHeightPx = Math.round(docHeightPx * scaleRatio);

    try {
        cropResponse = getCropIntegration().prepare(doc, targetItem);
    } catch (placementValidationError) {
        alert(
            localText(
                "InDesignの配置を再確認できないため、処理を中止しました。",
                "Processing was cancelled because the InDesign placement could not be revalidated."
            ) + "\n" + placementValidationError
        );
        return;
    }
    if (!cropResponse) return;
    try {
        assertPhotoshopDocumentSession(ctx.photoshopSession);
    } catch (documentCheckError) {
        alert(documentCheckError);
        return;
    }

    if (trimmingMode !== TRIMMING_MODE_NONE) {
        try {
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
    var resizeResult = runWithHistory(ctx.photoshopSession, HISTORY_NAME, "performResizeFromCtx()");
    __HISTORY_CTX__ = null;
    if (!resizeResult || resizeResult.ok !== true) {
        var metadataRestoredAfterProcessError = true;
        if (cropResponse && cropResponse.__integrationMetadataChangeAttempted === true) {
            metadataRestoredAfterProcessError = CropIntegration.restoreMetadata(doc, cropResponse);
        }
        var restoredAfterProcessError = restoreHistoryStateAfterFailure(doc, historyStateBeforeProcess);
        alert(
            localText("リサイズ・トリミング処理に失敗しました。", "Resize and trimming failed.") + "\n" +
            (resizeResult && resizeResult.error ? resizeResult.error : localText("原因不明のエラー", "Unknown error")) +
            (restoredAfterProcessError && metadataRestoredAfterProcessError
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

function getInDesignParentPage(item) {
    var currentItem = item;
    for (var parentDepth = 0; currentItem && parentDepth < 8; parentDepth++) {
        try {
            var parentPage = currentItem.parentPage;
            if (parentPage && parentPage.isValid !== false) return parentPage;
        } catch (_parentPageError) {}
        try {
            currentItem = currentItem.parent;
        } catch (_parentItemError) {
            currentItem = null;
        }
    }
    return null;
}
var INDESIGN_PARENT_PAGE_HELPER_SRC = getInDesignParentPage.toString();

function buildInitialCandidateRowData(item, index) {
    var order = String(index + 1);
    if (order.length < 2) order = "0" + order;
    var pageText = item && item.pageName ? String(item.pageName) : "-";
    var sizeText = "-";
    if (item && isFinite(Number(item.placedWmm)) && isFinite(Number(item.placedHmm))) {
        sizeText = Number(item.placedWmm).toFixed(2) + " × " + Number(item.placedHmm).toFixed(2) + " mm";
    }
    return {
        order: order,
        page: pageText,
        size: sizeText
    };
}

function buildPlacementHandle(candidate) {
    return {
        bridgeTarget: candidate.bridgeTarget || "",
        documentId: candidate.documentId,
        documentPath: candidate.documentPath || "",
        linkId: candidate.linkId,
        itemId: candidate.itemId,
        frameId: candidate.frameId
    };
}

function hasValidPlacementGeometryFingerprint(fingerprint) {
    if (!fingerprint) return false;
    var quadNames = ["graphicQuad", "frameQuad"];
    for (var quadIndex = 0; quadIndex < quadNames.length; quadIndex++) {
        var quad = fingerprint[quadNames[quadIndex]];
        if (!(quad instanceof Array) || quad.length !== 4) return false;
        for (var pointIndex = 0; pointIndex < quad.length; pointIndex++) {
            var point = quad[pointIndex];
            if (!(point instanceof Array) || point.length < 2 ||
                    !isFinite(Number(point[0])) || !isFinite(Number(point[1]))) {
                return false;
            }
        }
    }
    return true;
}

function chooseInitialInDesignCandidate(items, initialItem, warningLines, photoshopFileName) {
    if (!items || !items.length) return null;
    if (items.length === 1) return items[0];

    var dialog = new Window("dialog", localText("処理する配置を選択", "Select Placement to Process"));
    dialog.orientation = "column";
    dialog.alignChildren = ["fill", "top"];
    dialog.spacing = 8;
    dialog.margins = 12;

    var columnTitles = [
        localText("連番", "No."),
        localText("ページ", "Page"),
        localText("サイズ", "Size")
    ];
    var rowDataList = [];
    var orderValues = [columnTitles[0]];
    var pageValues = [columnTitles[1]];
    var sizeValues = [columnTitles[2]];
    for (var rowDataIndex = 0; rowDataIndex < items.length; rowDataIndex++) {
        var rowData = buildInitialCandidateRowData(items[rowDataIndex], rowDataIndex);
        rowDataList.push(rowData);
        orderValues.push(rowData.order);
        pageValues.push(rowData.page);
        sizeValues.push(rowData.size);
    }

    function measureColumnWidth(values, minimumWidth) {
        var width = Number(minimumWidth) || 0;
        for (var valueIndex = 0; valueIndex < values.length; valueIndex++) {
            var textValue = String(values[valueIndex] || "");
            var measuredWidth = textValue.length * 7;
            try {
                measuredWidth = Number(dialog.graphics.measureString(textValue)[0]);
            } catch (_measureError) { }
            if (isFinite(measuredWidth)) {
                width = Math.max(width, Math.ceil(measuredWidth) + 24);
            }
        }
        return Math.ceil(width);
    }

    var columnWidths = [
        measureColumnWidth(orderValues, 54),
        measureColumnWidth(pageValues, 100),
        measureColumnWidth(sizeValues, 180)
    ];
    var listWidth = columnWidths[0] + columnWidths[1] + columnWidths[2] + 34;
    var contentWidth = Math.max(440, listWidth);

    var lines = warningLines || [];
    for (var lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        var messageLine = dialog.add("statictext", undefined, String(lines[lineIndex] || ""), { multiline: true });
        messageLine.preferredSize = [contentWidth, 34];
    }
    var explanation = dialog.add("statictext", undefined, localText(
        "ここで選択した同じ配置を、リサイズ・ガイド・切り抜き・XMPに使用します。",
        "The same selected placement will be used for resizing, guides, cropping, and XMP."
    ), { multiline: true });
    explanation.preferredSize = [contentWidth, 34];

    var fileNameText = dialog.add("statictext", undefined,
        localText("ファイル名：", "File name: ") + String(photoshopFileName || "-"),
        { multiline: true });
    fileNameText.preferredSize = [contentWidth, 34];

    var listBox = dialog.add("listbox", undefined, [], {
        multiselect: false,
        numberOfColumns: 3,
        showHeaders: true,
        columnTitles: columnTitles,
        columnWidths: columnWidths
    });
    var visibleRowCount = Math.max(4, Math.min(8, items.length));
    listBox.preferredSize = [contentWidth, 28 + visibleRowCount * 22];
    var initialIndex = 0;
    for (var itemIndex = 0; itemIndex < items.length; itemIndex++) {
        var row = listBox.add("item", rowDataList[itemIndex].order);
        row.subItems[0].text = rowDataList[itemIndex].page;
        row.subItems[1].text = rowDataList[itemIndex].size;
        row.candidate = items[itemIndex];
        if (initialItem && Number(items[itemIndex].linkId) === Number(initialItem.linkId) &&
                Number(items[itemIndex].documentId) === Number(initialItem.documentId) &&
                String(items[itemIndex].bridgeTarget || "") === String(initialItem.bridgeTarget || "")) {
            initialIndex = itemIndex;
        }
    }
    listBox.selection = listBox.items[initialIndex];
    listBox.onChange = function() {
        if (!this.selection || !this.selection.candidate) return;
        selectInInDesign(buildPlacementHandle(this.selection.candidate), false, true);
    };

    var buttonGroup = dialog.add("group");
    buttonGroup.alignment = ["right", "center"];
    var cancelButton = buttonGroup.add("button", undefined, localText("キャンセル", "Cancel"), { name: "cancel" });
    var showButton = buttonGroup.add("button", undefined, localText("InDesignで表示", "Show in InDesign"));
    var okButton = buttonGroup.add("button", undefined, "OK", { name: "ok" });
    dialog.defaultElement = okButton;
    dialog.cancelElement = cancelButton;

    cancelButton.onClick = function() { dialog.close(0); };
    okButton.onClick = function() {
        if (!listBox.selection) {
            alert(localText("候補を選択してください。", "Select a candidate."));
            return;
        }
        dialog.close(1);
    };
    showButton.onClick = function() {
        if (!listBox.selection) return;
        if (selectInInDesign(buildPlacementHandle(listBox.selection.candidate), true)) {
            dialog.close(2);
        }
    };

    var result = dialog.show();
    if (result !== 1 || !listBox.selection) return null;
    return listBox.selection.candidate;
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
            "未保存の変更があるドキュメントでは実行できません。保存し、InDesignのリンクを更新してから実行してください。",
            "This script cannot run while the document has unsaved changes. Save it, update the link in InDesign, and run the script again."
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
    var idSideSrc = inDesignSide.toString()
        .replace("/*__INJECT_HELPERS__*/",
            "var toNFCJa = " + NFC_HELPER_SRC + ";\n" +
            "var _normPath = " + NORM_HELPER_SRC_ID + ";\n" +
            "var getInDesignParentPage = " + INDESIGN_PARENT_PAGE_HELPER_SRC + ";\n" +
            "var _decodeAndNormalizePath = " + DECODE_NORM_HELPER_SRC + ";\n" +
            "var _decodePathRaw = " + DECODE_RAW_HELPER_SRC + ";\n" +
            "var remoteLocaleCode = " + toSourceLiteral(currentLocaleCode()) + ";\n" +
            "function remoteText(jaText, enText) { return remoteLocaleCode === 'en' ? enText : jaText; }");

    var initialResult = requestInitialInDesignCandidates(idSideSrc, imgPath, doc.name);
    if (!initialResult.ok) {
        alert(localText("InDesign通信エラー: ", "InDesign communication error: ") + initialResult.error);
        return;
    }
    var obj = initialResult.value;
    if (!obj || !obj.items || !obj.items.length) {
        alert(localText("InDesignで該当リンク画像が見つかりません。", "The matching linked image was not found in InDesign."));
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
                "InDesignから配置画像の実寸を取得できませんでした。",
                "The placed image dimensions could not be obtained from InDesign."
            ));
            return;
        }
        if (!hasValidPlacementGeometryFingerprint(item.geometryFingerprint)) {
            alert(localText(
                "InDesignから配置画像とフレームの位置・変形情報を取得できませんでした。",
                "The placed graphic and frame geometry could not be obtained from InDesign."
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

    var candidateItemsArray = matchedItems;
    var defaultTargetItem = candidateItemsArray[findLargestInDesignCandidateIndex(candidateItemsArray)];
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
            selectInInDesign(buildPlacementHandle(selectedTargetItem), true);
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
                "同じ画像が複数のInDesign配置で見つかりました。",
                "The same image was found in multiple InDesign placements."
            ));
        }
        selectedTargetItem = chooseInitialInDesignCandidate(candidateItemsArray, defaultTargetItem, candidateWarnings, doc.name);
        if (!selectedTargetItem) return;
    }

    if (selectedTargetItem.linkStatus === 1) {
        alert(localText("リンク切れ画像です。", "The linked image is missing."));
        return;
    }
    if (selectedTargetItem.linkStatus === 2) {
        alert(localText("リンクが更新されていません。", "The link is not updated."));
        return;
    }

    finalizeInDesignResizeFlow({
        photoshopSession: photoshopSession,
        docWidthPx: docWidthPx,
        docHeightPx: docHeightPx,
        currentPPI: currentPPI,
        longPx: longPx,
        imgPath: imgPath,
        candidateItemsArray: candidateItemsArray,
        targetItem: selectedTargetItem,
        matchedItemCount: candidateItemsArray.length,
        matchType: matchType
    });
}

// InDesign側で使用する共通関数: パスのデコードと正規化
function _decodeAndNormalizePath(encodedPath) {
    var decoded = decodeURIComponent(encodedPath);
    decoded = toNFCJa(decoded);
    try {
        decoded = _normPath(decoded);
    } catch (_e) { }
    return decoded;
}
var DECODE_NORM_HELPER_SRC = _decodeAndNormalizePath.toString();

// InDesign側で使用する共通関数: パスのデコード（正規化なし）
function _decodePathRaw(encodedPath) {
    var decoded = decodeURIComponent(encodedPath);
    return toNFCJa(decoded);
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

    function getObjectId(item) {
        try { return Number(item.id); } catch (_idError) {}
        return null;
    }

    function getFrameItemId(graphicItem) {
        try { return getObjectId(graphicItem.parent); } catch (_frameIdError) {}
        return null;
    }

    function getPageName(graphicItem) {
        var parentPage = getInDesignParentPage(graphicItem);
        if (parentPage) {
            try {
                var pageName = String(parentPage.name || "");
                if (pageName) return pageName;
            } catch (_pageNameError) {}
        }
        return remoteText("ペーストボード", "Pasteboard");
    }

    function getDocumentPath(document) {
        try {
            return String(document.fullName.fsName || document.fullName || "");
        } catch (_documentPathError) {}
        return "";
    }

    function buildDocumentInfo(document) {
        return {
            documentId: getObjectId(document),
            documentName: String(document.name || ""),
            documentPath: getDocumentPath(document),
            applicationVersion: String(app.version || "")
        };
    }

    function resolveSpreadPoint(item, anchorPoint) {
        var resolved = item.resolve(anchorPoint, CoordinateSpaces.SPREAD_COORDINATES);
        var point = resolved && resolved.length ? resolved[0] : null;
        if (!point || point.length < 2) {
            throw new Error(remoteText(
                "配置画像の座標を取得できませんでした。",
                "Could not resolve the placed image coordinates."
            ));
        }
        return [Number(point[0]), Number(point[1])];
    }

    function pointDistance(a, b) {
        var dx = Number(b[0]) - Number(a[0]);
        var dy = Number(b[1]) - Number(a[1]);
        return Math.sqrt(dx * dx + dy * dy);
    }

    function getPlacedImageSizeMM(graphicItem) {
        try {
            var topLeft = resolveSpreadPoint(graphicItem, AnchorPoint.TOP_LEFT_ANCHOR);
            var topRight = resolveSpreadPoint(graphicItem, AnchorPoint.TOP_RIGHT_ANCHOR);
            var bottomLeft = resolveSpreadPoint(graphicItem, AnchorPoint.BOTTOM_LEFT_ANCHOR);
            return {
                width: pointDistance(topLeft, topRight) * 25.4 / 72,
                height: pointDistance(topLeft, bottomLeft) * 25.4 / 72
            };
        } catch (_placedSizeError) {
            return { width: 0, height: 0 };
        }
    }

    function getPlacementGeometryFingerprint(graphicItem) {
        var frameItem = graphicItem;
        try {
            if (graphicItem.parent && graphicItem.parent.allGraphics !== undefined) {
                frameItem = graphicItem.parent;
            }
        } catch (_frameFingerprintError) {}

        function getQuad(item) {
            return [
                resolveSpreadPoint(item, AnchorPoint.TOP_LEFT_ANCHOR),
                resolveSpreadPoint(item, AnchorPoint.TOP_RIGHT_ANCHOR),
                resolveSpreadPoint(item, AnchorPoint.BOTTOM_RIGHT_ANCHOR),
                resolveSpreadPoint(item, AnchorPoint.BOTTOM_LEFT_ANCHOR)
            ];
        }

        try {
            return {
                graphicQuad: getQuad(graphicItem),
                frameQuad: getQuad(frameItem)
            };
        } catch (_fingerprintError) {
            return null;
        }
    }

    function buildItemObject(entry, hScale, vScale, pathInfo, displayPathInfo, resolvedPath) {
        var displayFileName = (displayPathInfo && displayPathInfo.fileName) ? displayPathInfo.fileName : pathInfo.fileName;
        var displayFolderPath = (displayPathInfo && displayPathInfo.folderPath) ? displayPathInfo.folderPath : pathInfo.folderPath;
        var documentInfo = buildDocumentInfo(entry.document);
        var placedSize = getPlacedImageSizeMM(entry.link.parent);
        var geometryFingerprint = getPlacementGeometryFingerprint(entry.link.parent);
        var linkStatus = entry.status;
        if (linkStatus == null) {
            linkStatus = getLinkStatusCode(entry.link);
            entry.status = linkStatus;
        }
        return {
            hScale: hScale,
            vScale: vScale,
            placedWmm: placedSize.width,
            placedHmm: placedSize.height,
            linkStatus: linkStatus,
            linkId: getObjectId(entry.link),
            itemId: getObjectId(entry.link.parent),
            frameId: getFrameItemId(entry.link.parent),
            documentId: documentInfo.documentId,
            documentName: documentInfo.documentName,
            documentPath: documentInfo.documentPath,
            applicationVersion: documentInfo.applicationVersion,
            pageName: getPageName(entry.link.parent),
            geometryFingerprint: geometryFingerprint,
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

    function buildLinkEntry(document, linkIndex, link) {
        var rawFilePath = String(link.filePath || "");
        var rawFileName = String(link.name || "");
        return {
            document: document,
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

    var targetRawPathInfo = buildNameOnlyPathInfo(decodedRaw, decodedRaw);
    var targetFileNameInfo = splitFileNameInfo(targetInfo && targetInfo.fileName ? String(targetInfo.fileName) : targetRawPathInfo.fileName);
    var targetPathInfo = buildNameOnlyPathInfo(decodedNorm, decodedRaw);
    var exactItems = [];
    var nameOnlyItems = [];
    var hasFolderDifference = false;
    var hasExtensionDifference = false;
    for (var documentIndex = 0; documentIndex < app.documents.length; documentIndex++) {
        var doc = app.documents[documentIndex];
        var links = doc.links;
        var exactEntries = [];
        var linkEntries = [];
        for (var linkIndex = 0; linkIndex < links.length; linkIndex++) {
            var entry = buildLinkEntry(doc, linkIndex, links[linkIndex]);
            if (entry.rawFilePath === decodedRaw) {
                exactEntries.push(entry);
                continue;
            }
            linkEntries.push(entry);
        }
        for (var rawExactIndex = 0; rawExactIndex < exactEntries.length; rawExactIndex++) {
            var rawExactEntry = exactEntries[rawExactIndex];
            exactItems.push(buildResolvedItem(rawExactEntry, getEntryRawPathInfo(rawExactEntry), rawExactEntry.rawFilePath));
        }
        var candidateEntries = [];
        if (targetFileNameInfo.baseName) {
            for (var rawIndex = 0; rawIndex < linkEntries.length; rawIndex++) {
                var fileNameInfo = linkEntries[rawIndex].fileNameInfo;
                if (fileNameInfo.baseName && fileNameInfo.baseName === targetFileNameInfo.baseName) {
                    candidateEntries.push(linkEntries[rawIndex]);
                }
            }
        }
        for (var candidateIndex = 0; candidateIndex < candidateEntries.length; candidateIndex++) {
            var candidateEntry = candidateEntries[candidateIndex];
            var normalizedLinkPath = getEntryNormalizedPath(candidateEntry);
            var pathInfo = getEntryNormalizedPathInfo(candidateEntry);
            if (normalizedLinkPath === decodedNorm) {
                exactItems.push(buildResolvedItem(candidateEntry, pathInfo, normalizedLinkPath));
                continue;
            }
            if (!targetFileNameInfo.baseName || !candidateEntry.fileNameInfo.baseName) continue;
            if (targetFileNameInfo.baseName !== candidateEntry.fileNameInfo.baseName) continue;
            if (targetPathInfo.folderPath !== pathInfo.folderPath) hasFolderDifference = true;
            if (targetFileNameInfo.extension !== candidateEntry.fileNameInfo.extension) hasExtensionDifference = true;
            nameOnlyItems.push(buildResolvedItem(candidateEntry, pathInfo, normalizedLinkPath));
        }
    }
    if (exactItems.length) {
        return ({
            matchType: "exact",
            hasFolderDifference: false,
            hasExtensionDifference: false,
            documentInfo: { applicationVersion: String(app.version || "") },
            items: exactItems
        }).toSource();
    }
    if (nameOnlyItems.length) {
        return ({
            matchType: "nameOnly",
            hasFolderDifference: hasFolderDifference,
            hasExtensionDifference: hasExtensionDifference,
            documentInfo: { applicationVersion: String(app.version || "") },
            items: nameOnlyItems
        }).toSource();
    }
    return null; // 一致するリンクなし
}

// InDesign側: リンクを選択・表示する関数（配置候補の即時プレビュー用）
function showInInDesignSide(handle, showActivationDialog) {
    /*__INJECT_HELPERS__*/
    if (app.documents.length === 0) {
        throw new Error("InDesign: " + remoteText("ドキュメントが開かれていません。", "No document is open."));
    }
    var doc = null;
    var requestedDocumentId = Number(handle && handle.documentId);
    if (isFinite(requestedDocumentId)) {
        try {
            doc = app.documents.itemByID(requestedDocumentId);
            if (!doc || doc.isValid === false) doc = null;
        } catch (_documentByIdError) { doc = null; }
    }
    if (!doc) {
        throw new Error("InDesign: " + remoteText("対象ドキュメントが見つかりません。", "The target document could not be found."));
    }
    if (handle && handle.documentPath) {
        var currentDocumentPath = "";
        try { currentDocumentPath = String(doc.fullName.fsName || doc.fullName || ""); } catch (_documentPathError) {}
        if (_normPath(currentDocumentPath) !== _normPath(String(handle.documentPath))) {
            throw new Error("InDesign: " + remoteText("対象ドキュメントが変更されています。", "The target document has changed."));
        }
    }
    var links = doc.links;
    var bestItem = null;
    var requestedLinkId = Number(handle && handle.linkId);
    if (isFinite(requestedLinkId)) {
        try {
            var requestedLink = links.itemByID(requestedLinkId);
            if (requestedLink && requestedLink.isValid !== false) bestItem = requestedLink.parent;
        } catch (_linkByIdError) { bestItem = null; }
    }
    if (!bestItem) {
        throw new Error("InDesign: " + remoteText("対象リンクが見つかりません。", "The target link could not be found."));
    }
    if (handle && handle.itemId != null && Number(bestItem.id) !== Number(handle.itemId)) {
        throw new Error("InDesign: " + remoteText("対象配置画像が変更されています。", "The target placed graphic has changed."));
    }
    if (handle && handle.frameId != null && Number(bestItem.parent.id) !== Number(handle.frameId)) {
        throw new Error("InDesign: " + remoteText("対象配置フレームが変更されています。", "The target placement frame has changed."));
    }
    var win = null;
    var previewItem = bestItem;
    try {
        if (bestItem.parent && bestItem.parent.isValid !== false) {
            previewItem = bestItem.parent;
        }
    } catch (_previewItemError) { previewItem = bestItem; }
    try {
        if (doc.layoutWindows.length > 0) {
            win = doc.layoutWindows[0];
        }
    } catch (_windowError) { win = null; }
    try {
        if (win) win.bringToFront();
    } catch (_bringWindowError) { }
    try {
        var previewPage = getInDesignParentPage(previewItem);
        if (previewPage && win) win.activePage = previewPage;
    } catch (_pageError) { }
    previewItem.select();
    try {
        if (win) {
            if (!fitSelection(win)) {
                try {
                    win.zoom(ZoomOptions.FIT_PAGE);
                } catch (_fitPageError) { }
            }
        }
    } catch (_z) { }
    if (showActivationDialog === true) {
        showTransientActivationDialog("InDesign");
    }
    return;

    function fitSelection(win) {
        var didFit = false;
        try {
            var fitSelectionAction = app.menuActions.itemByName("$ID/Fit Selection in Window");
            if (fitSelectionAction && fitSelectionAction.isValid) {
                fitSelectionAction.invoke();
                didFit = true;
            }
        } catch (_menuError) { }

        if (!didFit) {
            try {
                win.zoom(ZoomOptions.FIT_SPREAD);
                didFit = true;
            } catch (_spreadError) { }
        }

        if (didFit) {
            try {
                var maxPreviewZoom = 200;
                var currentZoom = Number(win.zoomPercentage);
                if (isFinite(currentZoom) && currentZoom > maxPreviewZoom) {
                    win.zoomPercentage = maxPreviewZoom;
                }
            } catch (_zoomLimitError) { }
        }

        return didFit;
    }
}

function selectInInDesign(handle, bringApplicationToFront, useTransientFocusRoundTrip) {
    var bridgeTarget = handle && handle.bridgeTarget ? String(handle.bridgeTarget) : "";
    if (!bridgeTarget) {
        alert(localText("対象のInDesignを確認できません。", "The target InDesign application could not be verified."));
        return false;
    }
    var showSrc = showInInDesignSide.toString()
        .replace("/*__INJECT_HELPERS__*/",
            "var toNFCJa = " + NFC_HELPER_SRC + ";\n" +
            "var _normPath = " + NORM_HELPER_SRC_ID + ";\n" +
            "var getInDesignParentPage = " + INDESIGN_PARENT_PAGE_HELPER_SRC + ";\n" +
            "var showTransientActivationDialog = " + TRANSIENT_ACTIVATION_DIALOG_HELPER_SRC + ";");
    var showActivationDialog = useTransientFocusRoundTrip === true;
    var showBody = "(" +
        "function(){" +
        "var remoteLocaleCode = " + toSourceLiteral(currentLocaleCode()) + ";" +
        "function remoteText(jaText, enText) { return remoteLocaleCode === 'en' ? enText : jaText; }" +
        showSrc + "\n" +
        "var __handle = " + toSourceLiteral(handle || {}) + ";" +
        "var __showActivationDialog = " + (showActivationDialog ? "true" : "false") + ";" +
        "showInInDesignSide(__handle, __showActivationDialog);" +
        "return 'ok';" +
        "}" +
        ")();";
    var bridgeTalkResult = sendBridgeTalkAndWait(bridgeTarget, showBody, 15000);
    if (!bridgeTalkResult.ok) {
        alert(localText("InDesign通信エラー: ", "InDesign communication error: ") + bridgeTalkResult.error);
        return false;
    }
    if (showActivationDialog) {
        activatePhotoshopWindow();
        showTransientActivationDialog("Photoshop");
    }
    if (bringApplicationToFront !== false) {
        bringInDesignTargetToFront(bridgeTarget);
    }
    return true;
}

// リサイズ確認ダイアログ: 画像情報（非ボールド）+ 配置情報（ボールド）+ ppi/メソッド選択 + 警告
function showConfirmDialog(doc, messageBase, placedWmm, placedHmm, docWidthPx, docHeightPx, imgPath, hasSmartObject, placedPPI, minPlacedPPI, maxPlacedPPI, matchedItemCount, selectionHandle, usesNameOnlyLinkInfo) {
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
            localText("伸ばして、トリム部分を切り抜く（フレーム外を削除します）", "Extend and crop to the trim area (deletes image content outside the frame)")
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

        var xmpDescriptionGroup = panel.add("group");
        xmpDescriptionGroup.orientation = "row";
        xmpDescriptionGroup.alignChildren = ["left", "top"];
        xmpDescriptionGroup.margins = [20, 4, 0, 0];
        xmpDescriptionGroup.add(
            "statictext",
            undefined,
            localText(
                "伸ばし処理はxmpタグを埋め込みます。InDesign側のスクリプトで処理してください",
                "Extending the image embeds an XMP tag. Use the InDesign-side script to process the image."
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

    var dlg = createDialogShell(localText("InDesignに合わせて画像リサイズ・トリミング ", "Resize and Trim Image to InDesign Placement ") + SCRIPT_VERSION);
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
    buttonRow.appButton.onClick = function () {
        if (selectInInDesign(selectionHandle || {
            linkIndex: null,
            pathFs: encodeURI(imgPath),
            items: []
        }, true)) {
            savePrefsAndClose(2, false);
        }
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
            trimmingMode: selectedState.trimmingMode,
            usePrev: !!usePrevArea.checkbox.value,
            cancelled: false
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
var TO_SOURCE_LITERAL_SRC = toSourceLiteral.toString();
var REPLACEMENT_XMP_NAMESPACE_URI = "http://ns.yamo.jp/photoshop/crop-replacement-data/1.0/";
var REPLACEMENT_XMP_PREFIX = "yamoCrop:";
var REPLACEMENT_XMP_PROPERTY = "PhotoshopCrop_ReplacementData";
var REPLACEMENT_DATA_VERSION = 1;
var REPLACEMENT_DATA_UNIT = "mm";
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
function requestCropDataFromInDesign(placementSession) {
    if (!placementSession || !placementSession.bridgeTarget ||
            placementSession.documentId == null || placementSession.linkId == null) {
        return {
            status: "error",
            message: localText("選択したInDesign配置を確認できません。", "The selected InDesign placement could not be verified.")
        };
    }
    var bridgeResult = sendToInDesign(placementSession);
    activatePhotoshopWindow();
    if (!bridgeResult || bridgeResult.ok !== true) {
        return {
            status: "error",
            message: localText("InDesign通信エラー: ", "InDesign communication error: ") +
                String(bridgeResult && bridgeResult.error ? bridgeResult.error : localText("原因不明のエラー", "Unknown error"))
        };
    }
    var responseObject = parseBridgeTalkResponse(bridgeResult.body);
    if (responseObject) return responseObject;
    return {
        status: "error",
        message: localText("InDesign応答の解析に失敗しました。", "Failed to parse the InDesign response.") + "\r" + bridgeResult.body
    };
}

function handleInDesignResponse(responseObject) {
    if (!responseObject) {
        alert(localText("InDesign応答の解析に失敗しました。", "Failed to parse the InDesign response."));
        return false;
    }
    if (responseObject.status === "cancel") {
        return false;
    }
    if (responseObject.status !== "ok") {
        alert(responseObject.message || localText("InDesign側でエラーが発生しました。", "An error occurred on the InDesign side."));
        return false;
    }
    return true;
}

function extractNormalizedFrameBounds(responseObject) {
    var selected = responseObject && responseObject.selected ? responseObject.selected : null;
    var bounds = selected && selected.normalizedFrameBounds
        ? selected.normalizedFrameBounds
        : (responseObject ? responseObject.normalizedFrameBounds : null);
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
    var normalizedBounds = extractNormalizedFrameBounds(responseObject);
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
    var boundary = Math.round(Number(normalizedBoundary) * Number(pixelSize));
    var size = Math.round(Number(pixelSize));
    if (!isFinite(boundary) || !isFinite(size) || size < 1) {
        return 0;
    }
    if (mode === "min") {
        if (boundary < 0) return -boundary;
        return boundary > 0 ? "g" + boundary : 0;
    }
    if (boundary > size) return boundary - size;
    return boundary < size ? "g" + (size - boundary) : 0;
}

function parseBridgeTalkResponse(responseText) {
    return parseJsonResponse(responseText);
}

function buildBridgeTalkInvocationBody(inDesignFunction, requestData) {
    var injected = buildInjectedInDesignFunctionSource(inDesignFunction);
    return "(" + injected + ")(" + toSourceLiteral(requestData || {}) + ");";
}

function sendToInDesign(placementSession) {
    // InDesign側で実行する関数（InDesignコンテキスト）
    var inDesignFunction = function(request) {
            /*__INJECT_TO_NFC_JA__*/
            var placement = request && request.placement ? request.placement : {};

            if (app.documents.length === 0) {
                return toSourceLiteral({
                    status: "error",
                    message: remoteText("ドキュメントが開かれていません。", "No document is open.")
                });
            }

            var selectedPlacement = null;
            try {
                selectedPlacement = resolveSelectedPlacement(placement);
            } catch (placementError) {
                return toSourceLiteral(buildErrorResponse(String(placementError)));
            }
            var targetDocument = selectedPlacement.document;
            var targetLink = selectedPlacement.link;

            // 環境復元のため退避
            var origUnit = app.scriptPreferences.measurementUnit;
            var origOrigin = targetDocument.viewPreferences.rulerOrigin;
            try {
                return toSourceLiteral(runCropSelection());
            } catch (e) {
                return toSourceLiteral(buildErrorResponse(remoteText("InDesign側エラー: ", "InDesign-side error: ") + e));
            } finally {
                // 環境復元
                try {
                    app.scriptPreferences.measurementUnit = origUnit;
                } catch (_) {}
                try {
                    targetDocument.viewPreferences.rulerOrigin = origOrigin;
                } catch (_) {}
            }

            function runCropSelection() {
                var measurementError = ensureInDesignMeasurementContext();
                if (measurementError) {
                    return buildErrorResponse(measurementError);
                }
                var selected = serializeCandidate(buildCandidate({
                    link: targetLink,
                    linkIndex: findCurrentLinkIndex(targetDocument, targetLink)
                }, 0));
                return {
                    status: "ok",
                    matchType: placement.matchType === "nameOnly" ? "nameOnly" : "exact",
                    hasFolderDifference: !!placement.hasFolderDifference,
                    hasExtensionDifference: !!placement.hasExtensionDifference,
                    matchCount: 1,
                    selectedIndex: 0,
                    selected: selected,
                    normalizedFrameBounds: selected.normalizedFrameBounds
                };
            }

            function ensureInDesignMeasurementContext() {
                app.scriptPreferences.measurementUnit = MeasurementUnits.MILLIMETERS;
                targetDocument.viewPreferences.rulerOrigin = RulerOrigin.SPREAD_ORIGIN;
                if (app.scriptPreferences.measurementUnit !== MeasurementUnits.MILLIMETERS) {
                    return remoteText("単位設定に失敗しました（MILLIMETERS 以外）", "Failed to set units (not MILLIMETERS)");
                }
                return "";
            }

            function getValidItemById(collection, id) {
                var numericId = Number(id);
                if (!isFinite(numericId)) return null;
                try {
                    var item = collection.itemByID(numericId);
                    return item && item.isValid !== false ? item : null;
                } catch (_itemByIdError) {
                    return null;
                }
            }

            function getDocumentPath(document) {
                try {
                    return String(document.fullName.fsName || document.fullName || "");
                } catch (_documentPathError) {
                    return "";
                }
            }

            function resolveSelectedPlacement(session) {
                var document = getValidItemById(app.documents, session.documentId);
                if (!document) {
                    throw new Error(remoteText(
                        "選択したInDesignドキュメントが開かれていません。",
                        "The selected InDesign document is no longer open."
                    ));
                }
                if (session.documentPath && _normPath(getDocumentPath(document)) !== _normPath(String(session.documentPath))) {
                    throw new Error(remoteText(
                        "選択したInDesignドキュメントが変更されています。",
                        "The selected InDesign document has changed."
                    ));
                }
                var link = getValidItemById(document.links, session.linkId);
                if (!link) {
                    throw new Error(remoteText(
                        "選択したリンクが見つかりません。",
                        "The selected link no longer exists."
                    ));
                }
                if (link.status !== LinkStatus.NORMAL) {
                    throw new Error(remoteText(
                        "選択したリンクが更新されていません。",
                        "The selected link is not up to date."
                    ));
                }
                if (session.rawFilePath && _normPath(String(link.filePath || "")) !== _normPath(String(session.rawFilePath))) {
                    throw new Error(remoteText(
                        "選択したリンク先が変更されています。",
                        "The selected link target has changed."
                    ));
                }
                var graphicItem = link.parent;
                if (session.itemId != null && Number(graphicItem.id) !== Number(session.itemId)) {
                    throw new Error(remoteText(
                        "選択した配置画像が変更されています。",
                        "The selected placed graphic has changed."
                    ));
                }
                var frameItem = getFrameContainer(graphicItem);
                if (session.frameId != null && Number(frameItem.id) !== Number(session.frameId)) {
                    throw new Error(remoteText(
                        "選択した配置フレームが変更されています。",
                        "The selected placement frame has changed."
                    ));
                }
                if (!session.geometryFingerprint ||
                        !placementGeometryMatches(session.geometryFingerprint, buildPlacementGeometryFingerprint(graphicItem, frameItem))) {
                    throw new Error(remoteText(
                        "選択した配置画像またはフレームの位置・変形が変更されています。",
                        "The selected graphic or frame geometry has changed."
                    ));
                }
                return {
                    document: document,
                    link: link,
                    graphicItem: graphicItem,
                    frameItem: frameItem
                };
            }

            function buildPlacementGeometryFingerprint(graphicItem, frameItem) {
                function buildQuad(item) {
                    return [
                        resolvePoint(item, AnchorPoint.TOP_LEFT_ANCHOR, CoordinateSpaces.SPREAD_COORDINATES),
                        resolvePoint(item, AnchorPoint.TOP_RIGHT_ANCHOR, CoordinateSpaces.SPREAD_COORDINATES),
                        resolvePoint(item, AnchorPoint.BOTTOM_RIGHT_ANCHOR, CoordinateSpaces.SPREAD_COORDINATES),
                        resolvePoint(item, AnchorPoint.BOTTOM_LEFT_ANCHOR, CoordinateSpaces.SPREAD_COORDINATES)
                    ];
                }
                return {
                    graphicQuad: buildQuad(graphicItem),
                    frameQuad: buildQuad(frameItem)
                };
            }

            function placementGeometryMatches(expected, actual) {
                function quadsMatch(expectedQuad, actualQuad) {
                    if (!expectedQuad || !actualQuad || expectedQuad.length !== 4 || actualQuad.length !== 4) return false;
                    for (var pointIndex = 0; pointIndex < 4; pointIndex++) {
                        if (!expectedQuad[pointIndex] || !actualQuad[pointIndex] ||
                                Math.abs(Number(expectedQuad[pointIndex][0]) - Number(actualQuad[pointIndex][0])) > 0.0001 ||
                                Math.abs(Number(expectedQuad[pointIndex][1]) - Number(actualQuad[pointIndex][1])) > 0.0001) {
                            return false;
                        }
                    }
                    return true;
                }
                return !!expected && !!actual &&
                    quadsMatch(expected.graphicQuad, actual.graphicQuad) &&
                    quadsMatch(expected.frameQuad, actual.frameQuad);
            }

            function findCurrentLinkIndex(document, link) {
                var targetId = Number(link.id);
                for (var linkIndex = 0; linkIndex < document.links.length; linkIndex++) {
                    try {
                        if (Number(document.links[linkIndex].id) === targetId) return linkIndex;
                    } catch (_linkIndexError) {}
                }
                return -1;
            }

            function buildErrorResponse(message) {
                return {
                    status: "error",
                    message: message
                };
            }

            // 基本ユーティリティ
            function getNumber(value) {
                var num = Number(value);
                return isNaN(num) ? 0 : num;
            }

            function buildCandidate(linkEntry, index) {
                var link = linkEntry.link;
                var item = link.parent;
                var parentItem = getFrameContainer(item);
                var geometry = buildCandidateGeometry(item, parentItem);

                return {
                    index: index,
                    linkIndex: linkEntry.linkIndex,
                    documentId: Number(targetDocument.id),
                    linkId: Number(link.id),
                    itemId: Number(item.id),
                    frameId: Number(parentItem.id),
                    normalizedFrameBounds: geometry.normalizedFrameBounds,
                    replacementData: geometry.replacementData
                };
            }

            function getFrameContainer(item) {
                try {
                    if (item.parent && hasGraphicsCollection(item.parent)) {
                        return item.parent;
                    }
                } catch (_frameContainerError) {}
                return item;
            }

            function hasGraphicsCollection(item) {
                try {
                    return item && item.allGraphics !== undefined;
                } catch (_graphicsError) {
                    return false;
                }
            }

            // 座標計算
            function buildCandidateGeometry(item, parentItem) {
                var imageGeometry = getRectangleGeometry(item);
                var frameGeometry = getFrameGeometry(parentItem);
                var framePoints = getRectangleQuad(parentItem);
                var localFrameBounds = getProjectedImageBounds(framePoints, imageGeometry);

                return {
                    normalizedFrameBounds: buildNormalizedFrameBounds(localFrameBounds, imageGeometry),
                    replacementData: buildReplacementData(localFrameBounds, imageGeometry, frameGeometry, item)
                };
            }

            function buildNormalizedFrameBounds(localFrameBounds, imageGeometry) {
                var imageWidth = Math.abs(getNumber(imageGeometry.width));
                var imageHeight = Math.abs(getNumber(imageGeometry.height));
                if (!imageWidth || !imageHeight) {
                    throw new Error(remoteText(
                        "配置画像の幅または高さを取得できません。",
                        "The placed image width or height could not be read."
                    ));
                }
                return {
                    minX: getNumber(localFrameBounds.minX) / imageWidth,
                    maxX: getNumber(localFrameBounds.maxX) / imageWidth,
                    minY: getNumber(localFrameBounds.minY) / imageHeight,
                    maxY: getNumber(localFrameBounds.maxY) / imageHeight
                };
            }

            function buildReplacementData(localFrameBounds, imageGeometry, frameGeometry, item) {
                // XMPには、Fitter側がそのまま使う最小限の配置情報だけを保存する。
                return {
                    version: REPLACEMENT_DATA_VERSION,
                    unit: REPLACEMENT_DATA_UNIT,
                    rotation: getNumber(item.rotationAngle),
                    mode1: buildReplacementMode(getExpandedLocalRect(localFrameBounds, imageGeometry), imageGeometry, frameGeometry),
                    mode2: buildReplacementMode(buildTrimmedLocalRect(localFrameBounds), imageGeometry, frameGeometry)
                };
            }

            function buildReplacementMode(localRect, imageGeometry, frameGeometry) {
                var topLeftInSpread = localPointToSpreadPoint(localRect.left, localRect.top, imageGeometry);
                var topLeftInFrame = projectPoint(topLeftInSpread, frameGeometry);
                return {
                    x: ptToMm(getNumber(topLeftInFrame[0])),
                    y: ptToMm(getNumber(topLeftInFrame[1])),
                    w: ptToMm(getNumber(localRect.right - localRect.left)),
                    h: ptToMm(getNumber(localRect.bottom - localRect.top))
                };
            }

            function buildTrimmedLocalRect(localFrameBounds) {
                return {
                    left: localFrameBounds.minX,
                    top: localFrameBounds.minY,
                    right: localFrameBounds.maxX,
                    bottom: localFrameBounds.maxY
                };
            }

            function getRectangleGeometry(item) {
                var pointSet = collectRectanglePointSet(item);
                var corners = getImageCornerPoints(pointSet.spreadPoints, pointSet.pointIndexMap);
                return buildGeometryFromCornerPoints(corners);
            }

            function buildGeometryFromCornerPoints(corners) {
                var imageAxes = buildImageAxes(corners.topLeft, corners.topRight, corners.bottomLeft);
                return {
                    topLeftSpread: corners.topLeft,
                    axisX: imageAxes.axisX,
                    axisY: imageAxes.axisY,
                    width: imageAxes.width,
                    height: imageAxes.height
                };
            }

            function getExpandedLocalRect(localFrameBounds, imageGeometry) {
                return {
                    left: Math.min(0, localFrameBounds.minX),
                    top: Math.min(0, localFrameBounds.minY),
                    right: Math.max(imageGeometry.width, localFrameBounds.maxX),
                    bottom: Math.max(imageGeometry.height, localFrameBounds.maxY)
                };
            }

            function localPointToSpreadPoint(localX, localY, imageGeometry) {
                return [
                    imageGeometry.topLeftSpread[0] + imageGeometry.axisX[0] * localX + imageGeometry.axisY[0] * localY,
                    imageGeometry.topLeftSpread[1] + imageGeometry.axisX[1] * localX + imageGeometry.axisY[1] * localY
                ];
            }

            function getImageCornerPoints(spreadPoints, pointIndexMap) {
                return {
                    topLeft: spreadPoints[pointIndexMap.topLeft],
                    topRight: spreadPoints[pointIndexMap.topRight],
                    bottomLeft: spreadPoints[pointIndexMap.bottomLeft]
                };
            }

            function buildImageAxes(topLeftSpread, topRightSpread, bottomLeftSpread) {
                var horizontalVector = subtractPoints(topRightSpread, topLeftSpread);
                var verticalVector = subtractPoints(bottomLeftSpread, topLeftSpread);

                return {
                    axisX: normalizeVector(horizontalVector),
                    axisY: normalizeVector(verticalVector),
                    width: vectorLength(horizontalVector),
                    height: vectorLength(verticalVector)
                };
            }

            function getRectangleQuad(item) {
                var pointSet = collectRectanglePointSet(item);
                return reorderRectanglePoints(pointSet.spreadPoints, pointSet.pointIndexMap);
            }

            function getFrameGeometry(parentItem) {
                return buildGeometryFromQuadPoints(getRectangleQuad(parentItem));
            }

            function toNumberPoint(value) {
                if (value instanceof Array) {
                    if (value.length === 2 && !(value[0] instanceof Array)) {
                        return [getNumber(value[0]), getNumber(value[1])];
                    }
                    if (value.length > 0) {
                        return toNumberPoint(value[0]);
                    }
                }
                return [0, 0];
            }

            function getRectanglePoints(item, coordinateSpace) {
                var anchors = [
                    AnchorPoint.TOP_LEFT_ANCHOR,
                    AnchorPoint.TOP_RIGHT_ANCHOR,
                    AnchorPoint.BOTTOM_RIGHT_ANCHOR,
                    AnchorPoint.BOTTOM_LEFT_ANCHOR
                ];
                var points = [];
                for (var idx = 0; idx < anchors.length; idx++) {
                    points.push(resolvePoint(item, anchors[idx], coordinateSpace));
                }
                return points;
            }

            function collectRectanglePointSet(item) {
                var localPoints = getRectanglePoints(item, CoordinateSpaces.INNER_COORDINATES);
                return {
                    localPoints: localPoints,
                    spreadPoints: getRectanglePoints(item, CoordinateSpaces.SPREAD_COORDINATES),
                    pointIndexMap: findRectanglePointIndices(localPoints)
                };
            }

            function reorderRectanglePoints(points, pointIndexMap) {
                var ordered = [];
                var used = {};
                ordered.push(points[pointIndexMap.topLeft]);
                used[pointIndexMap.topLeft] = true;
                ordered.push(points[pointIndexMap.topRight]);
                used[pointIndexMap.topRight] = true;
                var bottomRightIndex = findRemainingPointIndex(points, used);
                ordered.push(points[bottomRightIndex]);
                ordered.push(points[pointIndexMap.bottomLeft]);
                return ordered;
            }

            function findRemainingPointIndex(points, used) {
                for (var idx = 0; idx < points.length; idx++) {
                    if (!used[idx]) {
                        return idx;
                    }
                }
                return 2;
            }

            function resolvePoint(item, location, coordinateSpace) {
                try {
                    return toNumberPoint(item.resolve(location, coordinateSpace));
                } catch (_resolveError) {
                    return [0, 0];
                }
            }

            function findRectanglePointIndices(points) {
                var result = {
                    topLeft: 0,
                    topRight: 1,
                    bottomLeft: 3
                };
                if (!points || points.length < 4) {
                    return result;
                }

                var bestTopLeft = 0;
                var bestTopRight = 0;
                var bestBottomLeft = 0;
                var bestTopLeftScore = null;
                var bestTopRightScore = null;
                var bestBottomLeftScore = null;

                for (var idx = 0; idx < points.length; idx++) {
                    var point = points[idx];
                    var topLeftScore = point[0] + point[1];
                    var topRightScore = point[0] - point[1];
                    var bottomLeftScore = point[1] - point[0];

                    if (bestTopLeftScore === null || topLeftScore < bestTopLeftScore) {
                        bestTopLeftScore = topLeftScore;
                        bestTopLeft = idx;
                    }
                    if (bestTopRightScore === null || topRightScore > bestTopRightScore) {
                        bestTopRightScore = topRightScore;
                        bestTopRight = idx;
                    }
                    if (bestBottomLeftScore === null || bottomLeftScore > bestBottomLeftScore) {
                        bestBottomLeftScore = bottomLeftScore;
                        bestBottomLeft = idx;
                    }
                }

                result.topLeft = bestTopLeft;
                result.topRight = bestTopRight;
                result.bottomLeft = bestBottomLeft;
                return result;
            }

            function getProjectedImageBounds(points, imageGeometry) {
                return getProjectedBounds(projectPoints(points, imageGeometry));
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
                var delta = subtractPoints(point, geometry.topLeftSpread);
                var determinant = geometry.axisX[0] * geometry.axisY[1] -
                    geometry.axisX[1] * geometry.axisY[0];
                if (Math.abs(determinant) < 0.0000000001) {
                    throw new Error(remoteText(
                        "配置画像の変形行列を逆変換できません。",
                        "The placed image transform cannot be inverted."
                    ));
                }
                return [
                    (delta[0] * geometry.axisY[1] - delta[1] * geometry.axisY[0]) / determinant,
                    (geometry.axisX[0] * delta[1] - geometry.axisX[1] * delta[0]) / determinant
                ];
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

            function buildGeometryFromQuad(topLeftSpread, topRightSpread, bottomLeftSpread) {
                var horizontalVector = subtractPoints(topRightSpread, topLeftSpread);
                var verticalVector = subtractPoints(bottomLeftSpread, topLeftSpread);
                return {
                    topLeftSpread: topLeftSpread,
                    axisX: normalizeVector(horizontalVector),
                    axisY: normalizeVector(verticalVector),
                    width: vectorLength(horizontalVector),
                    height: vectorLength(verticalVector)
                };
            }

            function buildGeometryFromQuadPoints(quadPoints) {
                return buildGeometryFromQuad(quadPoints[0], quadPoints[1], quadPoints[3]);
            }

            function ptToMm(value) {
                return getNumber(value) * 25.4 / 72;
            }


            function serializeCandidate(candidate) {
                return {
                    index: candidate.index,
                    linkIndex: candidate.linkIndex,
                    documentId: candidate.documentId,
                    linkId: candidate.linkId,
                    itemId: candidate.itemId,
                    frameId: candidate.frameId,
                    normalizedFrameBounds: candidate.normalizedFrameBounds,
                    replacementData: candidate.replacementData
                };
            }
        };

    var bridgeTarget = placementSession && placementSession.bridgeTarget
        ? String(placementSession.bridgeTarget)
        : "";
    if (!bridgeTarget) {
        return {
            ok: false,
            error: localText("対象のInDesignを確認できません。", "The target InDesign application could not be verified.")
        };
    }
    try {
        if (BridgeTalk.isRunning(bridgeTarget) !== true) {
            return {
                ok: false,
                error: localText("対象のInDesignが終了しています。", "The target InDesign application is no longer running.")
            };
        }
    } catch (runningError) {
        return { ok: false, error: String(runningError) };
    }
    return sendBridgeTalkAndWait(bridgeTarget, buildBridgeTalkBody(inDesignFunction, placementSession), 300000);
}

function buildBridgeTalkBody(inDesignFunction, placementSession) {
    return buildBridgeTalkInvocationBody(inDesignFunction, {
        placement: placementSession || {}
    });
}

function buildInjectedInDesignFunctionSource(inDesignFunction) {
    return inDesignFunction.toString().replace(
        "/*__INJECT_TO_NFC_JA__*/",
        "var toNFCJa = " + NFC_HELPER_SRC + ";\n" +
        "var toSourceLiteral = " + TO_SOURCE_LITERAL_SRC + ";\n" +
        "var remoteLocaleCode = " + toSourceLiteral(currentLocaleCode()) + ";\n" +
        "function remoteText(jaText, enText) { return remoteLocaleCode === \"en\" ? enText : jaText; }\n" +
        "var _normPath = " + NORM_HELPER_SRC_ID + ";\n" +
        "var REPLACEMENT_DATA_VERSION = " + REPLACEMENT_DATA_VERSION + ";\n" +
        "var REPLACEMENT_DATA_UNIT = " + toSourceLiteral(REPLACEMENT_DATA_UNIT) + ";"
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

function prepare(doc, placementSession) {
    if (!doc) {
        alert(localText("処理対象のPhotoshopドキュメントを確認できません。", "The target Photoshop document could not be verified."));
        return null;
    }
    var responseObject = requestCropDataFromInDesign(placementSession);
    if (!responseObject) {
        alert(localText("InDesign応答の解析に失敗しました。", "Failed to parse the InDesign response."));
        return null;
    }

    if (!handleInDesignResponse(responseObject)) {
        return null;
    }

    return responseObject;
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
            "配置フレームに合わせたトリミング範囲を作成できません。",
            "A valid crop area matching the placed frame could not be created."
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
            "InDesignの配置フレーム情報をピクセル座標へ変換できませんでした。",
            "The InDesign placement geometry could not be converted to pixel coordinates."
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
    prepare: prepare,
    applyMode: applyMode,
    preflightMetadata: preflightMetadata,
    restoreMetadata: restoreMetadata,
    writeMetadata: writeMetadata
};
}


// 実行開始
main();
