#target photoshop

/*

SCRIPTMETA-BEGIN
Script-ID=org.iwashi.LayerColorSelector
Version=1.1
Release-Date=2026-06-24
Meta-URL=https://github.com/Yamonov/Iwashiya_Scripts/tree/main/Photoshop
Name=レイヤーカラー選択
Author=Murakami Yoshiteru
Target-App=Photoshop
Description-BEGIN
ScriptUIパネルで選択したレイヤーカラーを、選択中のレイヤーやレイヤーグループに適用します。
Description-END
SCRIPTMETA-END

*/

(function () {
    var CUSTOM_OPTION_KEY = "org.iwashi.LayerColorSelector";
    var CUSTOM_OPTION_COLOR_KEY = 1001;
    var HISTORY_NAME = "レイヤーカラーを設定";
    var UI_BACKGROUND_THEME = "appDialogBackground";
    var UI_BACKGROUND_COLOR = [0.16, 0.16, 0.16, 1];
    var UI_SELECTED_BACKGROUND_COLOR = [0.28, 0.28, 0.28, 1];
    var UI_TEXT_COLOR = [0.86, 0.86, 0.86, 1];
    var UI_SELECTED_TEXT_COLOR = [1.00, 1.00, 1.00, 1];
    var UI_SWATCH_BORDER_COLOR = [0.08, 0.08, 0.08, 1];
    var UI_SELECTED_SWATCH_BORDER_COLOR = [0.56, 0.68, 0.92, 1];

    var COLORS = [
        { id: "none", name: "カラーなし", chip: [0.72, 0.72, 0.72, 1] },
        { id: "red", name: "レッド", chip: [1.00, 0.42, 0.38, 1] },
        { id: "orange", name: "オレンジ", chip: [1.00, 0.62, 0.25, 1] },
        { id: "yellowColor", name: "イエロー", chip: [1.00, 0.90, 0.22, 1] },
        { id: "green", name: "グリーン", chip: [0.55, 0.82, 0.32, 1] },
        { id: "seafoam", name: "シーフォーム", chip: [0.08, 0.64, 0.60, 1] },
        { id: "blue", name: "ブルー", chip: [0.35, 0.58, 1.00, 1] },
        { id: "indigo", name: "インディゴ", chip: [0.34, 0.36, 1.00, 1] },
        { id: "magenta", name: "マゼンタ", chip: [0.93, 0.08, 0.48, 1] },
        { id: "fuchsia", name: "フクシア", chip: [0.80, 0.18, 0.85, 1] },
        { id: "violet", name: "バイオレット", chip: [0.58, 0.44, 0.84, 1] },
        { id: "gray", name: "グレー", chip: [0.58, 0.58, 0.58, 1] }
    ];

    var selectedLayerIDs = getSettableSelectedLayerIDs();
    if (!selectedLayerIDs.length) {
        return;
    }

    var initialColorID = readStoredColorID() || readLayerColorIDByID(selectedLayerIDs[0]) || "none";
    var selectedColor = showLayerColorPanel(indexOfColorID(initialColorID));
    if (!selectedColor) {
        return;
    }

    try {
        runWithHistory(selectedColor.id);
        saveStoredColorID(selectedColor.id);
    } catch (_) {}

    function showLayerColorPanel(initialIndex) {
        var selectedIndex = Math.max(0, Math.min(initialIndex, COLORS.length - 1));
        var result = null;
        var isDone = false;
        var win = makeWindow();
        var rows = [];
        var keyboardList = null;
        var isSyncingKeyboardSelection = false;

        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.spacing = 0;
        win.margins = [7, 7, 7, 7];

        setControlBackground(win, UI_BACKGROUND_COLOR, UI_BACKGROUND_THEME);

        for (var i = 0; i < COLORS.length; i++) {
            rows.push(makeColorRow(win, i));
        }
        installHiddenKeyboardButtons();

        refreshRows();

        win.addEventListener("keydown", handleKeyDown);

        win.onClose = function () {
            if (!isDone) {
                result = null;
            }
            return true;
        };

        try {
            win.center();
        } catch (_) {}

        win.show();
        return result;

        function makeColorRow(parent, colorIndex) {
            var color = COLORS[colorIndex];
            var row = parent.add("group");
            row.orientation = "row";
            row.alignChildren = ["left", "center"];
            row.spacing = 7;
            row.margins = [7, 3, 8, 3];
            row.preferredSize = [150, 22];

            var swatch = row.add("panel", undefined, "");
            swatch.margins = 0;
            swatch.preferredSize = [14, 14];

            var label = row.add("statictext", undefined, color.name);
            label.preferredSize = [105, 18];

            swatch.onDraw = function () {
                drawSwatch(swatch, color, colorIndex === selectedIndex);
            };

            attachCommitEvents(row, colorIndex);
            attachCommitEvents(swatch, colorIndex);
            attachCommitEvents(label, colorIndex);

            return {
                row: row,
                swatch: swatch,
                label: label,
                regularFont: label.graphics.font,
                selectedFont: ScriptUI.newFont(
                    label.graphics.font.name,
                    "Bold",
                    label.graphics.font.size
                )
            };
        }

        function installHiddenKeyboardButtons() {
            var keyboardGroup = win.add("group");
            keyboardGroup.orientation = "row";
            keyboardGroup.spacing = 0;
            keyboardGroup.margins = 0;
            keyboardGroup.preferredSize = [1, 1];
            keyboardGroup.maximumSize = [1, 1];

            var commitButton = keyboardGroup.add("button", undefined, "");
            var cancelButton = keyboardGroup.add("button", undefined, "");
            keyboardList = keyboardGroup.add("listbox", undefined, [], { multiselect: false });

            commitButton.preferredSize = [1, 1];
            commitButton.maximumSize = [1, 1];
            cancelButton.preferredSize = [1, 1];
            cancelButton.maximumSize = [1, 1];
            keyboardList.preferredSize = [1, 1];
            keyboardList.maximumSize = [1, 1];

            for (var i = 0; i < COLORS.length; i++) {
                keyboardList.add("item", COLORS[i].name);
            }

            commitButton.onClick = function () {
                finish(selectedIndex);
            };
            cancelButton.onClick = function () {
                cancel();
            };

            win.defaultElement = commitButton;
            win.cancelElement = cancelButton;

            commitButton.addEventListener("keydown", handleKeyDown);
            cancelButton.addEventListener("keydown", handleKeyDown);
            keyboardList.addEventListener("keydown", handleKeyDown);
            keyboardList.onChange = function () {
                if (isSyncingKeyboardSelection || !keyboardList.selection) {
                    return;
                }
                selectedIndex = keyboardList.selection.index;
                refreshRows();
            };
            syncKeyboardSelection();

            win.onShow = function () {
                focusKeyboardList();
            };

            function focusKeyboardList() {
                try {
                    keyboardList.active = true;
                } catch (_) {}
            }
        }

        function attachCommitEvents(control, colorIndex) {
            control.addEventListener("mousedown", function () {
                selectedIndex = colorIndex;
                refreshRows();
            });
            control.addEventListener("mouseup", function () {
                finish(colorIndex);
            });
        }

        function finish(colorIndex) {
            if (isDone) {
                return;
            }
            isDone = true;
            selectedIndex = colorIndex;
            result = COLORS[colorIndex];
            win.close(1);
        }

        function cancel() {
            if (isDone) {
                return;
            }
            isDone = true;
            result = null;
            win.close(0);
        }

        function refreshRows() {
            for (var i = 0; i < rows.length; i++) {
                var selected = i === selectedIndex;
                setControlBackground(
                    rows[i].row,
                    selected ? UI_SELECTED_BACKGROUND_COLOR : UI_BACKGROUND_COLOR,
                    selected ? null : UI_BACKGROUND_THEME
                );

                try {
                    rows[i].label.graphics.font = selected ? rows[i].selectedFont : rows[i].regularFont;
                } catch (_) {}

                try {
                    rows[i].label.graphics.foregroundColor = rows[i].label.graphics.newPen(
                        rows[i].label.graphics.PenType.SOLID_COLOR,
                        selected ? UI_SELECTED_TEXT_COLOR : UI_TEXT_COLOR,
                        1
                    );
                } catch (_) {}

                try {
                    rows[i].swatch.notify("onDraw");
                } catch (_) {}
            }
            try {
                win.layout.layout(true);
            } catch (_) {}
        }

        function handleKeyDown(event) {
            if (isCommitKeyEvent(event)) {
                finish(selectedIndex);
                stopEvent(event);
                return;
            }
            if (isCancelKeyEvent(event)) {
                cancel();
                stopEvent(event);
            }
        }

        function syncKeyboardSelection() {
            if (!keyboardList) {
                return;
            }
            isSyncingKeyboardSelection = true;
            try {
                keyboardList.selection = selectedIndex;
            } catch (_) {}
            isSyncingKeyboardSelection = false;
        }
    }

    function setControlBackground(control, fallbackColor, themeName) {
        try {
            control.graphics.backgroundColor = makeBackgroundBrush(control.graphics, fallbackColor, themeName);
        } catch (_) {}
    }

    function makeBackgroundBrush(graphics, fallbackColor, themeName) {
        if (themeName) {
            try {
                return graphics.newBrush(graphics.BrushType.THEME_COLOR, themeName, 1);
            } catch (_) {}
        }
        return graphics.newBrush(graphics.BrushType.SOLID_COLOR, fallbackColor);
    }

    function makeWindow() {
        try {
            return new Window("dialog", "", undefined, { borderless: true });
        } catch (_) {
            return new Window("dialog", "");
        }
    }

    function drawSwatch(control, color, isSelected) {
        var graphics = control.graphics;
        var width = numericSize(control.size, "width", 14);
        var height = numericSize(control.size, "height", 14);
        var fillBrush = graphics.newBrush(graphics.BrushType.SOLID_COLOR, color.chip);
        var borderPen = graphics.newPen(
            graphics.PenType.SOLID_COLOR,
            isSelected ? UI_SELECTED_SWATCH_BORDER_COLOR : UI_SWATCH_BORDER_COLOR,
            isSelected ? 2 : 1
        );

        graphics.rectPath(0, 0, width, height);
        graphics.fillPath(fillBrush);
        graphics.strokePath(borderPen);

        if (color.id === "none") {
            var crossPen = graphics.newPen(graphics.PenType.SOLID_COLOR, [0.25, 0.25, 0.25, 1], 1);
            graphics.newPath();
            graphics.moveTo(3, 3);
            graphics.lineTo(width - 3, height - 3);
            graphics.moveTo(width - 3, 3);
            graphics.lineTo(3, height - 3);
            graphics.strokePath(crossPen);
        }
    }

    function numericSize(size, propertyName, fallbackValue) {
        if (size && typeof size[propertyName] === "number" && size[propertyName] > 0) {
            return size[propertyName];
        }
        if (size && propertyName === "width" && typeof size[0] === "number" && size[0] > 0) {
            return size[0];
        }
        if (size && propertyName === "height" && typeof size[1] === "number" && size[1] > 0) {
            return size[1];
        }
        return fallbackValue;
    }

    function runWithHistory(colorID) {
        var runnerName = "__iwashiLayerColorSelectorHistoryRunner";
        var colorKey = "__iwashiLayerColorSelectorColorID";

        $.global[colorKey] = colorID;
        $.global[runnerName] = function () {
            setSelectedLayersColor($.global[colorKey]);
        };

        try {
            app.activeDocument.suspendHistory(HISTORY_NAME, "$.global." + runnerName + "()");
        } finally {
            try {
                delete $.global[runnerName];
                delete $.global[colorKey];
            } catch (_) {
                $.global[runnerName] = null;
                $.global[colorKey] = null;
            }
        }
    }

    function setSelectedLayersColor(colorID) {
        var desc = new ActionDescriptor();
        var ref = new ActionReference();
        var layerDesc = new ActionDescriptor();

        ref.putEnumerated(sTID("layer"), sTID("ordinal"), sTID("targetEnum"));
        desc.putReference(sTID("null"), ref);

        layerDesc.putEnumerated(sTID("color"), sTID("color"), sTID(colorID));
        desc.putObject(sTID("to"), sTID("layer"), layerDesc);

        executeAction(sTID("set"), desc, DialogModes.NO);
    }

    function getSettableSelectedLayerIDs() {
        if (!app.documents.length) {
            return [];
        }

        try {
            var layerIDs = readSelectedLayerIDs();
            if (!layerIDs.length) {
                return [];
            }

            for (var i = 0; i < layerIDs.length; i++) {
                if (!canReadLayerColorByID(layerIDs[i])) {
                    return [];
                }
            }

            return layerIDs;
        } catch (_) {
            return [];
        }
    }

    function readSelectedLayerIDs() {
        var layerIDs = readSelectedLayerIDsByIDList();
        if (layerIDs.length) {
            return layerIDs;
        }
        return readSelectedLayerIDsByReferenceList();
    }

    function readSelectedLayerIDsByIDList() {
        var layerIDs = [];

        try {
            var ref = new ActionReference();
            ref.putProperty(sTID("property"), sTID("targetLayersIDs"));
            ref.putEnumerated(sTID("document"), sTID("ordinal"), sTID("targetEnum"));

            var desc = executeActionGet(ref);
            var targetLayersIDKey = sTID("targetLayersIDs");
            if (desc.hasKey(targetLayersIDKey)) {
                var list = desc.getList(targetLayersIDKey);
                for (var i = 0; i < list.count; i++) {
                    addUniqueLayerID(layerIDs, readLayerIDFromReference(list.getReference(i)));
                }
            }
        } catch (_) {}

        return layerIDs;
    }

    function readSelectedLayerIDsByReferenceList() {
        var layerIDs = [];

        try {
            var ref = new ActionReference();
            ref.putProperty(sTID("property"), sTID("targetLayers"));
            ref.putEnumerated(sTID("document"), sTID("ordinal"), sTID("targetEnum"));

            var desc = executeActionGet(ref);
            var targetLayersKey = sTID("targetLayers");
            if (desc.hasKey(targetLayersKey)) {
                var list = desc.getList(targetLayersKey);
                for (var i = 0; i < list.count; i++) {
                    addUniqueLayerID(layerIDs, readLayerIDFromReference(list.getReference(i)));
                }
            }
        } catch (_) {}

        return layerIDs;
    }

    function readLayerIDFromReference(layerReference) {
        try {
            return layerReference.getIdentifier();
        } catch (_) {}

        try {
            var ref = new ActionReference();
            ref.putIndex(cTID("Lyr "), layerReference.getIndex());

            var desc = executeActionGet(ref);
            var layerIDKey = sTID("layerID");
            if (desc.hasKey(layerIDKey)) {
                return desc.getInteger(layerIDKey);
            }
        } catch (_) {}

        return null;
    }

    function addUniqueLayerID(layerIDs, layerID) {
        if (typeof layerID !== "number" || layerID <= 0) {
            return;
        }
        for (var i = 0; i < layerIDs.length; i++) {
            if (layerIDs[i] === layerID) {
                return;
            }
        }
        layerIDs.push(layerID);
    }

    function canReadLayerColorByID(layerID) {
        return !isBackgroundLayerID(layerID) && readRawLayerColorIDByID(layerID) !== null;
    }

    function isBackgroundLayerID(layerID) {
        try {
            var ref = new ActionReference();
            ref.putProperty(sTID("property"), sTID("background"));
            ref.putIdentifier(cTID("Lyr "), layerID);

            var desc = executeActionGet(ref);
            var backgroundKey = sTID("background");
            return desc.hasKey(backgroundKey) && desc.getBoolean(backgroundKey);
        } catch (_) {
            return false;
        }
    }

    function readLayerColorIDByID(layerID) {
        return normalizeColorID(readRawLayerColorIDByID(layerID));
    }

    function readRawLayerColorIDByID(layerID) {
        try {
            var ref = new ActionReference();
            ref.putProperty(cTID("Prpr"), cTID("Clr "));
            ref.putIdentifier(cTID("Lyr "), layerID);

            var desc = executeActionGet(ref);
            var colorKey = cTID("Clr ");
            if (!desc.hasKey(colorKey)) {
                return null;
            }
            return typeIDToStringID(desc.getEnumerationValue(colorKey));
        } catch (_) {
            return null;
        }
    }

    function readStoredColorID() {
        try {
            var desc = app.getCustomOptions(CUSTOM_OPTION_KEY);
            return normalizeColorID(desc.getString(CUSTOM_OPTION_COLOR_KEY));
        } catch (_) {
            return null;
        }
    }

    function saveStoredColorID(colorID) {
        var desc = new ActionDescriptor();
        desc.putString(CUSTOM_OPTION_COLOR_KEY, colorID);
        app.putCustomOptions(CUSTOM_OPTION_KEY, desc, true);
    }

    function normalizeColorID(colorID) {
        if (!colorID) {
            return null;
        }

        var aliases = {
            grain: "green",
            Grn: "green",
            "Grn ": "green",
            Rd: "red",
            "Rd  ": "red",
            Orng: "orange",
            Ylw: "yellowColor",
            "Ylw ": "yellowColor",
            Bl: "blue",
            "Bl  ": "blue",
            Indi: "indigo",
            Mgnt: "magenta",
            Fuch: "fuchsia",
            Vlt: "violet",
            "Vlt ": "violet",
            Gry: "gray",
            "Gry ": "gray",
            grey: "gray",
            None: "none"
        };

        if (aliases[colorID]) {
            return aliases[colorID];
        }

        return indexOfColorID(colorID) >= 0 ? colorID : null;
    }

    function indexOfColorID(colorID) {
        for (var i = 0; i < COLORS.length; i++) {
            if (COLORS[i].id === colorID) {
                return i;
            }
        }
        return 0;
    }

    function eventKeyName(event) {
        try {
            return String(event.keyName || "").toUpperCase();
        } catch (_) {
            return "";
        }
    }

    function eventKeyIdentifier(event) {
        try {
            return String(event.keyIdentifier || "").toUpperCase();
        } catch (_) {
            return "";
        }
    }

    function eventCharacter(event) {
        try {
            return String(event.key || event.text || event.character || "");
        } catch (_) {
            return "";
        }
    }

    function isCommitKeyEvent(event) {
        var keyName = eventKeyName(event);
        var keyIdentifier = eventKeyIdentifier(event);
        var character = eventCharacter(event);

        return keyName === "ENTER" ||
            keyName === "RETURN" ||
            keyIdentifier === "U+000A" ||
            keyIdentifier === "U+000D" ||
            character === "\n" ||
            character === "\r";
    }

    function isCancelKeyEvent(event) {
        var keyName = eventKeyName(event);
        var keyIdentifier = eventKeyIdentifier(event);
        return keyName === "ESCAPE" || keyName === "ESC" || keyIdentifier === "U+001B";
    }

    function stopEvent(event) {
        try {
            event.preventDefault();
        } catch (_) {}
        try {
            event.stopPropagation();
        } catch (_) {}
    }

    function cTID(value) {
        return charIDToTypeID(value);
    }

    function sTID(value) {
        return stringIDToTypeID(value);
    }
}());
