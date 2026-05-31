/*

SCRIPTMETA-BEGIN
Script-ID=org.iwashi.Halftone_Generator
Version=1.1
Meta-URL=https://github.com/Yamonov/Iwashiya_Scripts/tree/main/Photoshop
Name=Photoshopで疑似AMスクリーン生成
Author=Murakami Yoshiteru
Release-Date=2025-12-23
Target-App=Photoshop
Edit-Password-SHA256=S2C2Of7I542XGuHs:5f4fdf97ab915c48dadd217f5ef3df991529d0f3e352e221f596e2c1b6ecf800
Description-BEGIN
・CMYK画像をPhotoshopの疑似AMスクリーン変換します。網角、線数を個別に設定できます。

使用前に実配置サイズ・必要な実効解像度にリサイズしてから実行してください。
Illustrator/InDesignのオブジェクトやページは、PDFをPhotoshopに読み込ませます。
読み込み設定は、アンチエイリアスなし、解像度2,400で実寸で開いてください。
Description-END
SCRIPTMETA-END
*/

var scriptVersion = "Ver 1.1 (2025/12/23)";

(function() {

    if (app.documents.length === 0) {
        alert("CMYKまたはグレースケールモードの画像を開いてから実行してください。");
        return;
    }
    if (!(app.activeDocument.mode === DocumentMode.CMYK || app.activeDocument.mode === DocumentMode.GRAYSCALE)) {
        alert("CMYKまたはグレースケールモードの画像を開いてから実行してください。");
        return;
    }

    var isGray = app.activeDocument.mode === DocumentMode.GRAYSCALE;
    var presetTable = [
        ["CMYK", "K45_175線", 15, 75, 0, 45, 175, 175, 175, 175],
        ["CMYK", "M45_175線", 15, 45, 0, 75, 175, 175, 175, 175],
        ["CMYK", "K45_80線", 15, 75, 0, 45, 80, 80, 80, 80],
        ["CMYK", "K45_300線", 15, 75, 0, 45, 300, 300, 300, 300],
        ["CMYK", "7度_175（Y190）線", 22, 52, 7, 82, 175, 175, 190, 175],
        ["GRAY", "45度_175線", 45, 175],
        ["GRAY", "45度_80線", 45, 80],
        ["GRAY", "45度_300線", 45, 300],
        ["GRAY", "75度_175線", 75, 175],
        ["GRAY", "0度_175線", 0, 175]
    ];
    var keys = isGray ? ["Gray"] : ["C", "M", "Y", "K"];

    function buildDialog() {
        var dlg = new Window("dialog", "線数と角度の設定");
        dlg.orientation = "column";
        dlg.alignChildren = "left";

        var mode = isGray ? "GRAY" : "CMYK";
        var filtered = [];
        for (var i = 0; i < presetTable.length; i++) {
            if (presetTable[i][0] === mode) {
                filtered.push(presetTable[i]);
            }
        }
        var presetNames = [];
        for (var i = 0; i < filtered.length; i++) {
            presetNames.push(filtered[i][1]);
        }

        var presetList = dlg.add("dropdownlist", undefined, presetNames);
        presetList.selection = 0;

        var inputGroup = dlg.add("group");
        inputGroup.orientation = "column";
        var inputFields = {};
        inputFields._selectedPreset = null;

        for (var i = 0; i < keys.length; i++) {
            var row = inputGroup.add("group");
            row.add("statictext", undefined, keys[i] + ": 角度");
            inputFields[keys[i]] = {};
            inputFields[keys[i]].angle = row.add("edittext", undefined, "0");
            inputFields[keys[i]].angle.characters = 5;
            row.add("statictext", undefined, "線数");
            inputFields[keys[i]].lpi = row.add("edittext", undefined, "0");
            inputFields[keys[i]].lpi.characters = 5;
        }

        var resGroup = dlg.add("group");
        resGroup.add("statictext", undefined, "出力解像度:");
        var resDropdown = resGroup.add("dropdownlist", undefined, ["4800", "2400", "1200", "600"]);
        resDropdown.selection = 1;
        inputFields.resolution = resDropdown;

        presetList.onChange = function() {
            var sel = filtered[presetList.selection.index];
            inputFields._selectedPreset = sel;
            if (mode === "GRAY") {
                inputFields["Gray"].angle.text = sel[2];
                inputFields["Gray"].lpi.text = sel[3];
            } else {
                var angles = sel.slice(2, 6);
                var lpis = sel.slice(6);
                var ch = ["C", "M", "Y", "K"];
                for (var i = 0; i < ch.length; i++) {
                    inputFields[ch[i]].angle.text = angles[i];
                    inputFields[ch[i]].lpi.text = lpis[i];
                }
            }
        };
        presetList.notify();
        // 注意文をパネルで追加
        var notePanel = dlg.add("panel", undefined, "注意");
        notePanel.orientation = "column";
        notePanel.alignChildren = "left";
        notePanel.margins = [10, 15, 10, 10];

        var note = notePanel.add("statictext", undefined,
            "元画像を複製して処理します。\n※先に画像解像度で、使用サイズ＆解像度にリサイズし、統合してから実行してください。\nESCでキャンセル", {
                multiline: true
            }
        );
        note.maximumSize.width = 380;
        var buttonRow = dlg.add("group");
        buttonRow.orientation = "row";
        buttonRow.alignChildren = "center";
        var okButton = buttonRow.add("button", undefined, "OK");
        buttonRow.add("statictext", undefined, scriptVersion);
        var helpButton = buttonRow.add("button", undefined, "?");
        helpButton.preferredSize = [24, 22];
        helpButton.onClick = function() {
            var url = "https://gist.github.com/Yamonov/6f00bd65e486513d82f773f858ac76cb";
            if ($.os.indexOf("Windows") >= 0) {
                app.system('cmd /c start "" "' + url + '"');
            } else {
                app.system('/usr/bin/open "' + url + '"');
            }
        };
        okButton.onClick = function() {
            if (!validateInputs(inputFields)) {
                return;
            }
            dlg.close(1);
        };

        return dlg.show() == 1 ? inputFields : null;
    }

    function validateInputs(fields) {
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var angle = parseFloat(fields[key].angle.text);
            var lpi = parseFloat(fields[key].lpi.text);
            if (isNaN(angle) || angle < 0 || angle > 360) {
                alert(key + "の角度は0〜360の範囲で入力してください。");
                return false;
            }
            if (isNaN(lpi) || lpi < 1 || lpi > 4800) {
                alert(key + "の線数は1〜4800の範囲で入力してください。");
                return false;
            }
        }
        return true;
    }

    function getPresetSuffix(fields) {
        var mode = isGray ? "GRAY" : "CMYK";
        var preset = fields._selectedPreset;
        var label = "カスタム";
        if (preset) {
            var isMatch = true;
            if (mode === "GRAY") {
                var angle = parseFloat(fields["Gray"].angle.text);
                var lpi = parseFloat(fields["Gray"].lpi.text);
                isMatch = (angle === preset[2] && lpi === preset[3]);
            } else {
                var angles = preset.slice(2, 6);
                var lpis = preset.slice(6);
                var ch = ["C", "M", "Y", "K"];
                for (var i = 0; i < ch.length; i++) {
                    var a = parseFloat(fields[ch[i]].angle.text);
                    var l = parseFloat(fields[ch[i]].lpi.text);
                    if (a !== angles[i] || l !== lpis[i]) {
                        isMatch = false;
                        break;
                    }
                }
            }
            if (isMatch) {
                label = preset[1];
            }
        }
        return "_" + mode + "_" + label;
    }

    function getScreenSettings(fields) {
        var s = {};
        for (var i = 0; i < keys.length; i++) {
            s[keys[i]] = {
                angle: parseFloat(fields[keys[i]].angle.text),
                lpi: parseFloat(fields[keys[i]].lpi.text)
            };
        }
        s.resolution = parseInt(fields.resolution.selection.text, 10);
        return s;
    }

    function binarizeChannel(doc, setting, resolution) {
        app.activeDocument = doc;
        // doc.resizeImage(undefined, undefined, resolution, ResampleMethod.NONE); // 解像度変更を無効化
        var bmo = new BitmapConversionOptions();
        bmo.resolution = resolution;
        bmo.method = BitmapConversionType.HALFTONESCREEN;
        bmo.frequency = setting.lpi;
        bmo.angle = setting.angle;
        bmo.shape = BitmapHalfToneType.ROUND;
        doc.changeMode(ChangeMode.BITMAP, bmo);
        doc.changeMode(ChangeMode.GRAYSCALE);
    }

    function mergeCMYKChannels(docNames) {
        var desc = new ActionDescriptor();
        var list = new ActionList();
        for (var i = 0; i < 4; i++) {
            var ref = new ActionReference();
            ref.putName(stringIDToTypeID("document"), docNames[i]);
            list.putReference(ref);
        }
        desc.putList(stringIDToTypeID("null"), list);
        desc.putEnumerated(stringIDToTypeID("mode"), stringIDToTypeID("colorSpace"), stringIDToTypeID("CMYKColorEnum"));
        try {
            executeAction(stringIDToTypeID("mergeChannels"), desc, DialogModes.NO);
        } catch (e) {
            alert("mergeChannels に失敗しました\n" + e);
        }
    }

    var inputFields = buildDialog();
    if (!inputFields) return;

    var doc = app.activeDocument;
    var baseName = doc.name.replace(/\.[^\.]+$/, "");
    var outputName = baseName + getPresetSuffix(inputFields);
    var screenSettings = getScreenSettings(inputFields);
    var resolution = screenSettings.resolution;
    var dupName = isGray ? outputName : (baseName + "_複製");
    var dup = doc.duplicate(dupName, true);
    try {
        dup.flatten();
    } catch (e) {
        // 統合済みで flatten が不要な場合はスキップ
    }
    app.activeDocument = dup;
    var splitDocs;
    if (isGray) {
        splitDocs = [dup];
    } else {
        splitDocs = dup.splitChannels();
    }

    var binarizedDocs = [];
    for (var i = 0; i < keys.length; i++) {
        binarizeChannel(splitDocs[i], screenSettings[keys[i]], resolution);
        binarizedDocs.push(splitDocs[i]);
    }

    if (!isGray) {
        var docNames = [];
        for (var i = 0; i < binarizedDocs.length; i++) {
            docNames.push(binarizedDocs[i].name);
        }
        mergeCMYKChannels(docNames);
        try {
            var mergedDoc = app.activeDocument;
            if (mergedDoc && mergedDoc.name !== outputName) {
                var namedDoc = mergedDoc.duplicate(outputName, true);
                mergedDoc.close(SaveOptions.DONOTSAVECHANGES);
                app.activeDocument = namedDoc;
            }
        } catch (e) {
            // 失敗時は名称変更をスキップ
        }
    }

})();