#target "illustrator"

/*
SCRIPTMETA-BEGIN
Script-ID=keypadSettingsChager_Ai
Version=1.3
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

    var originalPoint = readPoint();
    var selectedPoint = originalPoint;
    var cornerOnValue = readCornerOnValue();
    var originalUnitState = getCurrentUnitState();
    var optionByShortcut = {};
    var unitPresetItems = [];
    var selectedUnitPresetIndex = 0;
    var lastHandledKey = "";
    var lastHandledAt = 0;
    var lastClickedOption = null;
    var lastOptionClickAt = 0;

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
    anchorBlock.spacing = 2;

    var cells = [];
    var grid = anchorBlock.add("group");
    grid.orientation = "column";
    grid.alignChildren = ["center", "center"];
    grid.margins = 0;
    grid.spacing = 0;

    for (var rowIndex = 0; rowIndex < 3; rowIndex++) {
        var row = grid.add("group");
        row.orientation = "row";
        row.alignChildren = ["center", "center"];
        row.margins = 0;
        row.spacing = 0;

        for (var colIndex = 0; colIndex < 3; colIndex++) {
            var cell = row.add("statictext", undefined, "□");
            cell.justify = "center";
            cell.preferredSize = [18, 18];
            setCellFont(cell);
            cells.push(cell);
        }
    }

    updateDisplay(selectedPoint);

    var keypadLabel = anchorBlock.add("statictext", undefined, "テンキー");
    keypadLabel.justify = "center";
    try {
        keypadLabel.graphics.font = ScriptUI.newFont("dialog", ScriptUI.FontStyle.REGULAR, 10);
    } catch (e2b) { }

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
        for (var i = 0; i < cells.length; i++) {
            cells[i].text = i === point ? "■" : "□";
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
            setCellFont(mark);

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
            setCellFont(mark);

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
        var handler = makeOptionClickHandler(option);
        var eventNames = ["mousedown", "mouseup", "click"];

        for (var i = 0; i < eventNames.length; i++) {
            try {
                control.addEventListener(eventNames[i], handler);
            } catch (e) { }
        }

        control.onClick = handler;
        control.onMouseDown = handler;
        control.onMouseUp = handler;
    }

    function makeOptionClickHandler(option) {
        return function () {
            if (isDuplicateOptionClick(option)) {
                return;
            }

            rememberOptionClick(option);
            setOptionValue(option, !option.value);
        };
    }

    function attachUnitPresetClickHandler(control, item) {
        var handler = makeUnitPresetClickHandler(item);
        var eventNames = ["mousedown", "mouseup", "click"];

        for (var i = 0; i < eventNames.length; i++) {
            try {
                control.addEventListener(eventNames[i], handler);
            } catch (e) { }
        }

        control.onClick = handler;
        control.onMouseDown = handler;
        control.onMouseUp = handler;
    }

    function makeUnitPresetClickHandler(item) {
        return function () {
            applyUnitPreset(item.index);
        };
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

        return Object.prototype.hasOwnProperty.call(labels, code) ? labels[code] : String(code);
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

    function setCellFont(cell) {
        try {
            cell.graphics.font = ScriptUI.newFont("Osaka-Mono", ScriptUI.FontStyle.REGULAR, 18);
            return;
        } catch (e) { }

        try {
            cell.graphics.font = ScriptUI.newFont("Menlo", ScriptUI.FontStyle.REGULAR, 18);
            return;
        } catch (e2) { }

        try {
            cell.graphics.font = ScriptUI.newFont("dialog", ScriptUI.FontStyle.REGULAR, 18);
        } catch (e3) { }
    }

    function keyToPoint(key) {
        var map = {
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

        return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : null;
    }

    function keyToOption(key) {
        return Object.prototype.hasOwnProperty.call(optionByShortcut, key) ? optionByShortcut[key] : null;
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

        return new Date().getTime() - lastHandledAt < 200;
    }

    function rememberOptionClick(option) {
        lastClickedOption = option;
        lastOptionClickAt = new Date().getTime();
    }

    function isDuplicateOptionClick(option) {
        if (option !== lastClickedOption) {
            return false;
        }

        return new Date().getTime() - lastOptionClickAt < 200;
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

            if (Object.prototype.hasOwnProperty.call(optionByShortcut, raw)) {
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
        var map = {
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

        return Object.prototype.hasOwnProperty.call(map, raw) ? map[raw] : "";
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

        var map = {
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

        if (Object.prototype.hasOwnProperty.call(map, code)) {
            return map[code];
        }

        return "";
    }

    function preventDefault(ev) {
        try {
            ev.preventDefault();
        } catch (e) { }
    }
}());
