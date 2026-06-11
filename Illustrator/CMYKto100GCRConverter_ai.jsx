#target illustrator

/*
SCRIPTMETA-BEGIN
Script-ID=org.iwashi.CMYKto100GCRConverter_ai
Version=2.1.6
Meta-URL=https://github.com/Yamonov/Iwashiya_Scripts/tree/main/Illustrator
Name=色を変えずにCMYK値を300%以下にする
Author=Murakami Yoshiteru
Release-Date=2026-06-11
Target-App=Illustrator
Edit-Password-SHA256=oS5aCLoTCKedGLZN:3d8282cb048f8c02d5bf1dca0493471b70fda75c2a3131e4cb0c10b4c1688127
Description-BEGIN
・選択したCMYKオブジェクトのカラーを、発色を維持しつつ、印刷でのブレが少ないカラー、CMYのうち１〜２版（＋K）の値に整理します。
・彩度調整オプションで、仕上がりの彩度を上げられます。
・墨濁り低減オプションで、墨が濃い印刷向けに薄い色からKを減らせます。
・グレーを墨版オプションは、ハイライト側から積極的にグレーに近い色を墨版に置き換えます。
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

var YamoScriptVersion = formatScriptVersion(readSelfHeaderMeta());
var YAMO_LOCALE_OVERRIDE = ""; // テスト時のみ "ja" または "en" を指定

var UI_TEXT = {
    progressTitle: { ja: "CMYK値を整理中...", en: "Adjusting CMYK..." },
    scanningSelection: { ja: "処理対象を調査中...", en: "Checking selection..." },
    optionsTitle: { ja: "変換オプション", en: "Conversion Options" },
    titleSeparator: { ja: "　｜　", en: " | " },
    targetCount: { ja: "処理対象数", en: "Colors to process" },
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
    saturationAmount: { ja: "  彩度", en: "  Amount" },
    saturationAmountHelp: { ja: "彩度を上げる割合です。", en: "Saturation increase amount." },
    kTaper: { ja: "墨濁り低減", en: "Reduce K muddiness" },
    kTaperHelp: {
        ja: "Kを開始％から終了％まで段階的に減らし、削減分をCMYで調整します。",
        en: "Gradually reduces K from the start value to the end value and compensates with CMY."
    },
    kReduceStart: { ja: "  K削減開始", en: "  K start" },
    kReduceStartHelp: { ja: "この値以下のKを0にします。", en: "K at or below this value is set to 0." },
    kReduceEndHelp: {
        ja: "この値以上のKは変更せず、この値未満を段階的に減らします。",
        en: "K at or above this value is unchanged. Lower values are reduced gradually."
    },
    moreGrayK: { ja: "より多くのグレイを墨版にする", en: "Convert more gray to black plate" },
    moreGrayKHelp: {
        ja: "低彩度のグレーカラーでCMYを減らし、墨版中心の構成に近づけます。",
        en: "Reduces CMY in low-saturation grays and moves them closer to black-plate output."
    },
    cancel: { ja: "キャンセル", en: "Cancel" },
    requireCMYK: { ja: "CMYKドキュメントで実行してください", en: "Run this script in a CMYK document." },
    requireSelection: { ja: "選択してから実行してください", en: "Select objects before running this script." },
    done: { ja: "完了", en: "Done" },
    selectedObjects: { ja: "選択オブジェクト数", en: "Selected objects" },
    processedColors: { ja: "処理色数", en: "Processed colors" },
    processingTime: { ja: "処理時間", en: "Processing time" },
    cacheRate: { ja: "キャッシュ利用率", en: "Cache use rate" },
    skippedCount: { ja: "未適用件数", en: "Skipped items" },
    secondsUnit: { ja: "秒", en: "sec" },
    timeSeconds: { ja: "約{sec}秒", en: "about {sec} sec" },
    timeMinutes: { ja: "約{min}分", en: "about {min} min" },
    timeMinutesSeconds: { ja: "約{min}分{sec}秒", en: "about {min} min {sec} sec" },
    timeHours: { ja: "約{hour}時間", en: "about {hour} hr" },
    timeHoursMinutes: { ja: "約{hour}時間{min}分", en: "about {hour} hr {min} min" }
};

function currentLocaleCode() {
    var raw = YAMO_LOCALE_OVERRIDE || $.locale || "";
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

//-----------------------------------------------------
// 最小二乗補正
var LS_JACOBIAN_STEP = 1.0; // 数値ヤコビアンの微小ステップ（%）
var LS_LAMBDA = 0.1; // 最小二乗の正則化
var LS_PIVOT_EPS = 1e-12; // 最小二乗の特異判定
var K_TAPER_CHANGE_EPS = 0.01; // K削減後に再計算する最小変化量

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

// K削減オプション（後処理）
var DEFAULT_K_TAPER_ENABLED = false;
var DEFAULT_K_REDUCE_START = 5;
var DEFAULT_K_REDUCE_END = 20;
var DEFAULT_SATURATION_BOOST_ENABLED = false;
var DEFAULT_SATURATION_BOOST_PCT = 5;
var DEFAULT_MORE_GRAY_TO_K_ONLY_ENABLED = false;
var ESTIMATE_FIXED_SECONDS = 3.2;
var ESTIMATE_UNCACHED_SECONDS_PER_COLOR = 0.0035;
var ESTIMATE_CACHED_SECONDS_PER_COLOR = 0.00021;
var ESTIMATE_ASSUMED_CACHE_RATE = 0.2;
var SATURATION_BOOST_FULL_CHROMA = 20; // C*ab がこの値以上なら指定どおりの彩度補正
var K_TAPER_ENABLED = DEFAULT_K_TAPER_ENABLED; // ScriptUIで「墨濁り低減」がオンのときに有効化
var K_REDUCE_START = DEFAULT_K_REDUCE_START; // Kがこの値以下なら強制的に0に（ScriptUIで変更）
var K_REDUCE_END = DEFAULT_K_REDUCE_END; // Kがこの値以上なら変更しない（ScriptUIで変更）
var SATURATION_BOOST_ENABLED = DEFAULT_SATURATION_BOOST_ENABLED; // ScriptUIで「彩度補正」がオンのときに有効化
var SATURATION_BOOST_PCT = DEFAULT_SATURATION_BOOST_PCT; // a*, b* をこの割合だけ拡大
var MORE_GRAY_TO_K_ONLY_ENABLED = DEFAULT_MORE_GRAY_TO_K_ONLY_ENABLED; // 低彩度グレーでK-only候補を広げる

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

function resetSkipCount() {
    gSkipCount = 0;
}

function countSkip() {
    gSkipCount++;
}

function createProgressBar(initialMax) {
    var win = new Window('palette', uiText('progressTitle') + ' ' + YamoScriptVersion, undefined, {
        closeButton: false
    });
    var bar = win.add('progressbar', undefined, 0, Math.max(1, initialMax | 0));
    bar.preferredSize = [400, 20];
    win.layout.layout(true);
    win.center();
    win.show();
    var state = {
        win: win,
        bar: bar,
        value: 0,
        max: Math.max(1, initialMax | 0),
        updateEvery: 10
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
                try {
                    state.win.update();
                } catch (e) { }
            }
        },
        close: function () {
            try {
                state.win.close();
            } catch (e) { }
        }
    };
}

function createStatusWindow(message, width) {
    var frames = ['●○○', '○●○', '○○●'];
    var frameIndex = 0;
    var tickCount = 0;
    var updateEvery = 50;
    var updateIntervalMs = 300;
    var lastUpdateMs = nowMs();
    var win = new Window('palette', message, undefined, {
        closeButton: false
    });
    win.alignChildren = 'center';
    var label = win.add('statictext', undefined, message + ' ' + frames[frameIndex]);
    label.preferredSize = [width || 200, 22];
    try {
        label.justify = 'center';
    } catch (e) { }
    win.layout.layout(true);
    win.center();
    win.show();
    try {
        win.update();
    } catch (e) { }

    return {
        tick: function () {
            tickCount++;
            if ((tickCount % updateEvery) !== 0) return;
            var t = nowMs();
            if ((t - lastUpdateMs) < updateIntervalMs) return;
            frameIndex = (frameIndex + 1) % frames.length;
            label.text = message + ' ' + frames[frameIndex];
            lastUpdateMs = t;
            try {
                win.update();
            } catch (e) { }
        },
        close: function () {
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

function dialogVersionText() {
    return String(YamoScriptVersion);
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

// 「変換オプション」ダイアログ
function showConvertOptionsDialog(pathCount) {
    var dlg = new Window('dialog', uiText('optionsTitle') + uiText('titleSeparator') + dialogVersionText());
    dlg.orientation = 'column';
    dlg.alignChildren = 'fill';

    // 対象パス数と予測時間
    var infoGroup = dlg.add('group');
    infoGroup.orientation = 'row';
    infoGroup.alignChildren = 'center';
    infoGroup.add('statictext', undefined, uiText('targetCount') + ': ' + pathCount);
    infoGroup.add('statictext', [0, 0, 36, 18], '');

    var estimateSec = estimateProcessingSeconds(pathCount);
    var estimateText = infoGroup.add('statictext', undefined, uiText('estimateTime') + ': ' + formatEstimatedTime(estimateSec));
    estimateText.helpTip = uiText('estimateHelp');
    if (estimateSec >= 60) setStaticTextRed(estimateText);

    // 調整オプションをまとめたパネル
    var kPanel = dlg.add('panel');
    kPanel.alignChildren = 'left';
    kPanel.orientation = 'column';

    var satGroup = kPanel.add('group');
    satGroup.orientation = 'row';
    var chkSatBoost = satGroup.add('checkbox', undefined, uiText('saturationBoost'));
    chkSatBoost.value = false;
    chkSatBoost.helpTip = uiText('saturationBoostHelp');
    var labelSat = satGroup.add('statictext', [0, 0, 42, 18], uiText('saturationAmount'));
    var ddSat = satGroup.add('dropdownlist', undefined, ['10', '20', '30']);
    ddSat.selection = 0; // デフォルトは 10%
    ddSat.helpTip = uiText('saturationAmountHelp');
    var labelSatPct = satGroup.add('statictext', [0, 0, 14, 18], '%');
    var satToggleTargets = [labelSat, ddSat, labelSatPct];

    // 墨濁り低減チェックとK削減開始/終了オプションを1行にまとめる
    var optGroup = kPanel.add('group');
    optGroup.orientation = 'row';
    var chkSaturation = optGroup.add('checkbox', undefined, uiText('kTaper'));
    chkSaturation.value = false; // 初期値はOFF
    chkSaturation.helpTip = uiText('kTaperHelp');

    // K削減開始/終了オプション（1行にまとめる）
    var labelK = optGroup.add('statictext', [0, 0, 70, 18], uiText('kReduceStart'));
    var ddK = optGroup.add('dropdownlist', undefined, ['3', '5', '10', '15']);
    ddK.selection = 1; // デフォルトは 5%
    ddK.helpTip = uiText('kReduceStartHelp');
    optGroup.add('statictext', [0, 0, 18, 18], '〜');
    var labelKEnd = optGroup.add('statictext', undefined, '');
    var ddKEnd = optGroup.add('dropdownlist', undefined, ['20', '30', '40', '50', '60']);
    ddKEnd.selection = 0; // デフォルトは 20%
    ddKEnd.helpTip = uiText('kReduceEndHelp');
    var labelPctEnd = optGroup.add('statictext', [0, 0, 14, 18], '%');
    var toggleTargets = [labelK, ddK, labelKEnd, ddKEnd, labelPctEnd];

    var grayKGroup = kPanel.add('group');
    grayKGroup.orientation = 'row';
    var chkMoreGrayK = grayKGroup.add('checkbox', undefined, uiText('moreGrayK'));
    chkMoreGrayK.value = false;
    chkMoreGrayK.helpTip = uiText('moreGrayKHelp');

    function updateEnabled() {
        setControlsEnabled(satToggleTargets, chkSatBoost.value);
        setControlsEnabled(toggleTargets, chkSaturation.value);
    }
    chkSatBoost.onClick = updateEnabled;
    chkSaturation.onClick = updateEnabled;
    updateEnabled();

    // ボタン
    var btnGroup = dlg.add('group');
    btnGroup.alignment = 'right';
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
        enableKTaper: false,
        kReduceStart: K_REDUCE_START,
        kReduceEnd: K_REDUCE_END,
        enableMoreGrayKOnly: false
    };

    var ret = dlg.show();
    if (ret !== 1) {
        return result; // ok=false のまま返す
    }

    result.ok = true;
    result.enableSaturationBoost = chkSatBoost.value;
    result.saturationBoostPct = readDropdownInt(ddSat, result.saturationBoostPct);
    result.enableKTaper = chkSaturation.value;
    result.kReduceStart = readDropdownInt(ddK, result.kReduceStart);
    result.kReduceEnd = readDropdownInt(ddKEnd, result.kReduceEnd);
    result.enableMoreGrayKOnly = chkMoreGrayK.value;
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

function copyLab(lab) {
    return {
        L: lab.L,
        a: lab.a,
        b: lab.b
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

function taperKValue(k0) {
    if (k0 <= K_REDUCE_START) return 0;
    if (k0 >= K_REDUCE_END) return k0;

    var w = (k0 - K_REDUCE_START) / (K_REDUCE_END - K_REDUCE_START);
    if (w < 0) w = 0;
    if (w > 1) w = 1;
    return k0 * w;
}

function buildCMYRefineMask(cmyk) {
    return {
        c: (cmyk.c > ZERO_THR),
        m: (cmyk.m > ZERO_THR),
        y: (cmyk.y > ZERO_THR),
        k: false
    };
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

// -------- K削減 + CMY再フィット（Labを維持するための後処理） --------
function taperKAndRefineCMY(adj, targetLab) {
    // adj: {c,m,y,k,(L,a,b,dE)} / targetLab: {L,a,b}
    if (!adj || !targetLab) return adj;

    // 元の値をコピー
    var out = copyCMYK(adj);

    // K削減全体が無効なら何もしない
    if (!K_TAPER_ENABLED) {
        return adj;
    }

    if (isAlmostPureK(out)) return adj;

    var k0 = out.k;
    out.k = taperKValue(k0);

    if (Math.abs(out.k - k0) < K_TAPER_CHANGE_EPS) return adj;

    var res = refineWithMaskLS(out, targetLab, buildCMYRefineMask(out));
    return res || makeLabResultFromCMYK(out, targetLab);
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

function getDirectPatternInfo(pattern) {
    var info = DIRECT_PATTERN_INFO[pattern];
    if (info) return info;
    throw "未定義のCMYKパターンです: " + pattern;
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
    if (MORE_GRAY_TO_K_ONLY_ENABLED) return true;
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

    var adj = adjustDirectPatterned(orig, targetLab);
    if (!adj) {
        trimLabCacheAfterSearch();
        return makeColorProcessResult(false, 'noCandidate');
    }

    if (K_TAPER_ENABLED && adj.k < K_REDUCE_END) {
        adj = taperKAndRefineCMY(adj, targetLab);
    }

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

    var orig = extractCMYK(color);
    if (!orig) return makeColorProcessResult(false, 'nonCMYK'); // spot/gray/RGB等

    // Spot（グローバルCMYK）の場合は、スウォッチ（Spot）のベース色を書き換える。オブジェクト側は触らない。
    if (orig._isSpot && orig._spotRef) {
        return processSpotColorObject(orig);
    }

    return buildAdjustedColorResult(orig, true);
}

function applyColorResultToProperty(target, propName, res) {
    if (!res || !res.changed) {
        if (res && res.reason && res.reason !== 'same' && res.reason !== 'spotAlreadyProcessed') {
            countSkip();
        }
        return 0;
    }
    if (!res.spot) {
        target[propName] = makeCMYK(res.out.c, res.out.m, res.out.y, res.out.k);
    }
    return 1;
}

function processColorProperty(target, propName, allowGradient) {
    try {
        var col = target[propName];
        if (!col) return 0;
        if (allowGradient && col.typename === 'GradientColor') {
            var res = processGradientColor(col);
            if (res.changed) target[propName] = col;
            return res.changed;
        }
        var changed = applyColorResultToProperty(target, propName, processColorObject(col));
        stepProgress(1);
        return changed;
    } catch (e) {
        countSkip();
        return 0;
    }
}

function getTextFrameAttributes(tf) {
    try {
        return tf.textRange.characterAttributes;
    } catch (e) { }
    return null;
}

function processTextAttributesColors(attrs) {
    if (!attrs) return 0;
    var changes = 0;
    changes += processColorProperty(attrs, 'fillColor', false);
    changes += processColorProperty(attrs, 'strokeColor', false);
    return changes;
}

// TextFrame の文字カラー処理（塗り/線）: 実務で使用する統計を返す
function processTextFrameColors(tf) {
    var attrs = getTextFrameAttributes(tf);
    if (!attrs) {
        countSkip();
        return {
            changes: 0
        };
    }
    return {
        changes: processTextAttributesColors(attrs)
    };
}

// GradientColor を処理（各ストップの CMYK/SpotColor） - カウンタ集計
function processGradientColor(gradColor) {
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
                changed += applyColorResultToProperty(stop, 'color', processColorObject(col));
            }
        } catch (e) {
            countSkip();
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
            countSkip();
            filled = false;
        }
    }
    if (typeof stroked === 'undefined') {
        try {
            stroked = item.stroked;
        } catch (e2) {
            countSkip();
            stroked = false;
        }
    }
    if (filled) changes += processColorProperty(item, 'fillColor', true);
    if (stroked) changes += processColorProperty(item, 'strokeColor', true);
    return {
        changes: changes
    };
}

function walkSelectionArtItems(visitor) {
    var doc = app.activeDocument;
    var sel = doc.selection;
    if (!sel || sel.length === 0) return false;

    function walk(it) {
        if (!it) return;
        var tn = it.typename;
        if (tn === 'GroupItem') {
            var arr = it.pageItems;
            for (var i = 0, n = arr.length; i < n; i++) walk(arr[i]);
        } else if (tn === 'CompoundPathItem') {
            var arr2 = it.pathItems;
            for (var j = 0, n2 = arr2.length; j < n2; j++) walk(arr2[j]);
        } else if (tn === 'TextFrame' || tn === 'PathItem' || tn === 'MeshItem') {
            visitor(it);
        }
    }
    for (var i = 0, nSel = sel.length; i < nSel; i++) walk(sel[i]);
    return true;
}

function countTextFrameAttempts(tf) {
    return 2;
}

function countPageItemAttempts(it) {
    var cnt = 0;
    try {
        if (it.filled) cnt += 1;
    } catch (e) { }
    try {
        if (it.stroked) cnt += 1;
    } catch (e) { }
    return cnt;
}

function applySelectionArtItem(it) {
    return (it.typename === 'TextFrame') ? processTextFrameColors(it).changes : processPageItemColors(it).changes;
}

function countSelectionArtItemAttempts(it) {
    return (it.typename === 'TextFrame') ? countTextFrameAttempts(it) : countPageItemAttempts(it);
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
    var items = [];
    var statusWindow = showStatusWindow ? createStatusWindow(uiText('scanningSelection'), 200) : null;
    try {
        walkSelectionArtItems(function (it) {
            var entry = makeSelectionArtItemEntry(it);
            items.push(entry);
            selectedObjectCount++;
            planned += entry.attempts;
            if (statusWindow) statusWindow.tick();
        });
    } catch (e) { }
    if (statusWindow) statusWindow.close();
    return {
        planned: planned,
        selectedObjectCount: selectedObjectCount,
        items: items
    };
}

function formatPercent(numerator, denominator) {
    if (!denominator || denominator <= 0) return "0%";
    return round2((numerator / denominator) * 100) + "%";
}

function buildResultMessage(selectedObjectCount, plannedCount, appliedInfo, totalSec) {
    var msg = [];
    msg.push(uiText('done'));
    msg.push(uiText('selectedObjects') + ": " + selectedObjectCount);
    msg.push(uiText('processedColors') + ": " + appliedInfo.count);
    msg.push(uiText('processingTime') + ": " + round2(totalSec) + " " + uiText('secondsUnit'));
    msg.push(uiText('cacheRate') + ": " + formatPercent(cacheHitCount, plannedCount));
    if (gSkipCount > 0) {
        msg.push(uiText('skippedCount') + ": " + gSkipCount);
    }
    return msg;
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
        K_TAPER_ENABLED = DEFAULT_K_TAPER_ENABLED;
        K_REDUCE_START = DEFAULT_K_REDUCE_START;
        K_REDUCE_END = DEFAULT_K_REDUCE_END;
        SATURATION_BOOST_ENABLED = DEFAULT_SATURATION_BOOST_ENABLED;
        SATURATION_BOOST_PCT = DEFAULT_SATURATION_BOOST_PCT;
        MORE_GRAY_TO_K_ONLY_ENABLED = DEFAULT_MORE_GRAY_TO_K_ONLY_ENABLED;
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

        if (!validateActiveDocument()) return;

        resetSkipCount();

        var stats = collectSelectionStats(true);

        var opt = showConvertOptionsDialog(stats.planned);
        if (!opt || !opt.ok) {
            // ユーザーがキャンセルした場合は処理を中止
            return;
        }
        SATURATION_BOOST_ENABLED = opt.enableSaturationBoost;
        SATURATION_BOOST_PCT = opt.saturationBoostPct;
        K_TAPER_ENABLED = opt.enableKTaper;
        K_REDUCE_START = opt.kReduceStart;
        K_REDUCE_END = opt.kReduceEnd;
        MORE_GRAY_TO_K_ONLY_ENABLED = opt.enableMoreGrayKOnly;

        gProgress = createProgressBar(stats.planned > 0 ? stats.planned : 100);
        var t0 = nowMs();

        // 選択オブジェクトへ適用（色の置換）
        var appliedInfo = null;
        var totalSec = 0;
        var msg = null;
        try {
            appliedInfo = applyToSelection(stats.items);
            totalSec = (nowMs() - t0) / 1000.0; // 変換処理のみの時間
            msg = buildResultMessage(stats.selectedObjectCount, stats.planned, appliedInfo, totalSec);
        } finally {
            cleanupAfterRun();
        }

        // 実行結果をダイアログ表示
        alert(msg.join("\n"));
    })();
