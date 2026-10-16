/*
SCRIPTMETA-BEGIN
Script-ID=org.iwashi.AlignToKeyObject
Version=1
Meta-URL=https://github.com/Yamonov/Iwashiya_Scripts/tree/main/InDesgin
Name=キーオブジェクトにサイズを合わせる
Author=Murakami Yoshiteru
Target-App=InDesign
Description-BEGIN
キーオブジェクトを基準に、他の選択オブジェクトの幅や高さを揃えます。
複数のオブジェクトを選択してキーオブジェクトを指定し、ダイアログで「幅のみ」「高さのみ」「幅と高さの両方」から選択して実行します。
回転したオブジェクトは、その回転方向に沿った幅・高さで揃えます。「角度を一致」をオンにすると、キーオブジェクトの回転角度にも合わせます。
回転中心は、右側の9点の基準点表示から選択できます。
「角度を一致」がオンの場合は、選択した基準点の位置を維持してサイズと角度を合わせます。
Description-END
SCRIPTMETA-END
*/

(function () {
    if (app.documents.length === 0) {
        alert("ドキュメントを開いてから実行してください。");
        return;
    }

    var doc = app.activeDocument;
    var selection = doc.selection;
    if (selection.length < 2) {
        alert("複数のオブジェクトを選択し、キーオブジェクトを指定してください。");
        return;
    }

    var keyObject;
    try {
        keyObject = doc.selectionKeyObject;
        if (!keyObject || !keyObject.isValid) {
            throw new Error("キーオブジェクトが指定されていません。");
        }
    } catch (error) {
        alert("キーオブジェクトを指定してください。");
        return;
    }

    var keySize;
    try {
        keySize = measureItem(keyObject);
    } catch (error2) {
        alert("キーオブジェクトの幅と高さを取得できません。");
        return;
    }

    var options = showOptionsDialog();
    if (!options) return;
    var chosenOption = options.sizeMode;
    var matchAngle = options.matchAngle;

    var keyAngle = 0;
    if (matchAngle) {
        try {
            keyAngle = readAngle(keyObject);
        } catch (error3) {
            alert("キーオブジェクトの回転角度を取得できません。");
            return;
        }
    }

    var failures = [];
    app.doScript(function () {
        for (var i = 0; i < selection.length; i++) {
            var item = selection[i];
            try {
                // 同じオブジェクトでも、DOMの参照は別インスタンスになることがある。
                if (item.id === keyObject.id) continue;
                if (item.locked || item.itemLayer.locked) {
                    throw new Error("オブジェクトまたはレイヤーがロックされています。");
                }
                var size = measureItem(item);
                var angleDifference = matchAngle ? keyAngle - readAngle(item) : 0;
                var referencePoint = matchAngle ? rotationAnchor(options.rotationPoint) : AnchorPoint.TOP_LEFT_ANCHOR;
                // サイズ変更で基準点を動かさず、回転にも実行前の同じ座標を使う。
                var originalReferencePosition = resolveCorner(item, referencePoint);
                item.resize(
                    [CoordinateSpaces.INNER_COORDINATES, BoundingBoxLimits.GEOMETRIC_PATH_BOUNDS],
                    [referencePoint, BoundingBoxLimits.GEOMETRIC_PATH_BOUNDS, CoordinateSpaces.INNER_COORDINATES],
                    ResizeMethods.MULTIPLYING_CURRENT_DIMENSIONS_BY,
                    [chosenOption === 1 ? 1 : keySize.width / size.width, chosenOption === 0 ? 1 : keySize.height / size.height],
                    false,
                    false
                );
                if (matchAngle && Math.abs(angleDifference) > 0.0000001) {
                    item.transform(
                        CoordinateSpaces.SPREAD_COORDINATES,
                        originalReferencePosition,
                        app.transformationMatrices.add({counterclockwiseRotationAngle: angleDifference})
                    );
                }
            } catch (error) {
                failures.push(String(error.message || error));
            }
        }
    }, ScriptLanguage.JAVASCRIPT, [], UndoModes.ENTIRE_SCRIPT, "キーオブジェクトにサイズを合わせる");

    if (failures.length) {
        alert("サイズを変更できなかったオブジェクト：" + failures.length + "件\n" + failures[0]);
    }

    function showOptionsDialog() {
        var dialog = new Window("dialog", "リサイズオプション");
        dialog.orientation = "column";
        dialog.alignChildren = ["fill", "top"];
        dialog.margins = 16;
        dialog.spacing = 16;

        var body = dialog.add("group");
        body.orientation = "row";
        body.alignChildren = ["left", "top"];
        body.spacing = 24;

        var sizeColumn = body.add("group");
        sizeColumn.orientation = "column";
        sizeColumn.alignChildren = ["left", "top"];
        sizeColumn.spacing = 8;
        var labels = ["幅のみ", "高さのみ", "幅と高さの両方"];
        var sizeButtons = [];
        for (var i = 0; i < labels.length; i++) {
            sizeButtons.push(sizeColumn.add("radiobutton", undefined, labels[i]));
        }
        sizeButtons[2].value = true;

        var angleColumn = body.add("group");
        angleColumn.orientation = "column";
        angleColumn.alignChildren = ["center", "top"];
        angleColumn.spacing = 8;
        var angleCheckbox = angleColumn.add("checkbox", undefined, "角度を一致");
        angleCheckbox.value = false;

        var selectedPoint = 0;
        var pointNames = ["左上", "上中央", "右上", "左中央", "中央", "右中央", "左下", "下中央", "右下"];
        var preview = angleColumn.add("statictext", undefined, "");
        preview.preferredSize = [60, 60];
        preview.minimumSize = [60, 60];
        preview.maximumSize = [60, 60];
        preview.enabled = false;
        preview.helpTip = "回転中心：" + pointNames[selectedPoint];
        preview.onDraw = drawRotationPoints;
        preview.addEventListener("mousedown", function (event) {
            if (!preview.enabled || event.button !== 0) return;
            var x = event.clientX;
            var y = event.clientY;
            if (x < 0 || y < 0 || x >= 60 || y >= 60) return;
            selectedPoint = Math.floor(y / 20) * 3 + Math.floor(x / 20);
            preview.helpTip = "回転中心：" + pointNames[selectedPoint];
            redrawPreview();
        });
        angleCheckbox.onClick = function () {
            preview.enabled = angleCheckbox.value;
            redrawPreview();
        };

        var actionButtons = dialog.add("group");
        actionButtons.alignment = ["right", "top"];
        actionButtons.add("button", undefined, "キャンセル", {name: "cancel"});
        actionButtons.add("button", undefined, "OK", {name: "ok"});

        if (dialog.show() !== 1) return null;
        var sizeMode = 2;
        for (var j = 0; j < sizeButtons.length; j++) {
            if (sizeButtons[j].value) sizeMode = j;
        }
        return {sizeMode: sizeMode, matchAngle: angleCheckbox.value, rotationPoint: selectedPoint};

        function redrawPreview() {
            preview.notify("onDraw");
            dialog.update();
        }

        function drawRotationPoints() {
            var g = this.graphics;
            var dark = app.generalPreferences.uiBrightnessPreference <= 0.5;
            var shade = this.enabled ? (dark ? 0.94 : 0.08) : (dark ? 0.42 : 0.68);
            var color = [shade, shade, shade, 1];
            var pen = g.newPen(g.PenType.SOLID_COLOR, color, 1);
            var fill = g.newBrush(g.BrushType.SOLID_COLOR, color);
            var positions = [3.5, 25.5, 47.5];
            var boxSize = 9;

            // KeypadSettingsChangerと同じく、外周の接続線と9個の枠を描画する。
            for (var edge = 0; edge < 2; edge++) {
                var start = positions[edge] + boxSize;
                var end = positions[edge + 1];
                drawLine(start, 8, end, 8);
                drawLine(start, 52, end, 52);
                drawLine(8, start, 8, end);
                drawLine(52, start, 52, end);
            }
            for (var point = 0; point < 9; point++) {
                var x = positions[point % 3];
                var y = positions[Math.floor(point / 3)];
                g.newPath();
                g.rectPath(x, y, boxSize, boxSize);
                if (point === selectedPoint) g.fillPath(fill);
                g.strokePath(pen);
            }

            function drawLine(x1, y1, x2, y2) {
                g.newPath();
                g.moveTo(x1, y1);
                g.lineTo(x2, y2);
                g.strokePath(pen);
            }
        }
    }

    function rotationAnchor(index) {
        var anchors = [
            AnchorPoint.TOP_LEFT_ANCHOR, AnchorPoint.TOP_CENTER_ANCHOR, AnchorPoint.TOP_RIGHT_ANCHOR,
            AnchorPoint.LEFT_CENTER_ANCHOR, AnchorPoint.CENTER_ANCHOR, AnchorPoint.RIGHT_CENTER_ANCHOR,
            AnchorPoint.BOTTOM_LEFT_ANCHOR, AnchorPoint.BOTTOM_CENTER_ANCHOR, AnchorPoint.BOTTOM_RIGHT_ANCHOR
        ];
        return anchors[index];
    }

    function resolveCorner(item, anchor) {
        // オブジェクト自身の座標系で角を指定し、見開き上の実際の距離を測る。
        var values = item.resolve(
            [anchor, BoundingBoxLimits.GEOMETRIC_PATH_BOUNDS, CoordinateSpaces.INNER_COORDINATES],
            CoordinateSpaces.SPREAD_COORDINATES,
            false
        );
        var point = values && values[0];
        if (!point || point.length !== 2 || !isFinite(point[0]) || !isFinite(point[1])) {
            throw new Error("オブジェクトの角の座標を取得できません。");
        }
        return [Number(point[0]), Number(point[1])];
    }

    function measureItem(item) {
        var topLeft = resolveCorner(item, AnchorPoint.TOP_LEFT_ANCHOR);
        var topRight = resolveCorner(item, AnchorPoint.TOP_RIGHT_ANCHOR);
        var bottomLeft = resolveCorner(item, AnchorPoint.BOTTOM_LEFT_ANCHOR);
        var width = distance(topLeft, topRight);
        var height = distance(topLeft, bottomLeft);
        if (!isFinite(width) || !isFinite(height) || width <= 0 || height <= 0) {
            throw new Error("オブジェクトの幅と高さを取得できません。");
        }
        return {width: width, height: height, topLeft: topLeft};
    }

    function distance(a, b) {
        var dx = b[0] - a[0];
        var dy = b[1] - a[1];
        return Math.sqrt(dx * dx + dy * dy);
    }

    function readAngle(item) {
        // グループ内でも、見開き上で見える角度を一致させる。
        var angle = Number(item.absoluteRotationAngle);
        if (!isFinite(angle)) throw new Error("オブジェクトの回転角度を取得できません。");
        return angle;
    }
})();
