#target "illustrator"

/*
SCRIPTMETA-BEGIN
Script-ID=keypadSettingsChager_Ai
Version=1.4
Meta-URL=https://github.com/Yamonov/Iwashiya_Scripts/tree/main/Illustrator
Name=各種設定をテンキーで変更
Author=Murakami Yoshiteru
Target-App=Illustrator
Description=テンキー入力で変形基準点とIllustratorの各種設定を即時変更します。
SCRIPTMETA-END
*/

(function () {
    var PREF_KEY = "plugin/Transform/AnchorPoint";
    var TRANSFORM_PANEL_COMMAND = "AdobeTransformObjects1";
    var ANCHOR_PREVIEW_SIZE = 136;
    var ANCHOR_BOX_SIZE = 26;
    var ANCHOR_LINE_WIDTH = 1.5;
    var ANCHOR_KEY_FONT_SIZE = 9;
    var DUPLICATE_INPUT_INTERVAL = 200;
    var ANCHOR_POSITIONS = [
        [6, 6],
        [55, 6],
        [104, 6],
        [6, 55],
        [55, 55],
        [104, 55],
        [6, 104],
        [55, 104],
        [104, 104]
    ];
    var ANCHOR_LINES = [
        [32, 19, 55, 19],
        [81, 19, 104, 19],
        [117, 32, 117, 55],
        [117, 81, 117, 104],
        [81, 117, 104, 117],
        [32, 117, 55, 117],
        [19, 81, 19, 104],
        [19, 32, 19, 55]
    ];
    var ANCHOR_KEYS = ["7", "8", "9", "4", "5", "6", "1", "2", "3"];
    var KEY_TO_POINT = {
        "7": 0,
        "8": 1,
        "9": 2,
        "4": 3,
        "5": 4,
        "6": 5,
        "1": 6,
        "2": 7,
        "3": 8
    };
    var NAMED_SHORTCUTS = {
        "slash": "/",
        "divide": "/",
        "numpaddivide": "/",
        "asterisk": "*",
        "multiply": "*",
        "numpadmultiply": "*",
        "minus": "-",
        "hyphen": "-",
        "subtract": "-",
        "numpadsubtract": "-",
        "plus": "+",
        "add": "+",
        "numpadadd": "+",
        "equal": "=",
        "equals": "=",
        "numpadequal": "=",
        "comma": ",",
        "period": ".",
        "decimal": ".",
        "numpaddecimal": ".",
        "u+002f": "/",
        "u+002a": "*",
        "u+002d": "-",
        "u+002b": "+",
        "u+003d": "=",
        "u+002c": ",",
        "u+002e": "."
    };
    var KEY_CODE_TO_SHORTCUT = {
        42: "*",
        43: "+",
        44: ",",
        45: "-",
        46: ".",
        47: "/",
        61: "=",
        67: "*",
        69: "+",
        75: "/",
        78: "-",
        82: "0",
        96: "0",
        106: "*",
        107: "+",
        109: "-",
        110: ".",
        111: "/",
        187: "+",
        188: ",",
        189: "-",
        190: ".",
        191: "/"
    };

    var originalPoint = readPoint();
    var selectedPoint = originalPoint;
    var cornerOnValue = readCornerOnValue();
    var originalUnitState = getCurrentUnitState();
    var optionByShortcut = {};
    var unitPresetItems = [];
    var selectedUnitPresetIndex = 0;
    var lastHandledKey = "";
    var lastHandledAt = 0;
    var lastClickedItem = null;
    var lastItemClickAt = 0;

    var win = new Window("dialog", "設定を変更");
    win.orientation = "column";
    win.alignChildren = ["fill", "center"];
    win.margins = [12, 10, 12, 10];
    win.spacing = 0;

    var body = win.add("group");
    body.orientation = "row";
    body.alignChildren = ["top", "top"];
    body.margins = 0;
    body.spacing = 14;

    var anchorBlock = body.add("group");
    anchorBlock.orientation = "column";
    anchorBlock.alignChildren = ["center", "center"];
    anchorBlock.margins = 0;
    anchorBlock.spacing = 0;

    var anchorPreview = anchorBlock.add("statictext", undefined, "");
    anchorPreview.preferredSize = [ANCHOR_PREVIEW_SIZE, ANCHOR_PREVIEW_SIZE];
    anchorPreview.minimumSize = [ANCHOR_PREVIEW_SIZE, ANCHOR_PREVIEW_SIZE];
    anchorPreview.maximumSize = [ANCHOR_PREVIEW_SIZE, ANCHOR_PREVIEW_SIZE];
    anchorPreview.onDraw = drawAnchorPreview;

    updateDisplay(selectedPoint);

    var options = body.add("group");
    options.orientation = "row";
    options.alignChildren = ["left", "top"];
    options.margins = 0;
    options.spacing = 12;

    addOptionColumn(options, getOptionDefinitions());
    addUnitPresetColumn(options);

    var keySink = win.add("edittext", undefined, "");
    keySink.preferredSize = [0, 0];
    keySink.minimumSize = [0, 0];
    keySink.maximumSize = [0, 0];

    function handleKeyDown(ev) {
        var key = normalizeKey(ev);

        if (isDuplicateKey(key)) {
            preventDefault(ev);
            return;
        }

        if (key === "enter") {
            preventDefault(ev);
            win.close(1);
            return;
        }

        if (key === "escape") {
            applyPoint(originalPoint);
            preventDefault(ev);
            win.close(0);
            return;
        }

        var point = keyToPoint(key);
        if (point !== null) {
            selectedPoint = point;
            updateDisplay(selectedPoint);
            applyPoint(selectedPoint);
            rememberHandledKey(key);
            preventDefault(ev);
            return;
        }

        var option = keyToOption(key);
        if (option) {
            setOptionValue(option, !option.value);
            rememberHandledKey(key);
            preventDefault(ev);
            return;
        }

        if (key === ".") {
            cycleUnitPreset();
            rememberHandledKey(key);
            preventDefault(ev);
        }
    }

    try {
        win.addEventListener("keydown", handleKeyDown);
    } catch (e3) {
        win.onKeyDown = handleKeyDown;
    }

    try {
        keySink.addEventListener("keydown", handleKeyDown);
    } catch (e4) {
        keySink.onKeyDown = handleKeyDown;
    }

    keySink.onChanging = function () {
        var value = String(keySink.text || "");
        var changed = false;

        for (var i = 0; i < value.length; i++) {
            var key = value.charAt(i);

            if (isDuplicateKey(key)) {
                continue;
            }

            var point = keyToPoint(key);
            if (point !== null) {
                selectedPoint = point;
                changed = true;
                rememberHandledKey(key);
            }

            var option = keyToOption(key);
            if (option) {
                setOptionValue(option, !option.value);
                rememberHandledKey(key);
                continue;
            }

            if (key === ".") {
                cycleUnitPreset();
                rememberHandledKey(key);
            }
        }

        keySink.text = "";

        if (changed) {
            updateDisplay(selectedPoint);
            applyPoint(selectedPoint);
        }

        try {
            keySink.active = true;
        } catch (e5) { }
    };

    try {
        win.onShow = function () {
            win.active = true;
            keySink.active = true;
        };
    } catch (e6) { }

    win.show();

    function readPoint() {
        try {
            var point = app.preferences.getIntegerPreference(PREF_KEY);
            if (point >= 0 && point <= 8) {
                return point;
            }
        } catch (e) { }

        return 4;
    }

    function readCornerOnValue() {
        try {
            var value = app.preferences.getIntegerPreference("policyForPreservingCorners");
            if (value !== 0) {
                return value;
            }
        } catch (e) { }

        return 1;
    }

    function applyPoint(point) {
        app.preferences.setIntegerPreference(PREF_KEY, point);
        refreshTransformPanel();
        focusKeySink();
    }

    function refreshTransformPanel() {
        try {
            app.executeMenuCommand(TRANSFORM_PANEL_COMMAND);
            app.executeMenuCommand(TRANSFORM_PANEL_COMMAND);
        } catch (e) { }
    }

    function updateDisplay(point) {
        selectedPoint = point;
        try {
            anchorPreview.notify("onDraw");
        } catch (e) { }

        refreshWindow();
    }

    function drawAnchorPreview() {
        var g = this.graphics;
        var colors = getAnchorPreviewColors();
        var pen = g.newPen(g.PenType.SOLID_COLOR, colors.line, ANCHOR_LINE_WIDTH);
        var fill = g.newBrush(g.BrushType.SOLID_COLOR, colors.fill);
        var boxSize = ANCHOR_BOX_SIZE;
        var i;

        for (i = 0; i < ANCHOR_LINES.length; i++) {
            drawLine(g, pen, ANCHOR_LINES[i][0], ANCHOR_LINES[i][1], ANCHOR_LINES[i][2], ANCHOR_LINES[i][3]);
        }

        for (i = 0; i < ANCHOR_POSITIONS.length; i++) {
            drawAnchorBox(g, pen, fill, colors, ANCHOR_POSITIONS[i][0], ANCHOR_POSITIONS[i][1], boxSize, i === selectedPoint, ANCHOR_KEYS[i]);
        }
    }

    function getAnchorPreviewColors() {
        var isDark = isDarkUi();

        return {
            line: isDark ? [0.96, 0.96, 0.94, 1] : [0.06, 0.05, 0.04, 1],
            fill: isDark ? [0.96, 0.96, 0.94, 1] : [0.06, 0.05, 0.04, 1],
            normalText: isDark ? [0.96, 0.96, 0.94, 1] : [0.06, 0.05, 0.04, 1],
            selectedText: isDark ? [0.06, 0.05, 0.04, 1] : [0.98, 0.98, 0.96, 1]
        };
    }

    function isDarkUi() {
        try {
            return app.preferences.getRealPreference("uiBrightness") <= 0.5;
        } catch (e) { }

        return false;
    }

    function drawLine(g, pen, x1, y1, x2, y2) {
        g.newPath();
        g.moveTo(x1, y1);
        g.lineTo(x2, y2);
        g.strokePath(pen);
    }

    function drawAnchorBox(g, pen, fill, colors, x, y, size, selected, label) {
        if (selected) {
            g.newPath();
            g.rectPath(x, y, size, size);
            g.fillPath(fill);
        }

        g.newPath();
        g.rectPath(x, y, size, size);
        g.strokePath(pen);

        drawAnchorKeyLabel(g, colors, x, y, size, selected, label);
    }

    function drawAnchorKeyLabel(g, colors, x, y, size, selected, label) {
        var labelColor = selected ? colors.selectedText : colors.normalText;
        var textPen = g.newPen(g.PenType.SOLID_COLOR, labelColor, 1);
        var fontSize = ANCHOR_KEY_FONT_SIZE;
        var font = null;
        var textWidth = fontSize * 0.6;
        var textX;
        var textY;

        try {
            font = ScriptUI.newFont("dialog", ScriptUI.FontStyle.REGULAR, fontSize);
        } catch (eFont) {
            font = null;
        }

        try {
            textWidth = g.measureString(label, font)[0];
        } catch (eMeasure) { }

        textX = Math.round(x + (size - textWidth) / 2);
        textY = Math.round(y + (size - fontSize) / 2) - 1;

        try {
            g.drawString(label, textPen, textX, textY, font);
        } catch (eDraw) {
            try {
                g.drawString(label, textPen, textX, textY);
            } catch (eDraw2) { }
        }
    }

    function addOptionColumn(parent, items) {
        var column = parent.add("group");
        column.orientation = "column";
        column.alignChildren = ["left", "center"];
        column.margins = 0;
        column.spacing = 2;

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            var row = column.add("group");
            row.orientation = "row";
            row.alignChildren = ["left", "center"];
            row.margins = 0;
            row.spacing = 3;

            var mark = row.add("statictext", undefined, "□");
            mark.justify = "center";
            mark.preferredSize = [16, 18];
            setMarkFont(mark);

            var label = row.add("statictext", undefined, item.label + " [" + item.shortcut + "]");
            label.justify = "left";

            item.row = row;
            item.mark = mark;
            item.labelControl = label;
            item.value = getOptionValue(item);
            updateOptionDisplay(item);
            attachOptionClickHandler(row, item);
            attachOptionClickHandler(mark, item);
            attachOptionClickHandler(label, item);
            optionByShortcut[item.shortcut] = item;
        }

        return column;
    }

    function addUnitPresetColumn(parent) {
        var column = parent.add("group");
        column.orientation = "column";
        column.alignChildren = ["left", "center"];
        column.margins = 0;
        column.spacing = 2;

        var title = column.add("statictext", undefined, "単位 [.]");
        title.justify = "left";

        var presets = getUnitPresets();

        for (var i = 0; i < presets.length; i++) {
            var item = presets[i];
            var row = column.add("group");
            row.orientation = "row";
            row.alignChildren = ["left", "center"];
            row.margins = 0;
            row.spacing = 3;

            var mark = row.add("statictext", undefined, "□");
            mark.justify = "center";
            mark.preferredSize = [16, 18];
            setMarkFont(mark);

            var label = row.add("statictext", undefined, item.label);
            label.justify = "left";

            item.row = row;
            item.mark = mark;
            item.labelControl = label;
            item.index = i;
            attachUnitPresetClickHandler(row, item);
            attachUnitPresetClickHandler(mark, item);
            attachUnitPresetClickHandler(label, item);
            unitPresetItems.push(item);
        }

        updateUnitPresetDisplay();

        return column;
    }

    function getOptionDefinitions() {
        return [
            {
                label: "コピー元のレイヤーにペースト",
                shortcut: "=",
                getValue: function () {
                    return getBooleanPreference("layers/pastePreserve");
                },
                setValue: function (value) {
                    app.preferences.setBooleanPreference("layers/pastePreserve", value);
                    app.preferences.setBooleanPreference("layers/pastePreserveBackup", value);
                }
            },
            {
                label: "線幅と効果も拡大・縮小",
                shortcut: "/",
                getValue: function () {
                    return getBooleanPreference("scaleLineWeight");
                },
                setValue: function (value) {
                    app.preferences.setBooleanPreference("scaleLineWeight", value);
                    refreshTransformPanel();
                }
            },
            {
                label: "パターンを変形",
                shortcut: "*",
                getValue: function () {
                    return getBooleanPreference("transformPatterns");
                },
                setValue: function (value) {
                    app.preferences.setBooleanPreference("transformPatterns", value);
                    refreshTransformPanel();
                }
            },
            {
                label: "プレビュー境界を使用",
                shortcut: "-",
                getValue: function () {
                    return getBooleanPreference("includeStrokeInBounds");
                },
                setValue: function (value) {
                    app.preferences.setBooleanPreference("includeStrokeInBounds", value);
                    refreshTransformPanel();
                }
            },
            {
                label: "角を拡大・縮小",
                shortcut: "+",
                getValue: function () {
                    return getIntegerPreference("policyForPreservingCorners") !== 0;
                },
                setValue: function (value) {
                    app.preferences.setIntegerPreference("policyForPreservingCorners", value ? cornerOnValue : 0);
                    refreshTransformPanel();
                }
            },
            {
                label: "リアルタイムの描画と編集",
                shortcut: "0",
                getValue: function () {
                    return getIntegerPreference("LiveEdit_State_Machine") !== 0;
                },
                setValue: function (value) {
                    app.preferences.setIntegerPreference("LiveEdit_State_Machine", value ? 1 : 0);
                }
            },
            {
                label: "全てのブラックを正確に表示",
                shortcut: ",",
                getValue: function () {
                    return getIntegerPreference("blackPreservation/Onscreen") === 0;
                },
                setValue: function (value) {
                    app.preferences.setIntegerPreference("blackPreservation/Onscreen", value ? 0 : 1);
                    redrawDocument();
                }
            }
        ];
    }

    function getUnitPresets() {
        return [
            {
                label: "現状：" + formatUnitState(originalUnitState),
                rulerType: originalUnitState.rulerType,
                strokeUnits: originalUnitState.strokeUnits,
                textUnits: originalUnitState.textUnits,
                asianUnits: originalUnitState.asianUnits
            },
            {
                label: "一般/線：mm　文字：級/歯",
                rulerType: 1,
                strokeUnits: 1,
                textUnits: 5,
                asianUnits: 5
            },
            {
                label: "一般/線：pt　文字：pt",
                rulerType: 2,
                strokeUnits: 2,
                textUnits: 2,
                asianUnits: 2
            },
            {
                label: "一般/線：px　文字：pt",
                rulerType: 6,
                strokeUnits: 6,
                textUnits: 2,
                asianUnits: 2
            },
            {
                label: "一般/線：px　文字：px",
                rulerType: 6,
                strokeUnits: 6,
                textUnits: 6,
                asianUnits: 6
            }
        ];
    }

    function attachOptionClickHandler(control, option) {
        attachMouseDownHandler(control, makeOptionClickHandler(option));
    }

    function makeOptionClickHandler(option) {
        return function () {
            if (isDuplicateItemClick(option)) {
                return;
            }

            rememberItemClick(option);
            setOptionValue(option, !option.value);
        };
    }

    function attachUnitPresetClickHandler(control, item) {
        attachMouseDownHandler(control, makeUnitPresetClickHandler(item));
    }

    function makeUnitPresetClickHandler(item) {
        return function () {
            if (isDuplicateItemClick(item)) {
                return;
            }

            rememberItemClick(item);
            applyUnitPreset(item.index);
        };
    }

    function attachMouseDownHandler(control, handler) {
        try {
            control.addEventListener("mousedown", handler);
            return;
        } catch (e) { }

        control.onMouseDown = handler;
    }

    function cycleUnitPreset() {
        var index = selectedUnitPresetIndex;
        var nextIndex = index < 0 ? 0 : (index + 1) % unitPresetItems.length;
        applyUnitPreset(nextIndex);
    }

    function applyUnitPreset(index) {
        if (index < 0 || index >= unitPresetItems.length) {
            return;
        }

        var preset = unitPresetItems[index];
        selectedUnitPresetIndex = index;
        app.preferences.setIntegerPreference("rulerType", preset.rulerType);
        app.preferences.setIntegerPreference("strokeUnits", preset.strokeUnits);
        app.preferences.setIntegerPreference("text/units", preset.textUnits);
        app.preferences.setIntegerPreference("text/asianunits", preset.asianUnits);
        updateUnitPresetDisplay();
        refreshUnits();
        focusKeySink();
    }

    function updateUnitPresetDisplay() {
        for (var i = 0; i < unitPresetItems.length; i++) {
            unitPresetItems[i].mark.text = i === selectedUnitPresetIndex ? "■" : "□";
        }

        refreshWindow();
    }

    function getCurrentUnitState() {
        return {
            rulerType: getIntegerPreference("rulerType"),
            strokeUnits: getIntegerPreference("strokeUnits"),
            textUnits: getIntegerPreference("text/units"),
            asianUnits: getIntegerPreference("text/asianunits")
        };
    }

    function formatUnitState(current) {
        return "一般：" + getUnitLabel(current.rulerType, "rulerType") +
            "　線：" + getUnitLabel(current.strokeUnits, "strokeUnits") +
            "　文字：" + getUnitLabel(current.textUnits, "text/units") +
            "　東ア：" + getUnitLabel(current.asianUnits, "text/asianunits");
    }

    function getUnitLabel(code, prefKey) {
        if (code === 5) {
            return prefKey === "text/units" ? "級" : "歯";
        }

        var labels = {
            0: "in",
            1: "mm",
            2: "pt",
            3: "pica",
            4: "cm",
            6: "px"
        };

        return hasOwn(labels, code) ? labels[code] : String(code);
    }

    function getOptionValue(option) {
        try {
            return !!option.getValue();
        } catch (e) {
            return false;
        }
    }

    function setOptionValue(option, value) {
        try {
            option.setValue(!!value);
            option.value = !!option.getValue();
            updateOptionDisplay(option);
            focusKeySink();
        } catch (e) {
            option.value = getOptionValue(option);
            updateOptionDisplay(option);
            focusKeySink();
            alert("設定を変更できませんでした。\n" + option.label + "\n" + e);
        }
    }

    function updateOptionDisplay(option) {
        if (option.mark) {
            option.mark.text = option.value ? "■" : "□";
            refreshWindow();
        }
    }

    function getBooleanPreference(key) {
        return app.preferences.getBooleanPreference(key);
    }

    function getIntegerPreference(key) {
        return app.preferences.getIntegerPreference(key);
    }

    function redrawDocument() {
        app.redraw();
        refreshPreviewMode();
        app.redraw();
    }

    function refreshPreviewMode() {
        app.executeMenuCommand("preview");
        app.executeMenuCommand("preview");
    }

    function refreshUnits() {
        app.redraw();
        refreshTransformPanel();
        app.redraw();
    }

    function refreshWindow() {
        try {
            win.layout.layout(true);
        } catch (e) { }

        try {
            win.update();
        } catch (e2) { }
    }

    function focusKeySink() {
        try {
            win.active = true;
            keySink.active = true;
        } catch (e) { }
    }

    function setMarkFont(mark) {
        try {
            mark.graphics.font = ScriptUI.newFont("Osaka-Mono", ScriptUI.FontStyle.REGULAR, 18);
            return;
        } catch (e) { }

        try {
            mark.graphics.font = ScriptUI.newFont("Menlo", ScriptUI.FontStyle.REGULAR, 18);
            return;
        } catch (e2) { }

        try {
            mark.graphics.font = ScriptUI.newFont("dialog", ScriptUI.FontStyle.REGULAR, 18);
        } catch (e3) { }
    }

    function keyToPoint(key) {
        return hasOwn(KEY_TO_POINT, key) ? KEY_TO_POINT[key] : null;
    }

    function keyToOption(key) {
        return hasOwn(optionByShortcut, key) ? optionByShortcut[key] : null;
    }

    function rememberHandledKey(key) {
        lastHandledKey = key;
        lastHandledAt = new Date().getTime();
    }

    function isDuplicateKey(key) {
        if (!key) {
            return false;
        }

        if (key !== lastHandledKey) {
            return false;
        }

        return new Date().getTime() - lastHandledAt < DUPLICATE_INPUT_INTERVAL;
    }

    function rememberItemClick(item) {
        lastClickedItem = item;
        lastItemClickAt = new Date().getTime();
    }

    function isDuplicateItemClick(item) {
        if (item !== lastClickedItem) {
            return false;
        }

        return new Date().getTime() - lastItemClickAt < DUPLICATE_INPUT_INTERVAL;
    }

    function normalizeKey(ev) {
        var raw = "";

        if (ev) {
            raw = ev.keyName || ev.keyIdentifier || ev.key || "";
            raw = String(raw).toLowerCase();

            if (raw === "return" || raw === "enter" || raw === "numpadenter" || raw === "u+000d" || raw === "13") {
                return "enter";
            }

            if (raw === "escape" || raw === "esc" || raw === "u+001b" || raw === "27") {
                return "escape";
            }

            if (hasOwn(optionByShortcut, raw)) {
                return raw;
            }

            if (/^numpad[0-9]$/.test(raw)) {
                return raw.replace("numpad", "");
            }

            if (/^num[0-9]$/.test(raw)) {
                return raw.replace("num", "");
            }

            if (/^[0-9]$/.test(raw)) {
                return raw;
            }

            if (/^u\+003[0-9]$/.test(raw)) {
                return raw.charAt(raw.length - 1);
            }

            var namedKey = namedShortcutToKey(raw);
            if (namedKey) {
                return namedKey;
            }

            if (ev.keyCode || ev.which) {
                return keyCodeToKey(ev.keyCode || ev.which);
            }
        }

        return raw;
    }

    function namedShortcutToKey(raw) {
        return hasOwn(NAMED_SHORTCUTS, raw) ? NAMED_SHORTCUTS[raw] : "";
    }

    function keyCodeToKey(code) {
        code = Number(code);

        if (code === 13 || code === 3) {
            return "enter";
        }

        if (code === 27) {
            return "escape";
        }

        if (code >= 48 && code <= 57) {
            return String(code - 48);
        }

        if (code >= 97 && code <= 105) {
            return String(code - 96);
        }

        if (hasOwn(KEY_CODE_TO_SHORTCUT, code)) {
            return KEY_CODE_TO_SHORTCUT[code];
        }

        return "";
    }

    function preventDefault(ev) {
        try {
            ev.preventDefault();
        } catch (e) { }
    }

    function hasOwn(object, key) {
        return Object.prototype.hasOwnProperty.call(object, key);
    }
}());
