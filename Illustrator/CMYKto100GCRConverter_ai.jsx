#target illustrator

/*
SCRIPTMETA-BEGIN
Script-ID=org.iwashi.CMYKto100GCRConverter_ai
Meta-Default-language=ja
Version=2.7
Meta-URL=https://github.com/Yamonov/Iwashiya_Scripts/tree/main/Illustrator
Name=色を変えずにCMYK値を調整
Name[en]=Optimize CMYK Color Separations
Tags=カラー,color,CMYK,製版,prepress
Author=Murakami Yoshiteru
Release-Date=2026-11-17
Target-App=Illustrator
Edit-Password-SHA256=oS5aCLoTCKedGLZN:3d8282cb048f8c02d5bf1dca0493471b70fda75c2a3131e4cb0c10b4c1688127
Description-BEGIN
[ja]
・選択したCMYKオブジェクトのカラーを、発色を維持しつつ、印刷でのブレが少ないカラー、CMYのうち１〜２版（＋K）の値に整理します。
・彩度調整オプションで、仕上がりの彩度を上げられます。
・K量の調整オプションで、Kを減らす方向または増やす方向へ段階的に寄せられます。増やすとより多くのグレートーンがKのみに、減らすとCMYからKを抜いてK濁りを抑えます。
・グローバルスウォッチ、グラデーションにも対応しています。
・選択したグループ内を多重クリッピングまで調べ、複合パスを一度ずつ処理します。
・変換済みのグローバルカラーとグラデーションを作成し、選択範囲に適用します。変換済みCMYKグローバルスウォッチの名前にはCMYK値と元の独自名を使用します。
・「指定スウォッチを無視」で、チェックしたグローバルカラー・特色・グラデーションの定義を使うオブジェクト全体を処理対象から外せます。濃度違いとグラデーションの停止点も判定します。
・無視するスウォッチは行をクリックして指定・解除します。Spaceキーでも、最後に操作した行の指定を切り替えられます。
・「K100の自動墨ノセを回避」をオンにすると、選択範囲内で不透明度100%の単色のうち、最終結果がK100のものとグレー濃度100%のものを、K100/Y1の共通グローバルスウォッチ（Y設定値1.01%）に置き換え、対象のオーバープリント属性も解除します。

■注意！
・アピアランスで塗ったテキストはアピアランス分割してください。
・内部を取得できないグループや複合パスは、未適用オブジェクトとして報告します。
※ 分版プレビューでKをオフにしてから実行すると、効果と処理が抜けた箇所が分かりやすくなります。
・グラデーションメッシュとブレンドオブジェクトは非対応です。

[en]
- Simplifies the colors of selected CMYK objects to one or two CMY plates plus K, preserving their appearance while reducing variation in print.
- The saturation option can increase the saturation of the result.
- The K amount option adjusts black ink in steps, either decreasing or increasing it. Increasing K converts more gray tones to K only; decreasing it reduces black in CMY mixtures to avoid muddy colors.
- Supports global swatches and gradients.
- Traverses nested clipping groups and processes each compound path once.
- Creates converted global colors and gradients and applies them within the selection. Converted CMYK global swatch names include the CMYK values and the original custom name.
- "Ignore specified swatches" excludes entire objects that use checked global color, spot color, or gradient definitions, including tints and gradient stops.
- Click a swatch row to toggle its ignore setting. Press and release Space to toggle the last active row.
- When "Avoid Automatic K100 Overprint" is enabled, fully opaque solid colors in the selection that end up as K100, including 100% grayscale black, are replaced with a shared K100/Y1 global swatch (Y is set to 1.01%). Overprint is also disabled for the affected objects.

Important:
- Use Expand Appearance on text with fills applied through the Appearance panel.
- Groups and compound paths whose contents cannot be accessed are reported as unapplied objects.
- Turn off K in Separations Preview before running the script to make the effect and any missed areas easier to see.
- Gradient meshes and blend objects are not supported.
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
        version: (s.match(/^Version=([^\n]+)(?:\n|$)/m) || [])[1] || ""
    };
}

function formatScriptVersionOnly(meta) {
    return meta.version ? "Ver " + meta.version : "";
}

var YamoScriptMeta = readSelfHeaderMeta();
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
    ignoreSpecifiedSwatches: { ja: "指定スウォッチを無視", en: "Ignore specified swatches" },
    ignoreSpecifiedSwatchesHelp: {
        ja: "チェックしたスウォッチの定義を使うオブジェクト全体を無視します。濃度違いとグラデーションの停止点を含みます。テキストはフレーム全体が対象です。",
        en: "Ignores entire objects using the checked swatch definitions, including tints and gradient stops. Text is handled per frame."
    },
    ignoredSwatchList: { ja: "無視するスウォッチ", en: "Swatches to ignore" },
    noLinkedSwatches: { ja: "対象のスウォッチがありません。", en: "No eligible swatches." },
    swatchListReadFailed: { ja: "スウォッチを取得できませんでした。", en: "Could not read the swatches." },
    swatchListPartial: { ja: "取得できなかったスウォッチ: {count}件", en: "Unreadable swatches: {count}" },
    swatchGlobal: { ja: "グローバル", en: "Global color" },
    swatchSpot: { ja: "特色", en: "Spot color" },
    swatchGradient: { ja: "グラデーション", en: "Gradient" },
    swatchCheckHelp: { ja: "□：無視指定なし／■：無視指定あり。行をクリックすると切り替わります。Spaceは離したときに、最後に操作した行を1回だけ切り替えます。", en: "□: not ignored / ■: ignored. Click a row to toggle it. Press and release Space to toggle the last active row once." },
    swatchPreviewHelp: { ja: "識別用のRGBプレビュー", en: "RGB preview for identification" },
    swatchGradientPreviewHelp: { ja: "グラデーションの簡易RGBプレビュー", en: "Approximate RGB gradient preview" },
    swatchPreviewUnavailable: { ja: "色のプレビューを取得できませんでした。", en: "The color preview could not be read." },
    ignoredObjects: { ja: "無視件数", en: "Ignored objects" },
    ignoredSwatchesResult: { ja: "選択内での無視スウォッチ", en: "Ignored swatches in selection" },
    estimateTime: { ja: "予測最大時間", en: "Estimated maximum time" },
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
        ja: "K+側で有効です。CMYK値は四捨五入して整数化しますが、1〜3%の成分は0%にせず残します。明るく色味のある薄い色で、CMYが減ってもKが十分増えない場合は、CMYを消す変換を採用しません。",
        en: "Available on the K+ side. Rounds CMYK values to integers but retains 1–3% components instead of setting them to zero. For light colors with visible chroma, rejects conversions that remove CMY without adding enough K."
    },
    avoidAutoBlackOverprint: { ja: "K100の自動墨ノセを回避", en: "Avoid automatic overprint for K100" },
    avoidAutoBlackOverprintHelp: {
        ja: "全オプション適用後、選択範囲内のC0/M0/Y0/K100の塗り・線・文字色をC0/M0/Y1/K100の共通グローバルスウォッチに置き換え、対象のオーバープリント属性を解除します。Yの設定値は1.01%とし、保存後も1%以上であることを確認します。元からK100のものと、グレー濃度100%の単色も含みます。既に専用スウォッチを使う対象もオーバープリント属性を確認します。オブジェクトと親グループ・レイヤーの不透明度が全て100%の場合に適用します。グラデーションは対象外です。不透明マスクとアピアランス内の個別の不透明度は確認できません。",
        en: "After all conversion options, replaces solid C0/M0/Y0/K100 fills, strokes, and text colors in the selection with one C0/M0/Y1/K100 global swatch and disables their overprint attributes, including existing K100 colors and 100% grayscale black. Yellow is set to 1.01% and verified to remain at or above 1% after storage. Also checks overprint on eligible paints already using the dedicated swatch. The object and all parent groups and layers must have 100% opacity. Gradients are excluded. Opacity masks and individual appearance opacity cannot be checked."
    },
    autoBlackOverprintSwatchName: { ja: "自動墨ノセ回避K100", en: "K100 Auto Overprint Avoidance" },
    autoBlackOverprintNotice: {
        ja: "自動墨ノセ処理回避のため、K100オブジェクトをK100/Y1のグローバルスウォッチに登録しました。ノセにしたいものは個別に選択し、K100にしてください。",
        en: "To avoid automatic black overprinting, K100 objects have been assigned to a K100/Y1 global swatch. For objects you want to overprint, select them individually and set them to K100."
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
    swatchRenameSkipped: { ja: "スウォッチ名の未更新", en: "Swatch names not updated" },
    swatchRenameSkippedHelp: {
        ja: "名前の重複や取得・更新の失敗があったため、改名を見送りました。色の変換結果は保持されています。",
        en: "Some names could not be updated because of name conflicts or read/write failures. Color conversions have been retained."
    },
    processingTime: { ja: "処理時間", en: "Processing time" },
    processingTimeBreakdown: {
        ja: "色変換・スウォッチ処理: {conversion}\n後処理・画面更新: {cleanup}\n選択更新: {selection}",
        en: "Color conversion and swatches: {conversion}\nCleanup and redraw: {cleanup}\nSelection update: {selection}"
    },
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
    skippedObjectsPartiallySelected: {
        ja: "未適用オブジェクト{total}件のうち{selected}件を選択しました。選択できなかったオブジェクトがあります。",
        en: "Selected {selected} of {total} unapplied objects. Some objects could not be selected."
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
var DEFAULT_AVOID_AUTO_BLACK_OVERPRINT_ENABLED = false;
var AUTO_BLACK_OVERPRINT_CMYK = { c: 0, m: 0, y: 1.01, k: 100 };
var AUTO_BLACK_OVERPRINT_MIN_Y = 1;
var AUTO_BLACK_OVERPRINT_CMYK_EPS = 1e-6; // Illustratorが返すCMYK百分率の微小な丸め誤差を許容
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
var AVOID_AUTO_BLACK_OVERPRINT_ENABLED = DEFAULT_AVOID_AUTO_BLACK_OVERPRINT_ENABLED;
var SATURATION_BOOST_ENABLED = DEFAULT_SATURATION_BOOST_ENABLED; // ScriptUIで「彩度補正」がオンのときに有効化
var SATURATION_BOOST_PCT = DEFAULT_SATURATION_BOOST_PCT; // a*, b* をこの割合だけ拡大

var CMYK_CHANNELS = ['c', 'm', 'y', 'k'];
var DIRECT_PATTERN_INFO = {
    K: { pattern: 'K', channelIds: [3], useC: false, useM: false, useY: false },
    C: { pattern: 'C', channelIds: [0, 3], useC: true, useM: false, useY: false },
    M: { pattern: 'M', channelIds: [1, 3], useC: false, useM: true, useY: false },
    Y: { pattern: 'Y', channelIds: [2, 3], useC: false, useM: false, useY: true },
    CM: { pattern: 'CM', channelIds: [0, 1, 3], useC: true, useM: true, useY: false },
    MY: { pattern: 'MY', channelIds: [1, 2, 3], useC: false, useM: true, useY: true },
    YC: { pattern: 'YC', channelIds: [2, 0, 3], useC: true, useM: false, useY: true }
};
var DIRECT_BASE_PATTERN_INFOS = [
    DIRECT_PATTERN_INFO.K,
    DIRECT_PATTERN_INFO.CM,
    DIRECT_PATTERN_INFO.MY,
    DIRECT_PATTERN_INFO.YC
];
var DIRECT_SINGLE_PATTERN_INFOS = [
    DIRECT_PATTERN_INFO.C,
    DIRECT_PATTERN_INFO.M,
    DIRECT_PATTERN_INFO.Y
];
var DIRECT_SINGLE_FALLBACK_DE_MIN = 0.35;
var K_ONLY_SEED = { c: 0, m: 0, y: 0, k: 50 };
var CMY_REFINE_MASKS = [
    { c: true, m: true, y: false, k: false },
    { c: false, m: true, y: true, k: false },
    { c: true, m: false, y: true, k: false }
];
var K_REFINE_MASK = { c: false, m: false, y: false, k: true };
var K_ONLY_REFINE_STEPS = [20, 10, 5, 2, 1];

// 進行状況バー（ScriptUI）: 幅400px、分母は動的に+10%
var gProgress = null;
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
    spotWriteFailed: { ja: "グローバルカラー作成不可", en: "Global color creation failed" },
    gradientWriteFailed: { ja: "グラデーション作成不可", en: "Gradient creation failed" },
    autoBlackOverprintFailed: { ja: "墨ノセ回避色の適用不可", en: "Could not apply the automatic overprint avoidance color" },
    autoBlackOverprintNameConflict: { ja: "墨ノセ回避スウォッチと同名の別の色あり", en: "Another color uses the overprint avoidance swatch name" },
    autoBlackOverprintReadFailed: { ja: "墨ノセ回避スウォッチの確認不可", en: "Could not inspect the overprint avoidance swatch" },
    autoBlackOverprintCreateFailed: { ja: "墨ノセ回避スウォッチの作成不可", en: "Could not create the overprint avoidance swatch" },
    autoBlackOverprintVerifyFailed: { ja: "墨ノセ回避スウォッチのY値確認不可", en: "Could not verify the overprint avoidance swatch's yellow value" },
    overprintWriteFailed: { ja: "オーバープリント解除不可", en: "Could not disable overprint" },
    opacityReadFailed: { ja: "不透明度の確認不可", en: "Opacity could not be checked" },
    colorReadFailed: { ja: "カラー取得不可", en: "Color read failed" },
    colorWriteFailed: { ja: "カラー更新不可", en: "Color update failed" },
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
    gSkipBreakdown = [];
}

function countSkip(entry, reason) {
    if (!entry || entry.skipped) return;
    entry.skipped = true;
    if (entry.workList) entry.workList.skipped[entry.workIndex] = true;
    reason = reason || "unknown";
    addSkipBreakdownEntry(gSkipBreakdown, "process:" + reason, skipReasonLabel(reason), 1);
}

function itemUUIDKey(item) {
    try {
        var uuid = item.uuid;
        if (uuid || uuid === 0) return "uuid:" + String(uuid);
    } catch (e) { }
    return null;
}

function addUniqueSelectableItem(items, item, seenKeys, fallbackRefs) {
    if (!item) return false;
    var key = artItemKey(item, fallbackRefs);
    if (seenKeys[key]) return false;
    seenKeys[key] = true;
    items.push(item);
    return true;
}

function artItemKey(item, references) {
    var key = itemUUIDKey(item);
    if (key) return key;
    for (var i = 0; i < references.length; i++) {
        if (references[i] === item) return 'ref:' + i;
    }
    references.push(item);
    return 'ref:' + (references.length - 1);
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
            if (items[i].selected) selected++;
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
        nextUpdate: PROGRESS_STATUS_CHECK_EVERY,
        updateCount: 0,
        checkpointCount: 0
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
            var shouldUpdate = (forceUpdate || state.value >= state.max || state.value >= state.nextUpdate);
            if (shouldUpdate) {
                while (state.nextUpdate <= state.value) state.nextUpdate += state.updateEvery;
                state.bar.value = Math.min(state.value, state.max);
                state.updateCount++;
                var shouldCheckCancel = (state.updateCount % PROGRESS_CANCEL_CHECK_EVERY_UPDATES) === 0;
                try {
                    state.win.update();
                } catch (e) { }
                if (cancelled) throw makeUserCancelledError();
                if (shouldCheckCancel && isEscapePressed()) requestCancel();
                if (cancelled) throw makeUserCancelledError();
            }
        },
        checkpoint: function () {
            state.checkpointCount++;
            if ((state.checkpointCount % state.updateEvery) !== 0) return;
            try {
                state.win.update();
            } catch (e) { }
            if (isEscapePressed()) requestCancel();
            if (cancelled) throw makeUserCancelledError();
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

function checkpointProgress() {
    if (gProgress) gProgress.checkpoint();
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

function swatchKindLabel(kind) {
    var keys = { global: 'swatchGlobal', spot: 'swatchSpot', gradient: 'swatchGradient' };
    return uiText(keys[kind]);
}

function swatchPreviewRGB(color, cache) {
    var type = String(color.typename);
    var tint = 1;
    if (type === 'SpotColor') {
        tint = clamp01(color.tint / 100);
        color = color.spot.color;
        type = String(color.typename);
    }
    var values;
    var space;
    if (type === 'CMYKColor') {
        values = [color.cyan, color.magenta, color.yellow, color.black];
    } else if (type === 'LabColor') {
        values = [color.l, color.a, color.b];
        space = ImageColorSpace.LAB;
    } else if (type === 'GrayColor') {
        values = [color.gray];
    } else if (type === 'RGBColor') {
        values = [color.red, color.green, color.blue];
    } else {
        throw new Error('Preview color unavailable');
    }
    var key = type + ':' + values.join(',') + ':' + tint;
    if (cache[key]) return cache[key];
    for (var v = 0; v < values.length; v++) {
        if (typeof values[v] !== 'number' || !isFinite(values[v])) throw new Error('Invalid preview components');
    }
    var rgb;
    // 識別用の色玉は簡易計算とし、CMYKとグレーの表示だけのためにCMMを呼ばない。
    // 本体の色変換は、このプレビュー処理とは別に従来どおり行う。
    if (type === 'CMYKColor') {
        var ink = 1 - clamp01(values[3] / 100);
        rgb = [255 * (1 - clamp01(values[0] / 100)) * ink,
            255 * (1 - clamp01(values[1] / 100)) * ink,
            255 * (1 - clamp01(values[2] / 100)) * ink];
    } else if (type === 'GrayColor') {
        var gray = 255 * (1 - clamp01(values[0] / 100));
        rgb = [gray, gray, gray];
    } else if (type === 'RGBColor') {
        rgb = values;
    } else {
        rgb = app.convertSampleColor(space, values, ImageColorSpace.RGB, ColorConvertPurpose.defaultpurpose);
    }
    var result = [];
    for (var i = 0; i < 3; i++) {
        if (typeof rgb[i] !== 'number' || !isFinite(rgb[i])) throw new Error('Invalid RGB preview');
        result.push(clamp01(rgb[i] / 255) * tint + 1 - tint);
    }
    result.push(1);
    cache[key] = result;
    return result;
}

function swatchPreviewColors(entry, cache) {
    try {
        if (entry.kind !== 'gradient') {
            return { kind: 'solid', colors: [swatchPreviewRGB(entry.reference.color, cache)] };
        }
        var stops = entry.reference.gradientStops;
        var samples = [];
        for (var i = 0; i < stops.length; i++) {
            var stop = stops[i];
            var rgb = swatchPreviewRGB(stop.color, cache);
            var position = stop.rampPoint;
            var opacity = stop.opacity;
            if (typeof position !== 'number' || !isFinite(position) || typeof opacity !== 'number' || !isFinite(opacity)) {
                throw new Error('Gradient preview attributes unavailable');
            }
            samples.push({ position: position / 100, color: [rgb[0], rgb[1], rgb[2], clamp01(opacity / 100)] });
        }
        if (samples.length < 2) throw new Error('Gradient preview unavailable');
        samples.sort(function (a, b) { return a.position - b.position; });
        var colors = [];
        var index = 0;
        for (var x = 0; x < 15; x++) {
            var position = x / 14;
            while (index + 1 < samples.length && position > samples[index + 1].position) index++;
            var first = samples[index];
            var last = samples[Math.min(index + 1, samples.length - 1)];
            var distance = last.position - first.position;
            var amount = distance > 0 ? clamp01((position - first.position) / distance) : 0;
            var color = [];
            for (var channel = 0; channel < 4; channel++) {
                color.push(first.color[channel] * (1 - amount) + last.color[channel] * amount);
            }
            colors.push(color);
        }
        return { kind: 'gradient', colors: colors };
    } catch (e) {
        return { kind: 'unknown', colors: [] };
    }
}

function createSwatchPreviewPNG(preview) {
    // 15pxのRGBA画像をメモリ上で生成する。PNGのIDATは非圧縮DEFLATEを使う。
    var size = 15;
    var bytes = new Array(size * (size * 4 + 1));
    var byteIndex = 0;
    var borderColor = [0.5, 0.5, 0.5, 1];
    var darkColor = [0.4, 0.4, 0.4, 1];
    var lightColor = [0.88, 0.88, 0.88, 1];
    for (var y = 0; y < size; y++) {
        bytes[byteIndex++] = 0;
        for (var x = 0; x < size; x++) {
            var dx = x + 0.5 - size / 2;
            var dy = y + 0.5 - size / 2;
            var distance = Math.sqrt(dx * dx + dy * dy);
            var alpha = clamp01(7 - distance);
            var color;
            if (distance > 5.8) color = borderColor;
            else if (preview.kind === 'solid') color = preview.colors[0];
            else if (preview.kind === 'gradient') color = preview.colors[x];
            else {
                color = Math.abs(x - y) < 1 ? darkColor : lightColor;
            }
            for (var c = 0; c < 3; c++) bytes[byteIndex++] = Math.round(clamp01(color[c]) * 255);
            bytes[byteIndex++] = Math.round(alpha * clamp01(color[3]) * 255);
        }
    }
    var data = '';
    var adlerA = 1;
    var adlerB = 0;
    for (var b = 0; b < bytes.length; b++) {
        data += String.fromCharCode(bytes[b]);
        adlerA = (adlerA + bytes[b]) % 65521;
        adlerB = (adlerB + adlerA) % 65521;
    }
    function uint32(value) {
        return String.fromCharCode((value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255);
    }
    if (!swatchPreviewCRCTable) {
        swatchPreviewCRCTable = [];
        for (var t = 0; t < 256; t++) {
            var value = t;
            for (var bit = 0; bit < 8; bit++) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
            swatchPreviewCRCTable[t] = value;
        }
    }
    function chunk(type, content) {
        var payload = type + content;
        var crc = -1;
        for (var i = 0; i < payload.length; i++) {
            crc = (crc >>> 8) ^ swatchPreviewCRCTable[(crc ^ payload.charCodeAt(i)) & 255];
        }
        return uint32(content.length) + payload + uint32((crc ^ -1) >>> 0);
    }
    var length = data.length;
    var complement = 65535 - length;
    var compressed = '\x78\x01\x01' + String.fromCharCode(length & 255, length >>> 8, complement & 255, complement >>> 8) +
        data + uint32((adlerB << 16) | adlerA);
    return '\x89PNG\r\n\x1a\n' + chunk('IHDR', uint32(size) + uint32(size) + '\x08\x06\x00\x00\x00') +
        chunk('IDAT', compressed) + chunk('IEND', '');
}

function swatchPreviewImage(preview) {
    if (!preview) return null;
    if (!preview.image && typeof preview.png === 'string') preview.image = ScriptUI.newImage(preview.png);
    return preview.image || null;
}

function createSwatchList(parent, entries, width, height, checkable, showKind) {
    var rowHeight = checkable ? 24 : 22;
    var checkWidth = 32;
    var kindWidth = 104;
    var contentWidth = Math.max(80, width - 24);
    var columnWidths = [];
    if (checkable) columnWidths.push(checkWidth);
    columnWidths.push(Math.max(80, contentWidth - (checkable ? checkWidth : 0) - (showKind ? kindWidth : 0)));
    if (showKind) columnWidths.push(kindWidth);
    var properties = {
        numberOfColumns: columnWidths.length,
        showHeaders: false,
        columnWidths: columnWidths
    };
    var list = parent.add('listbox', undefined, [], properties);
    list.alignment = ['fill', 'top'];
    list.preferredSize = [width, height];
    list.minimumSize = [width, height];
    list.maximumSize = [width, height];
    if (checkable) {
        try {
            var listFont = list.graphics.font;
            var listFontName = listFont && (listFont.family || listFont.name) || 'dialog';
            var listFontSize = listFont && Number(listFont.size) || 12;
            list.graphics.font = ScriptUI.newFont(listFontName, 'REGULAR', Math.max(14, listFontSize));
        } catch (fontError) { }
    }
    list.itemSize = [width - 20, rowHeight];
    var colorCache = {};
    var imageCache = {};
    var updatingSelection = false;
    var keyboardSelection = false;
    var lastIndex = -1;
    var checkInputEnabled = checkable;
    var spaceHeld = false;
    var spaceIndex = -1;
    var spaceValue = false;

    function checkText(ignored) {
        // 小さく表示されやすい投票欄の字形を避け、輪郭と塗りで状態を区別する。
        return '  ' + (ignored ? '\u25A0' : '\u25A1');
    }

    function previewFor(entry) {
        if (entry.preview) return entry.preview;
        if (!entry.reference) return null;
        var preview = swatchPreviewColors(entry, colorCache);
        entry.previewKind = preview.kind;
        var key = preview.kind;
        for (var p = 0; p < preview.colors.length; p++) key += ':' + preview.colors[p].join(',');
        try {
            if (!imageCache[key]) imageCache[key] = { key: key, png: createSwatchPreviewPNG(preview), image: null };
            entry.preview = imageCache[key];
        } catch (imageError) { }
        return entry.preview || null;
    }

    for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        var item = list.add('item', checkable ? checkText(entry.ignored) : entry.name);
        var label = checkable ? item.subItems[0] : item;
        if (checkable) label.text = entry.name;
        if (showKind) item.subItems[checkable ? 1 : 0].text = swatchKindLabel(entry.kind);
        try { label.image = swatchPreviewImage(previewFor(entry)); } catch (imageError) { }
    }

    function updateHelp(item) {
        if (!item) return;
        var entry = entries[item.index];
        if (!entry) return;
        var help = entry.name;
        if (showKind) {
            var helpKey = entry.previewKind === 'gradient' ? 'swatchGradientPreviewHelp' :
                entry.previewKind === 'unknown' ? 'swatchPreviewUnavailable' : 'swatchPreviewHelp';
            help += '\n' + swatchKindLabel(entry.kind) + '\n' + uiText(helpKey);
        }
        if (checkable) help += '\n' + uiText('swatchCheckHelp');
        list.helpTip = help;
    }

    function selectedItem() {
        var item = list.selection;
        return item && typeof item.index === 'number' && item.index >= 0 && item.index < entries.length ? item : null;
    }

    function activeItem() {
        return selectedItem() || (lastIndex >= 0 && lastIndex < entries.length ? list.items[lastIndex] : null);
    }

    function clearSelection() {
        updatingSelection = true;
        try { list.selection = null; }
        finally { updatingSelection = false; }
    }

    function cancelPendingCheck() {
        // 押下中のSpaceは解放まで保持し、フォーカス復帰後のリピートでも再開しない。
        spaceIndex = -1;
        keyboardSelection = false;
    }

    function releaseSpace() {
        spaceHeld = false;
        spaceIndex = -1;
    }

    function setIgnored(item, value) {
        if (!checkInputEnabled || !item) return false;
        var entry = entries[item.index];
        value = !!value;
        if (!entry || !!entry.ignored === value) return false;
        updatingSelection = true;
        try {
            item.text = checkText(value);
            entry.ignored = value;
        } finally { updatingSelection = false; }
        return true;
    }

    list.onChange = function () {
        if (updatingSelection || (checkable && !checkInputEnabled)) return;
        var fromKeyboard = keyboardSelection || (spaceHeld && spaceIndex >= 0);
        keyboardSelection = false;
        var item = selectedItem();
        lastIndex = item ? item.index : -1;
        if (item) updateHelp(item);
        else list.helpTip = checkable ? uiText('swatchCheckHelp') : '';
        if (spaceIndex >= 0 && (!item || item.index !== spaceIndex)) cancelPendingCheck();
        if (checkable && item && !fromKeyboard) {
            // 通常クリックで届く選択通知を使う。同じ行の再クリックに備えて選択を解除する。
            setIgnored(item, !entries[item.index].ignored);
            clearSelection();
        }
    };

    if (checkable) {
        list.helpTip = uiText('swatchCheckHelp');
        function isSpaceEvent(event) {
            var key = String(event.keyName || event.keyIdentifier || '');
            return key === 'Space' || key === 'U+0020' || key === ' ';
        }
        function hasModifiers(event) {
            return event.shiftKey || event.ctrlKey || event.altKey || event.metaKey;
        }
        function isMoveKey(key) {
            return key === 'Up' || key === 'Down' || key === 'PageUp' || key === 'PageDown';
        }
        // 対象自身のcaptureではなく、実機で通知を確認した親Windowでキーを受ける。
        var ownerWindow = list.window;
        ownerWindow.addEventListener('keydown', function (event) {
            if (!checkInputEnabled) return;
            var key = String(event.keyName || event.keyIdentifier || '');
            if (event.target !== list) {
                if (key === 'Tab') { cancelPendingCheck(); keyboardSelection = true; }
                return;
            }
            if (!isSpaceEvent(event) || hasModifiers(event)) {
                cancelPendingCheck();
                keyboardSelection = true;
                if (isMoveKey(key) && !selectedItem() && lastIndex >= 0) {
                    updatingSelection = true;
                    try { list.selection = list.items[lastIndex]; }
                    finally { updatingSelection = false; }
                }
                return;
            }
            event.preventDefault();
            keyboardSelection = true;
            if (spaceHeld) return;
            spaceHeld = true;
            var item = activeItem();
            spaceIndex = item ? item.index : -1;
            spaceValue = item ? !entries[item.index].ignored : false;
        }, true);
        ownerWindow.addEventListener('keyup', function (event) {
            if (!isSpaceEvent(event)) {
                keyboardSelection = false;
                return;
            }
            keyboardSelection = false;
            if (!checkInputEnabled || event.target !== list || hasModifiers(event)) { releaseSpace(); return; }
            event.preventDefault();
            if (!spaceHeld || spaceIndex < 0) { releaseSpace(); return; }
            var item = activeItem();
            var apply = item && item.index === spaceIndex;
            var value = spaceValue;
            releaseSpace();
            if (apply) {
                setIgnored(item, value);
                lastIndex = item.index;
                clearSelection();
            }
        }, true);
        list.onDeactivate = cancelPendingCheck;
        // 親パネルを閉じる場合も、選択状態を変えずに入力だけを取り消す。
        list.cancelPendingCheck = cancelPendingCheck;
        list.setCheckInputEnabled = function (enabled) {
            checkInputEnabled = !!enabled;
            cancelPendingCheck();
            if (checkInputEnabled) {
                var item = activeItem();
                if (item) updateHelp(item);
                else list.helpTip = uiText('swatchCheckHelp');
            }
        };
    }
    // スクロール・選択・描画は標準ListBoxに任せ、再描画の回避処理を加えない。
    return list;
}

function createIgnoredSwatchList(panel, catalog, width, height) {
    panel.orientation = 'column';
    panel.alignChildren = ['fill', 'top'];
    panel.margins = [10, 20, 10, 10];
    panel.spacing = 6;
    var message = '';
    if (catalog.failed) message = uiText('swatchListReadFailed');
    else if (catalog.entries.length === 0) message = uiText('noLinkedSwatches');
    else if (catalog.failures > 0) message = uiFormat('swatchListPartial', { count: catalog.failures });
    if (message) {
        var status = panel.add('statictext', undefined, message, { multiline: true });
        status.preferredSize = [width - 20, 34];
    }
    if (catalog.entries.length === 0) return null;
    return createSwatchList(panel, catalog.entries, width - 20, height - 34 - (message ? 40 : 0), true, true);
}

function showConvertOptionsDialog(stats, doc) {
    var targetCount = stats.selectedObjectCount + stats.unsupportedObjectCount;
    var plannedCount = stats.planned;
    var dialogMinWidth = 280;
    var dlg = new Window('dialog', uiText('optionsTitle'));
    var columnSpacing = dlg.spacing;
    dlg.orientation = 'row';
    dlg.alignChildren = ['left', 'top'];
    dlg.spacing = 0;
    dlg.preferredSize.width = dialogMinWidth;
    var leftColumn = dlg.add('group');
    leftColumn.orientation = 'column';
    leftColumn.alignChildren = 'fill';
    leftColumn.alignment = ['left', 'top'];
    leftColumn.margins = 0;
    leftColumn.spacing = columnSpacing;

    var optionPanelWidth = dialogMinWidth - 36;
    var optionPanelMargins = [8, 18, 28, 14];
    var infoPanelMargins = [8, 18, 8, 14];
    var optionDropdownWidth = 54;
    var balanceSideLabelWidth = 36;
    var balanceSliderWidth = 146;
    var balanceSliderStep = 50;
    var allowedColorDifferenceLabelExtraWidth = 72;
    var balanceOptionIndent = balanceSideLabelWidth - 18;

    var satPanel = leftColumn.add('panel', undefined, uiText('saturationBoost'));
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

    var balancePanel = leftColumn.add('panel', undefined, uiText('cmyKBalance'));
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
    }

    function updateEnabled() {
        setControlsEnabled(satToggleTargets, chkSatBoost.value);
    }
    chkSatBoost.onClick = updateEnabled;

    // 変換後の色処理と未適用オブジェクト選択オプション
    var optionPanel = leftColumn.add('panel', undefined, uiText('optionGroup'));
    optionPanel.alignment = 'fill';
    optionPanel.orientation = 'column';
    optionPanel.alignChildren = ['left', 'center'];
    optionPanel.preferredSize.width = optionPanelWidth;
    optionPanel.margins = infoPanelMargins;
    optionPanel.spacing = 2;

    var chkAvoidAutoBlackOverprint = optionPanel.add('checkbox', undefined, uiText('avoidAutoBlackOverprint'));
    chkAvoidAutoBlackOverprint.alignment = ['left', 'center'];
    chkAvoidAutoBlackOverprint.value = DEFAULT_AVOID_AUTO_BLACK_OVERPRINT_ENABLED;
    chkAvoidAutoBlackOverprint.helpTip = uiText('avoidAutoBlackOverprintHelp');

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

    var chkIgnoreSwatches = optionPanel.add('checkbox', undefined, uiText('ignoreSpecifiedSwatches'));
    chkIgnoreSwatches.alignment = ['left', 'center'];
    chkIgnoreSwatches.value = false;
    chkIgnoreSwatches.helpTip = uiText('ignoreSpecifiedSwatchesHelp');

    // 対象数と予測最大時間
    var infoPanel = leftColumn.add('panel', undefined, uiText('info'));
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
    var btnGroup = leftColumn.add('group');
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
        avoidAutoBlackOverprint: DEFAULT_AVOID_AUTO_BLACK_OVERPRINT_ENABLED,
        selectSkippedObjects: true,
        ignoredSwatches: []
    };

    var compactSize = null;
    var leftSize = null;
    var swatchPanel = null;
    var swatchCatalog = null;
    var swatchList = null;
    var expandedGap = 12;
    function rememberCompactSize() {
        if (compactSize) return;
        compactSize = [dlg.size.width, dlg.size.height];
        leftSize = [leftColumn.size.width, leftColumn.size.height];
        leftColumn.preferredSize = leftSize;
        leftColumn.minimumSize = leftSize;
        leftColumn.maximumSize = leftSize;
    }
    function updateSwatchPanel() {
        rememberCompactSize();
        var expanded = chkIgnoreSwatches.value;
        var listWidth = Math.round((compactSize[0] - expandedGap - 20) * 1.5);
        var panelWidth = listWidth + 20;
        var position = [dlg.location.x, dlg.location.y];
        if (expanded && !swatchPanel) {
            swatchCatalog = readIgnoredSwatchCatalog(doc || app.activeDocument);
            swatchPanel = dlg.add('panel', undefined, uiText('ignoredSwatchList'));
            swatchPanel.alignment = ['left', 'top'];
            swatchList = createIgnoredSwatchList(swatchPanel, swatchCatalog, panelWidth, leftSize[1]);
        }
        if (swatchList) swatchList.setCheckInputEnabled(expanded);
        if (swatchPanel) {
            var panelSize = expanded ? [panelWidth, leftSize[1]] : [0, 0];
            swatchPanel.visible = expanded;
            swatchPanel.minimumSize = [0, 0];
            swatchPanel.maximumSize = panelSize;
            swatchPanel.preferredSize = panelSize;
            swatchPanel.minimumSize = panelSize;
        }
        var size = [expanded ? compactSize[0] + expandedGap + panelWidth : compactSize[0], compactSize[1]];
        dlg.spacing = expanded ? expandedGap : 0;
        dlg.minimumSize = [0, 0];
        dlg.maximumSize = size;
        dlg.minimumSize = size;
        dlg.preferredSize = size;
        dlg.layout.layout(true);
        dlg.size = size;
        dlg.layout.resize();
        dlg.location = position;
    }
    dlg.onShow = rememberCompactSize;
    dlg.onDeactivate = function () { if (swatchList) swatchList.cancelPendingCheck(); };
    dlg.onClose = function () { if (swatchList) swatchList.setCheckInputEnabled(false); };
    chkIgnoreSwatches.onClick = updateSwatchPanel;

    updateEnabled();
    updateBalanceToleranceDisplay();
    dlg.layout.layout(true);

    var ret;
    try { ret = dlg.show(); }
    finally { if (swatchList) swatchList.setCheckInputEnabled(false); }
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
    result.avoidAutoBlackOverprint = chkAvoidAutoBlackOverprint.value;
    result.selectSkippedObjects = chkSelectSkippedObjects.value;
    if (chkIgnoreSwatches.value && swatchCatalog) {
        for (var si = 0; si < swatchCatalog.entries.length; si++) {
            var swatch = swatchCatalog.entries[si];
            if (swatch.ignored) result.ignoredSwatches.push({
                key: swatch.key, kind: swatch.kind, name: swatch.name, preview: swatch.preview
            });
        }
    }
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
var resultCacheLookupCount = 0;

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

function cacheGetResult(cmyk, key) {
    if (key == null) key = cacheKeyFromCMYK(cmyk.c, cmyk.m, cmyk.y, cmyk.k);
    var cached = resultCache[key] || null;
    if (!cached || !isSameCMYK(cached.input, cmyk)) return null;
    return cached;
}

function cachePutResult(inCmyk, result, key) {
    if (key == null) key = cacheKeyFromCMYK(inCmyk.c, inCmyk.m, inCmyk.y, inCmyk.k);
    resultCache[key] = {
        input: copyCMYK(inCmyk),
        changed: !!result.changed,
        reason: result.reason || null,
        out: result.out ? copyCMYK(result.out) : null
    };
}

// === CMYK→Lab メモ化（キャッシュ専用丸め） ===
var labConvCache = {};
var kOnlyIntegerLabCache = new Array(101);
var labConvCacheCount = 0;

// === Spot（グローバルCMYK）の処理済み管理 ===
var processedSpotMap = {};
var processedGradientMap = {};
var spotReferenceKeys = [];
var gradientReferenceKeys = [];
var ignoredSwatchRules = null;
var swatchPreviewCRCTable = null;
var pendingSpotRenames = [];
var spotRenameSkippedCount = 0;
var createdColorResources = [];
var colorDocument = null;
var opacityStateCache = {};
var opacityReferenceKeys = [];
var autoBlackOverprintState = createAutoBlackOverprintState();
var CMYK_SWATCH_NAME_PATTERN = /^[ \t]*C[ \t]*=[ \t]*(\d+(?:\.\d+)?)[ \t]+M[ \t]*=[ \t]*(\d+(?:\.\d+)?)[ \t]+Y[ \t]*=[ \t]*(\d+(?:\.\d+)?)[ \t]+K[ \t]*=[ \t]*(\d+(?:\.\d+)?)(?:[ \t]+\(([\s\S]*)\))?[ \t]*$/;

function hostCollectionObjectKey(obj, prefix, references) {
    if (!obj) return null;
    try {
        var index = obj.index;
        if ((typeof index === 'number' || typeof index === 'string') && (index || index === 0)) {
            return prefix + ':idx:' + String(index);
        }
    } catch (e) { }
    try {
        var name = obj.name;
        if (name) return prefix + ':name:' + String(name);
    } catch (e2) { }
    for (var i = 0, n = references.length; i < n; i++) {
        if (references[i].ref === obj) return references[i].key;
    }
    var key = prefix + ':ref:' + references.length;
    references.push({
        ref: obj,
        key: key
    });
    return key;
}

function spotKey(spot) {
    return hostCollectionObjectKey(spot, 'spot', spotReferenceKeys);
}

function gradientKey(gradient) {
    return hostCollectionObjectKey(gradient, 'gradient', gradientReferenceKeys);
}

function readIgnoredSwatchCatalog(doc) {
    var result = { entries: [], failures: 0, failed: false };
    var swatches;
    var count;
    try {
        swatches = doc.swatches;
        count = swatches.length;
        if (typeof count !== 'number' || !isFinite(count) || count < 0) throw new Error('Invalid swatch collection');
    } catch (e) {
        result.failed = true;
        return result;
    }
    var seen = {};
    for (var i = 0; i < count; i++) {
        try {
            var swatch = swatches[i];
            var color = swatch.color;
            if (!color) continue;
            var type = String(color.typename);
            var reference;
            var key;
            var kind;
            if (type === 'SpotColor') {
                reference = color.spot;
                if (reference.colorType === ColorModel.PROCESS) kind = 'global';
                else if (reference.colorType === ColorModel.SPOT) kind = 'spot';
                else continue;
                key = spotKey(reference);
            } else if (type === 'GradientColor') {
                reference = color.gradient;
                kind = 'gradient';
                key = gradientKey(reference);
            } else {
                continue;
            }
            if (!key || seen[key]) continue;
            var name = kind === 'global' || kind === 'spot' ? reference.name : swatch.name;
            if (typeof name !== 'string') throw new Error('Swatch name unavailable');
            seen[key] = true;
            result.entries.push({ key: key, kind: kind, name: name, reference: reference, ignored: false });
        } catch (readError) {
            result.failures++;
        }
    }
    return result;
}

function createIgnoredSwatchRules(entries) {
    if (!entries || entries.length === 0) return null;
    var rules = { keys: {}, entries: [], matchedKeys: {}, unmatchedCount: 0,
        hasSpots: false, gradientMatches: {}, ignoredCount: 0 };
    for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        if (!rules.keys[entry.key]) {
            rules.keys[entry.key] = true;
            rules.entries.push({ key: entry.key, name: entry.name, preview: entry.preview });
            rules.unmatchedCount++;
        }
        if (entry.kind === 'global' || entry.kind === 'spot') rules.hasSpots = true;
    }
    return rules;
}

function recordIgnoredSwatchMatch(key, rules) {
    if (!rules.keys[key]) return false;
    if (!rules.matchedKeys[key]) {
        rules.matchedKeys[key] = true;
        rules.unmatchedCount--;
    }
    return true;
}

function collectIgnoredSwatches(rules) {
    var swatches = [];
    if (!rules) return swatches;
    for (var i = 0; i < rules.entries.length; i++) {
        var entry = rules.entries[i];
        if (rules.matchedKeys[entry.key] && typeof entry.name === 'string') {
            swatches.push({ name: entry.name, preview: entry.preview });
        }
    }
    return swatches;
}

function ignoredGradientDecision(gradient, key, rules) {
    if (!rules.hasSpots) return null;
    if (typeof rules.gradientMatches[key] !== 'undefined') return rules.gradientMatches[key];
    var decision = null;
    try {
        var stops = gradient.gradientStops;
        var count = stops.length;
        if (typeof count !== 'number' || !isFinite(count) || count < 2) throw new Error('Gradient stops unavailable');
        for (var i = 0; i < count; i++) {
            checkpointProgress();
            try {
                var color = stops[i].color;
                if (color && color.typename === 'SpotColor' && recordIgnoredSwatchMatch(spotKey(color.spot), rules)) {
                    decision = 'ignore';
                    if (rules.unmatchedCount === 0) break;
                }
            } catch (stopError) {
                if (isUserCancelledError(stopError)) throw stopError;
                if (decision !== 'ignore') decision = 'gradientStopFailed';
            }
        }
    } catch (e) {
        if (isUserCancelledError(e)) throw e;
        if (decision !== 'ignore') decision = 'gradientStopFailed';
    }
    rules.gradientMatches[key] = decision;
    return decision;
}

function ignoredPaintDecision(source, rules) {
    if (source.reason) return source.reason;
    var color = source.color;
    if (!color) return null;
    try {
        if (source.typeName === 'SpotColor') {
            return recordIgnoredSwatchMatch(spotKey(color.spot), rules) ? 'ignore' : null;
        }
        if (source.typeName === 'GradientColor') {
            var gradient = color.gradient;
            var key = gradientKey(gradient);
            var matchedDefinition = recordIgnoredSwatchMatch(key, rules);
            if (matchedDefinition && rules.unmatchedCount === 0) return 'ignore';
            var stopDecision = ignoredGradientDecision(gradient, key, rules);
            return matchedDefinition ? 'ignore' : stopDecision;
        }
    } catch (e) {
        if (isUserCancelledError(e)) throw e;
        return 'colorReadFailed';
    }
    return null;
}

function ignoredObjectDecision(prepared, rules) {
    var failure = null;
    var matched = false;
    for (var i = 0; i < prepared.length; i++) {
        var task = prepared[i];
        if (task.reason && !failure) failure = task.reason;
        for (var p = 0; p < task.paints.length; p++) {
            var decision = ignoredPaintDecision(task.paints[p].source, rules);
            if (decision === 'ignore') {
                matched = true;
                if (rules.unmatchedCount === 0) return decision;
            } else if (decision && !failure) {
                failure = decision;
            }
        }
    }
    return matched ? 'ignore' : failure;
}

function markProcessedSpot(key, state) {
    if (key) processedSpotMap[key] = state;
}

function trackColorResource(value, dependencies) {
    var record = { value: value, uses: 0, keep: false, dependencies: dependencies || [] };
    createdColorResources.push(record);
    return record;
}

function retainColorResource(record) {
    if (!record) return;
    record.uses++;
    if (record.uses !== 1) return;
    for (var i = 0; i < record.dependencies.length; i++) {
        retainColorResource(record.dependencies[i]);
    }
}

function releaseColorResource(record) {
    if (!record || record.uses === 0) return;
    record.uses--;
    if (record.uses !== 0) return;
    for (var i = 0; i < record.dependencies.length; i++) {
        releaseColorResource(record.dependencies[i]);
    }
}

function preserveColorResource(record) {
    if (!record || record.keep) return;
    // 代入が例外になった場合、ホストが途中まで反映した可能性を考慮する。
    record.keep = true;
    for (var i = 0; i < record.dependencies.length; i++) {
        preserveColorResource(record.dependencies[i]);
    }
}

function removeUnusedColorResources() {
    for (var i = createdColorResources.length - 1; i >= 0; i--) {
        var record = createdColorResources[i];
        if (record.uses === 0 && !record.keep) {
            try { record.value.remove(); } catch (e) { }
        }
    }
    createdColorResources = [];
}

function buildGlobalCMYKSwatchName(originalName, cmyk) {
    var name = 'C=' + cmyk.c + ' M=' + cmyk.m + ' Y=' + cmyk.y + ' K=' + cmyk.k;
    var match = CMYK_SWATCH_NAME_PATTERN.exec(originalName);
    if (match) {
        for (var i = 1; i <= 4; i++) {
            if (Number(match[i]) > 100) {
                match = null;
                break;
            }
        }
    }
    // 既に付けたCMYK表記だけを更新し、独自名に含まれる括弧や空白も保持する。
    if (match) return typeof match[5] === 'string' ? name + ' (' + match[5] + ')' : name;
    return name + ' (' + originalName + ')';
}

function queueSpotRename(spot, originalName, cmyk, sourceName, resource) {
    if (arguments.length < 4) sourceName = originalName;
    if (typeof originalName !== 'string' || typeof sourceName !== 'string') {
        spotRenameSkippedCount++;
        return;
    }
    var newName = buildGlobalCMYKSwatchName(sourceName, cmyk);
    if (newName === originalName) return;
    pendingSpotRenames.push({ spot: spot, originalName: originalName, newName: newName, resource: resource });
}

function readSwatchNameCounts(doc) {
    var counts = {};
    var swatches = doc.swatches;
    for (var i = 0, n = swatches.length; i < n; i++) {
        var name = swatches[i].name;
        if (typeof name !== 'string') throw new Error('Cannot read swatch name');
        var key = 'swatch:' + name;
        counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
}

function restoreSpotName(task) {
    try {
        if (task.spot.name !== task.originalName) task.spot.name = task.originalName;
        return task.spot.name === task.originalName;
    } catch (e) {
        return false;
    }
}

function applyPendingSpotRenames(doc) {
    var tasks = [];
    for (var p = 0; p < pendingSpotRenames.length; p++) {
        var pending = pendingSpotRenames[p];
        if (!pending.resource || pending.resource.uses > 0 || pending.resource.keep) tasks.push(pending);
    }
    pendingSpotRenames = [];
    if (tasks.length === 0) return;

    // 衝突確認はスウォッチ一覧を一度だけ読む。取得できなければ改名しない。
    var nameCounts;
    try {
        nameCounts = readSwatchNameCounts(doc);
    } catch (e) {
        spotRenameSkippedCount += tasks.length;
        return;
    }

    for (var i = 0, n = tasks.length; i < n; i++) {
        var task = tasks[i];
        var newKey = 'swatch:' + task.newName;
        if (nameCounts[newKey] > 0) {
            spotRenameSkippedCount++;
            continue;
        }
        try {
            if (task.spot.name !== task.originalName) {
                spotRenameSkippedCount++;
                continue;
            }
        } catch (e2) {
            spotRenameSkippedCount++;
            continue;
        }
        try {
            task.spot.name = task.newName;
            // 切り詰め等で独自名が失われた場合も、元の名前へ戻す。
            if (task.spot.name !== task.newName) throw new Error('Swatch name was not retained');
        } catch (e3) {
            if (!restoreSpotName(task)) {
                // 名前一覧との整合性を確認できないため、残りの改名も見送る。
                spotRenameSkippedCount += n - i;
                return;
            }
            spotRenameSkippedCount++;
            continue;
        }
        var oldKey = 'swatch:' + task.originalName;
        nameCounts[oldKey] = Math.max(0, (nameCounts[oldKey] || 0) - 1);
        nameCounts[newKey] = 1;
    }
}

function isK100CMYK(cmyk) {
    return cmyk.c === 0 && cmyk.m === 0 && cmyk.y === 0 && cmyk.k === 100;
}

function isAutoBlackOverprintCMYK(cmyk) {
    var expected = AUTO_BLACK_OVERPRINT_CMYK;
    return Math.abs(cmyk.c - expected.c) <= AUTO_BLACK_OVERPRINT_CMYK_EPS &&
        Math.abs(cmyk.m - expected.m) <= AUTO_BLACK_OVERPRINT_CMYK_EPS &&
        (Math.abs(cmyk.y - expected.y) <= AUTO_BLACK_OVERPRINT_CMYK_EPS ||
            Math.abs(cmyk.y - AUTO_BLACK_OVERPRINT_MIN_Y) <= AUTO_BLACK_OVERPRINT_CMYK_EPS) &&
        Math.abs(cmyk.k - expected.k) <= AUTO_BLACK_OVERPRINT_CMYK_EPS;
}

function hasMinimumAutoBlackOverprintYellow(cmyk) {
    return isAutoBlackOverprintCMYK(cmyk) && cmyk.y >= AUTO_BLACK_OVERPRINT_MIN_Y;
}

function verifyAutoBlackOverprintSpot(spot) {
    var color = spot.color;
    if (spot.colorType !== ColorModel.PROCESS || !color || color.typename !== 'CMYKColor' ||
        !hasMinimumAutoBlackOverprintYellow(readCMYKValues(color))) {
        throw new Error('Overprint avoidance swatch must retain at least 1% yellow');
    }
}

function isAutoBlackOverprintSwatchName(name) {
    var names = UI_TEXT.autoBlackOverprintSwatchName;
    if (name === names.ja || name === names.en) return true;
    if (typeof name !== 'string') return false;
    var bases = [names.ja, names.en];
    for (var i = 0; i < bases.length; i++) {
        if (name.indexOf(bases[i]) === 0 && /^ \([1-9]\d*\)$/.test(name.substring(bases[i].length))) return true;
    }
    return false;
}

function isAutoBlackOverprintDefinition(name, cmyk) {
    return isAutoBlackOverprintSwatchName(name) && isAutoBlackOverprintCMYK(cmyk);
}

function readCMYKValues(color) {
    return { c: color.cyan, m: color.magenta, y: color.yellow, k: color.black };
}

function readSolidProcessCMYK(color) {
    if (!color) return null;
    var typeName = color.typename;
    if (typeName === 'SpotColor') {
        // 濃度が100%未満なら、定義がK100でも使用箇所の色はK100ではない。
        if (color.tint !== 100) return null;
        var spot = color.spot;
        if (!spot || spot.colorType !== ColorModel.PROCESS) return null;
        color = spot.color;
        if (!color) return null;
        typeName = color.typename;
    }
    if (typeName === 'CMYKColor') return readCMYKValues(color);
    // 墨ノセ回避の最終判定だけで、グレー濃度100%をK100として扱う。
    if (typeName === 'GrayColor' && color.gray === 100) return { c: 0, m: 0, y: 0, k: 100 };
    return null;
}

function readFullyOpaqueState(item) {
    // 1: 全階層100%、0: 半透明、-1: 取得できず判定不可。
    var trail = [];
    var seen = {};
    var state = -1;
    var depth = 0;
    try {
        while (item) {
            if (++depth % 100 === 0) checkpointProgress();
            if (item.typename === 'Document') { state = 1; break; }
            var key = artItemKey(item, opacityReferenceKeys);
            if (typeof opacityStateCache[key] !== 'undefined') { state = opacityStateCache[key]; break; }
            if (seen[key]) break;
            seen[key] = true;
            trail.push(key);
            var opacity = item.opacity;
            if (typeof opacity !== 'number' || !isFinite(opacity)) break;
            if (opacity !== 100) { state = 0; break; }
            item = item.parent;
        }
    } catch (e) { if (isUserCancelledError(e)) throw e; }
    for (var i = 0; i < trail.length; i++) opacityStateCache[trail[i]] = state;
    return state;
}

function createAutoBlackOverprintState() {
    return { tasks: [], spot: null, resource: null, spotChecked: false, spotFailureReason: null, colorApplied: false };
}

function queueAutoBlackOverprintTask(target, propName, entry, alreadyChanged, convertedResource, selectionTask) {
    var isText = entry.typeName === 'TextFrame';
    var overprintPropName = propName === 'fillColor' ?
        (isText ? 'overprintFill' : 'fillOverprint') :
        (isText ? 'overprintStroke' : 'strokeOverprint');
    var task = {
        target: target,
        propName: propName,
        overprintPropName: overprintPropName,
        alreadyChanged: alreadyChanged,
        convertedResource: convertedResource
    };
    if (isText && selectionTask && selectionTask.kind === 'textRun') {
        // 属性参照は保持せず、既存の開始・終了位置から後処理の直前に取得する。
        task.textRun = selectionTask;
        task.target = null;
    }
    if (entry.workList) {
        // 作業用記録は次の対象で再利用するため、後処理には一覧と添字を渡す。
        task.workList = entry.workList;
        task.workIndex = entry.workIndex;
    } else {
        task.entry = entry;
    }
    autoBlackOverprintState.tasks.push(task);
}

function getAutoBlackOverprintSpot(doc) {
    if (autoBlackOverprintState.spotChecked) return autoBlackOverprintState.spot;
    autoBlackOverprintState.spotChecked = true;
    var createdSpot = null;
    var failureReason = 'autoBlackOverprintReadFailed';
    try {
        var definition = AUTO_BLACK_OVERPRINT_CMYK;
        var name = uiText('autoBlackOverprintSwatchName');
        var swatches = doc.swatches;
        var nameConflict = false;
        var legacyNameConflict = false;
        var names = {};
        for (var i = 0, n = swatches.length; i < n; i++) {
            var swatch = swatches[i];
            var swatchName = swatch.name;
            names['swatch:' + swatchName] = true;
            if (swatchName === name) nameConflict = true;
            if (!isAutoBlackOverprintSwatchName(swatchName)) continue;
            var color = swatch.color;
            if (!color || color.typename !== 'SpotColor') continue;
            var cmyk = readSolidProcessCMYK(color);
            if (cmyk && isAutoBlackOverprintDefinition(swatchName, cmyk)) {
                if (!hasMinimumAutoBlackOverprintYellow(cmyk)) {
                    if (swatchName === name) legacyNameConflict = true;
                    continue;
                }
                autoBlackOverprintState.spot = color.spot;
                return autoBlackOverprintState.spot;
            }
        }
        // 同名の別の色を上書きしない。失敗は未適用として報告する。
        if (nameConflict && !legacyNameConflict) {
            autoBlackOverprintState.spotFailureReason = 'autoBlackOverprintNameConflict';
            return null;
        }
        // 旧版のY1は新しい定義へ置き換え、選択した使用箇所に適用する。
        if (legacyNameConflict) {
            var suffix = 2;
            var baseName = name;
            do { name = baseName + ' (' + suffix++ + ')'; } while (names['swatch:' + name]);
        }
        failureReason = 'autoBlackOverprintCreateFailed';
        createdSpot = doc.spots.add();
        createdSpot.colorType = ColorModel.PROCESS;
        createdSpot.color = makeCMYK(definition.c, definition.m, definition.y, definition.k);
        createdSpot.name = name;
        if (createdSpot.name !== name) throw new Error('Unexpected swatch name');
        failureReason = 'autoBlackOverprintVerifyFailed';
        verifyAutoBlackOverprintSpot(createdSpot);
        autoBlackOverprintState.spot = createdSpot;
        autoBlackOverprintState.resource = trackColorResource(createdSpot);
        return autoBlackOverprintState.spot;
    } catch (e) {
        autoBlackOverprintState.spotFailureReason = failureReason;
        if (createdSpot) {
            try { createdSpot.remove(); } catch (removeError) { }
        }
        return null;
    }
}

function clearPaintOverprint(task) {
    var propName = task.overprintPropName;
    if (task.target[propName] === false) return false;
    task.target[propName] = false;
    if (task.target[propName] !== false) throw new Error('Overprint could not be disabled');
    return true;
}

function autoBlackTaskEntry(task, scratch) {
    if (!task.workList) return task.entry;
    return loadSelectionWorkEntry(task.workList, task.workIndex, scratch);
}

function applyAutoBlackOverprintTask(task, doc, entry) {
    entry = entry || autoBlackTaskEntry(task);
    if (task.textRun) {
        task.target = readTextTaskAttributes(entry, task.textRun);
        if (!task.target) return makeColorProcessResult(false, 'textAttributesReadFailed');
    }
    var cmyk;
    var dedicatedColor;
    var alreadyProtected;
    try {
        var sourceColor = task.target[task.propName];
        cmyk = readSolidProcessCMYK(sourceColor);
        // 値で先に絞り、専用色でない場合の追加の名前取得を避ける。
        dedicatedColor = cmyk && isAutoBlackOverprintCMYK(cmyk) &&
            sourceColor.typename === 'SpotColor' && isAutoBlackOverprintDefinition(sourceColor.spot.name, cmyk);
        alreadyProtected = dedicatedColor && hasMinimumAutoBlackOverprintYellow(cmyk);
    } catch (e) {
        return makeColorProcessResult(false, 'colorReadFailed');
    }
    if (!cmyk || (!isK100CMYK(cmyk) && !dedicatedColor)) return makeColorProcessResult(false);
    if (typeof entry.autoBlackOverprintOpacityState === 'undefined') {
        entry.autoBlackOverprintOpacityState = readFullyOpaqueState(entry.target);
        if (entry.workList) entry.workList.opacityStates[entry.workIndex] = entry.autoBlackOverprintOpacityState;
    }
    if (entry.autoBlackOverprintOpacityState !== 1) {
        return makeColorProcessResult(false, entry.autoBlackOverprintOpacityState < 0 ? 'opacityReadFailed' : null);
    }
    var paintChanged = false;
    if (!alreadyProtected) {
        var spot = getAutoBlackOverprintSpot(doc);
        if (!spot) return makeColorProcessResult(false, autoBlackOverprintState.spotFailureReason || 'autoBlackOverprintFailed');
        try {
            var color = new SpotColor();
            color.spot = spot;
            color.tint = 100;
            task.target[task.propName] = color;
            retainColorResource(autoBlackOverprintState.resource);
            releaseColorResource(task.convertedResource);
            paintChanged = true;
            autoBlackOverprintState.colorApplied = true;
        } catch (e2) {
            preserveColorResource(autoBlackOverprintState.resource);
            return makeColorProcessResult(false, 'autoBlackOverprintFailed');
        }
    }
    // 色の代入後に、対象の塗りまたは線の属性だけを解除する。
    try {
        if (clearPaintOverprint(task)) paintChanged = true;
    } catch (e3) {
        return makeColorProcessResult(paintChanged, 'overprintWriteFailed');
    }
    return makeColorProcessResult(paintChanged);
}

function applyAutoBlackOverprint(doc) {
    // オフでは対象色・不透明度・スウォッチの判定を一切行わない。
    if (!AVOID_AUTO_BLACK_OVERPRINT_ENABLED) return 0;
    var tasks = autoBlackOverprintState.tasks;
    var addedChanges = 0;
    var scratch = createSelectionArtItemRecord(null, '', null);
    for (var i = 0, n = tasks.length; i < n; i++) {
        checkpointProgress(); // 更新間隔の制御はcheckpoint内で行う。
        var task = tasks[i];
        var entry = autoBlackTaskEntry(task, scratch);
        var result = applyAutoBlackOverprintTask(task, doc, entry);
        if (result.reason) countSkip(entry, result.reason);
        if (result.changed && !task.alreadyChanged) addedChanges++;
    }
    autoBlackOverprintState.tasks = [];
    return addedChanges;
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

function integerKCacheIndex(k) {
    var rounded = Math.round(k);
    if (rounded < 0 || rounded > 100) return -1;
    return Math.abs(k - rounded) < 1e-9 ? rounded : -1;
}

function cmykToLab(c, m, y, k, knownKey) {
    var isKOnly = isKOnlyCMYKValues(c, m, y);
    var integerK = isKOnly ? integerKCacheIndex(k) : -1;
    var key;
    var cached;

    if (integerK >= 0) {
        cached = kOnlyIntegerLabCache[integerK];
    } else {
        key = knownKey == null ? cacheKeyFromCMYK(c, m, y, k) : knownKey;
        cached = labConvCache[key];
        if (cached &&
            (cached.c !== c || cached.m !== m || cached.y !== y || cached.k !== k)) {
            cached = null;
        }
    }
    if (cached) return integerK >= 0 ? cached : cached.lab;

    var lab = app.convertSampleColor(
        ImageColorSpace.CMYK,
        [c, m, y, integerK >= 0 ? integerK : k],
        ImageColorSpace.LAB,
        ColorConvertPurpose.defaultpurpose
    );
    var out = {
        L: lab[0],
        a: lab[1],
        b: lab[2]
    };

    if (integerK >= 0) {
        kOnlyIntegerLabCache[integerK] = out;
    } else {
        if (!labConvCache[key]) labConvCacheCount++;
        labConvCache[key] = {
            c: c,
            m: m,
            y: y,
            k: k,
            lab: out
        };
    }
    return out;
}

function getKOnlyIntegerLab(k) {
    var lab = kOnlyIntegerLabCache[k];
    return lab || cmykToLab(0, 0, 0, k);
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

function makeLabResultFromKnownLab(cmyk, targetLab, lab) {
    var out = copyCMYK(cmyk);
    out.L = lab.L;
    out.a = lab.a;
    out.b = lab.b;
    out.dE = de76(targetLab.L, targetLab.a, targetLab.b, lab.L, lab.a, lab.b);
    return out;
}

function makeLabResultFromCMYK(cmyk, targetLab) {
    return makeLabResultFromKnownLab(
        cmyk,
        targetLab,
        cmykToLab(cmyk.c, cmyk.m, cmyk.y, cmyk.k)
    );
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

// CMYK値を整数に丸め
function roundCMYKValue(v, applyZeroThreshold) {
    var r = Math.round(v);
    // 薄い色の保護が有効なら、探索中の評価から最終出力まで1〜3%も残す。
    if (applyZeroThreshold && !LIGHT_COLOR_PROTECT_ENABLED && r <= ZERO_THR) return 0;
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
function refineWithMaskLS(start, targetLab, allowed, currentLab) {
    var cur = copyCMYK(start);
    var baseCacheKey = cacheKeyFromCMYK(cur.c, cur.m, cur.y, cur.k);
    var lab = currentLab || cmykToLab(cur.c, cur.m, cur.y, cur.k, baseCacheKey);
    // 有効チャネルを列順に並べる
    var cols = [];
    for (var i = 0; i < CMYK_CHANNELS.length; i++) {
        var ch = CMYK_CHANNELS[i];
        if (allowed[ch]) cols.push(ch);
    }
    var p = cols.length;
    if (p === 0) return makeLabResultFromCMYK(cur, targetLab);
    // ヤコビアン J: 3 x p（上限では後退差分）
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
        var actualDelta = trial[ch] - cur[ch];
        var trialCacheKey = cacheKeyFromCMYK(trial.c, trial.m, trial.y, trial.k);
        if (actualDelta === 0 || trialCacheKey === baseCacheKey) {
            trial[ch] = clampPct(cur[ch] - h);
            actualDelta = trial[ch] - cur[ch];
            trialCacheKey = cacheKeyFromCMYK(trial.c, trial.m, trial.y, trial.k);
        }
        if (actualDelta === 0) continue;
        var lab2 = cmykToLab(trial.c, trial.m, trial.y, trial.k, trialCacheKey);
        J[0][ci] = (lab2.L - lab.L) / actualDelta;
        J[1][ci] = (lab2.a - lab.a) / actualDelta;
        J[2][ci] = (lab2.b - lab.b) / actualDelta;
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

function applyCMYMask(cmyk, mask) {
    var out = copyCMYK(cmyk);
    if (!mask.c) out.c = 0;
    if (!mask.m) out.m = 0;
    if (!mask.y) out.y = 0;
    return out;
}

function refineBestCMYPair(start, targetLab) {
    var best = null;
    for (var i = 0; i < CMY_REFINE_MASKS.length; i++) {
        var mask = CMY_REFINE_MASKS[i];
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

    for (var i = 0; i < CMY_K_BALANCE_K_REDUCTION_FACTORS.length; i++) {
        var trialAmount = amount * CMY_K_BALANCE_K_REDUCTION_FACTORS[i];
        if (trialAmount <= 0) continue;

        var out = copyCMYK(adj);
        out.k = clampPct(adj.k * (1 - trialAmount));
        if (!kIsReduced(adj, out)) continue;

        var candidate = finalizedLabResult(refineBestCMYPair(out, targetLab), targetLab);
        if (!kIsReduced(adj, candidate)) continue;

        if (acceptCMYKBalanceResult(adj, candidate, amount, targetLab)) return candidate;
    }

    return adj;
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
        var next = refineWithMaskLS(best, targetLab, allowed, best);
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
    return candidate.dE <= limit;
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
        var kRes = refineWithMaskLSPasses(out, targetLab, K_REFINE_MASK, CMY_K_BALANCE_REFINE_PASSES);
        // 実際に書き込む整数・閾値適用後の色で、薄色保護と許容色差を判定する。
        kRes = finalizedLabResult(kRes, targetLab);
        if (shouldProtectLightColorFromKBalance(adj, kRes, targetLab)) return adj;
        return acceptCMYKBalanceResult(adj, kRes, amount, targetLab) ? kRes : adj;
    } else {
        return findCMYBalanceResult(adj, targetLab, amount);
    }
}

// -------- 直接探索: CMYのうち1色以上を0にしたパターンでLabへ近づける --------
function makeKOnlyResult(k, targetLab, scoreContext) {
    k = Math.round(clampPct(k));
    var cache = scoreContext ? scoreContext.kOnlyResultCache : null;
    if (cache && cache.hasOwnProperty(k)) return cache[k];
    var cmyk = {
        c: 0,
        m: 0,
        y: 0,
        k: k
    };
    var result = makeLabResultFromKnownLab(cmyk, targetLab, getKOnlyIntegerLab(k));
    if (cache) cache[k] = result;
    return result;
}

function refineKOnly(targetLab, scoreContext) {
    var best = makeKOnlyResult(K_ONLY_SEED.k, targetLab, scoreContext);

    for (var si = 0; si < K_ONLY_REFINE_STEPS.length; si++) {
        var step = K_ONLY_REFINE_STEPS[si];
        for (var pass = 0; pass < 12; pass++) {
            var improved = false;
            var previousK = best.k;
            var plusAdopted = false;
            var plusK = Math.round(clampPct(best.k + step));
            if (plusK !== best.k) {
                var plusResult = makeKOnlyResult(plusK, targetLab, scoreContext);
                if (plusResult.dE < best.dE) {
                    best = plusResult;
                    improved = true;
                    plusAdopted = true;
                }
            }

            var minusK = Math.round(clampPct(best.k - step));
            if (plusAdopted && minusK === previousK) continue;
            if (minusK !== best.k) {
                var minusResult = makeKOnlyResult(minusK, targetLab, scoreContext);
                if (minusResult.dE < best.dE) {
                    best = minusResult;
                    improved = true;
                }
            }

            if (!improved) break;
        }
    }

    return makeKOnlyResult(finalizeCMYK(best).k, targetLab, scoreContext);
}

function findKOnlyByLightness(targetLab) {
    var bestK = 0;
    var bestLab = getKOnlyIntegerLab(bestK);
    var bestScore = Math.abs(targetLab.L - bestLab.L);

    for (var k = 1; k <= 100; k++) {
        var lab = getKOnlyIntegerLab(k);
        var score = Math.abs(targetLab.L - lab.L);
        if (score < bestScore || (score === bestScore && k > bestK)) {
            bestK = k;
            bestLab = lab;
            bestScore = score;
        }
    }

    return makeLabResultFromKnownLab({
        c: 0,
        m: 0,
        y: 0,
        k: bestK
    }, targetLab, bestLab);
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

function makeDirectPatternSeed(inputCMYK, info, removedMin) {
    if (removedMin == null) removedMin = minRemovedCMY(inputCMYK, info);
    var seedK = inputCMYK.k;
    if (removedMin > 0) {
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
    var removedMin = minRemovedCMY(inputCMYK, info);
    addUniqueDirectSeed(seeds, seen, makeDirectPatternSeed(inputCMYK, info, removedMin));

    if (!needsExtraDirectSeeds(targetLab)) return seeds;

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
    var minimum = 101;
    if (!info.useC && inputCMYK.c < minimum) minimum = inputCMYK.c;
    if (!info.useM && inputCMYK.m < minimum) minimum = inputCMYK.m;
    if (!info.useY && inputCMYK.y < minimum) minimum = inputCMYK.y;
    return minimum === 101 ? 0 : minimum;
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
        kWeight: neutral * darkWeight,
        scoreCache: {},
        kOnlyResultCache: {}
    };
}

function scoreDirectCMYKValues(c, m, y, k, targetLab, scoreContext) {
    var ctx = scoreContext || makeDirectScoreContext(targetLab);
    c = roundCMYKValue(c, true);
    m = roundCMYKValue(m, true);
    y = roundCMYKValue(y, true);
    k = roundCMYKValue(k, true);
    var key = cacheKeyFromCMYK(c, m, y, k);
    if (ctx.scoreCache.hasOwnProperty(key)) return ctx.scoreCache[key];
    var lab = cmykToLab(c, m, y, k, key);
    var dL = targetLab.L - lab.L;
    var da = targetLab.a - lab.a;
    var db = targetLab.b - lab.b;
    var ab2 = da * da + db * db;
    var dE = Math.sqrt(dL * dL + ab2);
    var grayCast = Math.sqrt(ab2);
    var nonK = c + m + y;
    var underL = dL > 0 ? dL : 0;

    var score = dE +
        (DIRECT_GRAY_CAST_WEIGHT * ctx.neutral * grayCast) +
        (DIRECT_NONK_WEIGHT * ctx.kWeight * nonK / 100) +
        (DIRECT_UNDER_LIGHTNESS_WEIGHT * ctx.darkWeight * underL);
    ctx.scoreCache[key] = score;
    return score;
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
    var bestScore = candidate.score;
    if (bestScore == null) {
        bestScore = scoreDirectCMYKValues(bestC, bestM, bestY, bestK, targetLab, scoreContext);
    }
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
    var bestScore = candidate.score;
    if (bestScore == null) {
        bestScore = scoreDirectCMYKValues(bestC, bestM, bestY, bestK, targetLab, scoreContext);
    }

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
                        continue;
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
                        continue;
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
                        continue;
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
                        continue;
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

function directPatternPriority(info) {
    if (!info) return 99;
    if (info.pattern === 'K') return 0;
    if (info.pattern === 'C') return 1;
    if (info.pattern === 'M') return 2;
    if (info.pattern === 'Y') return 3;
    if (info.pattern === 'CM') return 4;
    if (info.pattern === 'MY') return 5;
    if (info.pattern === 'YC') return 6;
    return 99;
}

function isBetterDirectCandidate(candidate, best) {
    if (!best) return true;
    if (candidate.score < best.score) return true;
    return candidate.score === best.score &&
        directPatternPriority(candidate.patternInfo) < directPatternPriority(best.patternInfo);
}

function searchDirectPatternInfos(inputCMYK, targetLab, patternInfos, passesPerStep, scoreContext, initialBest) {
    var best = initialBest || null;
    for (var i = 0; i < patternInfos.length; i++) {
        var info = patternInfos[i];
        if (info.pattern === 'K' && !isDirectKOnlyDecisionArea(targetLab)) continue;
        var seeds = buildDirectPatternSeeds(inputCMYK, targetLab, info);
        for (var si = 0; si < seeds.length; si++) {
            var candidate = makeDirectCandidateFromCMYK(seeds[si], info);
            var refined = refineDirectCandidate(candidate, targetLab, passesPerStep, scoreContext);
            if (isBetterDirectCandidate(refined, best)) {
                best = refined;
            }
        }
    }
    return best;
}

function selectDirectSingleFallbackInfos(baseResult) {
    if (!baseResult || baseResult.dE < DIRECT_SINGLE_FALLBACK_DE_MIN) return [];

    var values = [
        { value: baseResult.c, info: DIRECT_SINGLE_PATTERN_INFOS[0] },
        { value: baseResult.m, info: DIRECT_SINGLE_PATTERN_INFOS[1] },
        { value: baseResult.y, info: DIRECT_SINGLE_PATTERN_INFOS[2] }
    ];
    values.sort(function (a, b) {
        if (a.value !== b.value) return b.value - a.value;
        return directPatternPriority(a.info) - directPatternPriority(b.info);
    });

    var primary = values[0].value;
    var secondaryTotal = values[1].value + values[2].value;
    if (primary <= ZERO_THR || secondaryTotal > ZERO_THR * 2) return [];

    var selected = [values[0].info];
    if (values[1].value === primary) selected.push(values[1].info);
    return selected;
}

function adjustDirectPatternedWithPasses(inputCMYK, targetLab, passesPerStep, integerPasses, scoreContext) {
    var baseBest = searchDirectPatternInfos(
        inputCMYK,
        targetLab,
        DIRECT_BASE_PATTERN_INFOS,
        passesPerStep,
        scoreContext,
        null
    );
    if (!baseBest) return null;

    var baseFinal = finalizeCMYK(baseBest);
    var baseResult = makeLabResultFromCMYK(baseFinal, targetLab);
    var singleInfos = selectDirectSingleFallbackInfos(baseResult);
    var best = baseBest;

    if (singleInfos.length > 0) {
        best = searchDirectPatternInfos(
            inputCMYK,
            targetLab,
            singleInfos,
            passesPerStep,
            scoreContext,
            baseBest
        );
    }

    var integerBest = refineIntegerDirectCandidate(best, targetLab, integerPasses, scoreContext);
    var finalCMYK = finalizeCMYK(integerBest);
    if (isSameCMYK(finalCMYK, baseFinal)) return baseResult;
    return makeLabResultFromCMYK(finalCMYK, targetLab);
}

function adjustDirectPatterned(inputCMYK, targetLab) {
    var scoreContext = makeDirectScoreContext(targetLab);
    var result = adjustDirectPatternedWithPasses(
        inputCMYK,
        targetLab,
        DIRECT_REFINE_PASSES_PER_STEP,
        DIRECT_INTEGER_REFINE_PASSES,
        scoreContext
    );
    if (!result) return null;

    if (isDirectKOnlyDecisionArea(targetLab)) {
        var kOnly = refineKOnly(targetLab, scoreContext);
        if (shouldPreferDirectKOnlyDark(targetLab, result, kOnly, scoreContext)) return kOnly;
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
    if (spot) res.spot = spot;
    return res;
}

function isSameCMYK(a, b) {
    return a.c === b.c && a.m === b.m && a.y === b.y && a.k === b.k;
}

function getCachedAdjustedResult(orig, key) {
    var cached = cacheGetResult(orig, key);
    if (!cached) return null;

    cacheHitCount++;
    return makeColorProcessResult(cached.changed, cached.reason, cached.out);
}

function cacheAdjustedResult(orig, result, key) {
    cachePutResult(orig, result, key);
    return result;
}

function computeAdjustedResult(orig, key) {
    try {
        var labA = cmykToLab(orig.c, orig.m, orig.y, orig.k, key);
        var targetLab = (SATURATION_BOOST_ENABLED && SATURATION_BOOST_PCT > 0) ? applySaturationBoostToLab(labA, SATURATION_BOOST_PCT) : labA;
        var kBoostResult = buildKBoostResult(targetLab);

        if (kBoostResult) {
            var kBoostOut = finalizeCMYK(kBoostResult);
            if (!shouldProtectLightColorFromKBalance(orig, kBoostOut, targetLab)) {
                if (isSameCMYK(orig, kBoostOut)) {
                    return cacheAdjustedResult(orig, makeColorProcessResult(false, 'same'), key);
                }
                return cacheAdjustedResult(orig, makeColorProcessResult(true, null, kBoostOut), key);
            }
        }

        var adj = adjustDirectPatterned(orig, targetLab);
        if (!adj) {
            return cacheAdjustedResult(orig, makeColorProcessResult(false, 'noCandidate'), key);
        }

        adj = applyCMYKBalance(adj, targetLab);

        var finalOut = finalizeCMYK(adj);
        if (isSameCMYK(orig, finalOut)) {
            return cacheAdjustedResult(orig, makeColorProcessResult(false, 'same'), key);
        }
        return cacheAdjustedResult(orig, makeColorProcessResult(true, null, finalOut), key);
    } finally {
        trimLabCacheAfterSearch();
    }
}

function buildAdjustedColorResult(orig) {
    resultCacheLookupCount++;
    var key = cacheKeyFromCMYK(orig.c, orig.m, orig.y, orig.k);
    var cachedResult = getCachedAdjustedResult(orig, key);
    return cachedResult || computeAdjustedResult(orig, key);
}

function processedSpotStateResult(state) {
    if (!state) return null;
    if (typeof state.changed !== 'undefined') return state;
    return makeColorProcessResult(false, state.reason);
}

function processSpotColorObject(sp, key, orig) {
    var spotResult = buildAdjustedColorResult(orig);
    if (AVOID_AUTO_BLACK_OVERPRINT_ENABLED && spotResult.changed &&
        (isK100CMYK(spotResult.out) || isAutoBlackOverprintCMYK(spotResult.out)) && isAutoBlackOverprintCMYK(orig)) {
        // 全変換オプションの結果を確認してから、専用色のY値が整数化や閾値処理で変わるのを防ぐ。
        try {
            if (isAutoBlackOverprintDefinition(sp.name, orig)) {
                markProcessedSpot(key, { reason: null });
                return makeColorProcessResult(false, 'same');
            }
        } catch (nameError) { }
    }
    if (!spotResult.changed) {
        var unchangedState = {
            reason: spotResult.reason === 'same' ? null : spotResult.reason
        };
        markProcessedSpot(key, unchangedState);
        return spotResult;
    }

    var originalName = null;
    try {
        originalName = sp.name;
    } catch (nameReadError) { }
    var convertedSpot = null;
    try {
        var doc = colorDocument || app.activeDocument;
        convertedSpot = doc.spots.add();
        convertedSpot.colorType = ColorModel.PROCESS;
        convertedSpot.color = makeCMYK(spotResult.out.c, spotResult.out.m, spotResult.out.y, spotResult.out.k);
    } catch (e) {
        if (convertedSpot) {
            try { convertedSpot.remove(); } catch (removeError) { }
        }
        if (isUserCancelledError(e)) throw e;
        var failedState = {
            reason: 'spotWriteFailed'
        };
        markProcessedSpot(key, failedState);
        return makeColorProcessResult(false, failedState.reason);
    }

    var result = makeColorProcessResult(true, null, spotResult.out, convertedSpot);
    result.resource = trackColorResource(convertedSpot);
    markProcessedSpot(key, result);
    markProcessedSpot(spotKey(convertedSpot), makeColorProcessResult(false, 'same'));
    var assignedName = null;
    try { assignedName = convertedSpot.name; } catch (nameError) { }
    queueSpotRename(convertedSpot, assignedName, spotResult.out, originalName, result.resource);
    return result;
}

function processSpotColor(color) {
    var sp;
    var key;
    var baseColor;
    var baseType;
    var orig;
    try {
        sp = color.spot;
        if (!sp) return makeColorProcessResult(false, 'nonCMYK');
        key = spotKey(sp);
        var priorState = key ? processedSpotMap[key] : null;
        if (priorState) return processedSpotStateResult(priorState);
        baseColor = sp.color;
        baseType = baseColor ? String(baseColor.typename) : "";
        if (baseType === 'GrayColor') {
            markProcessedSpot(key, {
                reason: null
            });
            return makeColorProcessResult(false, 'ignoredGray');
        }
        if (sp.colorType !== ColorModel.PROCESS || baseType !== 'CMYKColor') {
            markProcessedSpot(key, {
                reason: 'nonCMYK'
            });
            return makeColorProcessResult(false, 'nonCMYK');
        }
        orig = readCMYKValues(baseColor);
    } catch (e) {
        if (sp && key) {
            markProcessedSpot(key, {
                reason: 'colorReadFailed'
            });
        }
        return makeColorProcessResult(false, 'colorReadFailed');
    }
    return processSpotColorObject(sp, key, orig);
}

// 単一カラー（CMYK/SpotColor）を処理 - 詳細な結果を返す
function processColorObject(color, typeName) {
    if (!color) return makeColorProcessResult(false, 'same');
    if (!typeName) {
        try {
            typeName = String(color.typename);
        } catch (e) {
            return makeColorProcessResult(false, 'colorReadFailed');
        }
    }

    if (typeName === 'NoColor') return makeColorProcessResult(false, 'ignoredNoColor');
    if (typeName === 'GrayColor') return makeColorProcessResult(false, 'ignoredGray');
    if (typeName === 'PatternColor') return makeColorProcessResult(false, 'patternColor');
    if (typeName === 'SpotColor') return processSpotColor(color);
    if (typeName !== 'CMYKColor') return makeColorProcessResult(false, 'nonCMYK');

    var orig;
    try {
        orig = readCMYKValues(color);
    } catch (e2) {
        return makeColorProcessResult(false, 'colorReadFailed');
    }
    return buildAdjustedColorResult(orig);
}

function isIgnoredColorProcessReason(reason) {
    return !reason ||
        reason === 'same' ||
        reason === 'ignoredGray' ||
        reason === 'ignoredNoColor';
}

function makeReplacementColor(source, result) {
    if (result.spot) {
        var spotColor = new SpotColor();
        spotColor.spot = result.spot;
        spotColor.tint = source.tint;
        return spotColor;
    }
    if (result.gradient) {
        var gradientColor = new GradientColor();
        gradientColor.gradient = result.gradient;
        gradientColor.origin = [source.origin[0], source.origin[1]];
        gradientColor.length = source.length;
        gradientColor.angle = source.angle;
        gradientColor.hiliteAngle = source.hiliteAngle;
        gradientColor.hiliteLength = source.hiliteLength;
        gradientColor.matrix = source.matrix;
        return gradientColor;
    }
    return makeCMYK(result.out.c, result.out.m, result.out.y, result.out.k);
}

function applyColorResultToProperty(target, propName, res, entry, sourceColor) {
    if (res && !isIgnoredColorProcessReason(res.reason)) {
        countSkip(entry, res.reason);
    }
    if (!res || !res.changed) return 0;
    try {
        target[propName] = makeReplacementColor(sourceColor, res);
        retainColorResource(res.resource);
    } catch (e) {
        preserveColorResource(res.resource);
        if (isUserCancelledError(e)) throw e;
        countSkip(entry, 'colorWriteFailed');
        return 0;
    }
    return res.changes || 1;
}

function snapshotPaintColor(color, typeName) {
    if (typeName === 'CMYKColor') {
        return { typename: typeName, cyan: color.cyan, magenta: color.magenta,
            yellow: color.yellow, black: color.black };
    }
    if (typeName === 'SpotColor') {
        return { typename: typeName, spot: color.spot, tint: color.tint };
    }
    return color;
}

function readColorProperty(target, propName) {
    try {
        var color = target[propName];
        var typeName = color ? String(color.typename) : '';
        return { color: snapshotPaintColor(color, typeName), typeName: typeName };
    } catch (e) {
        if (isUserCancelledError(e)) throw e;
        return { reason: 'colorReadFailed' };
    }
}

function processColorPropertyCore(target, propName, allowGradient, entry, source, selectionTask) {
    source = source || readColorProperty(target, propName);
    if (source.reason) {
        countSkip(entry, 'colorReadFailed');
        return 0;
    }
    var col = source.color;
    var typeName = source.typeName;
    if (!col) return 0;
    var res = allowGradient && typeName === 'GradientColor' ?
        processGradientColor(col) : processColorObject(col, typeName);
    var changed = applyColorResultToProperty(target, propName, res, entry, col);
    if (AVOID_AUTO_BLACK_OVERPRINT_ENABLED &&
        (typeName === 'CMYKColor' || typeName === 'SpotColor' || typeName === 'GrayColor') &&
        (changed > 0 || (res && !res.changed && isIgnoredColorProcessReason(res.reason)))) {
        // 単色の使用箇所だけを保持する。共有グラデーションの停止点は変更しない。
        queueAutoBlackOverprintTask(target, propName, entry, changed > 0, changed > 0 ? res.resource : null, selectionTask);
    }
    return changed;
}

// 元の定義から変換済みの定義を作り、各使用箇所への適用時に参照数を数える。
function processGradientColor(gradColor) {
    var g;
    var key;
    try {
        g = gradColor.gradient;
        key = gradientKey(g);
    } catch (e) {
        if (isUserCancelledError(e)) throw e;
        return makeColorProcessResult(false, 'gradientStopFailed');
    }
    var priorState = key ? processedGradientMap[key] : null;
    if (priorState) return priorState;
    var sourceStops = [];
    var gradientType;
    try {
        gradientType = g.type;
        var stops = g.gradientStops;
        var stopCount = stops.length;
        if (stopCount < 2) throw new Error('Gradient needs at least two stops');
        for (var s = 0; s < stopCount; s++) {
            checkpointProgress();
            var stop = stops[s];
            var stopColor = stop.color;
            sourceStops.push({
                color: stopColor, source: snapshotPaintColor(stopColor, stopColor ? String(stopColor.typename) : ''),
                rampPoint: stop.rampPoint,
                midPoint: stop.midPoint, opacity: stop.opacity
            });
        }
    } catch (e2) {
        if (isUserCancelledError(e2)) throw e2;
        var readFailure = makeColorProcessResult(false, 'gradientStopFailed');
        if (key) processedGradientMap[key] = readFailure;
        return readFailure;
    }
    var changes = 0;
    var reason = null;
    var dependencies = [];
    for (var i = 0; i < sourceStops.length; i++) {
        checkpointProgress();
        var sourceStop = sourceStops[i];
        try {
            var converted = processColorObject(sourceStop.source);
            if (!reason && !isIgnoredColorProcessReason(converted.reason)) reason = converted.reason;
            if (converted.changed) {
                sourceStop.color = makeReplacementColor(sourceStop.source, converted);
                if (converted.resource) dependencies.push(converted.resource);
                changes++;
            }
        } catch (colorError) {
            if (isUserCancelledError(colorError)) throw colorError;
            if (!reason) reason = 'gradientStopFailed';
        }
    }
    var result = makeColorProcessResult(false, reason);
    var gradient = null;
    if (changes > 0) {
        try {
            var doc = colorDocument || app.activeDocument;
            gradient = doc.gradients.add();
            gradient.type = gradientType;
            var destinationStops = gradient.gradientStops;
            while (destinationStops.length < sourceStops.length) destinationStops.add();
            for (var d = 0; d < sourceStops.length; d++) {
                checkpointProgress();
                var destination = destinationStops[d];
                var original = sourceStops[d];
                destination.rampPoint = original.rampPoint;
                destination.midPoint = original.midPoint;
                destination.opacity = original.opacity;
                destination.color = original.color;
            }
            result = makeColorProcessResult(true, reason);
            result.gradient = gradient;
            result.changes = changes;
            result.resource = trackColorResource(gradient, dependencies);
            processedGradientMap[gradientKey(gradient)] = makeColorProcessResult(false, 'same');
        } catch (e3) {
            if (gradient) {
                try { gradient.remove(); } catch (removeError) { }
            }
            if (isUserCancelledError(e3)) throw e3;
            result = makeColorProcessResult(false, 'gradientWriteFailed');
        }
    }
    if (key) processedGradientMap[key] = result;
    return result;
}

function makeTextSubRange(tf, startIndex, endIndex) {
    try {
        var range = tf.textRange;
        range.end = endIndex;
        range.start = startIndex;
        if (range.start !== startIndex || range.end !== endIndex) return null;
        return range;
    } catch (e) {
        return null;
    }
}

function readTextRunValue(tf, startIndex, endIndex) {
    var probe = makeTextSubRange(tf, startIndex, endIndex);
    if (!probe) return null;
    try {
        var value = Number(probe.getTextRunLength());
        return isNaN(value) ? null : value;
    } catch (e) {
        return null;
    }
}

function collectTextRunSpecs(tf, heartbeat) {
    var fullRange;
    var frameStart;
    var frameEnd;
    try {
        fullRange = tf.textRange;
        frameStart = Number(fullRange.start);
        frameEnd = Number(fullRange.end);
    } catch (e) {
        return null;
    }
    if (isNaN(frameStart) || isNaN(frameEnd) || frameEnd < frameStart) return null;

    var runValueMode = null;
    if (frameEnd > frameStart) {
        if (heartbeat) heartbeat();
        var tailValue = readTextRunValue(tf, frameEnd - 1, frameEnd);
        if (tailValue === frameEnd && frameEnd !== 1) {
            runValueMode = 'absolute';
        } else if (tailValue === 1) {
            runValueMode = 'length';
        }
    }

    var runs = [];
    var cursor = frameStart;
    while (cursor < frameEnd) {
        if (heartbeat) heartbeat();
        var runValue = readTextRunValue(tf, cursor, frameEnd);
        if (runValue == null) return null;
        var runEnd;
        if (runValueMode === 'absolute') {
            if (runValue <= cursor || runValue > frameEnd) return null;
            runEnd = runValue;
        } else if (runValueMode === 'length') {
            if (runValue < 1 || cursor + runValue > frameEnd) return null;
            runEnd = cursor + runValue;
        } else {
            var absoluteEnd = (runValue > cursor && runValue <= frameEnd) ? runValue : null;
            var lengthEnd = (runValue >= 1 && cursor + runValue <= frameEnd) ? cursor + runValue : null;
            if (absoluteEnd == null && lengthEnd == null) return null;
            if (absoluteEnd == null) {
                runValueMode = 'length';
                runEnd = lengthEnd;
            } else if (lengthEnd == null) {
                runValueMode = 'absolute';
                runEnd = absoluteEnd;
            } else {
                runEnd = absoluteEnd;
            }
        }
        runs.push({
            start: cursor,
            end: runEnd
        });
        cursor = runEnd;
    }
    return runs;
}

function addTextColorTasks(entry, tf, heartbeat) {
    var runs = collectTextRunSpecs(tf, heartbeat);
    if (!runs) {
        entry.tasks.push({
            kind: 'scanFailure',
            reason: 'textAttributesReadFailed',
            steps: 1
        });
        return;
    }
    for (var i = 0, n = runs.length; i < n; i++) {
        entry.tasks.push({
            kind: 'textRun',
            start: runs[i].start,
            end: runs[i].end,
            steps: 2
        });
    }
}

function walkSelectionArtItems(visitor, unsupportedVisitor, heartbeat) {
    var doc = app.activeDocument;
    var selection = doc.selection;
    var count = selection ? selection.length : 0;
    if (count === 0) return false;
    var references = [];
    // 1: 訪問済み、2: 処理対象へ登録済み、4: 未対応として登録済み。
    var states = {};
    var parents = {};
    var owners = {};
    var scope = {};
    // 全要素のノードを保持せず、未処理の要素と既知の所属だけを並行する配列に積む。
    var stack = [];
    var stackKeys = [];
    var stackOwners = [];
    var stackOwnerKeys = [];
    var pending = [];
    var pendingGroups = {};
    var pendingCompounds = {};

    function itemKey(item) {
        return artItemKey(item, references);
    }

    function parentOf(item, key) {
        if (typeof parents[key] !== 'undefined') return parents[key];
        var parent = null;
        try { parent = item.parent || null; } catch (e) {
            if (isUserCancelledError(e)) throw e;
            return undefined;
        }
        parents[key] = parent;
        return parent;
    }

    function compoundOwner(item, knownKey) {
        var key = knownKey || itemKey(item);
        if (typeof owners[key] !== 'undefined') return owners[key];
        var path = [];
        var seen = {};
        var owner = null;
        while (item) {
            if (heartbeat) heartbeat();
            if (typeof owners[key] !== 'undefined') { owner = owners[key]; break; }
            if (seen[key]) break;
            seen[key] = true;
            path.push(key);
            var type = '';
            try { type = String(item.typename); } catch (e) {
                if (isUserCancelledError(e)) throw e;
                item = undefined;
                break;
            }
            if (type === 'CompoundPathItem') { owner = item; break; }
            if (type === 'Document' || type === 'Layer') break;
            item = parentOf(item, key);
            if (item) key = itemKey(item);
        }
        if (typeof item !== 'undefined') {
            for (var p = 0; p < path.length; p++) owners[path[p]] = owner;
        }
        return owner;
    }

    function pathOwner(item, key) {
        if (typeof owners[key] !== 'undefined') return owners[key];
        var parent = parents[key];
        if (typeof parent === 'undefined') {
            try { parent = item.parent; } catch (e) {
                if (isUserCancelledError(e)) throw e;
                return null;
            }
        }
        return parent ? compoundOwner(parent) : null;
    }

    function belongsToSelection(item) {
        var path = [];
        var seen = {};
        var included = false;
        while (item) {
            if (heartbeat) heartbeat();
            var key = itemKey(item);
            if (typeof scope[key] !== 'undefined') { included = scope[key]; break; }
            if (seen[key]) break;
            seen[key] = true;
            path.push(key);
            item = parentOf(item, key);
        }
        if (typeof item !== 'undefined') {
            for (var p = 0; p < path.length; p++) scope[path[p]] = included;
        }
        return included;
    }

    function report(item, knownKey) {
        var key = knownKey || itemKey(item);
        if (states[key] & 4) return;
        states[key] = (states[key] || 0) | 4;
        if (unsupportedVisitor) unsupportedVisitor(item);
    }

    function emit(item, type, owner, knownKey) {
        var key = knownKey || itemKey(owner);
        if (states[key] & 2) return;
        states[key] = (states[key] || 0) | 2;
        visitor(item, type, owner);
    }

    function readCollection(item, property, receive, reverse) {
        var length = -1;
        var failed = false;
        var collection;
        try {
            collection = item[property];
            length = collection.length;
            if (typeof length !== 'number' || !isFinite(length) || length < 0) throw new Error('Invalid collection');
        } catch (e) {
            if (isUserCancelledError(e)) throw e;
            return { length: -1, failed: true };
        }
        for (var c = 0; c < length; c++) {
            if (heartbeat) heartbeat();
            var child;
            try {
                var index = reverse ? length - 1 - c : c;
                child = collection[index];
                if (!child) throw new Error('Unavailable child');
            } catch (e2) {
                if (isUserCancelledError(e2)) throw e2;
                failed = true;
                continue;
            }
            if (receive(child) === false) break;
        }
        return { length: length, failed: failed };
    }

    function walkGroup(item, key, owner, ownerKey) {
        var start = stack.length;
        var length = -1;
        var failed = false;
        var collection;
        try {
            collection = item.pageItems;
            length = collection.length;
            if (typeof length !== 'number' || !isFinite(length) || length < 0) throw new Error('Invalid collection');
        } catch (e) {
            if (isUserCancelledError(e)) throw e;
            length = -1;
            failed = true;
        }
        // 逆順に積み、取り出す順序は従来どおりにする。正常時は中間の子一覧を作らない。
        for (var i = length - 1; i >= 0; i--) {
            if (heartbeat) heartbeat();
            var child;
            try {
                child = collection[i];
                if (!child) throw new Error('Unavailable child');
            } catch (e2) {
                if (isUserCancelledError(e2)) throw e2;
                failed = true;
                continue;
            }
            stack.push(child);
            stackKeys.push(itemKey(child));
            stackOwners.push(owner);
            stackOwnerKeys.push(ownerKey);
        }
        var emptyClip = false;
        try { emptyClip = length === 0 && item.clipped === true; } catch (e3) { }
        if (!failed && !emptyClip) return;

        // 取得不能な子がある場合だけ、重複確認表と型別コレクションで補完する。
        var found = {};
        var foundCount = 0;
        for (var s = start; s < stack.length; s++) {
            if (!found[stackKeys[s]]) {
                found[stackKeys[s]] = true;
                foundCount++;
            }
        }
        var collections = ['pathItems', 'groupItems', 'compoundPathItems', 'textFrames', 'meshItems', 'placedItems',
            'rasterItems', 'pluginItems', 'symbolItems', 'graphItems', 'nonNativeItems', 'legacyTextItems'];
        for (var c = 0; c < collections.length; c++) {
            readCollection(item, collections[c], function (child) {
                var childKey = itemKey(child);
                var parent = parentOf(child, childKey);
                if (!parent || itemKey(parent) !== key || found[childKey]) return;
                found[childKey] = true;
                foundCount++;
                // 補完した子は、先に取得できた子の後で処理する。
                stack.splice(start, 0, child);
                stackKeys.splice(start, 0, childKey);
                stackOwners.splice(start, 0, owner);
                stackOwnerKeys.splice(start, 0, ownerKey);
            });
        }
        var expected = emptyClip ? -1 : length;
        if (expected < 0 || foundCount < expected) {
            var record = { item: item, key: key, type: 'GroupItem', expected: expected, found: found, count: foundCount };
            pending.push(record);
            pendingGroups[key] = record;
        }
    }

    function drainStack() {
        while (stack.length) {
            if (heartbeat) heartbeat();
            var item = stack.pop();
            var key = stackKeys.pop() || itemKey(item);
            var owner = stackOwners.pop();
            var ownerKey = stackOwnerKeys.pop();
            if (states[key] & 1) continue;
            states[key] = (states[key] || 0) | 1;
            var type;
            try { type = String(item.typename); } catch (e) {
                if (isUserCancelledError(e)) throw e;
                report(item, key);
                continue;
            }

            if (type === 'GroupItem') {
                if (typeof owner === 'undefined') {
                    owner = compoundOwner(item, key);
                    ownerKey = owner ? itemKey(owner) : null;
                }
                walkGroup(item, key, owner, ownerKey);
            } else if (type === 'CompoundPathItem') {
                var representative = null;
                // 最初に取得できたPathItemを代表とする。取得不能な添字の後も調べる。
                readCollection(item, 'pathItems', function (child) {
                    try {
                        if (child.typename === 'PathItem') { representative = child; return false; }
                        else {
                            stack.push(child);
                            stackKeys.push(null);
                            stackOwners.push(item);
                            stackOwnerKeys.push(key);
                        }
                    } catch (e2) { if (isUserCancelledError(e2)) throw e2; }
                });
                if (representative) {
                    emit(representative, 'PathItem', item, key);
                } else {
                    pending.push({ item: item, key: key, type: type });
                    pendingCompounds[key] = item;
                }
            } else if (type === 'PathItem') {
                if (typeof owner === 'undefined') {
                    owner = pathOwner(item, key);
                    ownerKey = owner ? itemKey(owner) : key;
                }
                emit(item, type, owner || item, owner ? ownerKey : key);
            } else if (type === 'TextFrame') {
                emit(item, type, item, key);
            } else {
                report(item, key);
            }
        }
    }

    function hasPendingRecovery() {
        for (var p = 0; p < pending.length; p++) {
            var record = pending[p];
            if (record.type === 'CompoundPathItem') {
                if (!(states[record.key] & 2)) return true;
            } else if (record.expected < 0 || record.count < record.expected) {
                return true;
            }
        }
        return false;
    }

    function recoverDocumentItem(item) {
        if (!belongsToSelection(item)) return;
        var key = itemKey(item);
        var parent = parentOf(item, key);
        var group = parent ? pendingGroups[itemKey(parent)] : null;
        if (group && !group.found[key]) {
            group.found[key] = true;
            group.count++;
        }
        if (!(states[key] & 1)) {
            stack.push(item);
            stackKeys.push(key);
            stackOwners.push(undefined);
            stackOwnerKeys.push(null);
            drainStack();
        }
        return hasPendingRecovery();
    }
    for (var i = 0; i < count; i++) {
        if (heartbeat) heartbeat();
        var selected = selection[i];
        if (!selected) continue;
        var selectedKey = itemKey(selected);
        var owner = compoundOwner(selected, selectedKey);
        var root = owner || selected;
        var rootKey = owner ? itemKey(owner) : selectedKey;
        scope[rootKey] = true;
        stack.push(root);
        stackKeys.push(rootKey);
        stackOwners.push(owners[rootKey]);
        stackOwnerKeys.push(owner ? rootKey : null);
    }
    stack.reverse();
    stackKeys.reverse();
    stackOwners.reverse();
    stackOwnerKeys.reverse();
    drainStack();
    var needsCompoundRecovery = false;
    for (var p = 0; p < pending.length; p++) {
        var record = pending[p];
        if (record.type === 'CompoundPathItem' && !(states[record.key] & 2)) {
            needsCompoundRecovery = true;
            break;
        }
    }
    var recoveryGroups = null;
    if (needsCompoundRecovery) {
        // pathItemsが空の複合パスは、その直下のグループから内部を取得する。
        // UUIDが一致する親だけを扱い、必要な対象が揃った時点で終了する。
        recoveryGroups = [];
        var lastParent = null;
        var lastParentKey = null;
        readCollection(doc, 'groupItems', function (item) {
            recoveryGroups.push(item);
            var parent;
            try {
                parent = item.parent;
            } catch (e) {
                if (isUserCancelledError(e)) throw e;
                return;
            }
            if (!parent) return;
            if (parent !== lastParent) {
                lastParentKey = itemKey(parent);
                // 取得失敗時は、次の参照でUUIDを再確認できるようにする。
                lastParent = lastParentKey.indexOf('uuid:') === 0 ? parent : null;
            }
            var compound = pendingCompounds[lastParentKey];
            if (!compound || (states[lastParentKey] & 2)) return;
            var key = itemKey(item);
            parents[key] = compound;
            stack.push(item);
            stackKeys.push(key);
            stackOwners.push(compound);
            stackOwnerKeys.push(lastParentKey);
            drainStack();
            return hasPendingRecovery();
        }, true);
    }
    if (hasPendingRecovery()) {
        // 取得できない対象が残る場合に文書側の一覧を補完する。
        // グループ一覧は既に取得した参照を使い、各一覧の読み取りを一回に抑える。
        var documentCollections = ['pageItems', 'pathItems', 'groupItems'];
        for (var d = 0; d < documentCollections.length && hasPendingRecovery(); d++) {
            var property = documentCollections[d];
            var source = property === 'groupItems' && recoveryGroups ? { groupItems: recoveryGroups } : doc;
            readCollection(source, property, recoverDocumentItem);
        }
    }
    for (var u = 0; u < pending.length; u++) {
        var unresolved = pending[u];
        if (unresolved.type === 'CompoundPathItem') {
            if (!(states[unresolved.key] & 2)) report(unresolved.item, unresolved.key);
        } else if (unresolved.expected < 0 || unresolved.count < unresolved.expected) {
            report(unresolved.item, unresolved.key);
        }
    }
    return true;
}


var gPathTaskPlans = [];
function createSelectionWorkList() {
    // 一件ごとの記録オブジェクトを保持せず、各情報を同じ添字で対応付ける。
    return { targets: [], typeNames: [], owners: [], tasks: [], attempts: [], skipped: [], opacityStates: [] };
}

function loadSelectionWorkEntry(workList, index, entry) {
    entry = entry || createSelectionArtItemRecord(null, '', null);
    entry.target = workList.targets[index];
    entry.typeName = workList.typeNames[index];
    entry.owner = workList.owners[index];
    entry.tasks = workList.tasks[index];
    entry.attempts = workList.attempts[index];
    entry.skipped = !!workList.skipped[index];
    entry.autoBlackOverprintOpacityState = workList.opacityStates[index];
    entry.workList = workList;
    entry.workIndex = index;
    return entry;
}

function createSelectionArtItemRecord(target, typeName, owner) {
    return {
        target: target,
        typeName: typeName,
        owner: owner || target
    };
}

function makeSelectionArtItemEntry(target, typeName, owner, heartbeat) {
    return populateSelectionArtItemEntry(createSelectionArtItemRecord(target, typeName, owner), heartbeat);
}

function populateSelectionArtItemEntry(entry, heartbeat) {
    var target = entry.target;
    var typeName = entry.typeName;
    entry.attempts = 0;
    entry.skipped = false;
    if (typeName === 'TextFrame') {
        entry.tasks = [];
        addTextColorTasks(entry, target, heartbeat);
        for (var i = 0; i < entry.tasks.length; i++) entry.attempts += entry.tasks[i].steps || 1;
        return entry;
    }
    var plan = readPathTaskPlan(target);
    entry.tasks = plan.tasks;
    entry.attempts = plan.attempts;
    return entry;
}

function readPathTaskPlan(target) {
    var fillState;
    var strokeState;
    try { fillState = target.filled ? 1 : 0; } catch (fillError) { fillState = 2; }
    try { strokeState = target.stroked ? 1 : 0; } catch (strokeError) { strokeState = 2; }
    // オフ・オン・取得失敗の組み合わせは最大9種類。対象や色を含まない定義だけを共有する。
    // 実際の色・エラー・変換結果はprepareSelectionTasks以降でオブジェクトごとに保持する。
    var key = fillState * 3 + strokeState;
    var plan = gPathTaskPlans[key];
    if (!plan) {
        var tasks = [];
        if (fillState === 1) tasks.push({ kind: 'colorProperty', propName: 'fillColor', allowGradient: true, steps: 1 });
        else if (fillState === 2) tasks.push({ kind: 'scanFailure', reason: 'fillStateReadFailed', steps: 1 });
        if (strokeState === 1) tasks.push({ kind: 'colorProperty', propName: 'strokeColor', allowGradient: true, steps: 1 });
        else if (strokeState === 2) tasks.push({ kind: 'scanFailure', reason: 'strokeStateReadFailed', steps: 1 });
        plan = { tasks: tasks, attempts: tasks.length };
        gPathTaskPlans[key] = plan;
    }
    return plan;
}

function readTextTaskAttributes(entry, task) {
    var range = makeTextSubRange(entry.target, task.start, task.end);
    if (!range) return null;
    try {
        return range.characterAttributes;
    } catch (e) {
        if (isUserCancelledError(e)) throw e;
        return null;
    }
}

function prepareSelectionTask(entry, task) {
    var prepared = { target: entry.target, paints: [], steps: task.steps || 1 };
    if (task.kind === 'scanFailure') {
        prepared.reason = task.reason;
    } else if (task.kind === 'colorProperty') {
        prepared.paints.push({ propName: task.propName, allowGradient: task.allowGradient,
            source: readColorProperty(entry.target, task.propName) });
    } else if (task.kind === 'textRun') {
        var attrs = readTextTaskAttributes(entry, task);
        if (!attrs) {
            prepared.reason = 'textAttributesReadFailed';
        } else {
            prepared.paints.push({ propName: 'fillColor', allowGradient: false, source: readColorProperty(attrs, 'fillColor') });
            prepared.paints.push({ propName: 'strokeColor', allowGradient: false, source: readColorProperty(attrs, 'strokeColor') });
        }
    }
    return prepared;
}

function prepareSelectionTasks(entry) {
    var prepared = [];
    for (var i = 0; i < entry.tasks.length; i++) {
        checkpointProgress();
        prepared.push(prepareSelectionTask(entry, entry.tasks[i]));
    }
    return prepared;
}

function hasPreparedReadFailure(prepared) {
    for (var i = 0; i < prepared.length; i++) {
        if (prepared[i].reason) return true;
        var paints = prepared[i].paints;
        for (var p = 0; p < paints.length; p++) {
            if (paints[p].source.reason) return true;
        }
    }
    return false;
}

function prepareCompoundPathTasks(entry, prepared) {
    if (!hasPreparedReadFailure(prepared)) return prepared;
    var paths;
    var count;
    try {
        if (!entry.owner || entry.owner.typename !== 'CompoundPathItem') return prepared;
        paths = entry.owner.pathItems;
        count = paths.length;
    } catch (e) {
        if (isUserCancelledError(e)) throw e;
        return prepared;
    }
    for (var i = 0; i < count; i++) {
        checkpointProgress();
        var candidate;
        try {
            candidate = paths[i];
            if (!candidate || candidate === entry.target || candidate.typename !== 'PathItem') continue;
        } catch (e2) {
            if (isUserCancelledError(e2)) throw e2;
            continue;
        }
        var alternative = makeSelectionArtItemEntry(candidate, 'PathItem', entry.owner);
        var alternativeTasks = prepareSelectionTasks(alternative);
        if (hasPreparedReadFailure(alternativeTasks)) continue;
        entry.target = candidate;
        entry.tasks = alternative.tasks;
        entry.attempts = alternative.attempts;
        if (entry.workList) {
            entry.workList.targets[entry.workIndex] = candidate;
            entry.workList.tasks[entry.workIndex] = alternative.tasks;
            entry.workList.attempts[entry.workIndex] = alternative.attempts;
        }
        return alternativeTasks;
    }
    return prepared;
}

function applySelectionTask(entry, task, prepared) {
    prepared = prepared || prepareSelectionTask(entry, task);
    if (task.kind === 'textRun' && !prepared.reason) {
        // 別の範囲を読む際にホストの範囲参照が変化しても、書き込み先を確定する。
        prepared.target = readTextTaskAttributes(entry, task);
        if (!prepared.target) {
            prepared.reason = 'textAttributesReadFailed';
            prepared.paints = [];
        }
    }
    var changed = 0;
    if (prepared.reason) countSkip(entry, prepared.reason);
    for (var i = 0; i < prepared.paints.length; i++) {
        var paint = prepared.paints[i];
        changed += processColorPropertyCore(prepared.target, paint.propName, paint.allowGradient, entry, paint.source, task);
    }
    stepProgress(prepared.steps);
    return changed;
}

function applySelectionArtItemEntry(entry) {
    if (!entry || !entry.target) return 0;
    // オブジェクト内の全色を取得してから適用する。文字範囲も元の属性で判定できる。
    var prepared = prepareSelectionTasks(entry);
    if (entry.typeName === 'PathItem') prepared = prepareCompoundPathTasks(entry, prepared);
    if (ignoredSwatchRules) {
        var decision = ignoredObjectDecision(prepared, ignoredSwatchRules);
        if (decision) {
            if (decision === 'ignore') ignoredSwatchRules.ignoredCount++;
            else countSkip(entry, decision);
            stepProgress(entry.attempts);
            return 0;
        }
    }
    var changed = 0;
    for (var i = 0, n = entry.tasks.length; i < n; i++) {
        changed += applySelectionTask(entry, entry.tasks[i], prepared[i]);
    }
    return changed;
}

// 選択を走査して全適用（Group/Compound含む） - 詳細集計
function applyToSelection(items) {
    var applied = 0;
    if (items && items.targets) {
        // 全件の記録を作り直さず、現在処理する一件分だけを入れ替えて使う。
        var entry = createSelectionArtItemRecord(null, '', null);
        for (var j = 0, count = items.targets.length; j < count; j++) {
            loadSelectionWorkEntry(items, j, entry);
            applied += applySelectionArtItemEntry(entry);
        }
        return { count: applied };
    }
    // 単体処理などで作成済みの記録配列を渡す場合も、同じ変換処理を使う。
    for (var i = 0, n = items ? items.length : 0; i < n; i++) {
        applied += applySelectionArtItemEntry(items[i]);
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
    var pathCount = 0;
    var textCount = 0;
    var unsupportedObjectCount = 0;
    var items = createSelectionWorkList();
    var targets = items.targets;
    var typeNames = items.typeNames;
    var owners = items.owners;
    var taskLists = items.tasks;
    var attempts = items.attempts;
    var unsupportedItems = [];
    var unsupportedBreakdown = [];
    var cancelled = false;
    var statusWindow = showStatusWindow ? createStatusWindow(uiText('scanningSelection'), 220, uiText('scanCancelHelp')) : null;
    var scanHeartbeat = statusWindow ? function () {
        statusWindow.tick();
    } : null;
    try {
        var walked = walkSelectionArtItems(function (target, typeName, owner) {
            // 走査中は対象だけを保持し、属性取得と予定作成は走査完了後にまとめて行う。
            targets.push(target);
            typeNames.push(typeName);
            owners.push(owner || target);
            selectedObjectCount++;
            if (typeName === 'TextFrame') textCount++;
            else pathCount++;
        }, function (it) {
            unsupportedObjectCount++;
            unsupportedItems.push(it);
        }, scanHeartbeat);
        if (!walked) throw new Error(uiText('requireSelection'));

        // 取得済みの対象から予定だけを格納する。階層・対象・代表パスを再取得しない。
        var i;
        var n = targets.length;
        var plan;
        if (pathCount > 0) {
            taskLists.length = n;
            attempts.length = n;
            for (i = 0; i < n; i++) {
                if (typeNames[i] === 'TextFrame') continue;
                if (scanHeartbeat) scanHeartbeat();
                plan = readPathTaskPlan(targets[i]);
                taskLists[i] = plan.tasks;
                attempts[i] = plan.attempts;
                planned += plan.attempts;
            }
        }
        if (textCount > 0) {
            taskLists.length = n;
            attempts.length = n;
            var entry = createSelectionArtItemRecord(null, 'TextFrame', null);
            for (i = 0; i < n; i++) {
                if (typeNames[i] !== 'TextFrame') continue;
                if (scanHeartbeat) scanHeartbeat();
                entry.target = targets[i];
                populateSelectionArtItemEntry(entry, scanHeartbeat);
                taskLists[i] = entry.tasks;
                attempts[i] = entry.attempts;
                planned += entry.attempts;
            }
        }
        if (unsupportedItems.length > 0) {
            for (i = 0; i < unsupportedItems.length; i++) {
                if (scanHeartbeat) scanHeartbeat();
                addUnsupportedBreakdownEntry(unsupportedBreakdown, unsupportedItems[i]);
            }
        }
    } catch (e) {
        if (isUserCancelledError(e)) {
            cancelled = true;
        } else {
            throw e;
        }
    } finally {
        if (statusWindow) statusWindow.close();
    }
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

function collectFinalSkippedItems(stats) {
    var items = [];
    var seenKeys = {};
    var fallbackRefs = [];
    var unsupported = stats && stats.unsupportedItems ? stats.unsupportedItems : [];
    var entries = stats && stats.items ? stats.items : [];
    var i;

    for (i = 0; i < unsupported.length; i++) {
        addUniqueSelectableItem(items, unsupported[i], seenKeys, fallbackRefs);
    }
    if (entries.targets) {
        for (i = 0; i < entries.targets.length; i++) {
            if (entries.skipped[i]) addUniqueSelectableItem(items, entries.owners[i], seenKeys, fallbackRefs);
        }
        return items;
    }
    for (i = 0; i < entries.length; i++) {
        if (entries[i].skipped) {
            addUniqueSelectableItem(items, entries[i].owner, seenKeys, fallbackRefs);
        }
    }
    return items;
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

function addCompletionMetricCell(parent, labelKey, value, width, helpTip) {
    var cell = parent.add('statictext', undefined, formatMetricText(labelKey, value));
    cell.alignment = ['left', 'center'];
    cell.justify = 'left';
    cell.preferredSize.width = width;
    if (helpTip) cell.helpTip = helpTip;
    return cell;
}

function addCompletionMetricRow(parent, leftKey, leftValue, rightKey, rightValue, widths, rightHelpTip) {
    var row = parent.add('group');
    row.orientation = 'row';
    row.alignment = 'left';
    row.alignChildren = ['left', 'center'];
    row.spacing = 18;
    row.margins = 0;
    addCompletionMetricCell(row, leftKey, leftValue, widths.left);
    addCompletionMetricCell(row, rightKey, rightValue, widths.right, rightHelpTip);
    return row;
}

function addCompletionPanel(parent, width) {
    var panel = parent.add('panel', undefined, '');
    panel.alignment = 'fill';
    panel.orientation = 'column';
    panel.alignChildren = ['left', 'center'];
    panel.preferredSize.width = width;
    panel.margins = [10, 10, 10, 10];
    panel.spacing = 6;
    return panel;
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
    addCompletionMetricRow(metricsGroup, 'cacheHitRate', info.cacheHitRate, 'processingTime', info.processingTime, metricWidths, info.processingTimeHelp);

    if (info.ignoredCount > 0) {
        metricsGroup.add('statictext', undefined, formatMetricText('ignoredObjects', formatNumberWithUnit(info.ignoredCount, 'selectedObjectsUnit')));
    }

    if (info.swatchRenameSkippedCount > 0) {
        var renameSkipped = metricsGroup.add('statictext', undefined, formatMetricText('swatchRenameSkipped', info.swatchRenameSkippedCount));
        renameSkipped.helpTip = uiText('swatchRenameSkippedHelp');
    }

    if (info.ignoredSwatches && info.ignoredSwatches.length > 0) {
        var ignoredPanelWidth = metricWidths.left + metricWidths.right + 18;
        var ignoredPanel = addCompletionPanel(dlg, ignoredPanelWidth);
        var ignoredTitle = ignoredPanel.add('statictext', undefined, uiText('ignoredSwatchesResult'));
        setControlBold(ignoredTitle);
        var ignoredListHeight = Math.min(6, info.ignoredSwatches.length) * 22 + 8;
        createSwatchList(ignoredPanel, info.ignoredSwatches, ignoredPanelWidth - 20, ignoredListHeight, false, false);
    }

    if (info.skippedCount > 0) {
        var skippedTitle = formatMetricText('skippedCount', formatNumberWithUnit(info.skippedCount, 'skippedCountUnit'));
        var breakdownLines = skippedBreakdownLines(info.skippedDetails);
        var skippedPanelWidth = completionSkippedPanelWidth(skippedTitle, breakdownLines);
        var skippedContentWidth = skippedPanelWidth - 20;
        var skippedPanel = addCompletionPanel(dlg, skippedPanelWidth);

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

    if (info.showAutoBlackOverprintNotice) {
        var noticePanelWidth = Math.max(metricWidths.left + metricWidths.right + 18, skippedPanelWidth || 0);
        var noticePanel = addCompletionPanel(dlg, noticePanelWidth);
        addBoldMultilineText(noticePanel, uiText('autoBlackOverprintNotice'), noticePanelWidth - 20);
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
    removeUnusedColorResources();
    try {
        resultCache = {};
        labConvCache = {};
        kOnlyIntegerLabCache = new Array(101);
        labConvCacheCount = 0;
        processedSpotMap = {};
        processedGradientMap = {};
        spotReferenceKeys = [];
        gradientReferenceKeys = [];
        ignoredSwatchRules = null;
        swatchPreviewCRCTable = null;
        pendingSpotRenames = [];
        spotRenameSkippedCount = 0;
        colorDocument = null;
        opacityStateCache = {};
        opacityReferenceKeys = [];
        autoBlackOverprintState = createAutoBlackOverprintState();
        cacheHitCount = 0;
        resultCacheLookupCount = 0;
        gSkipBreakdown = [];
        gPathTaskPlans = [];
        CMY_K_BALANCE_ENABLED = DEFAULT_CMY_K_BALANCE_ENABLED;
        CMY_K_BALANCE_VALUE = DEFAULT_CMY_K_BALANCE_VALUE;
        K_BOOST_ENABLED = DEFAULT_K_BOOST_ENABLED;
        LIGHT_COLOR_PROTECT_ENABLED = DEFAULT_LIGHT_COLOR_PROTECT_ENABLED;
        AVOID_AUTO_BLACK_OVERPRINT_ENABLED = DEFAULT_AVOID_AUTO_BLACK_OVERPRINT_ENABLED;
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

// 変換を実行し、処理結果を表示する
(
    function main() {
        var doc = validateActiveDocument();
        if (!doc) return;

        resetSkipCount();

        var stats = collectSelectionStats(true);
        if (!stats || stats.cancelled) return;

        var opt = showConvertOptionsDialog(stats, doc);
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
        AVOID_AUTO_BLACK_OVERPRINT_ENABLED = opt.avoidAutoBlackOverprint;
        colorDocument = doc;
        ignoredSwatchRules = createIgnoredSwatchRules(opt.ignoredSwatches);

        gProgress = createProgressBar(stats.planned > 0 ? stats.planned : 100);
        var t0 = nowMs();

        // 選択オブジェクトへ適用（色の置換）
        var appliedInfo = null;
        var totalSec = 0;
        var conversionEndMs = t0;
        var cleanupStartMs = t0;
        var cleanupEndMs = t0;
        var completionInfo = null;
        var cancelled = false;
        var finalSkippedItems = [];
        try {
            try {
                appliedInfo = applyToSelection(stats.items);
            } finally {
                // 名前を識別に使う変換ループの後で改名する。中断時も変換済みの分を反映する。
                applyPendingSpotRenames(doc);
            }
            if (AVOID_AUTO_BLACK_OVERPRINT_ENABLED) {
                appliedInfo.count += applyAutoBlackOverprint(doc);
            }
            finalSkippedItems = collectFinalSkippedItems(stats);
            conversionEndMs = nowMs();
            var skippedDetails = [];
            addSkipBreakdownEntries(skippedDetails, stats.unsupportedBreakdown);
            addSkipBreakdownEntries(skippedDetails, gSkipBreakdown);
            var completionSelectedObjectCount = stats.selectedObjectCount + stats.unsupportedObjectCount;
            completionInfo = {
                selectedObjectCount: formatNumberWithUnit(completionSelectedObjectCount, 'selectedObjectsUnit'),
                updatedColors: appliedInfo.count,
                swatchRenameSkippedCount: spotRenameSkippedCount,
                showAutoBlackOverprintNotice: autoBlackOverprintState.colorApplied,
                cacheHitRate: formatPercent(cacheHitCount, resultCacheLookupCount),
                processingTime: "",
                skippedCount: finalSkippedItems.length,
                ignoredCount: ignoredSwatchRules ? ignoredSwatchRules.ignoredCount : 0,
                ignoredSwatches: collectIgnoredSwatches(ignoredSwatchRules),
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
            cleanupStartMs = nowMs();
            // 結果表示で必要な件数・未適用対象は取得済み。大きな作業一覧への参照を外す。
            if (stats) stats.items = null;
            stats = null;
            cleanupAfterRun();
            cleanupEndMs = nowMs();
        }
        if (cancelled) return;

        var selectionStartMs = nowMs();
        if (opt.selectSkippedObjects) {
            var selectedSkippedCount = finalSkippedItems.length > 0 ? selectItems(doc, finalSkippedItems) : 0;
            if (finalSkippedItems.length === 0) {
                clearSelection(doc);
            } else if (selectedSkippedCount < finalSkippedItems.length) {
                completionInfo.skippedMessage = uiFormat('skippedObjectsPartiallySelected', {
                    selected: selectedSkippedCount,
                    total: finalSkippedItems.length
                });
            } else {
                completionInfo.skippedMessage = uiText('skippedObjectsSelected');
            }
        }

        var selectionEndMs = nowMs();
        totalSec = (selectionEndMs - t0) / 1000.0;
        completionInfo.processingTime = formatCompletionSeconds(totalSec);
        completionInfo.processingTimeHelp = uiFormat('processingTimeBreakdown', {
            conversion: formatCompletionSeconds((conversionEndMs - t0) / 1000.0),
            cleanup: formatCompletionSeconds((cleanupEndMs - cleanupStartMs) / 1000.0),
            selection: formatCompletionSeconds((selectionEndMs - selectionStartMs) / 1000.0)
        });

        // 実行結果をダイアログ表示
        showCompletionDialog(completionInfo);
    })();
