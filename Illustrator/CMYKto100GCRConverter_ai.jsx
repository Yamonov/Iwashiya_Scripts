#target illustrator

/*
SCRIPTMETA-BEGIN
Script-ID=org.iwashi.CMYKto100GCRConverter_ai
Version=2.2.1
Meta-URL=https://github.com/Yamonov/Iwashiya_Scripts/tree/main/Illustrator
Name=色を変えずにCMYK値を調整
Author=Murakami Yoshiteru
Release-Date=2026-07-09
Target-App=Illustrator
Edit-Password-SHA256=oS5aCLoTCKedGLZN:3d8282cb048f8c02d5bf1dca0493471b70fda75c2a3131e4cb0c10b4c1688127
Description-BEGIN
・選択したCMYKオブジェクトのカラーを、発色を維持しつつ、印刷でのブレが少ないカラー、CMYのうち１〜２版（＋K）の値に整理します。
・彩度調整オプションで、仕上がりの彩度を上げられます。
・K量の調整オプションで、Kを減らす方向または増やす方向へ段階的に寄せられます。増やすとより多くのグレートーンがKのみに、減らすとCMYからKを抜いてK濁りを抑えます。
・グローバルスウォッチ、グラデーションにも対応しています。

■注意！
・アピアランスで塗ったテキストはアピアランス分割してください。
・複雑なパスのクリッピング内オブジェクトは取りこぼすことがあります。
※ 分版プレビューでKをオフにしてから実行すると、効果と処理が抜けた箇所が分かりやすくなります。
・グラデーションメッシュとブレンドオブジェクトは非対応です。
Description-END
SCRIPTMETA-END
*/

// SCRIPTMETAから表示用バージョンを作る
function readSelfHeaderMeta() {
    var f = new File($.fileName);
    f.encoding = "BINARY";
    if (!f.open("r")) {
        throw new Error("Cannot open self file: " + $.fileName);
    }
    var s = f.read(500);
    f.close();
    s = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    return {
        version: (s.match(/^Version=([^\n]+)(?:\n|$)/m) || [])[1] || "",
        releaseDate: (s.match(/^Release-Date=([^\n]+)(?:\n|$)/m) || [])[1] || ""
    };
}

function formatScriptVersion(meta) {
    if (!meta.version && !meta.releaseDate) return "";
    if (!meta.version) return "(" + meta.releaseDate + ")";
    if (!meta.releaseDate) return "Ver " + meta.version;
    return "Ver " + meta.version + " (" + meta.releaseDate + ")";
}

function formatScriptVersionOnly(meta) {
    return meta.version ? "Ver " + meta.version : "";
}

var YamoScriptMeta = readSelfHeaderMeta();
var YamoScriptVersion = formatScriptVersion(YamoScriptMeta);
var YamoScriptVersionOnly = formatScriptVersionOnly(YamoScriptMeta);
//var YAMO_LOCALE_OVERRIDE = "en"; // テスト時のみ "ja" または "en" を指定

var UI_TEXT = {
    progressTitle: { ja: "CMYK値を整理中...", en: "Adjusting CMYK..." },
    progressCancelTitleSuffix: { ja: "（Escでキャンセル）", en: "(Esc to cancel)" },
    scanningSelection: { ja: "対象を調査中...", en: "Checking selection..." },
    scanCancelHelp: { ja: "Escでキャンセル", en: "Press Esc to cancel" },
    optionsTitle: { ja: "変換オプション", en: "Conversion Options" },
    titleSeparator: { ja: "　｜　", en: " | " },
    targetCount: { ja: "対象数: {count}", en: "Targets: {count}" },
    unsupportedCount: { ja: "（未対応{count}）", en: " (unsupported {count})" },
    targetCountHelp: {
        ja: "対象数は、処理対象と未対応オブジェクトの合計です。未対応例: グラデーションメッシュ、ラスタ画像/配置画像、シンボル、グラフ、プラグイン・特殊オブジェクト（ブレンド等）など。",
        en: "Targets include processable and unsupported objects. Unsupported examples: gradient meshes, raster/placed images, symbols, graphs, and plugin/special objects (such as blends)."
    },
    info: { ja: "情報", en: "Info" },
    optionGroup: { ja: "オプション", en: "Options" },
    estimateTime: { ja: "予測時間", en: "Estimated time" },
    estimateHelp: {
        ja: "使用色数とキャッシュ利用数で変わるため、目安です。キャッシュ利用率20%程度で計算しています。",
        en: "This is only a guide. It varies by color count and cache usage, assuming about 20% cache use."
    },
    saturationBoost: { ja: "彩度補正", en: "Saturation boost" },
    saturationBoostHelp: {
        ja: "色相を保ったままLabのa*とb*を拡大し、彩度を上げます。",
        en: "Increases saturation by expanding Lab a* and b* while preserving hue."
    },
    saturationAmount: { ja: "彩度", en: "Amount" },
    saturationAmountHelp: { ja: "彩度を上げる割合です。", en: "Saturation increase amount." },
    cmyKBalance: { ja: "CMY/Kバランスを調整", en: "Adjust CMY/K balance" },
    cmyKBalanceHelp: {
        ja: "K量をスライダで調整します。左はKを減らしてCMYで補完し、右はCMYを減らしてKで補完します。中央から動かすほど許容色差が大きくなり、暗い色ではL値に応じて最大2倍まで広がります。",
        en: "Adjusts the K amount with the slider. Left reduces K and compensates with CMY; right reduces CMY and compensates with K. Moving away from center allows more color difference, expanding up to 2x for darker colors based on L*."
    },
    allowedColorDifference: { ja: "最大許容色差（⊿E76）", en: "Max allowed color difference (Delta E 76)" },
    allowedColorDifferenceHelp: {
        ja: "上の数値はスライダ位置ごとの基準値です。明るい色ではその値を使い、暗い色ではL値に応じて最大2倍まで広げます。",
        en: "The values above are the base limits for each slider position. Bright colors use the shown value, and darker colors expand it up to 2x based on L*."
    },
    kBoost: { ja: "Kブースト", en: "K boost" },
    kBoostHelp: {
        ja: "K+最大時だけ有効です。KのみでL値に近い明度へ変換し、a*/b*の差は暗い色ほど大きく許容します。L=100では10、L=0に近づくほど制限なしになります。",
        en: "Available only at maximum K+. Converts colors to K only by matching L*. The allowed a*/b* difference grows as colors get darker: 10 at L*=100 and unlimited near L*=0."
    },
    protectLightColors: { ja: "薄い色を保護", en: "Protect light colors" },
    protectLightColorsHelp: {
        ja: "K+側で有効です。明るく色味のある薄い色で、CMYが減ってもKが十分増えない場合は、CMYを消す変換を採用しません。",
        en: "Available on the K+ side. For light colors with visible chroma, rejects conversions that remove CMY without adding enough K."
    },
    cmyKBalanceSliderHelp: {
        ja: "中央は変更なしです。K-側はKを減らしてCMYで補完し、K+側はCMYを減らしてKで補完します。中央から動かすほど許容色差が大きくなり、暗い色ではL値に応じて最大2倍まで広がります。",
        en: "Center leaves the result unchanged. K- reduces K and compensates with CMY; K+ reduces CMY and compensates with K. Moving away from center allows more color difference, expanding up to 2x for darker colors based on L*."
    },
    cancel: { ja: "キャンセル", en: "Cancel" },
    requireCMYK: { ja: "CMYKドキュメントで実行してください", en: "Run this script in a CMYK document." },
    requireSelection: { ja: "選択してから実行してください", en: "Select objects before running this script." },
    completionTitle: { ja: "変換処理が完了しました", en: "Conversion complete" },
    selectedObjects: { ja: "選択オブジェクト数", en: "Selected objects" },
    selectedObjectsUnit: { ja: "件", en: "objects" },
    updatedColors: { ja: "変更色数", en: "Updated colors" },
    processingTime: { ja: "処理時間", en: "Processing time" },
    cacheHitRate: { ja: "キャッシュヒット率", en: "Cache hit rate" },
    skippedCount: { ja: "未適用件数", en: "Skipped items" },
    skippedCountUnit: { ja: "件", en: "items" },
    selectSkippedObjects: { ja: "未適用オブジェクトを選択する", en: "Select unapplied objects" },
    selectSkippedObjectsHelp: {
        ja: "処理できなかったオブジェクトや未対応オブジェクトを、完了後に選択します。未適用オブジェクトがない場合は選択を解除します。",
        en: "After conversion, selects objects that could not be processed or are unsupported. If there are no unapplied objects, the selection is cleared."
    },
    skippedObjectsSelected: {
        ja: "未適用オブジェクトを選択しました。分割・拡張が可能なオブジェクトは処理してから、再度実行してください。",
        en: "Unapplied objects were selected. For objects that can be divided or expanded, process them first and run the script again."
    },
    secondsUnit: { ja: "秒", en: "sec" },
    timeSeconds: { ja: "約{sec}秒", en: "about {sec} sec" },
    timeMinutes: { ja: "約{min}分", en: "about {min} min" },
    timeMinutesSeconds: { ja: "約{min}分{sec}秒", en: "about {min} min {sec} sec" },
    timeHours: { ja: "約{hour}時間", en: "about {hour} hr" },
    timeHoursMinutes: { ja: "約{hour}時間{min}分", en: "about {hour} hr {min} min" },
    undefinedCMYKPattern: { ja: "未定義のCMYKパターンです: ", en: "Undefined CMYK pattern: " }
};

function currentLocaleCode() {
    var raw = (typeof YAMO_LOCALE_OVERRIDE !== "undefined" ? YAMO_LOCALE_OVERRIDE : "") || $.locale || "";
    raw = String(raw).toLowerCase();
    if (!raw) return "ja";
    return raw.indexOf("ja") === 0 ? "ja" : "en";
}

function uiText(key) {
    var entry = UI_TEXT[key];
    if (!entry) return key;
    var locale = currentLocaleCode();
    return entry[locale] || entry.ja || entry.en || key;
}

function uiFormat(key, values) {
    var s = uiText(key);
    for (var name in values) {
        s = s.replace(new RegExp("\\{" + name + "\\}", "g"), values[name]);
    }
    return s;
}

function saturationBoostDropdownItems() {
    var suffix = currentLocaleCode() === "ja" ? "上げ" : " UP";
    return ['10%' + suffix, '20%' + suffix, '30%' + suffix];
}

//-----------------------------------------------------
// 最小二乗補正
var LS_JACOBIAN_STEP = 1.0; // 数値ヤコビアンの微小ステップ（%）
var LS_LAMBDA = 0.1; // 最小二乗の正則化
var LS_PIVOT_EPS = 1e-12; // 最小二乗の特異判定
var CMY_K_BALANCE_CHANGE_EPS = 0.01; // バランス補正後に再計算する最小変化量

// 直接探索
var DIRECT_REFINE_STEPS = [20, 10, 5, 2, 1];
var DIRECT_CLOSE_REFINE_STEPS = [5, 2, 1];
var DIRECT_CLOSE_INITIAL_SCORE_MAX = 3.0;
var DIRECT_REFINE_PASSES_PER_STEP = 2;
var DIRECT_INTEGER_REFINE_PASSES = 2;
var DIRECT_GRAY_CHROMA_SCALE = 8.0;
var DIRECT_K_DARK_CURVE = 4.5;
var DIRECT_GRAY_CAST_WEIGHT = 0.85;
var DIRECT_NONK_WEIGHT = 24.0;
var DIRECT_UNDER_LIGHTNESS_WEIGHT = 0.35;
var DIRECT_K_ONLY_DARK_L_MAX = 35;
var DIRECT_K_ONLY_DARK_CHROMA_MAX = 8.0;
var DIRECT_K_ONLY_DARK_BASE_DE = 1.5;
var DIRECT_K_ONLY_DARK_CURVE_DE = 8.0;
var DIRECT_K_ONLY_DARK_BASE_EXTRA_DE = 0.8;
var DIRECT_K_ONLY_DARK_CURVE_EXTRA_DE = 8.0;

// キャッシュ精度
var CACHE_KEY_DECIMALS = 1; // CMYKキャッシュキーの丸め桁数
var CACHE_KEY_SCALE = Math.pow(10, CACHE_KEY_DECIMALS);
var CACHE_KEY_MAX = 100 * CACHE_KEY_SCALE;
var CACHE_KEY_BASE = CACHE_KEY_MAX + 1;
var LAB_CACHE_MAX_ENTRIES = 125; // Lab変換キャッシュの件数上限

// 最終丸め
var ZERO_THR = 3; // ≤ ZERO_THR → 0

// CMY/Kバランスオプション（後処理）
var DEFAULT_CMY_K_BALANCE_ENABLED = false;
var DEFAULT_CMY_K_BALANCE_VALUE = 0;
var CMY_K_BALANCE_CURVE = 2.4;
var CMY_K_BALANCE_DE_BASE = 1.5;
var CMY_K_BALANCE_DE_RANGE = 8.5;
var CMY_K_BALANCE_REFINE_PASSES = 4;
var CMY_K_BALANCE_K_REDUCTION_FACTORS = [1.0, 0.75, 0.5, 0.33, 0.2, 0.1, 0.05];
var DEFAULT_K_BOOST_ENABLED = false;
var K_BOOST_AB_DELTA_AT_L100 = 10.0;
var K_BOOST_BALANCE_VALUE = 100;
var DEFAULT_LIGHT_COLOR_PROTECT_ENABLED = false;
var LIGHT_COLOR_PROTECT_L_MIN = 80;
var LIGHT_COLOR_PROTECT_CHROMA_MIN = 2.0;
var LIGHT_COLOR_PROTECT_CMY_REMOVED_MIN = 1.0;
var LIGHT_COLOR_PROTECT_K_REPLACEMENT_RATIO_MAX = 0.15;
var DEFAULT_SATURATION_BOOST_ENABLED = false;
var DEFAULT_SATURATION_BOOST_PCT = 5;
var ESTIMATE_FIXED_SECONDS = 3.2;
var ESTIMATE_UNCACHED_SECONDS_PER_COLOR = 0.0035;
var ESTIMATE_CACHED_SECONDS_PER_COLOR = 0.00021;
var ESTIMATE_ASSUMED_CACHE_RATE = 0.2;
var SATURATION_BOOST_FULL_CHROMA = 20; // C*ab がこの値以上なら指定どおりの彩度補正
var CMY_K_BALANCE_ENABLED = DEFAULT_CMY_K_BALANCE_ENABLED; // ScriptUIで「CMYとKのバランス」がオンのときに有効化
var CMY_K_BALANCE_VALUE = DEFAULT_CMY_K_BALANCE_VALUE; // -100..100、負はCMY寄り、正はK寄り
var K_BOOST_ENABLED = DEFAULT_K_BOOST_ENABLED; // K+最大時、低彩度色をKのみで明度合わせする
var LIGHT_COLOR_PROTECT_ENABLED = DEFAULT_LIGHT_COLOR_PROTECT_ENABLED; // K+側で薄い有彩色のCMY消失を抑える
var SATURATION_BOOST_ENABLED = DEFAULT_SATURATION_BOOST_ENABLED; // ScriptUIで「彩度補正」がオンのときに有効化
var SATURATION_BOOST_PCT = DEFAULT_SATURATION_BOOST_PCT; // a*, b* をこの割合だけ拡大

var CMYK_CHANNELS = ['c', 'm', 'y', 'k'];
var DIRECT_PATTERN_INFO = {
    K: { pattern: 'K', channelIds: [3], useC: false, useM: false, useY: false, removedCode: 0 },
    CM: { pattern: 'CM', channelIds: [0, 1, 3], useC: true, useM: true, useY: false, removedCode: 3 },
    MY: { pattern: 'MY', channelIds: [1, 2, 3], useC: false, useM: true, useY: true, removedCode: 1 },
    YC: { pattern: 'YC', channelIds: [2, 0, 3], useC: true, useM: false, useY: true, removedCode: 2 }
};
var DIRECT_ACTIVE_PATTERN_INFOS = [
    DIRECT_PATTERN_INFO.K,
    DIRECT_PATTERN_INFO.CM,
    DIRECT_PATTERN_INFO.MY,
    DIRECT_PATTERN_INFO.YC
];
var K_ONLY_SEED = { c: 0, m: 0, y: 0, k: 50 };

// 進行状況バー（ScriptUI）: 幅400px、分母は動的に+10%
var gProgress = null;
var gSkipCount = 0;
var gSkippedItems = [];
var gSkipBreakdown = [];
var USER_CANCELLED_ERROR_NAME = "YamoUserCancelled";
var SCAN_STATUS_CHECK_EVERY = 50;
var PROGRESS_STATUS_CHECK_EVERY = 100;
var PROGRESS_CANCEL_CHECK_EVERY_UPDATES = 10;
var COMPLETION_METRIC_LEFT_MIN_WIDTH = 190;
var COMPLETION_METRIC_RIGHT_MIN_WIDTH = 150;
var COMPLETION_SKIPPED_PANEL_MIN_WIDTH = 340;
var COMPLETION_TEXT_PADDING_WIDTH = 34;
var COMPLETION_TEXT_LINE_HEIGHT = 17;
var COMPLETION_TEXT_HEIGHT_PADDING = 6;
var UNSUPPORTED_OBJECT_TYPE_LABELS = {
    MeshItem: { ja: "グラデーションメッシュ", en: "Gradient mesh" },
    RasterItem: { ja: "ラスタ画像", en: "Raster image" },
    PlacedItem: { ja: "配置画像", en: "Placed image" },
    SymbolItem: { ja: "シンボル", en: "Symbol" },
    GraphItem: { ja: "グラフ", en: "Graph" },
    PluginItem: { ja: "プラグイン・特殊オブジェクト（ブレンド等）", en: "Plugin/special object (such as blends)" },
    NonNativeItem: { ja: "非ネイティブオブジェクト", en: "Non-native object" },
    LegacyTextItem: { ja: "旧テキスト", en: "Legacy text" },
    GroupItem: { ja: "グループ（内部取得不可）", en: "Group (contents unavailable)" },
    CompoundPathItem: { ja: "複合パス（内部取得不可）", en: "Compound path (contents unavailable)" }
};
var SKIP_REASON_LABELS = {
    patternColor: { ja: "パターン等", en: "Patterns, etc." },
    nonCMYK: { ja: "非CMYKカラー", en: "Non-CMYK color" },
    noCandidate: { ja: "許容色差内の変換候補なし", en: "No candidate within allowed difference" },
    spotWriteFailed: { ja: "スポットカラー更新不可", en: "Spot color update failed" },
    colorReadFailed: { ja: "カラー取得不可", en: "Color read failed" },
    textAttributesReadFailed: { ja: "テキスト属性取得不可", en: "Text attributes unavailable" },
    gradientStopFailed: { ja: "グラデーション停止色取得不可", en: "Gradient stop color failed" },
    fillStateReadFailed: { ja: "塗り情報取得不可", en: "Fill state unavailable" },
    strokeStateReadFailed: { ja: "線情報取得不可", en: "Stroke state unavailable" },
    unknown: { ja: "処理不可", en: "Unprocessable" }
};

function localizedLabel(entry) {
    if (!entry) return "";
    var locale = currentLocaleCode();
    return entry[locale] || entry.ja || entry.en || "";
}

function itemTypeName(item) {
    try {
        if (item && item.typename) return String(item.typename);
    } catch (e) { }
    return "Unknown";
}

function unsupportedObjectTypeLabel(typeName) {
    var label = localizedLabel(UNSUPPORTED_OBJECT_TYPE_LABELS[typeName]);
    if (label) return label;
    return currentLocaleCode() === "ja" ? "未対応オブジェクト（" + typeName + "）" : "Unsupported object (" + typeName + ")";
}

function skipReasonLabel(reason) {
    return localizedLabel(SKIP_REASON_LABELS[reason]) || localizedLabel(SKIP_REASON_LABELS.unknown);
}

function addSkipBreakdownEntry(entries, key, label, count) {
    if (!entries) return;
    count = count || 1;
    for (var i = 0, n = entries.length; i < n; i++) {
        if (entries[i].key === key) {
            entries[i].count += count;
            return;
        }
    }
    entries.push({
        key: key,
        label: label,
        count: count
    });
}

function addSkipBreakdownEntries(target, source) {
    if (!target || !source) return target;
    for (var i = 0, n = source.length; i < n; i++) {
        addSkipBreakdownEntry(target, source[i].key, source[i].label, source[i].count);
    }
    return target;
}

function addUnsupportedBreakdownEntry(entries, item) {
    var typeName = itemTypeName(item);
    addSkipBreakdownEntry(entries, "unsupported:" + typeName, unsupportedObjectTypeLabel(typeName), 1);
}

function resetSkipCount() {
    gSkipCount = 0;
    gSkippedItems = [];
    gSkipBreakdown = [];
}

function markSkippedItem(item) {
    if (!item) return;
    for (var i = 0, n = gSkippedItems.length; i < n; i++) {
        if (gSkippedItems[i] === item) return;
    }
    gSkippedItems.push(item);
}

function countSkip(item, reason) {
    gSkipCount++;
    markSkippedItem(item);
    reason = reason || "unknown";
    addSkipBreakdownEntry(gSkipBreakdown, "process:" + reason, skipReasonLabel(reason), 1);
}

function addUniqueItem(items, item) {
    if (!item) return;
    for (var i = 0, n = items.length; i < n; i++) {
        if (items[i] === item) return;
    }
    items.push(item);
}

function addUniqueItems(items, sourceItems) {
    if (!sourceItems) return items;
    for (var i = 0, n = sourceItems.length; i < n; i++) {
        addUniqueItem(items, sourceItems[i]);
    }
    return items;
}

function clearSelection(doc) {
    try {
        doc.selection = null;
    } catch (e) { }
    try {
        app.selection = null;
    } catch (e2) { }
    try {
        app.executeMenuCommand('deselectall');
    } catch (e3) { }
}

function selectItems(doc, items) {
    var selected = 0;
    clearSelection(doc);

    for (var i = 0, n = items ? items.length : 0; i < n; i++) {
        try {
            items[i].selected = true;
            selected++;
        } catch (e2) { }
    }
    return selected;
}

function isEscapeKeyName(keyName) {
    if (!keyName && keyName !== 0) return false;
    keyName = String(keyName).toLowerCase();
    return keyName === 'escape' || keyName === 'esc' || keyName === 'u+001b' || keyName === '27';
}

function attachEscapeCancelHandler(win, requestCancel) {
    try {
        win.addEventListener('keydown', function (ev) {
            if (ev && isEscapeKeyName(ev.keyName || ev.keyIdentifier || ev.key || ev.keyCode || ev.which)) {
                requestCancel();
                try {
                    ev.preventDefault();
                } catch (e) { }
            }
        });
    } catch (e2) { }
}

function isEscapePressed() {
    try {
        var ks = ScriptUI.environment.keyboardState;
        return !!(ks && isEscapeKeyName(ks.keyName || ks.keyIdentifier || ks.key || ks.keyCode || ks.which));
    } catch (e) {
        return false;
    }
}

function makeUserCancelledError() {
    var e = new Error("User cancelled");
    e.name = USER_CANCELLED_ERROR_NAME;
    return e;
}

function isUserCancelledError(e) {
    return e && e.name === USER_CANCELLED_ERROR_NAME;
}

function createProgressBar(initialMax) {
    var cancelled = false;
    var win = new Window('palette', uiText('progressTitle') + ' ' + uiText('progressCancelTitleSuffix'), undefined, {
        closeButton: false
    });
    var bar = win.add('progressbar', undefined, 0, Math.max(1, initialMax | 0));
    bar.preferredSize = [400, 20];
    function requestCancel() {
        cancelled = true;
    }
    attachEscapeCancelHandler(win, requestCancel);
    win.onClose = function () {
        requestCancel();
        return true;
    };
    win.layout.layout(true);
    win.center();
    win.show();
    try {
        win.update();
    } catch (e2) { }
    var state = {
        win: win,
        bar: bar,
        value: 0,
        max: Math.max(1, initialMax | 0),
        updateEvery: PROGRESS_STATUS_CHECK_EVERY,
        updateCount: 0
    };
    return {
        step: function (n) {
            if (!n) n = 1;
            state.value += n;
            var forceUpdate = false;
            if (state.value > state.max) { // 分母を10%増やす
                state.max = Math.ceil(state.max * 1.10);
                state.bar.maxvalue = state.max;
                forceUpdate = true;
            }
            var shouldUpdate = (forceUpdate || state.value >= state.max || (state.value % state.updateEvery) === 0);
            if (shouldUpdate) {
                state.bar.value = Math.min(state.value, state.max);
                state.updateCount++;
                var shouldCheckCancel = (state.updateCount % PROGRESS_CANCEL_CHECK_EVERY_UPDATES) === 0;
                try {
                    state.win.update();
                } catch (e) { }
                if (shouldCheckCancel && isEscapePressed()) requestCancel();
                if (shouldCheckCancel && cancelled) throw makeUserCancelledError();
            }
        },
        close: function () {
            try {
                state.win.onClose = null;
            } catch (e) { }
            try {
                state.win.close();
            } catch (e) { }
        }
    };
}

function createStatusWindow(message, width, helpText) {
    var frames = ['●○○', '○●○', '○○●', '○●○'];
    var frameIndex = 0;
    var tickCount = 0;
    var updateEvery = SCAN_STATUS_CHECK_EVERY;
    var updateIntervalMs = 300;
    var lastUpdateMs = nowMs();
    var cancelled = false;
    var win = new Window('palette', '', undefined, {
        closeButton: false,
        borderless: true
    });
    win.alignChildren = 'center';
    var label = win.add('statictext', undefined, message + ' ' + frames[frameIndex]);
    label.preferredSize = [width || 200, 22];
    try {
        label.justify = 'center';
    } catch (e) { }
    if (helpText) {
        var helpLabel = win.add('statictext', undefined, helpText);
        helpLabel.preferredSize = [width || 200, 18];
        try {
            helpLabel.justify = 'center';
        } catch (e2) { }
        try {
            helpLabel.graphics.foregroundColor = helpLabel.graphics.newPen(helpLabel.graphics.PenType.SOLID_COLOR, [0.55, 0.55, 0.55], 1);
        } catch (e3) { }
    }
    function requestCancel() {
        cancelled = true;
    }
    attachEscapeCancelHandler(win, requestCancel);
    win.onClose = function () {
        requestCancel();
        return true;
    };
    win.layout.layout(true);
    win.center();
    win.show();
    try {
        win.update();
    } catch (e4) { }

    return {
        tick: function () {
            tickCount++;
            if ((tickCount % updateEvery) !== 0) return true;
            var t = nowMs();
            if ((t - lastUpdateMs) < updateIntervalMs) return true;
            frameIndex = (frameIndex + 1) % frames.length;
            label.text = message + ' ' + frames[frameIndex];
            lastUpdateMs = t;
            try {
                win.update();
            } catch (e5) { }
            if (isEscapePressed()) requestCancel();
            if (cancelled) throw makeUserCancelledError();
        },
        close: function () {
            try {
                win.onClose = null;
            } catch (e) { }
            try {
                win.close();
            } catch (e) { }
        }
    };
}

function stepProgress(n) {
    if (gProgress) gProgress.step(n || 1);
}

function setControlsEnabled(controls, enabled) {
    for (var i = 0; i < controls.length; i++) {
        controls[i].enabled = enabled;
    }
}

function readDropdownInt(dropdown, fallback) {
    if (!dropdown || !dropdown.selection) return fallback;
    var value = parseInt(dropdown.selection.text, 10);
    return isNaN(value) ? fallback : value;
}

function readSliderInt(slider, fallback) {
    if (!slider) return fallback;
    var value = Math.round(Number(slider.value));
    return isNaN(value) ? fallback : value;
}

function snapToStep(value, step, minValue, maxValue) {
    var n = Number(value);
    if (isNaN(n)) n = 0;
    var snapped = Math.round(n / step) * step;
    if (snapped < minValue) snapped = minValue;
    if (snapped > maxValue) snapped = maxValue;
    return snapped;
}

function dialogVersionText() {
    return String(YamoScriptVersionOnly);
}

function estimateProcessingSeconds(count) {
    var n = Number(count);
    if (isNaN(n) || n < 0) n = 0;
    if (n === 0) return 0;
    var cacheRate = ESTIMATE_ASSUMED_CACHE_RATE;
    if (cacheRate < 0) cacheRate = 0;
    if (cacheRate > 1) cacheRate = 1;
    var perColor = (ESTIMATE_UNCACHED_SECONDS_PER_COLOR * (1 - cacheRate)) +
        (ESTIMATE_CACHED_SECONDS_PER_COLOR * cacheRate);
    return ESTIMATE_FIXED_SECONDS + (n * perColor);
}

function formatEstimatedTime(seconds) {
    var sec = Math.max(0, Math.ceil(seconds));
    if (sec < 60) return uiFormat('timeSeconds', { sec: sec });

    var min = Math.floor(sec / 60);
    var rest = sec % 60;
    if (min < 60) {
        return rest > 0 ?
            uiFormat('timeMinutesSeconds', { min: min, sec: rest }) :
            uiFormat('timeMinutes', { min: min });
    }

    var hour = Math.floor(min / 60);
    var restMin = min % 60;
    return restMin > 0 ?
        uiFormat('timeHoursMinutes', { hour: hour, min: restMin }) :
        uiFormat('timeHours', { hour: hour });
}

function setStaticTextRed(st) {
    try {
        st.graphics.foregroundColor = st.graphics.newPen(st.graphics.PenType.SOLID_COLOR, [1, 0, 0], 1);
    } catch (e) { }
}

function setStaticTextMuted(st) {
    try {
        st.graphics.foregroundColor = st.graphics.newPen(st.graphics.PenType.SOLID_COLOR, [0.55, 0.55, 0.55], 1);
    } catch (e) { }
}

function setControlBold(control) {
    var fontName = "dialog";
    var fontSize = 12;
    try {
        var font = control.graphics.font;
        fontName = font && font.name ? font.name : fontName;
        fontSize = font && font.size ? font.size : fontSize;
    } catch (e) { }
    try {
        if (ScriptUI.FontStyle && ScriptUI.FontStyle.BOLD) {
            control.graphics.font = ScriptUI.newFont(fontName, ScriptUI.FontStyle.BOLD, fontSize);
            return;
        }
    } catch (e2) { }
    try {
        control.graphics.font = ScriptUI.newFont(fontName, "bold", fontSize);
        return;
    } catch (e3) { }
    try {
        control.graphics.font = ScriptUI.newFont(fontName, "BOLD", fontSize);
        return;
    } catch (e4) { }
    try {
        control.graphics.font = ScriptUI.newFont("dialog", "bold", fontSize);
    } catch (e5) { }
}

// 「変換オプション」ダイアログ
function formatTargetCountText(targetCount, unsupportedCount) {
    var s = uiFormat('targetCount', { count: targetCount });
    if (unsupportedCount > 0) {
        s += uiFormat('unsupportedCount', { count: unsupportedCount });
    }
    return s;
}

function showConvertOptionsDialog(stats) {
    var targetCount = stats.selectedObjectCount + stats.unsupportedObjectCount;
    var plannedCount = stats.planned;
    var dialogMinWidth = 280;
    var dlg = new Window('dialog', uiText('optionsTitle'));
    dlg.orientation = 'column';
    dlg.alignChildren = 'fill';
    dlg.preferredSize.width = dialogMinWidth;

    var optionPanelWidth = dialogMinWidth - 36;
    var optionPanelMargins = [8, 18, 28, 14];
    var infoPanelMargins = [8, 18, 8, 14];
    var optionDropdownWidth = 54;
    var balanceSideLabelWidth = 36;
    var balanceSliderWidth = 146;
    var balanceSliderStep = 50;
    var allowedColorDifferenceLabelExtraWidth = 72;
    var balanceOptionIndent = balanceSideLabelWidth - 18;

    var satPanel = dlg.add('panel', undefined, uiText('saturationBoost'));
    satPanel.alignment = 'fill';
    satPanel.alignChildren = ['left', 'center'];
    satPanel.orientation = 'column';
    satPanel.preferredSize.width = optionPanelWidth;
    satPanel.margins = optionPanelMargins;
    satPanel.helpTip = uiText('saturationBoostHelp');

    var satGroup = satPanel.add('group');
    satGroup.orientation = 'row';
    satGroup.alignment = 'left';
    satGroup.alignChildren = ['left', 'center'];
    satGroup.margins = 0;
    satGroup.spacing = 8;
    var chkSatBoost = satGroup.add('checkbox', undefined, uiText('saturationAmount'));
    chkSatBoost.value = false;
    chkSatBoost.helpTip = uiText('saturationBoostHelp');
    var satDropdownGroup = satGroup.add('group');
    satDropdownGroup.orientation = 'row';
    satDropdownGroup.alignChildren = ['left', 'center'];
    satDropdownGroup.margins = [0, -4, 0, 0];
    var ddSat = satDropdownGroup.add('dropdownlist', undefined, saturationBoostDropdownItems());
    ddSat.preferredSize.width = optionDropdownWidth + 30;
    ddSat.preferredSize.height = 20;
    ddSat.selection = 0; // デフォルトは 10%
    ddSat.helpTip = uiText('saturationAmountHelp');
    var satToggleTargets = [ddSat];

    var balancePanel = dlg.add('panel', undefined, uiText('cmyKBalance'));
    balancePanel.alignment = 'fill';
    balancePanel.orientation = 'column';
    balancePanel.alignChildren = ['left', 'center'];
    balancePanel.preferredSize.width = optionPanelWidth;
    balancePanel.margins = optionPanelMargins;
    balancePanel.spacing = 4;
    balancePanel.helpTip = uiText('cmyKBalanceHelp');

    var balanceDetailGroup = balancePanel.add('group');
    balanceDetailGroup.orientation = 'row';
    balanceDetailGroup.alignChildren = ['left', 'center'];
    balanceDetailGroup.margins = 0;
    balanceDetailGroup.spacing = 4;
    var labelCMYSide = balanceDetailGroup.add('statictext', undefined, 'K-');
    labelCMYSide.preferredSize.width = balanceSideLabelWidth;
    labelCMYSide.justify = 'right';
    var sliderCMYKBalance = balanceDetailGroup.add('slider', undefined, DEFAULT_CMY_K_BALANCE_VALUE, -100, 100);
    sliderCMYKBalance.preferredSize.width = balanceSliderWidth;
    sliderCMYKBalance.helpTip = uiText('cmyKBalanceSliderHelp');
    function snapCMYKBalanceSlider() {
        sliderCMYKBalance.value = snapToStep(sliderCMYKBalance.value, balanceSliderStep, -100, 100);
        updateBalanceToleranceDisplay();
    }
    sliderCMYKBalance.onChanging = snapCMYKBalanceSlider;
    sliderCMYKBalance.onChange = snapCMYKBalanceSlider;
    var labelKSide = balanceDetailGroup.add('statictext', undefined, 'K+');
    labelKSide.preferredSize.width = 18;
    labelKSide.justify = 'left';
    var balanceToleranceGroup = balancePanel.add('group');
    balanceToleranceGroup.orientation = 'row';
    balanceToleranceGroup.alignChildren = ['left', 'center'];
    balanceToleranceGroup.margins = 0;
    balanceToleranceGroup.spacing = 4;
    balanceToleranceGroup.add('statictext', [0, 0, balanceSideLabelWidth, 14], '');
    var balanceToleranceScaleGroup = balanceToleranceGroup.add('group');
    balanceToleranceScaleGroup.orientation = 'row';
    balanceToleranceScaleGroup.alignChildren = ['fill', 'center'];
    balanceToleranceScaleGroup.preferredSize.width = balanceSliderWidth;
    balanceToleranceScaleGroup.spacing = 0;
    balanceToleranceScaleGroup.margins = 0;
    balanceToleranceScaleGroup.helpTip = uiText('allowedColorDifferenceHelp');
    var balanceToleranceValues = ['10', '3.5', '0', '3.5', '10'];
    var balanceToleranceLabelWidths = [18, 27, 14, 27, 18];
    var balanceToleranceGapWidths = [5, 16, 16, 5];
    var balanceToleranceDisplayTargets = [];
    for (var ti = 0; ti < balanceToleranceValues.length; ti++) {
        var labelToleranceValue = balanceToleranceScaleGroup.add('statictext', undefined, balanceToleranceValues[ti]);
        labelToleranceValue.preferredSize.width = balanceToleranceLabelWidths[ti];
        labelToleranceValue.justify = ti === 0 ? 'left' : (ti === balanceToleranceValues.length - 1 ? 'right' : 'center');
        labelToleranceValue.helpTip = uiText('allowedColorDifferenceHelp');
        balanceToleranceDisplayTargets.push(labelToleranceValue);
        if (ti < balanceToleranceGapWidths.length) {
            balanceToleranceScaleGroup.add('statictext', [0, 0, balanceToleranceGapWidths[ti], 14], '');
        }
    }

    var toleranceLabelGroup = balancePanel.add('group');
    toleranceLabelGroup.orientation = 'row';
    toleranceLabelGroup.alignChildren = ['left', 'center'];
    toleranceLabelGroup.margins = 0;
    toleranceLabelGroup.spacing = 4;
    toleranceLabelGroup.add('statictext', [0, 0, balanceSideLabelWidth - (allowedColorDifferenceLabelExtraWidth / 2), 14], '');
    var labelAllowedColorDifference = toleranceLabelGroup.add('statictext', undefined, uiText('allowedColorDifference'));
    labelAllowedColorDifference.preferredSize.width = balanceSliderWidth + allowedColorDifferenceLabelExtraWidth;
    labelAllowedColorDifference.justify = 'center';
    labelAllowedColorDifference.helpTip = uiText('allowedColorDifferenceHelp');
    balanceToleranceDisplayTargets.push(labelAllowedColorDifference);

    var kBoostGroup = balancePanel.add('group');
    kBoostGroup.orientation = 'row';
    kBoostGroup.alignment = 'left';
    kBoostGroup.alignChildren = ['left', 'center'];
    kBoostGroup.margins = [0, 6, 0, 0];
    kBoostGroup.spacing = 4;
    kBoostGroup.helpTip = uiText('kBoostHelp');
    kBoostGroup.add('statictext', [0, 0, balanceOptionIndent, 14], '');
    var chkKBoost = kBoostGroup.add('checkbox', undefined, uiText('kBoost'));
    chkKBoost.alignment = ['left', 'center'];
    chkKBoost.value = false;
    chkKBoost.helpTip = uiText('kBoostHelp');

    var protectLightColorsGroup = balancePanel.add('group');
    protectLightColorsGroup.orientation = 'row';
    protectLightColorsGroup.alignment = 'left';
    protectLightColorsGroup.alignChildren = ['left', 'center'];
    protectLightColorsGroup.margins = [0, 2, 0, 0];
    protectLightColorsGroup.spacing = 4;
    protectLightColorsGroup.helpTip = uiText('protectLightColorsHelp');
    protectLightColorsGroup.add('statictext', [0, 0, balanceOptionIndent, 14], '');
    var chkProtectLightColors = protectLightColorsGroup.add('checkbox', undefined, uiText('protectLightColors'));
    chkProtectLightColors.alignment = ['left', 'center'];
    chkProtectLightColors.value = false;
    chkProtectLightColors.helpTip = uiText('protectLightColorsHelp');

    var enableDynamicDialogLayout = false;
    function updateBalanceToleranceDisplay() {
        var balanceValue = snapToStep(readSliderInt(sliderCMYKBalance, 0), balanceSliderStep, -100, 100);
        var isActive = balanceValue !== 0;
        var enableKBoost = balanceValue === K_BOOST_BALANCE_VALUE;
        var enableProtectLightColors = balanceValue > 0;
        setControlsEnabled(balanceToleranceDisplayTargets, isActive);
        chkKBoost.enabled = enableKBoost;
        if (!enableKBoost) chkKBoost.value = false;
        chkProtectLightColors.enabled = enableProtectLightColors;
        if (!enableProtectLightColors) chkProtectLightColors.value = false;
        if (enableDynamicDialogLayout) {
            try {
                dlg.layout.layout(true);
            } catch (e) { }
        }
    }

    function updateEnabled() {
        setControlsEnabled(satToggleTargets, chkSatBoost.value);
    }
    chkSatBoost.onClick = updateEnabled;

    // 未適用オブジェクト選択オプション
    var optionPanel = dlg.add('panel', undefined, uiText('optionGroup'));
    optionPanel.alignment = 'fill';
    optionPanel.orientation = 'column';
    optionPanel.alignChildren = ['left', 'center'];
    optionPanel.preferredSize.width = optionPanelWidth;
    optionPanel.margins = infoPanelMargins;
    optionPanel.spacing = 2;
    optionPanel.helpTip = uiText('selectSkippedObjectsHelp');

    var skippedObjectsOptionGroup = optionPanel.add('group');
    skippedObjectsOptionGroup.orientation = 'row';
    skippedObjectsOptionGroup.alignment = 'fill';
    skippedObjectsOptionGroup.alignChildren = ['left', 'center'];
    skippedObjectsOptionGroup.preferredSize.width = optionPanelWidth - 32;
    skippedObjectsOptionGroup.margins = 0;
    skippedObjectsOptionGroup.helpTip = uiText('selectSkippedObjectsHelp');
    var chkSelectSkippedObjects = skippedObjectsOptionGroup.add('checkbox', undefined, uiText('selectSkippedObjects'));
    chkSelectSkippedObjects.alignment = ['left', 'center'];
    chkSelectSkippedObjects.value = true;
    chkSelectSkippedObjects.helpTip = uiText('selectSkippedObjectsHelp');

    // 対象数と予測時間
    var infoPanel = dlg.add('panel', undefined, uiText('info'));
    infoPanel.alignment = 'fill';
    infoPanel.orientation = 'column';
    infoPanel.alignChildren = ['left', 'center'];
    infoPanel.preferredSize.width = optionPanelWidth;
    infoPanel.margins = infoPanelMargins;
    infoPanel.spacing = 2;

    var infoStack = infoPanel.add('group');
    infoStack.orientation = 'column';
    infoStack.alignment = 'fill';
    infoStack.alignChildren = ['left', 'center'];
    infoStack.spacing = 2;
    infoStack.margins = 0;
    infoStack.preferredSize.width = optionPanelWidth - 32;

    var targetGroup = infoStack.add('group');
    targetGroup.orientation = 'row';
    targetGroup.alignment = 'fill';
    targetGroup.alignChildren = ['left', 'center'];
    targetGroup.preferredSize.width = optionPanelWidth - 32;
    targetGroup.margins = 0;
    var targetCountText = targetGroup.add('statictext', undefined, formatTargetCountText(targetCount, stats.unsupportedObjectCount));
    targetCountText.alignment = ['left', 'center'];
    targetCountText.justify = 'left';
    targetCountText.helpTip = uiText('targetCountHelp');

    var estimateSec = estimateProcessingSeconds(plannedCount);
    var estimateGroup = infoStack.add('group');
    estimateGroup.orientation = 'row';
    estimateGroup.alignment = 'fill';
    estimateGroup.alignChildren = ['left', 'center'];
    estimateGroup.preferredSize.width = optionPanelWidth - 32;
    estimateGroup.margins = 0;
    var estimateText = estimateGroup.add('statictext', undefined, uiText('estimateTime') + ': ' + formatEstimatedTime(estimateSec));
    estimateText.alignment = ['left', 'center'];
    estimateText.justify = 'left';
    estimateText.helpTip = uiText('estimateHelp');
    if (estimateSec >= 60) setStaticTextRed(estimateText);

    // ボタン
    var btnGroup = dlg.add('group');
    btnGroup.alignment = 'right';
    var versionText = dialogVersionText();
    if (versionText) {
        var versionLabel = btnGroup.add('statictext', undefined, versionText);
        versionLabel.justify = 'left';
        setStaticTextMuted(versionLabel);
    }
    btnGroup.add('button', undefined, 'OK', {
        name: 'ok'
    });
    btnGroup.add('button', undefined, uiText('cancel'), {
        name: 'cancel'
    });

    var result = {
        ok: false,
        enableSaturationBoost: false,
        saturationBoostPct: SATURATION_BOOST_PCT,
        enableCMYKBalance: false,
        cmyKBalanceValue: CMY_K_BALANCE_VALUE,
        enableKBoost: false,
        enableLightColorProtect: false,
        selectSkippedObjects: true
    };

    updateEnabled();
    updateBalanceToleranceDisplay();
    enableDynamicDialogLayout = true;

    var ret = dlg.show();
    if (ret !== 1) {
        return result; // ok=false のまま返す
    }

    result.ok = true;
    result.enableSaturationBoost = chkSatBoost.value;
    result.saturationBoostPct = readDropdownInt(ddSat, result.saturationBoostPct);
    result.cmyKBalanceValue = snapToStep(readSliderInt(sliderCMYKBalance, result.cmyKBalanceValue), balanceSliderStep, -100, 100);
    result.enableCMYKBalance = result.cmyKBalanceValue !== 0;
    result.enableKBoost = result.cmyKBalanceValue === K_BOOST_BALANCE_VALUE && chkKBoost.value;
    result.enableLightColorProtect = result.cmyKBalanceValue > 0 && chkProtectLightColors.value;
    result.selectSkippedObjects = chkSelectSkippedObjects.value;
    return result;
}

/////////////////////////////////////////
// ユーティリティ関数
/////////////////////////////////////////

// 現在時刻をミリ秒で返す（処理時間計測用）
function nowMs() {
    return (new Date()).getTime();
}

// 数値を小数第2位で丸め（表示用）
function round2(x) {
    return Math.round(x * 100) / 100;
}

// === 入力CMYK→出力CMYK キャッシュ（丸めはキャッシュ専用） ===
var resultCache = {};
var cacheHitCount = 0;

function cacheKeyUnit(v) {
    var n = Math.round(v * CACHE_KEY_SCALE);
    if (isNaN(n)) return 0;
    if (n < 0) return 0;
    if (n > CACHE_KEY_MAX) return CACHE_KEY_MAX;
    return n;
}

function cacheKeyFromCMYK(c, m, y, k) {
    var cKey = cacheKeyUnit(c);
    var mKey = cacheKeyUnit(m);
    var yKey = cacheKeyUnit(y);
    var kKey = cacheKeyUnit(k);
    return (((cKey * CACHE_KEY_BASE + mKey) * CACHE_KEY_BASE + yKey) *
        CACHE_KEY_BASE + kKey);
}

function cacheGetResult(cmyk) {
    var key = cacheKeyFromCMYK(cmyk.c, cmyk.m, cmyk.y, cmyk.k);
    return resultCache[key] || null;
}

function cachePutResult(inCmyk, finalOut, changed) {
    var key = cacheKeyFromCMYK(inCmyk.c, inCmyk.m, inCmyk.y, inCmyk.k);
    resultCache[key] = {
        changed: changed,
        out: copyCMYK(finalOut)
    };
}

// === CMYK→Lab メモ化（キャッシュ専用丸め） ===
var labConvCache = {};
var kOnlyLabConvCache = {};
var labConvCacheCount = 0;

// === Spot（グローバルCMYK）の処理済み管理 ===
var processedSpotMap = {};
var processedGradientMap = {};

function spotKey(spot) {
    // 優先: index が取れる場合はそれを使う
    try {
        if (spot.hasOwnProperty('index')) return 'idx:' + spot.index;
    } catch (e) { }
    // 次善: toString（[Spot Spot N] 等）
    try {
        var s = spot.toString();
        if (s) return 'obj:' + s;
    } catch (e) {
        // 代替: 名前（自動リネーム対策として旧名も残す運用。後段で新名も登録する）
        try {
            if (spot.name) return 'name:' + spot.name;
        } catch (e) { }
    }
    return 'spot:unknown';
}

function markProcessedSpot(sp, key) {
    if (key) processedSpotMap[key] = true;
    try {
        var newKey = spotKey(sp);
        if (newKey && newKey !== key) processedSpotMap[newKey] = true;
    } catch (e) { }
}

function processedSpotResultFromColor(color) {
    if (!color || color.typename !== 'SpotColor') return null;
    try {
        var sp = color.spot;
        if (!sp) return null;
        var key = spotKey(sp);
        if (processedSpotMap[key]) {
            return makeColorProcessResult(false, 'spotAlreadyProcessed');
        }
    } catch (e) { }
    return null;
}

function isGrayColorObject(color) {
    if (!color) return false;
    if (color.typename === 'GrayColor') return true;
    if (color.typename === 'SpotColor') {
        try {
            var sp = color.spot;
            return !!(sp && sp.color && sp.color.typename === 'GrayColor');
        } catch (e) { }
    }
    return false;
}

function gradientKey(gradient) {
    try {
        if (gradient.hasOwnProperty('index')) return 'idx:' + gradient.index;
    } catch (e) { }
    try {
        if (gradient.name) return 'name:' + gradient.name;
    } catch (e) { }
    try {
        var s = gradient.toString();
        if (s) return 'obj:' + s;
    } catch (e) { }
    return null;
}

function cmykLabCacheGet(c, m, y, k) {
    var key = cacheKeyFromCMYK(c, m, y, k);
    return labConvCache[key] || null;
}

function cmykLabCachePut(c, m, y, k, lab) {
    var key = cacheKeyFromCMYK(c, m, y, k);
    if (!labConvCache[key]) {
        labConvCacheCount++;
    }
    labConvCache[key] = lab;
}

function trimLabCacheAfterSearch() {
    if (LAB_CACHE_MAX_ENTRIES <= 0) return;
    if (labConvCacheCount <= LAB_CACHE_MAX_ENTRIES) return;
    labConvCache = {};
    labConvCacheCount = 0;
}

function isKOnlyCMYKValues(c, m, y) {
    return c === 0 && m === 0 && y === 0;
}

function kOnlyLabCacheGet(c, m, y, k) {
    if (!isKOnlyCMYKValues(c, m, y)) return null;
    return kOnlyLabConvCache[cacheKeyUnit(k)] || null;
}

function kOnlyLabCachePut(c, m, y, k, lab) {
    if (!isKOnlyCMYKValues(c, m, y)) return false;
    kOnlyLabConvCache[cacheKeyUnit(k)] = lab;
    return true;
}

function cmykToLab(c, m, y, k) {
    // キャッシュを先に確認
    var kOnlyCached = kOnlyLabCacheGet(c, m, y, k);
    if (kOnlyCached) {
        return kOnlyCached;
    }
    var cached = cmykLabCacheGet(c, m, y, k);
    if (cached) {
        return cached;
    }
    var lab = app.convertSampleColor(
        ImageColorSpace.CMYK,
        [c, m, y, k],
        ImageColorSpace.LAB,
        ColorConvertPurpose.defaultpurpose
    );
    var out = {
        L: lab[0],
        a: lab[1],
        b: lab[2]
    };
    if (!kOnlyLabCachePut(c, m, y, k, out)) {
        cmykLabCachePut(c, m, y, k, out);
    }
    return out;
}

// ΔE76: Lab間のユークリッド距離を計算（色差評価）
function de76(L1, a1, b1, L2, a2, b2) {
    var dL = L1 - L2,
        da = a1 - a2,
        db = b1 - b2;
    return Math.sqrt(dL * dL + da * da + db * db);
}

function labChroma(lab) {
    return Math.sqrt(lab.a * lab.a + lab.b * lab.b);
}

function labABDelta(a, b) {
    var da = a.a - b.a;
    var db = a.b - b.b;
    return Math.sqrt(da * da + db * db);
}

function smoothUnit(t) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return t * t * (3 - 2 * t);
}

function clampPct(v) {
    if (v < 0) return 0;
    if (v > 100) return 100;
    return v;
}

function copyCMYK(cmyk) {
    return {
        c: cmyk.c,
        m: cmyk.m,
        y: cmyk.y,
        k: cmyk.k
    };
}

function makeLabResultFromCMYK(cmyk, targetLab) {
    var lab = cmykToLab(cmyk.c, cmyk.m, cmyk.y, cmyk.k);
    var out = copyCMYK(cmyk);
    out.L = lab.L;
    out.a = lab.a;
    out.b = lab.b;
    out.dE = de76(targetLab.L, targetLab.a, targetLab.b, lab.L, lab.a, lab.b);
    return out;
}

// CMYKColor オブジェクトを生成
function makeCMYK(c, m, y, k) {
    var cc = new CMYKColor();
    cc.cyan = c;
    cc.magenta = m;
    cc.yellow = y;
    cc.black = k;
    return cc;
}

// Illustrator Color から {c,m,y,k} を取得（CMYKColor/SpotColor(グローバルCMYK)対応）
function extractCMYK(color) {
    if (!color) return null;
    // SpotColor（ベースがCMYKのグローバルプロセスのみ対象。真の特色や非CMYKは除外）
    if (color.typename === 'SpotColor') {
        try {
            var sp = color.spot; // Spot オブジェクト
            // 真の特色（ColorModel.SPOT）はスキップ。グローバルプロセス（ColorModel.PROCESS）のみ対象。
            if (sp && sp.colorType === ColorModel.PROCESS && sp.color && sp.color.typename === 'CMYKColor') {
                return {
                    c: sp.color.cyan,
                    m: sp.color.magenta,
                    y: sp.color.yellow,
                    k: sp.color.black,
                    _isSpot: true,
                    _spotRef: sp
                };
            }
        } catch (e) { }
        // SpotColor だが対象外（真の特色や非CMYKベース）は null
        return null;
    }
    if (color.typename === 'CMYKColor') return {
        c: color.cyan,
        m: color.magenta,
        y: color.yellow,
        k: color.black
    };
    return null; // Spot/Gray/RGB/Pattern/Gradient は対象外（Gradientは別処理）
}

// CMYK値を整数に丸め
function roundCMYKValue(v, applyZeroThreshold) {
    var r = Math.round(v);
    if (applyZeroThreshold && r <= ZERO_THR) return 0;
    return clampPct(r);
}

function roundCMYK(cmyk, applyZeroThreshold) {
    return {
        c: roundCMYKValue(cmyk.c, applyZeroThreshold),
        m: roundCMYKValue(cmyk.m, applyZeroThreshold),
        y: roundCMYKValue(cmyk.y, applyZeroThreshold),
        k: roundCMYKValue(cmyk.k, applyZeroThreshold)
    };
}

// CMYK値の確定処理（整数化→閾値適用）
function finalizeCMYK(cmyk) {
    return roundCMYK(cmyk, true);
}


// ==== 小行列ソルバ＆LS微調整（K-onlyで一気にLを合わせる） ====
function _solveSymmetric(JTJ, b) {
    var n = JTJ.length;
    var M = new Array(n);
    for (var i = 0; i < n; i++) {
        M[i] = JTJ[i].slice();
        M[i].push(b[i]);
    }
    for (var k = 0; k < n; k++) {
        var piv = Math.abs(M[k][k]),
            pr = k;
        for (var r = k + 1; r < n; r++) {
            var v = Math.abs(M[r][k]);
            if (v > piv) {
                piv = v;
                pr = r;
            }
        }
        if (piv < LS_PIVOT_EPS) return null;
        if (pr != k) {
            var t = M[k];
            M[k] = M[pr];
            M[pr] = t;
        }
        var div = M[k][k];
        for (var j = k; j <= n; j++) M[k][j] /= div;
        for (var i2 = 0; i2 < n; i2++) {
            if (i2 === k) continue;
            var f = M[i2][k];
            for (var j2 = k; j2 <= n; j2++) M[i2][j2] -= f * M[k][j2];
        }
    }
    var x = new Array(n);
    for (var i3 = 0; i3 < n; i3++) x[i3] = M[i3][n];
    return x;
}
function refineWithMaskLS(start, targetLab, allowed) {
    var cur = copyCMYK(start);
    var lab = cmykToLab(cur.c, cur.m, cur.y, cur.k);
    // 有効チャネルを列順に並べる
    var cols = [];
    for (var i = 0; i < CMYK_CHANNELS.length; i++) {
        var ch = CMYK_CHANNELS[i];
        if (allowed[ch]) cols.push(ch);
    }
    var p = cols.length;
    if (p === 0) return makeLabResultFromCMYK(cur, targetLab);
    // ヤコビアン J: 3 x p（前進差分）
    var J = new Array(3);
    for (var r = 0; r < 3; r++) {
        J[r] = new Array(p);
        for (var c = 0; c < p; c++) J[r][c] = 0;
    }
    for (var ci = 0; ci < p; ci++) {
        var ch = cols[ci];
        var h = LS_JACOBIAN_STEP;
        var trial = copyCMYK(cur);
        trial[ch] = clampPct(trial[ch] + h);
        var lab2 = cmykToLab(trial.c, trial.m, trial.y, trial.k);
        J[0][ci] = (lab2.L - lab.L) / h;
        J[1][ci] = (lab2.a - lab.a) / h;
        J[2][ci] = (lab2.b - lab.b) / h;
    }
    // 正規方程式 A = J^T J + λI, b = J^T (target-lab)
    var A = new Array(p),
        bvec = new Array(p);
    for (var i2 = 0; i2 < p; i2++) {
        A[i2] = new Array(p);
        for (var j2 = 0; j2 < p; j2++) {
            var s = 0;
            for (var r2 = 0; r2 < 3; r2++) s += J[r2][i2] * J[r2][j2];
            A[i2][j2] = s;
        }
        A[i2][i2] += LS_LAMBDA;
    }
    var tL = targetLab.L - lab.L,
        ta = targetLab.a - lab.a,
        tb = targetLab.b - lab.b;
    for (var i4 = 0; i4 < p; i4++) {
        bvec[i4] = J[0][i4] * tL + J[1][i4] * ta + J[2][i4] * tb;
    }
    var dx = _solveSymmetric(A, bvec);
    if (dx) {
        for (var ci2 = 0; ci2 < p; ci2++) {
            var ch2 = cols[ci2];
            cur[ch2] = clampPct(cur[ch2] + dx[ci2]);
        }
    }
    return makeLabResultFromCMYK(cur, targetLab);
}

function isAlmostPureK(cmyk) {
    return cmyk.c <= ZERO_THR && cmyk.m <= ZERO_THR && cmyk.y <= ZERO_THR;
}

function makeCMYRefineMask(useC, useM, useY) {
    return {
        c: !!useC,
        m: !!useM,
        y: !!useY,
        k: false
    };
}

function cmyRefineMasks() {
    return [
        makeCMYRefineMask(true, true, false),
        makeCMYRefineMask(false, true, true),
        makeCMYRefineMask(true, false, true)
    ];
}

function applyCMYMask(cmyk, mask) {
    var out = copyCMYK(cmyk);
    if (!mask.c) out.c = 0;
    if (!mask.m) out.m = 0;
    if (!mask.y) out.y = 0;
    return out;
}

function refineBestCMYPair(start, targetLab) {
    var masks = cmyRefineMasks();
    var best = null;
    for (var i = 0; i < masks.length; i++) {
        var mask = masks[i];
        var maskedStart = applyCMYMask(start, mask);
        var candidate = refineWithMaskLSPasses(maskedStart, targetLab, mask, CMY_K_BALANCE_REFINE_PASSES);
        if (!best || candidate.dE < best.dE) {
            best = candidate;
        }
    }
    return best || makeLabResultFromCMYK(start, targetLab);
}

function finalizedLabResult(cmyk, targetLab) {
    return makeLabResultFromCMYK(finalizeCMYK(cmyk), targetLab);
}

function kIsReduced(base, candidate) {
    if (!base || !candidate) return false;
    return roundCMYKValue(candidate.k, true) < roundCMYKValue(base.k, true);
}

function findCMYBalanceResult(adj, targetLab, amount) {
    if (adj.k <= ZERO_THR) return adj;

    var bestReduced = null;
    for (var i = 0; i < CMY_K_BALANCE_K_REDUCTION_FACTORS.length; i++) {
        var trialAmount = amount * CMY_K_BALANCE_K_REDUCTION_FACTORS[i];
        if (trialAmount <= 0) continue;

        var out = copyCMYK(adj);
        out.k = clampPct(adj.k * (1 - trialAmount));
        if (!kIsReduced(adj, out)) continue;

        var candidate = finalizedLabResult(refineBestCMYPair(out, targetLab), targetLab);
        if (!kIsReduced(adj, candidate)) continue;

        if (!bestReduced || candidate.k < bestReduced.k || (candidate.k === bestReduced.k && candidate.dE < bestReduced.dE)) {
            bestReduced = candidate;
        }
        if (acceptCMYKBalanceResult(adj, candidate, amount, targetLab)) return candidate;
    }

    return bestReduced && acceptCMYKBalanceResult(adj, bestReduced, amount, targetLab) ? bestReduced : adj;
}

function buildKRefineMask() {
    return {
        c: false,
        m: false,
        y: false,
        k: true
    };
}

function cmyKBalanceCurve(value) {
    var t = Math.abs(Number(value)) / 100;
    if (isNaN(t) || t <= 0) return 0;
    if (t >= 1) return 1;
    var denom = Math.exp(CMY_K_BALANCE_CURVE) - 1;
    if (denom <= 0) return t;
    return (Math.exp(CMY_K_BALANCE_CURVE * t) - 1) / denom;
}

function refineWithMaskLSPasses(start, targetLab, allowed, passes) {
    var best = makeLabResultFromCMYK(start, targetLab);
    for (var i = 0; i < passes; i++) {
        var next = refineWithMaskLS(best, targetLab, allowed);
        if (!next || next.dE > best.dE + CMY_K_BALANCE_CHANGE_EPS) break;
        if (Math.abs(next.dE - best.dE) < CMY_K_BALANCE_CHANGE_EPS) {
            best = next;
            break;
        }
        best = next;
    }
    return best;
}

function cmyKBalanceToleranceMultiplier(targetLab) {
    if (!targetLab) return 1;
    var L = Number(targetLab.L);
    if (isNaN(L)) return 1;
    if (L <= 0) return 2;
    if (L >= 100) return 1;
    return 1 + smoothUnit((100 - L) / 100);
}

function acceptCMYKBalanceResult(base, candidate, amount, targetLab) {
    if (!candidate) return false;
    if (candidate.dE <= base.dE) return true;
    var limit = (CMY_K_BALANCE_DE_BASE + (CMY_K_BALANCE_DE_RANGE * amount)) * cmyKBalanceToleranceMultiplier(targetLab);
    return candidate.dE <= limit && (candidate.dE - base.dE) <= limit;
}

function cmyTotal(cmyk) {
    if (!cmyk) return 0;
    return clampPct(cmyk.c) + clampPct(cmyk.m) + clampPct(cmyk.y);
}

function shouldProtectLightColorFromKBalance(base, candidate, targetLab) {
    if (!LIGHT_COLOR_PROTECT_ENABLED || !base || !candidate || !targetLab) return false;
    if (targetLab.L < LIGHT_COLOR_PROTECT_L_MIN) return false;
    if (labChroma(targetLab) < LIGHT_COLOR_PROTECT_CHROMA_MIN) return false;

    var removedCMY = cmyTotal(base) - cmyTotal(candidate);
    if (removedCMY < LIGHT_COLOR_PROTECT_CMY_REMOVED_MIN) return false;

    var addedK = Math.max(0, candidate.k - base.k);
    var replacementRatio = addedK / Math.max(removedCMY, 1);
    return replacementRatio < LIGHT_COLOR_PROTECT_K_REPLACEMENT_RATIO_MAX;
}

function applySaturationBoostToLab(lab, pct) {
    if (!lab || pct <= 0) return lab;
    var chroma = labChroma(lab);
    var boostWeight = smoothUnit(chroma / SATURATION_BOOST_FULL_CHROMA);
    var scale = 1 + ((pct * boostWeight) / 100);
    return {
        L: lab.L,
        a: lab.a * scale,
        b: lab.b * scale
    };
}

// -------- CMY/Kバランス補正（Labを維持するための後処理） --------
function applyCMYKBalance(adj, targetLab) {
    if (!adj || !targetLab) return adj;
    if (!CMY_K_BALANCE_ENABLED || CMY_K_BALANCE_VALUE === 0) return adj;
    if (isAlmostPureK(adj)) return adj;

    var balanceValue = CMY_K_BALANCE_VALUE;
    if (balanceValue < -100) balanceValue = -100;
    if (balanceValue > 100) balanceValue = 100;

    var amount = cmyKBalanceCurve(balanceValue);
    if (amount <= 0) return adj;

    var out = copyCMYK(adj);
    if (balanceValue > 0) {
        var cmyScale = 1 - amount;
        out.c = clampPct(out.c * cmyScale);
        out.m = clampPct(out.m * cmyScale);
        out.y = clampPct(out.y * cmyScale);
        var kRes = refineWithMaskLSPasses(out, targetLab, buildKRefineMask(), CMY_K_BALANCE_REFINE_PASSES);
        if (shouldProtectLightColorFromKBalance(adj, kRes, targetLab)) return adj;
        return acceptCMYKBalanceResult(adj, kRes, amount, targetLab) ? kRes : adj;
    } else {
        return findCMYBalanceResult(adj, targetLab, amount);
    }
}

// -------- 直接探索: CMYのうち1色以上を0にしたパターンでLabへ近づける --------
function refineKOnly(targetLab) {
    var best = makeLabResultFromCMYK(K_ONLY_SEED, targetLab);
    var steps = [20, 10, 5, 2, 1];

    for (var si = 0; si < steps.length; si++) {
        var step = steps[si];
        for (var pass = 0; pass < 12; pass++) {
            var improved = false;

            var plus = {
                c: 0,
                m: 0,
                y: 0,
                k: clampPct(best.k + step)
            };
            if (plus.k !== best.k) {
                var plusResult = makeLabResultFromCMYK(plus, targetLab);
                if (plusResult.dE < best.dE) {
                    best = plusResult;
                    improved = true;
                }
            }

            var minus = {
                c: 0,
                m: 0,
                y: 0,
                k: clampPct(best.k - step)
            };
            if (minus.k !== best.k) {
                var minusResult = makeLabResultFromCMYK(minus, targetLab);
                if (minusResult.dE < best.dE) {
                    best = minusResult;
                    improved = true;
                }
            }

            if (!improved) break;
        }
    }

    return makeLabResultFromCMYK(finalizeCMYK(best), targetLab);
}

function findKOnlyByLightness(targetLab) {
    var bestK = 0;
    var bestScore = Math.abs(targetLab.L - cmykToLab(0, 0, 0, bestK).L);

    for (var k = 1; k <= 100; k++) {
        var lab = cmykToLab(0, 0, 0, k);
        var score = Math.abs(targetLab.L - lab.L);
        if (score < bestScore || (score === bestScore && k > bestK)) {
            bestK = k;
            bestScore = score;
        }
    }

    return makeLabResultFromCMYK({
        c: 0,
        m: 0,
        y: 0,
        k: bestK
    }, targetLab);
}

function buildKBoostResult(targetLab) {
    if (!K_BOOST_ENABLED || CMY_K_BALANCE_VALUE !== K_BOOST_BALANCE_VALUE) return null;
    var kOnly = findKOnlyByLightness(targetLab);
    if (labABDelta(targetLab, kOnly) > kBoostABDeltaLimit(targetLab)) return null;
    return kOnly;
}

function kBoostABDeltaLimit(targetLab) {
    if (!targetLab) return K_BOOST_AB_DELTA_AT_L100;
    var L = Number(targetLab.L);
    if (isNaN(L)) return K_BOOST_AB_DELTA_AT_L100;
    if (L <= 0) return Number.POSITIVE_INFINITY;
    if (L > 100) L = 100;
    return K_BOOST_AB_DELTA_AT_L100 * (100 / L);
}

function getDirectPatternInfo(pattern) {
    var info = DIRECT_PATTERN_INFO[pattern];
    if (info) return info;
    throw uiText('undefinedCMYKPattern') + pattern;
}

function makeDirectPatternSeed(inputCMYK, info) {
    var removedMin = minRemovedCMY(inputCMYK, info);
    var seedK = inputCMYK.k;
    if (removedMin < 100) {
        seedK = clampPct(seedK + removedMin * 0.5);
    }

    return {
        c: info.useC ? inputCMYK.c : 0,
        m: info.useM ? inputCMYK.m : 0,
        y: info.useY ? inputCMYK.y : 0,
        k: seedK
    };
}

function buildDirectPatternSeeds(inputCMYK, targetLab, info) {
    var seeds = [];
    var seen = {};
    addUniqueDirectSeed(seeds, seen, makeDirectPatternSeed(inputCMYK, info));

    if (!needsExtraDirectSeeds(targetLab)) return seeds;

    var removedMin = minRemovedCMY(inputCMYK, info);
    var baseK = clampPct(inputCMYK.k);
    var approxKFromL = clampPct(100 - targetLab.L);

    addUniqueDirectSeed(seeds, seen, makeDirectPatternSeedWithK(inputCMYK, info, baseK));
    addUniqueDirectSeed(seeds, seen, makeDirectPatternSeedWithK(inputCMYK, info, clampPct(baseK - removedMin * 0.5)));
    addUniqueDirectSeed(seeds, seen, makeDirectPatternSeedWithK(inputCMYK, info, approxKFromL));
    addUniqueDirectSeed(seeds, seen, makeScaledDirectPatternSeed(inputCMYK, info, 0.75, approxKFromL));

    return seeds;
}

function needsExtraDirectSeeds(targetLab) {
    return targetLab.L < 25;
}

function addUniqueDirectSeed(seeds, seen, seed) {
    var key = Math.round(seed.c) + "|" + Math.round(seed.m) + "|" + Math.round(seed.y) + "|" + Math.round(seed.k);
    if (seen[key]) return;
    seen[key] = true;
    seeds.push(seed);
}

function makeDirectPatternSeedWithK(inputCMYK, info, kValue) {
    return {
        c: info.useC ? inputCMYK.c : 0,
        m: info.useM ? inputCMYK.m : 0,
        y: info.useY ? inputCMYK.y : 0,
        k: clampPct(kValue)
    };
}

function makeScaledDirectPatternSeed(inputCMYK, info, cmyScale, kValue) {
    return {
        c: info.useC ? clampPct(inputCMYK.c * cmyScale) : 0,
        m: info.useM ? clampPct(inputCMYK.m * cmyScale) : 0,
        y: info.useY ? clampPct(inputCMYK.y * cmyScale) : 0,
        k: clampPct(kValue)
    };
}

function minRemovedCMY(inputCMYK, info) {
    if (info.removedCode === 1) return inputCMYK.c;
    if (info.removedCode === 2) return inputCMYK.m;
    if (info.removedCode === 3) return inputCMYK.y;
    return Math.min(inputCMYK.c, inputCMYK.m, inputCMYK.y);
}

function makeDirectCandidateFromCMYK(cmyk, info) {
    return makeDirectCandidateFromValues(cmyk.c, cmyk.m, cmyk.y, cmyk.k, info, null);
}

function makeDirectCandidateFromValues(c, m, y, k, info, score) {
    return {
        c: c,
        m: m,
        y: y,
        k: k,
        pattern: info.pattern,
        patternInfo: info,
        score: score
    };
}

function makeDirectScoreContext(targetLab) {
    var neutral = directNeutralWeight(targetLab);
    var darkWeight = exponentialDarkWeight(targetLab.L, DIRECT_K_DARK_CURVE);
    return {
        neutral: neutral,
        darkWeight: darkWeight,
        kWeight: neutral * darkWeight
    };
}

function scoreDirectCMYKValues(c, m, y, k, targetLab, scoreContext) {
    var ctx = scoreContext || makeDirectScoreContext(targetLab);
    c = roundCMYKValue(c, true);
    m = roundCMYKValue(m, true);
    y = roundCMYKValue(y, true);
    k = roundCMYKValue(k, true);
    var lab = cmykToLab(c, m, y, k);
    var dL = targetLab.L - lab.L;
    var da = targetLab.a - lab.a;
    var db = targetLab.b - lab.b;
    var ab2 = da * da + db * db;
    var dE = Math.sqrt(dL * dL + ab2);
    var grayCast = Math.sqrt(ab2);
    var nonK = c + m + y;
    var underL = dL > 0 ? dL : 0;

    return dE +
        (DIRECT_GRAY_CAST_WEIGHT * ctx.neutral * grayCast) +
        (DIRECT_NONK_WEIGHT * ctx.kWeight * nonK / 100) +
        (DIRECT_UNDER_LIGHTNESS_WEIGHT * ctx.darkWeight * underL);
}

function directNeutralWeight(lab) {
    return Math.exp(-labChroma(lab) / DIRECT_GRAY_CHROMA_SCALE);
}

function directKPreferenceWeight(lab) {
    return directNeutralWeight(lab) * exponentialDarkWeight(lab.L, DIRECT_K_DARK_CURVE);
}

function exponentialDarkWeight(L, curve) {
    var t = clamp01((100 - L) / 100);
    var denom = Math.exp(curve) - 1;
    if (denom <= 0) return t;
    return (Math.exp(curve * t) - 1) / denom;
}

function clamp01(v) {
    if (v < 0) return 0;
    if (v > 1) return 1;
    return v;
}

function refineDirectCandidate(candidate, targetLab, passesPerStep, scoreContext) {
    if (passesPerStep == null) passesPerStep = DIRECT_REFINE_PASSES_PER_STEP;
    var info = candidate.patternInfo || getDirectPatternInfo(candidate.pattern);
    var ids = info.channelIds;
    var bestC = candidate.c;
    var bestM = candidate.m;
    var bestY = candidate.y;
    var bestK = candidate.k;
    var bestScore = scoreDirectCMYKValues(bestC, bestM, bestY, bestK, targetLab, scoreContext);
    var dirC = 1;
    var dirM = 1;
    var dirY = 1;
    var dirK = 1;

    // 前回良かった方向を先に試し、採用直後の戻り確認を省く
    // 初期scoreが良いseedは近い場所から始まっているため、大きいstepを省く
    var refineSteps = (bestScore <= DIRECT_CLOSE_INITIAL_SCORE_MAX) ? DIRECT_CLOSE_REFINE_STEPS : DIRECT_REFINE_STEPS;
    for (var si = 0; si < refineSteps.length; si++) {
        var step = refineSteps[si];
        for (var pass = 0; pass < passesPerStep; pass++) {
            var improved = false;
            for (var ci = 0; ci < ids.length; ci++) {
                var id = ids[ci];
                var next;
                var nextScore;

                if (id === 0) {
                    next = clampPct(bestC + step * dirC);
                    if (next !== bestC) {
                        nextScore = scoreDirectCMYKValues(next, bestM, bestY, bestK, targetLab, scoreContext);
                        if (nextScore < bestScore) {
                            bestC = next;
                            bestScore = nextScore;
                            improved = true;
                            continue;
                        }
                    }
                    next = clampPct(bestC - step * dirC);
                    if (next !== bestC) {
                        nextScore = scoreDirectCMYKValues(next, bestM, bestY, bestK, targetLab, scoreContext);
                        if (nextScore < bestScore) {
                            bestC = next;
                            bestScore = nextScore;
                            dirC = -dirC;
                            improved = true;
                        }
                    }
                } else if (id === 1) {
                    next = clampPct(bestM + step * dirM);
                    if (next !== bestM) {
                        nextScore = scoreDirectCMYKValues(bestC, next, bestY, bestK, targetLab, scoreContext);
                        if (nextScore < bestScore) {
                            bestM = next;
                            bestScore = nextScore;
                            improved = true;
                            continue;
                        }
                    }
                    next = clampPct(bestM - step * dirM);
                    if (next !== bestM) {
                        nextScore = scoreDirectCMYKValues(bestC, next, bestY, bestK, targetLab, scoreContext);
                        if (nextScore < bestScore) {
                            bestM = next;
                            bestScore = nextScore;
                            dirM = -dirM;
                            improved = true;
                        }
                    }
                } else if (id === 2) {
                    next = clampPct(bestY + step * dirY);
                    if (next !== bestY) {
                        nextScore = scoreDirectCMYKValues(bestC, bestM, next, bestK, targetLab, scoreContext);
                        if (nextScore < bestScore) {
                            bestY = next;
                            bestScore = nextScore;
                            improved = true;
                            continue;
                        }
                    }
                    next = clampPct(bestY - step * dirY);
                    if (next !== bestY) {
                        nextScore = scoreDirectCMYKValues(bestC, bestM, next, bestK, targetLab, scoreContext);
                        if (nextScore < bestScore) {
                            bestY = next;
                            bestScore = nextScore;
                            dirY = -dirY;
                            improved = true;
                        }
                    }
                } else {
                    next = clampPct(bestK + step * dirK);
                    if (next !== bestK) {
                        nextScore = scoreDirectCMYKValues(bestC, bestM, bestY, next, targetLab, scoreContext);
                        if (nextScore < bestScore) {
                            bestK = next;
                            bestScore = nextScore;
                            improved = true;
                            continue;
                        }
                    }
                    next = clampPct(bestK - step * dirK);
                    if (next !== bestK) {
                        nextScore = scoreDirectCMYKValues(bestC, bestM, bestY, next, targetLab, scoreContext);
                        if (nextScore < bestScore) {
                            bestK = next;
                            bestScore = nextScore;
                            dirK = -dirK;
                            improved = true;
                        }
                    }
                }
            }
            if (!improved) break;
        }
    }

    return makeDirectCandidateFromValues(bestC, bestM, bestY, bestK, info, bestScore);
}

function refineIntegerDirectCandidate(candidate, targetLab, passes, scoreContext) {
    if (passes == null) passes = DIRECT_INTEGER_REFINE_PASSES;
    var info = candidate.patternInfo || getDirectPatternInfo(candidate.pattern);
    var ids = info.channelIds;
    var bestC = roundCMYKValue(candidate.c, false);
    var bestM = roundCMYKValue(candidate.m, false);
    var bestY = roundCMYKValue(candidate.y, false);
    var bestK = roundCMYKValue(candidate.k, false);
    var bestScore = scoreDirectCMYKValues(bestC, bestM, bestY, bestK, targetLab, scoreContext);

    for (var pass = 0; pass < passes; pass++) {
        var improved = false;
        for (var ci = 0; ci < ids.length; ci++) {
            var id = ids[ci];
            var next;
            var nextScore;

            if (id === 0) {
                next = Math.round(clampPct(bestC + 1));
                if (next !== bestC) {
                    nextScore = scoreDirectCMYKValues(next, bestM, bestY, bestK, targetLab, scoreContext);
                    if (nextScore < bestScore) {
                        bestC = next;
                        bestScore = nextScore;
                        improved = true;
                    }
                }
                next = Math.round(clampPct(bestC - 1));
                if (next !== bestC) {
                    nextScore = scoreDirectCMYKValues(next, bestM, bestY, bestK, targetLab, scoreContext);
                    if (nextScore < bestScore) {
                        bestC = next;
                        bestScore = nextScore;
                        improved = true;
                    }
                }
            } else if (id === 1) {
                next = Math.round(clampPct(bestM + 1));
                if (next !== bestM) {
                    nextScore = scoreDirectCMYKValues(bestC, next, bestY, bestK, targetLab, scoreContext);
                    if (nextScore < bestScore) {
                        bestM = next;
                        bestScore = nextScore;
                        improved = true;
                    }
                }
                next = Math.round(clampPct(bestM - 1));
                if (next !== bestM) {
                    nextScore = scoreDirectCMYKValues(bestC, next, bestY, bestK, targetLab, scoreContext);
                    if (nextScore < bestScore) {
                        bestM = next;
                        bestScore = nextScore;
                        improved = true;
                    }
                }
            } else if (id === 2) {
                next = Math.round(clampPct(bestY + 1));
                if (next !== bestY) {
                    nextScore = scoreDirectCMYKValues(bestC, bestM, next, bestK, targetLab, scoreContext);
                    if (nextScore < bestScore) {
                        bestY = next;
                        bestScore = nextScore;
                        improved = true;
                    }
                }
                next = Math.round(clampPct(bestY - 1));
                if (next !== bestY) {
                    nextScore = scoreDirectCMYKValues(bestC, bestM, next, bestK, targetLab, scoreContext);
                    if (nextScore < bestScore) {
                        bestY = next;
                        bestScore = nextScore;
                        improved = true;
                    }
                }
            } else {
                next = Math.round(clampPct(bestK + 1));
                if (next !== bestK) {
                    nextScore = scoreDirectCMYKValues(bestC, bestM, bestY, next, targetLab, scoreContext);
                    if (nextScore < bestScore) {
                        bestK = next;
                        bestScore = nextScore;
                        improved = true;
                    }
                }
                next = Math.round(clampPct(bestK - 1));
                if (next !== bestK) {
                    nextScore = scoreDirectCMYKValues(bestC, bestM, bestY, next, targetLab, scoreContext);
                    if (nextScore < bestScore) {
                        bestK = next;
                        bestScore = nextScore;
                        improved = true;
                    }
                }
            }
        }
        if (!improved) break;
    }

    return makeDirectCandidateFromValues(bestC, bestM, bestY, bestK, info, bestScore);
}

function adjustDirectPatternedWithPasses(inputCMYK, targetLab, passesPerStep, integerPasses, scoreContext) {
    var best = null;
    for (var i = 0; i < DIRECT_ACTIVE_PATTERN_INFOS.length; i++) {
        var info = DIRECT_ACTIVE_PATTERN_INFOS[i];
        if (info.pattern === 'K' && !isDirectKOnlyDecisionArea(targetLab)) continue;
        var seeds = buildDirectPatternSeeds(inputCMYK, targetLab, info);
        for (var si = 0; si < seeds.length; si++) {
            var candidate = makeDirectCandidateFromCMYK(seeds[si], info);
            var refined = refineDirectCandidate(candidate, targetLab, passesPerStep, scoreContext);
            if (!best || refined.score < best.score) {
                best = refined;
            }
        }
    }

    if (!best) return null;

    best = refineIntegerDirectCandidate(best, targetLab, integerPasses, scoreContext);
    return best;
}

function adjustDirectPatterned(inputCMYK, targetLab) {
    var scoreContext = makeDirectScoreContext(targetLab);
    var best = adjustDirectPatternedWithPasses(
        inputCMYK,
        targetLab,
        DIRECT_REFINE_PASSES_PER_STEP,
        DIRECT_INTEGER_REFINE_PASSES,
        scoreContext
    );
    if (!best) return null;

    var result = makeLabResultFromCMYK(finalizeCMYK(best), targetLab);

    if (isDirectKOnlyDecisionArea(targetLab)) {
        try {
            var kOnly = refineKOnly(targetLab);
            if (shouldPreferDirectKOnlyDark(targetLab, result, kOnly, scoreContext)) return kOnly;
        } catch (e) { }
    }

    return result;
}

function shouldPreferDirectKOnlyDark(decisionLab, bestResult, kOnlyResult, scoreContext) {
    if (!isDirectKOnlyDecisionArea(decisionLab)) return false;

    var kWeight = scoreContext ? scoreContext.kWeight : directKPreferenceWeight(decisionLab);
    var curve = Math.pow(kWeight, 0.75);
    var deLimit = DIRECT_K_ONLY_DARK_BASE_DE + DIRECT_K_ONLY_DARK_CURVE_DE * curve;
    var extraLimit = DIRECT_K_ONLY_DARK_BASE_EXTRA_DE + DIRECT_K_ONLY_DARK_CURVE_EXTRA_DE * curve;

    return kOnlyResult.dE <= deLimit && (kOnlyResult.dE - bestResult.dE) <= extraLimit;
}

function isDirectKOnlyDecisionArea(decisionLab) {
    if (labChroma(decisionLab) > DIRECT_K_ONLY_DARK_CHROMA_MAX) return false;
    return decisionLab.L <= DIRECT_K_ONLY_DARK_L_MAX;
}

function makeColorProcessResult(changed, reason, out, spot) {
    var res = {
        changed: changed
    };
    if (reason) res.reason = reason;
    if (out) res.out = out;
    if (spot) res.spot = true;
    return res;
}

function isSameCMYK(a, b) {
    return a.c === b.c && a.m === b.m && a.y === b.y && a.k === b.k;
}

function getCachedAdjustedResult(orig) {
    var cached = cacheGetResult(orig);
    if (!cached) return null;

    cacheHitCount++;
    if (!cached.changed) {
        return makeColorProcessResult(false, 'same');
    }
    return makeColorProcessResult(true, null, copyCMYK(cached.out));
}

function computeAdjustedResult(orig, useCache) {
    var labA = cmykToLab(orig.c, orig.m, orig.y, orig.k);
    var targetLab = (SATURATION_BOOST_ENABLED && SATURATION_BOOST_PCT > 0) ? applySaturationBoostToLab(labA, SATURATION_BOOST_PCT) : labA;
    var kBoostResult = buildKBoostResult(targetLab);

    if (kBoostResult) {
        var kBoostOut = finalizeCMYK(kBoostResult);
        if (!shouldProtectLightColorFromKBalance(orig, kBoostOut, targetLab)) {
            var kBoostChanged = !isSameCMYK(orig, kBoostOut);
            if (useCache) {
                cachePutResult(orig, kBoostOut, kBoostChanged);
            }
            trimLabCacheAfterSearch();

            if (!kBoostChanged) {
                return makeColorProcessResult(false, 'same');
            }
            return makeColorProcessResult(true, null, kBoostOut);
        }
    }

    var adj = adjustDirectPatterned(orig, targetLab);
    if (!adj) {
        trimLabCacheAfterSearch();
        return makeColorProcessResult(false, 'noCandidate');
    }

    adj = applyCMYKBalance(adj, targetLab);

    var finalOut = finalizeCMYK(adj);
    var changed = !isSameCMYK(orig, finalOut);
    if (useCache) {
        cachePutResult(orig, finalOut, changed);
    }
    trimLabCacheAfterSearch();

    if (!changed) {
        return makeColorProcessResult(false, 'same');
    }
    return makeColorProcessResult(true, null, finalOut);
}

function buildAdjustedColorResult(orig, useCache) {
    if (useCache) {
        var cachedResult = getCachedAdjustedResult(orig);
        if (cachedResult) return cachedResult;
    }
    return computeAdjustedResult(orig, useCache);
}

function processSpotColorObject(orig) {
    var sp = orig._spotRef;
    var key = spotKey(sp);
    if (processedSpotMap[key]) {
        return makeColorProcessResult(false, 'spotAlreadyProcessed');
    }

    var spotResult = buildAdjustedColorResult(orig, false);
    if (!spotResult.changed) {
        markProcessedSpot(sp, key);
        return spotResult;
    }

    try {
        sp.color = makeCMYK(spotResult.out.c, spotResult.out.m, spotResult.out.y, spotResult.out.k);
    } catch (e) {
        return makeColorProcessResult(false, 'spotWriteFailed');
    }

    markProcessedSpot(sp, key);
    return makeColorProcessResult(true, null, spotResult.out, true);
}

// 単一カラー（CMYK/SpotColor）を処理 - 詳細な結果を返す
function processColorObject(color) {
    var processedSpot = processedSpotResultFromColor(color);
    if (processedSpot) return processedSpot;

    if (isGrayColorObject(color)) return makeColorProcessResult(false, 'ignoredGray');
    if (color && color.typename === 'PatternColor') return makeColorProcessResult(false, 'patternColor');

    var orig = extractCMYK(color);
    if (!orig) return makeColorProcessResult(false, 'nonCMYK'); // spot/RGB等

    // Spot（グローバルCMYK）の場合は、スウォッチ（Spot）のベース色を書き換える。オブジェクト側は触らない。
    if (orig._isSpot && orig._spotRef) {
        return processSpotColorObject(orig);
    }

    return buildAdjustedColorResult(orig, true);
}

function applyColorResultToProperty(target, propName, res, ownerItem) {
    if (!res || !res.changed) {
        if (res && res.reason && res.reason !== 'same' && res.reason !== 'spotAlreadyProcessed' && res.reason !== 'ignoredGray') {
            countSkip(ownerItem || target, res.reason);
        }
        return 0;
    }
    if (!res.spot) {
        target[propName] = makeCMYK(res.out.c, res.out.m, res.out.y, res.out.k);
    }
    return 1;
}

function processColorProperty(target, propName, allowGradient, ownerItem) {
    try {
        var col = target[propName];
        if (!col) return 0;
        if (allowGradient && col.typename === 'GradientColor') {
            var res = processGradientColor(col, ownerItem || target);
            if (res.changed) target[propName] = col;
            return res.changed;
        }
        var changed = applyColorResultToProperty(target, propName, processColorObject(col), ownerItem || target);
        stepProgress(1);
        return changed;
    } catch (e) {
        if (isUserCancelledError(e)) throw e;
        countSkip(ownerItem || target, 'colorReadFailed');
        return 0;
    }
}

function getTextFrameAttributes(tf) {
    try {
        return tf.textRange.characterAttributes;
    } catch (e) { }
    return null;
}

function processTextAttributesColors(attrs, ownerItem) {
    if (!attrs) return 0;
    var changes = 0;
    changes += processColorProperty(attrs, 'fillColor', false, ownerItem);
    changes += processColorProperty(attrs, 'strokeColor', false, ownerItem);
    return changes;
}

// TextFrame の文字カラー処理（塗り/線）: 実務で使用する統計を返す
function processTextFrameColors(tf) {
    var attrs = getTextFrameAttributes(tf);
    if (!attrs) {
        countSkip(tf, 'textAttributesReadFailed');
        return {
            changes: 0
        };
    }
    return {
        changes: processTextAttributesColors(attrs, tf)
    };
}

// GradientColor を処理（各ストップの CMYK/SpotColor） - カウンタ集計
function processGradientColor(gradColor, ownerItem) {
    var g = gradColor.gradient;
    var key = gradientKey(g);
    if (key && processedGradientMap[key]) {
        return {
            changed: 0
        };
    }
    var stops = g.gradientStops;
    var changed = 0;
    for (var i = 0, n = stops.length; i < n; i++) {
        try {
            var stop = stops[i];
            var col = stop.color;
            if (col) {
                changed += applyColorResultToProperty(stop, 'color', processColorObject(col), ownerItem);
            }
        } catch (e) {
            if (isUserCancelledError(e)) throw e;
            countSkip(ownerItem, 'gradientStopFailed');
        }
        stepProgress(1);
    }
    if (key) processedGradientMap[key] = true;
    return {
        changed: changed
    };
}

// PageItem の塗り・線を処理 - 詳細カウンタを返す
function processPageItemColors(item, filled, stroked) {
    var changes = 0;
    if (typeof filled === 'undefined') {
        try {
            filled = item.filled;
        } catch (e) {
            countSkip(item, 'fillStateReadFailed');
            filled = false;
        }
    }
    if (typeof stroked === 'undefined') {
        try {
            stroked = item.stroked;
        } catch (e2) {
            countSkip(item, 'strokeStateReadFailed');
            stroked = false;
        }
    }
    if (filled) changes += processColorProperty(item, 'fillColor', true, item);
    if (stroked) changes += processColorProperty(item, 'strokeColor', true, item);
    return {
        changes: changes
    };
}

function walkSelectionArtItems(visitor, unsupportedVisitor) {
    var doc = app.activeDocument;
    var sel = doc.selection;
    if (!sel || sel.length === 0) return false;

    function walk(it) {
        if (!it) return;
        var tn = it.typename;
        if (tn === 'GroupItem') {
            var arr;
            try {
                arr = it.pageItems;
            } catch (e) {
                if (isUserCancelledError(e)) throw e;
                if (unsupportedVisitor) unsupportedVisitor(it);
                return;
            }
            for (var i = 0, n = arr.length; i < n; i++) {
                walk(arr[i]);
            }
        } else if (tn === 'CompoundPathItem') {
            var arr2;
            try {
                arr2 = it.pathItems;
            } catch (e2) {
                if (isUserCancelledError(e2)) throw e2;
                if (unsupportedVisitor) unsupportedVisitor(it);
                return;
            }
            for (var j = 0, n2 = arr2.length; j < n2; j++) {
                walk(arr2[j]);
            }
        } else if (tn === 'TextFrame' || tn === 'PathItem') {
            visitor(it);
        } else if (unsupportedVisitor) {
            unsupportedVisitor(it);
        }
    }
    for (var i = 0, nSel = sel.length; i < nSel; i++) walk(sel[i]);
    return true;
}

function countTextFrameAttempts(tf) {
    return 2;
}

function applySelectionArtItem(it) {
    return (it.typename === 'TextFrame') ? processTextFrameColors(it).changes : processPageItemColors(it).changes;
}

function makeSelectionArtItemEntry(it) {
    var tn = it.typename;
    var entry = {
        item: it,
        typename: tn,
        attempts: 0,
        filled: false,
        stroked: false
    };
    if (tn === 'TextFrame') {
        entry.attempts = countTextFrameAttempts(it);
        return entry;
    }
    try {
        entry.filled = !!it.filled;
        if (entry.filled) entry.attempts++;
    } catch (e) { }
    try {
        entry.stroked = !!it.stroked;
        if (entry.stroked) entry.attempts++;
    } catch (e2) { }
    return entry;
}

function applySelectionArtItemEntry(entry) {
    if (!entry || !entry.item) return 0;
    return (entry.typename === 'TextFrame') ?
        processTextFrameColors(entry.item).changes :
        processPageItemColors(entry.item, entry.filled, entry.stroked).changes;
}

// 選択を走査して全適用（Group/Compound含む） - 詳細集計
function applyToSelection(items) {
    var applied = 0;
    if (items) {
        for (var i = 0, n = items.length; i < n; i++) {
            applied += applySelectionArtItemEntry(items[i]);
        }
        return {
            count: applied
        };
    }
    if (!walkSelectionArtItems(function (it) {
        applied += applySelectionArtItem(it);
    })) {
        return {
            count: 0
        };
    }
    return {
        count: applied
    };
}

function validateActiveDocument() {
    try {
        if (app.documents.length === 0) {
            alert(uiText('requireCMYK'));
            return null;
        }
        var doc = app.activeDocument;
        if (doc.documentColorSpace !== DocumentColorSpace.CMYK) {
            alert(uiText('requireCMYK'));
            return null;
        }
        if (!doc.selection || doc.selection.length === 0) {
            alert(uiText('requireSelection'));
            return null;
        }
        return doc;
    } catch (e) {
        alert(uiText('requireCMYK'));
        return null;
    }
}

function collectSelectionStats(showStatusWindow) {
    var planned = 0;
    var selectedObjectCount = 0;
    var unsupportedObjectCount = 0;
    var items = [];
    var unsupportedItems = [];
    var unsupportedBreakdown = [];
    var cancelled = false;
    var statusWindow = showStatusWindow ? createStatusWindow(uiText('scanningSelection'), 220, uiText('scanCancelHelp')) : null;
    try {
        walkSelectionArtItems(function (it) {
            var entry = makeSelectionArtItemEntry(it);
            items.push(entry);
            selectedObjectCount++;
            planned += entry.attempts;
            if (statusWindow) statusWindow.tick();
        }, function (it) {
            unsupportedObjectCount++;
            unsupportedItems.push(it);
            addUnsupportedBreakdownEntry(unsupportedBreakdown, it);
            if (statusWindow) statusWindow.tick();
        });
    } catch (e) {
        if (isUserCancelledError(e)) {
            cancelled = true;
        } else {
            throw e;
        }
    }
    if (statusWindow) statusWindow.close();
    return {
        cancelled: !!cancelled,
        planned: planned,
        selectedObjectCount: selectedObjectCount,
        unsupportedObjectCount: unsupportedObjectCount,
        unsupportedItems: unsupportedItems,
        unsupportedBreakdown: unsupportedBreakdown,
        items: items
    };
}

function formatPercent(numerator, denominator) {
    if (!denominator || denominator <= 0) return "0%";
    return round2((numerator / denominator) * 100) + "%";
}

function metricSeparator() {
    return currentLocaleCode() === "ja" ? "：" : ": ";
}

function formatMetricText(labelKey, value) {
    return uiText(labelKey) + metricSeparator() + value;
}

function formatNumberWithUnit(value, unitKey) {
    var unit = uiText(unitKey);
    return currentLocaleCode() === "ja" ? String(value) + unit : String(value) + " " + unit;
}

function formatCompletionSeconds(totalSec) {
    return round2(totalSec) + " " + uiText('secondsUnit');
}

function estimateTextContentWidth(text) {
    var s = String(text);
    var width = 0;
    for (var i = 0, n = s.length; i < n; i++) {
        var ch = s.charAt(i);
        if (s.charCodeAt(i) > 255) {
            width += 15;
        } else if (ch === " " || ch === "." || ch === "," || ch === ":" || ch === "%" || ch === "i" || ch === "l" || ch === "I") {
            width += 6;
        } else {
            width += 9;
        }
    }
    return width;
}

function estimateStaticTextWidth(text) {
    return estimateTextContentWidth(text) + COMPLETION_TEXT_PADDING_WIDTH;
}

function maxMetricTextWidth(items, minWidth) {
    var width = minWidth;
    for (var i = 0, n = items.length; i < n; i++) {
        width = Math.max(width, estimateStaticTextWidth(items[i]));
    }
    return width;
}

function completionMetricWidths(info) {
    return {
        left: maxMetricTextWidth([
            formatMetricText('selectedObjects', info.selectedObjectCount),
            formatMetricText('cacheHitRate', info.cacheHitRate)
        ], COMPLETION_METRIC_LEFT_MIN_WIDTH),
        right: maxMetricTextWidth([
            formatMetricText('updatedColors', info.updatedColors),
            formatMetricText('processingTime', info.processingTime)
        ], COMPLETION_METRIC_RIGHT_MIN_WIDTH)
    };
}

function splitLines(text) {
    if (!text) return [];
    return String(text).split(/\r\n|\r|\n/);
}

function maxTextWidthFromLines(lines, minWidth) {
    var width = minWidth || 0;
    for (var i = 0, n = lines ? lines.length : 0; i < n; i++) {
        width = Math.max(width, estimateStaticTextWidth(lines[i]));
    }
    return width;
}

function estimatedWrappedLineCount(text, width) {
    var lines = splitLines(text);
    if (lines.length === 0) return 1;
    var contentWidth = Math.max(1, width - COMPLETION_TEXT_PADDING_WIDTH);
    var count = 0;
    for (var i = 0, n = lines.length; i < n; i++) {
        count += Math.max(1, Math.ceil(estimateTextContentWidth(lines[i]) / contentWidth));
    }
    return count;
}

function skippedBreakdownLines(details) {
    var lines = [];
    if (!details || details.length === 0) return lines;
    for (var i = 0, n = details.length; i < n; i++) {
        lines.push(details[i].label + metricSeparator() + formatNumberWithUnit(details[i].count, 'skippedCountUnit'));
    }
    return lines;
}

function completionSkippedPanelWidth(skippedTitle, breakdownLines) {
    return Math.max(
        COMPLETION_SKIPPED_PANEL_MIN_WIDTH,
        estimateStaticTextWidth(skippedTitle),
        maxTextWidthFromLines(breakdownLines, 0)
    );
}

function addHorizontalRule(parent, width) {
    var ruleGroup = parent.add('group');
    ruleGroup.orientation = 'row';
    ruleGroup.alignment = 'fill';
    ruleGroup.alignChildren = ['fill', 'center'];
    ruleGroup.preferredSize.width = width;
    ruleGroup.margins = [0, 2, 0, 2];
    var rule = ruleGroup.add('panel', undefined, undefined);
    rule.alignment = ['fill', 'center'];
    rule.preferredSize.height = 1;
    return rule;
}

function addBoldMultilineText(parent, text, width) {
    var st = parent.add('statictext', undefined, text, { multiline: true });
    st.alignment = ['fill', 'center'];
    st.justify = 'left';
    st.preferredSize.width = width;
    st.preferredSize.height = Math.max(18, estimatedWrappedLineCount(text, width) * COMPLETION_TEXT_LINE_HEIGHT + COMPLETION_TEXT_HEIGHT_PADDING);
    setControlBold(st);
    return st;
}

function addCompletionMetricCell(parent, labelKey, value, width) {
    var cell = parent.add('statictext', undefined, formatMetricText(labelKey, value));
    cell.alignment = ['left', 'center'];
    cell.justify = 'left';
    cell.preferredSize.width = width;
    return cell;
}

function addCompletionMetricRow(parent, leftKey, leftValue, rightKey, rightValue, widths) {
    var row = parent.add('group');
    row.orientation = 'row';
    row.alignment = 'left';
    row.alignChildren = ['left', 'center'];
    row.spacing = 18;
    row.margins = 0;
    addCompletionMetricCell(row, leftKey, leftValue, widths.left);
    addCompletionMetricCell(row, rightKey, rightValue, widths.right);
    return row;
}

function showCompletionDialog(info) {
    var dlg = new Window('dialog', uiText('completionTitle'));
    dlg.orientation = 'column';
    dlg.alignChildren = 'fill';
    dlg.margins = [18, 16, 18, 14];
    dlg.spacing = 12;

    var metricsGroup = dlg.add('group');
    metricsGroup.orientation = 'column';
    metricsGroup.alignment = 'left';
    metricsGroup.alignChildren = ['left', 'center'];
    metricsGroup.spacing = 4;
    metricsGroup.margins = 0;
    var metricWidths = completionMetricWidths(info);
    addCompletionMetricRow(metricsGroup, 'selectedObjects', info.selectedObjectCount, 'updatedColors', info.updatedColors, metricWidths);
    addCompletionMetricRow(metricsGroup, 'cacheHitRate', info.cacheHitRate, 'processingTime', info.processingTime, metricWidths);

    if (info.skippedCount > 0) {
        var skippedTitle = formatMetricText('skippedCount', formatNumberWithUnit(info.skippedCount, 'skippedCountUnit'));
        var breakdownLines = skippedBreakdownLines(info.skippedDetails);
        var skippedPanelWidth = completionSkippedPanelWidth(skippedTitle, breakdownLines);
        var skippedContentWidth = skippedPanelWidth - 20;
        var skippedPanel = dlg.add('panel', undefined, '');
        skippedPanel.alignment = 'fill';
        skippedPanel.orientation = 'column';
        skippedPanel.alignChildren = ['left', 'center'];
        skippedPanel.preferredSize.width = skippedPanelWidth;
        skippedPanel.margins = [10, 10, 10, 10];
        skippedPanel.spacing = 6;

        var skippedTitleText = skippedPanel.add('statictext', undefined, skippedTitle);
        skippedTitleText.alignment = ['fill', 'center'];
        skippedTitleText.justify = 'left';
        skippedTitleText.preferredSize.width = skippedContentWidth;
        setControlBold(skippedTitleText);

        if (info.skippedMessage) {
            addBoldMultilineText(skippedPanel, info.skippedMessage, skippedContentWidth);
        }
        if (breakdownLines.length > 0) {
            addHorizontalRule(skippedPanel, skippedContentWidth);
            addBoldMultilineText(skippedPanel, breakdownLines.join("\n"), skippedContentWidth);
        } else {
            skippedPanel.add('statictext', undefined, '');
        }
    }

    var btnGroup = dlg.add('group');
    btnGroup.alignment = 'right';
    btnGroup.add('button', undefined, 'OK', { name: 'ok' });
    dlg.show();
}

function cleanupAfterRun() {
    if (gProgress) {
        gProgress.close();
        gProgress = null;
    }
    try {
        resultCache = {};
        labConvCache = {};
        kOnlyLabConvCache = {};
        labConvCacheCount = 0;
        processedSpotMap = {};
        processedGradientMap = {};
        cacheHitCount = 0;
        gSkipCount = 0;
        gSkippedItems = [];
        gSkipBreakdown = [];
        CMY_K_BALANCE_ENABLED = DEFAULT_CMY_K_BALANCE_ENABLED;
        CMY_K_BALANCE_VALUE = DEFAULT_CMY_K_BALANCE_VALUE;
        K_BOOST_ENABLED = DEFAULT_K_BOOST_ENABLED;
        LIGHT_COLOR_PROTECT_ENABLED = DEFAULT_LIGHT_COLOR_PROTECT_ENABLED;
        SATURATION_BOOST_ENABLED = DEFAULT_SATURATION_BOOST_ENABLED;
        SATURATION_BOOST_PCT = DEFAULT_SATURATION_BOOST_PCT;
        $.gc();
    } catch (e) { }
    try {
        app.redraw();
    } catch (e) { }
}


/////////////////////////////////////////
// メイン処理関数
/////////////////////////////////////////

// 変換を実行し、計測結果を表示する処理
(
    function main() {

        var doc = validateActiveDocument();
        if (!doc) return;

        resetSkipCount();

        var stats = collectSelectionStats(true);
        if (!stats || stats.cancelled) return;

        var opt = showConvertOptionsDialog(stats);
        if (!opt || !opt.ok) {
            // ユーザーがキャンセルした場合は処理を中止
            return;
        }
        SATURATION_BOOST_ENABLED = opt.enableSaturationBoost;
        SATURATION_BOOST_PCT = opt.saturationBoostPct;
        CMY_K_BALANCE_ENABLED = opt.enableCMYKBalance;
        CMY_K_BALANCE_VALUE = opt.cmyKBalanceValue;
        K_BOOST_ENABLED = opt.enableKBoost;
        LIGHT_COLOR_PROTECT_ENABLED = opt.enableLightColorProtect;

        gProgress = createProgressBar(stats.planned > 0 ? stats.planned : 100);
        var t0 = nowMs();

        // 選択オブジェクトへ適用（色の置換）
        var appliedInfo = null;
        var totalSec = 0;
        var completionInfo = null;
        var cancelled = false;
        var finalSkippedItems = [];
        try {
            appliedInfo = applyToSelection(stats.items);
            addUniqueItems(finalSkippedItems, stats.unsupportedItems);
            addUniqueItems(finalSkippedItems, gSkippedItems);
            totalSec = (nowMs() - t0) / 1000.0; // 変換処理のみの時間
            var skippedDetails = [];
            addSkipBreakdownEntries(skippedDetails, stats.unsupportedBreakdown);
            addSkipBreakdownEntries(skippedDetails, gSkipBreakdown);
            var completionSelectedObjectCount = stats.selectedObjectCount + stats.unsupportedObjectCount;
            completionInfo = {
                selectedObjectCount: formatNumberWithUnit(completionSelectedObjectCount, 'selectedObjectsUnit'),
                updatedColors: appliedInfo.count,
                cacheHitRate: formatPercent(cacheHitCount, stats.planned),
                processingTime: formatCompletionSeconds(totalSec),
                skippedCount: stats.unsupportedObjectCount + gSkipCount,
                skippedMessage: "",
                skippedDetails: skippedDetails
            };
        } catch (e) {
            if (isUserCancelledError(e)) {
                cancelled = true;
            } else {
                throw e;
            }
        } finally {
            cleanupAfterRun();
        }
        if (cancelled) return;

        if (opt.selectSkippedObjects) {
            var selectedSkippedCount = finalSkippedItems.length > 0 ? selectItems(doc, finalSkippedItems) : 0;
            if (selectedSkippedCount === 0) {
                clearSelection(doc);
            } else {
                completionInfo.skippedMessage = uiText('skippedObjectsSelected');
            }
        }

        // 実行結果をダイアログ表示
        showCompletionDialog(completionInfo);
    })();
