#target "illustrator"

/*
SCRIPTMETA-BEGIN
Script-ID=org.iwashi.RandomFillFromSelectedSwatches
Version=1.1
Meta-URL=https://github.com/Yamonov/Iwashiya_Scripts/tree/main/Illustrator
Name=選択スウォッチから塗りと線をランダム割り当て
Author=Murakami Yoshiteru
Release-Date=2026-08-21
Target-App=Illustrator
Description=選択中の各オブジェクトの塗りと線に、複数選択したスウォッチを、偏りと長い連続を抑えてランダムに割り当てます。結果を繰り返し試し、キャンセルで実行前の状態に戻せます。
SCRIPTMETA-END
*/

(function () {
    var SCRIPT_NAME = "選択スウォッチから塗りと線をランダム割り当て";

    if (app.documents.length === 0) {
        alert("ドキュメントを開いてください。", SCRIPT_NAME);
        return;
    }

    var documentRef = app.activeDocument;
    var selectedItems = documentRef.selection;

    if (!selectedItems || selectedItems.length === 0) {
        alert("変更するオブジェクトを選択してください。", SCRIPT_NAME);
        return;
    }

    var selectedSwatches;
    try {
        selectedSwatches = documentRef.swatches.getSelected();
    } catch (_) {
        alert("選択中のスウォッチを取得できませんでした。", SCRIPT_NAME);
        return;
    }

    if (!selectedSwatches || selectedSwatches.length < 2) {
        alert("スウォッチパネルで2個以上のスウォッチを選択してください。", SCRIPT_NAME);
        return;
    }

    var targetItems = [];
    for (var i = 0; i < selectedItems.length; i++) {
        if (canApplyAppearance(selectedItems[i])) targetItems.push(selectedItems[i]);
    }

    if (targetItems.length === 0) {
        alert("選択範囲に塗りまたは線を変更できるオブジェクトがありません。", SCRIPT_NAME);
        return;
    }

    var originalState = captureOriginalState(targetItems);
    var accepted = false;
    var restored = false;

    // 初期値は「塗り」をオンにし、UIを表示する前に一度適用する。
    applyRandomAppearance(true, false);

    var win;
    try {
        win = createDialog();
        win.center();
        win.show();
    } catch (error) {
        restoreOriginalState();
        alert("操作画面を表示できませんでした。\n" + error, SCRIPT_NAME);
    }

    function createDialog() {
        var dialog = new Window("dialog", SCRIPT_NAME);
        dialog.orientation = "column";
        dialog.alignChildren = ["fill", "center"];
        dialog.spacing = 12;
        dialog.margins = 16;

        var optionGroup = dialog.add("group");
        optionGroup.orientation = "row";
        optionGroup.alignChildren = ["center", "center"];
        optionGroup.spacing = 14;

        var fillCheckbox = optionGroup.add("checkbox", undefined, "塗り");
        var strokeCheckbox = optionGroup.add("checkbox", undefined, "線");
        var applyButton = optionGroup.add("button", undefined, "適用");
        fillCheckbox.value = true;
        strokeCheckbox.value = false;
        applyButton.preferredSize = [72, 28];

        var confirmationGroup = dialog.add("group");
        confirmationGroup.orientation = "row";
        confirmationGroup.alignChildren = ["center", "center"];
        confirmationGroup.alignment = ["center", "center"];
        confirmationGroup.spacing = 12;

        var cancelButton = confirmationGroup.add("button", undefined, "キャンセル", { name: "cancel" });
        var okButton = confirmationGroup.add("button", undefined, "OK", { name: "ok" });
        cancelButton.preferredSize = [92, 28];
        okButton.preferredSize = [92, 28];

        applyButton.onClick = function () {
            if (!fillCheckbox.value && !strokeCheckbox.value) {
                alert("塗りまたは線を選択してください。", SCRIPT_NAME);
                return;
            }

            applyRandomAppearance(fillCheckbox.value, strokeCheckbox.value);
        };

        cancelButton.onClick = function () {
            restoreOriginalState();
            dialog.close(0);
        };

        okButton.onClick = function () {
            accepted = true;
            dialog.close(1);
        };

        dialog.onClose = function () {
            if (!accepted) restoreOriginalState();
        };

        dialog.defaultElement = okButton;
        dialog.cancelElement = cancelButton;
        return dialog;
    }

    function applyRandomAppearance(applyFill, applyStroke) {
        var fillAssignments = applyFill
            ? makePerceptualRandomOrder(selectedSwatches, targetItems.length)
            : null;
        var strokeAssignments = applyStroke
            ? makePerceptualRandomOrder(selectedSwatches, targetItems.length)
            : null;

        if (fillAssignments && strokeAssignments) {
            avoidMatchingFillAndStroke(fillAssignments, strokeAssignments, selectedSwatches);
        }

        for (var i = 0; i < targetItems.length; i++) {
            applyAppearance(
                targetItems[i],
                applyFill ? fillAssignments[i].color : null,
                applyStroke ? strokeAssignments[i].color : null,
                applyFill,
                applyStroke
            );
        }

        app.redraw();
    }

    function applyAppearance(item, fillColor, strokeColor, applyFill, applyStroke) {
        if (!item) return false;

        try {
            switch (item.typename) {
                case "PathItem":
                    if (applyFill) {
                        item.filled = true;
                        item.fillColor = fillColor;
                    }
                    if (applyStroke) {
                        item.stroked = true;
                        item.strokeColor = strokeColor;
                    }
                    return true;

                case "CompoundPathItem":
                    return applyToCollection(
                        item.pathItems,
                        fillColor,
                        strokeColor,
                        applyFill,
                        applyStroke
                    );

                case "GroupItem":
                    return applyToCollection(
                        item.pageItems,
                        fillColor,
                        strokeColor,
                        applyFill,
                        applyStroke
                    );

                case "TextFrame":
                    setTextAppearance(
                        item.textRange.characterAttributes,
                        fillColor,
                        strokeColor,
                        applyFill,
                        applyStroke
                    );
                    return true;

                case "TextRange":
                    setTextAppearance(
                        item.characterAttributes,
                        fillColor,
                        strokeColor,
                        applyFill,
                        applyStroke
                    );
                    return true;
            }
        } catch (_) {}

        return false;
    }

    function setTextAppearance(attributes, fillColor, strokeColor, applyFill, applyStroke) {
        if (applyFill) attributes.fillColor = fillColor;
        if (applyStroke) attributes.strokeColor = strokeColor;
    }

    function applyToCollection(items, fillColor, strokeColor, applyFill, applyStroke) {
        var changed = false;

        for (var i = 0; i < items.length; i++) {
            if (applyAppearance(items[i], fillColor, strokeColor, applyFill, applyStroke)) {
                changed = true;
            }
        }

        return changed;
    }

    function canApplyAppearance(item) {
        if (!item) return false;

        try {
            switch (item.typename) {
                case "PathItem":
                case "TextFrame":
                case "TextRange":
                    return true;

                case "CompoundPathItem":
                    return collectionCanAcceptAppearance(item.pathItems);

                case "GroupItem":
                    return collectionCanAcceptAppearance(item.pageItems);
            }
        } catch (_) {}

        return false;
    }

    function collectionCanAcceptAppearance(items) {
        for (var i = 0; i < items.length; i++) {
            if (canApplyAppearance(items[i])) return true;
        }
        return false;
    }

    function captureOriginalState(items) {
        var records = [];

        for (var i = 0; i < items.length; i++) {
            captureItemState(items[i], records);
        }

        return records;
    }

    function captureItemState(item, records) {
        if (!item) return;

        try {
            switch (item.typename) {
                case "PathItem":
                    if (!containsItemRecord(records, item)) {
                        records.push({
                            kind: "path",
                            item: item,
                            filled: item.filled,
                            fillColor: item.fillColor,
                            stroked: item.stroked,
                            strokeColor: item.strokeColor
                        });
                    }
                    return;

                case "CompoundPathItem":
                    captureCollectionState(item.pathItems, records);
                    return;

                case "GroupItem":
                    captureCollectionState(item.pageItems, records);
                    return;

                case "TextFrame":
                    captureTextState(item.textRange, records);
                    return;

                case "TextRange":
                    captureTextState(item, records);
                    return;
            }
        } catch (_) {}
    }

    function captureCollectionState(items, records) {
        for (var i = 0; i < items.length; i++) {
            captureItemState(items[i], records);
        }
    }

    function captureTextState(textRange, records) {
        try {
            if (textRange.characters.length > 0) {
                for (var i = 0; i < textRange.characters.length; i++) {
                    captureTextRangeState(textRange.characters[i], records);
                }
            } else {
                captureTextRangeState(textRange, records);
            }
        } catch (_) {
            captureTextRangeState(textRange, records);
        }
    }

    function captureTextRangeState(textRange, records) {
        try {
            records.push({
                kind: "text",
                item: textRange,
                fillColor: textRange.characterAttributes.fillColor,
                strokeColor: textRange.characterAttributes.strokeColor
            });
        } catch (_) {}
    }

    function containsItemRecord(records, item) {
        for (var i = 0; i < records.length; i++) {
            if (records[i].item === item) return true;
        }
        return false;
    }

    function restoreOriginalState() {
        if (restored) return;

        for (var i = 0; i < originalState.length; i++) {
            var record = originalState[i];

            try {
                if (record.kind === "path") {
                    record.item.fillColor = record.fillColor;
                    record.item.strokeColor = record.strokeColor;
                    record.item.filled = record.filled;
                    record.item.stroked = record.stroked;
                } else if (record.kind === "text") {
                    record.item.characterAttributes.fillColor = record.fillColor;
                    record.item.characterAttributes.strokeColor = record.strokeColor;
                }
            } catch (_) {}
        }

        restored = true;
        app.redraw();
    }

    // 使用回数をほぼ均等にしつつ、同じ色が長く連続しにくい順序を作る。
    // 2回までの連続は低い確率で許し、規則的な交互配色になることも避ける。
    function makePerceptualRandomOrder(swatches, itemCount) {
        var swatchCount = swatches.length;
        var remaining = [];
        var order = [];
        var indices = [];
        var baseCount = Math.floor(itemCount / swatchCount);
        var extraCount = itemCount % swatchCount;
        var i;

        for (i = 0; i < swatchCount; i++) {
            remaining[i] = baseCount;
            indices[i] = i;
        }

        shuffle(indices);
        for (i = 0; i < extraCount; i++) remaining[indices[i]]++;

        while (order.length < itemCount) {
            var previous = order.length > 0 ? order[order.length - 1] : -1;
            var previousPrevious = order.length > 1 ? order[order.length - 2] : -1;
            var weights = [];
            var totalWeight = 0;

            for (i = 0; i < swatchCount; i++) {
                var weight = remaining[i];

                if (weight > 0 && i === previous) {
                    weight *= 0.3;
                    if (i === previousPrevious && hasOtherRemaining(remaining, i)) weight = 0;
                }

                weights[i] = weight;
                totalWeight += weight;
            }

            var selectedIndex = weightedRandomIndex(weights, totalWeight);
            order.push(selectedIndex);
            remaining[selectedIndex]--;
        }

        var result = [];
        for (i = 0; i < order.length; i++) result.push(swatches[order[i]]);
        return result;
    }

    // 塗りと線を同時に変更するときは、同じオブジェクトで同色になるのを避ける。
    function avoidMatchingFillAndStroke(fillAssignments, strokeAssignments, swatches) {
        for (var i = 0; i < fillAssignments.length; i++) {
            if (!sameSwatch(fillAssignments[i], strokeAssignments[i])) continue;

            var swapIndex = findStrokeSwapIndex(i, fillAssignments, strokeAssignments);
            if (swapIndex >= 0) {
                var temporary = strokeAssignments[i];
                strokeAssignments[i] = strokeAssignments[swapIndex];
                strokeAssignments[swapIndex] = temporary;
            } else {
                strokeAssignments[i] = chooseDifferentSwatch(swatches, fillAssignments[i]);
            }
        }
    }

    function findStrokeSwapIndex(index, fillAssignments, strokeAssignments) {
        for (var i = index + 1; i < strokeAssignments.length; i++) {
            if (
                !sameSwatch(fillAssignments[index], strokeAssignments[i]) &&
                !sameSwatch(fillAssignments[i], strokeAssignments[index])
            ) {
                return i;
            }
        }
        return -1;
    }

    function chooseDifferentSwatch(swatches, excludedSwatch) {
        var candidates = [];

        for (var i = 0; i < swatches.length; i++) {
            if (!sameSwatch(swatches[i], excludedSwatch)) candidates.push(swatches[i]);
        }

        return candidates[Math.floor(Math.random() * candidates.length)];
    }

    function sameSwatch(first, second) {
        if (first === second) return true;

        try {
            return first.name === second.name;
        } catch (_) {
            return false;
        }
    }

    function hasOtherRemaining(remaining, excludedIndex) {
        for (var i = 0; i < remaining.length; i++) {
            if (i !== excludedIndex && remaining[i] > 0) return true;
        }
        return false;
    }

    function weightedRandomIndex(weights, totalWeight) {
        var threshold = Math.random() * totalWeight;

        for (var i = 0; i < weights.length; i++) {
            threshold -= weights[i];
            if (weights[i] > 0 && threshold < 0) return i;
        }

        for (var j = weights.length - 1; j >= 0; j--) {
            if (weights[j] > 0) return j;
        }

        return 0;
    }

    function shuffle(values) {
        for (var i = values.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temporary = values[i];
            values[i] = values[j];
            values[j] = temporary;
        }
    }
}());
