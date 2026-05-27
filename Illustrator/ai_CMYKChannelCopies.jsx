#target "illustrator"

/*

SCRIPTMETA-BEGIN
Script-ID=org.iwashi.CMYKChannelCopies
Version=0.5
Meta-URL=https://raw.githubusercontent.com/Yamonov/Iwashiya_Scripts/main/Illustrator/SCRIPTMETA.txt
Name=分版オブジェクト生成
Author=Yoshiteru Murakami
Release-Date=2026-05-27
Target-App=Illustrator
Edit-Password-SHA256=VXumlreZb7NPYcxh:f4fb797ffdcf1bef1ddae7ae66c3884fadd33a1ac230f8213a59a84706aa1ace
Description-BEGIN
オブジェクトを選択して実行すると、下方向に
Cのみ、Mのみ………のオブジェクトを複製配置します
Description-END
SCRIPTMETA-END

*/

(function () {
    var GAP_RATIO = 0.2;
    var CHANNELS = ["C", "M", "Y", "K"];

    function clamp(value, min, max) {
        value = Number(value);
        if (isNaN(value)) return min;
        return Math.max(min, Math.min(max, value));
    }

    function makeCMYK(c, m, y, k) {
        var color = new CMYKColor();
        color.cyan = clamp(c, 0, 100);
        color.magenta = clamp(m, 0, 100);
        color.yellow = clamp(y, 0, 100);
        color.black = clamp(k, 0, 100);
        return color;
    }

    function rgbToCmykFallback(r, g, b) {
        var rr = clamp(r, 0, 255) / 255;
        var gg = clamp(g, 0, 255) / 255;
        var bb = clamp(b, 0, 255) / 255;
        var k = 1 - Math.max(rr, gg, bb);

        if (k >= 1) {
            return { c: 0, m: 0, y: 0, k: 100 };
        }

        return {
            c: ((1 - rr - k) / (1 - k)) * 100,
            m: ((1 - gg - k) / (1 - k)) * 100,
            y: ((1 - bb - k) / (1 - k)) * 100,
            k: k * 100
        };
    }

    function convertSample(sourceSpace, values, destSpace) {
        try {
            var converted = app.convertSampleColor(
                sourceSpace,
                values,
                destSpace,
                ColorConvertPurpose.defaultpurpose
            );
            if (converted && converted.length >= 4) {
                return {
                    c: converted[0],
                    m: converted[1],
                    y: converted[2],
                    k: converted[3]
                };
            }
        } catch (e) {}

        return null;
    }

    function grayColorSpace() {
        try {
            if (ImageColorSpace.GrayScale !== undefined) return ImageColorSpace.GrayScale;
        } catch (e) {}

        try {
            if (ImageColorSpace.GRAYSCALE !== undefined) return ImageColorSpace.GRAYSCALE;
        } catch (e2) {}

        return null;
    }

    function colorToCMYK(color) {
        if (!color) return null;

        try {
            if (color.typename === "NoColor") {
                return null;
            }

            if (color.typename === "CMYKColor") {
                return {
                    c: color.cyan,
                    m: color.magenta,
                    y: color.yellow,
                    k: color.black
                };
            }

            if (color.typename === "RGBColor") {
                var rgbResult = convertSample(
                    ImageColorSpace.RGB,
                    [clamp(color.red, 0, 255), clamp(color.green, 0, 255), clamp(color.blue, 0, 255)],
                    ImageColorSpace.CMYK
                );
                return rgbResult || rgbToCmykFallback(color.red, color.green, color.blue);
            }

            if (color.typename === "GrayColor") {
                var graySpace = grayColorSpace();
                if (graySpace !== null) {
                    return convertSample(graySpace, [clamp(color.gray, 0, 100)], ImageColorSpace.CMYK);
                }
                return null;
            }

            if (color.typename === "SpotColor") {
                var spotBase = null;
                try {
                    spotBase = color.spot.color;
                } catch (spotError) {}

                var baseCMYK = colorToCMYK(spotBase);
                if (!baseCMYK) return null;

                var tint = 1;
                try {
                    tint = clamp(color.tint, 0, 100) / 100;
                } catch (tintError) {}

                return {
                    c: baseCMYK.c * tint,
                    m: baseCMYK.m * tint,
                    y: baseCMYK.y * tint,
                    k: baseCMYK.k * tint
                };
            }
        } catch (e2) {}

        return null;
    }

    function isolateChannelColor(color, channel) {
        var cmyk = colorToCMYK(color);
        if (!cmyk) return null;

        if (channel === "C") return makeCMYK(cmyk.c, 0, 0, 0);
        if (channel === "M") return makeCMYK(0, cmyk.m, 0, 0);
        if (channel === "Y") return makeCMYK(0, 0, cmyk.y, 0);
        if (channel === "K") return makeCMYK(0, 0, 0, cmyk.k);

        return null;
    }

    function processColorProperty(target, propertyName, channel, stats) {
        var originalColor = null;

        try {
            originalColor = target[propertyName];
        } catch (readError) {
            return;
        }

        if (!originalColor || originalColor.typename === "NoColor") {
            return;
        }

        var newColor = isolateChannelColor(originalColor, channel);
        if (!newColor) {
            stats.unsupported++;
            return;
        }

        try {
            target[propertyName] = newColor;
            stats.changed++;
        } catch (writeError) {
            stats.unsupported++;
        }
    }

    function processTextFrame(textFrame, channel, stats) {
        try {
            var attributes = textFrame.textRange.characterAttributes;
            processColorProperty(attributes, "fillColor", channel, stats);
            processColorProperty(attributes, "strokeColor", channel, stats);
        } catch (e) {
            stats.unsupported++;
        }
    }

    function walkArtItems(item, visitor) {
        if (!item) return;

        var typeName = "";
        try {
            typeName = item.typename;
        } catch (e) {
            return;
        }

        if (typeName === "GroupItem") {
            var groupItems = item.pageItems;
            for (var i = 0; i < groupItems.length; i++) {
                walkArtItems(groupItems[i], visitor);
            }
        } else if (typeName === "CompoundPathItem") {
            var pathItems = item.pathItems;
            for (var j = 0; j < pathItems.length; j++) {
                walkArtItems(pathItems[j], visitor);
            }
        } else if (typeName === "TextFrame" || typeName === "PathItem" || typeName === "MeshItem") {
            visitor(item);
        }
    }

    function processArtItem(item, channel, stats) {
        var typeName = item.typename;

        if (typeName === "TextFrame") {
            processTextFrame(item, channel, stats);
            return;
        }

        if (typeName === "PathItem") {
            try {
                if (item.filled) {
                    processColorProperty(item, "fillColor", channel, stats);
                }
            } catch (fillError) {}

            try {
                if (item.stroked) {
                    processColorProperty(item, "strokeColor", channel, stats);
                }
            } catch (strokeError) {}
            return;
        }

        stats.unsupported++;
    }

    function processPageItem(item, channel, stats) {
        walkArtItems(item, function (artItem) {
            processArtItem(artItem, channel, stats);
        });
    }

    function selectionItems(selection) {
        var items = [];

        for (var i = 0; i < selection.length; i++) {
            try {
                if (selection[i] && selection[i].duplicate && selection[i].visibleBounds) {
                    items.push(selection[i]);
                }
            } catch (e) {}
        }

        return items;
    }

    function itemBounds(item) {
        try {
            return item.visibleBounds;
        } catch (e) {}

        try {
            return item.geometricBounds;
        } catch (e2) {}

        return null;
    }

    function combinedBounds(items) {
        var bounds = null;

        for (var i = 0; i < items.length; i++) {
            var b = itemBounds(items[i]);
            if (!b || b.length < 4) continue;

            if (!bounds) {
                bounds = [b[0], b[1], b[2], b[3]];
            } else {
                bounds[0] = Math.min(bounds[0], b[0]);
                bounds[1] = Math.max(bounds[1], b[1]);
                bounds[2] = Math.max(bounds[2], b[2]);
                bounds[3] = Math.min(bounds[3], b[3]);
            }
        }

        return bounds;
    }

    function duplicateRow(items, yOffset) {
        var row = [];

        for (var i = 0; i < items.length; i++) {
            try {
                var copy = items[i].duplicate();
                copy.translate(0, yOffset);
                row.push(copy);
            } catch (e) {}
        }

        return row;
    }

    function selectItems(doc, items) {
        try {
            doc.selection = null;
        } catch (e) {}

        for (var i = 0; i < items.length; i++) {
            try {
                items[i].selected = true;
            } catch (e2) {}
        }
    }

    if (app.documents.length === 0) {
        alert("ドキュメントが開かれていません。");
        return;
    }

    var doc = app.activeDocument;
    if (doc.documentColorSpace !== DocumentColorSpace.CMYK) {
        alert("CMYK ドキュメントで実行してください。");
        return;
    }

    var sourceItems = selectionItems(doc.selection);

    if (sourceItems.length === 0) {
        alert("選択してから実行してください。");
        return;
    }

    var bounds = combinedBounds(sourceItems);
    if (!bounds) {
        alert("選択オブジェクトのサイズを取得できませんでした。");
        return;
    }

    var selectionHeight = Math.abs(bounds[1] - bounds[3]);
    if (selectionHeight <= 0) {
        alert("選択オブジェクトの高さが 0 のため、コピー位置を計算できませんでした。");
        return;
    }

    var stepY = -(selectionHeight * (1 + GAP_RATIO));
    var createdItems = [];
    var stats = {
        changed: 0,
        unsupported: 0
    };

    for (var rowIndex = 0; rowIndex < CHANNELS.length; rowIndex++) {
        var rowItems = duplicateRow(sourceItems, stepY * (rowIndex + 1));

        for (var itemIndex = 0; itemIndex < rowItems.length; itemIndex++) {
            processPageItem(rowItems[itemIndex], CHANNELS[rowIndex], stats);
            createdItems.push(rowItems[itemIndex]);
        }
    }

    if (createdItems.length === 0) {
        alert("コピーを作成できませんでした。");
        return;
    }

    selectItems(doc, createdItems);
    app.redraw();

    if (stats.unsupported > 0) {
        alert(
            "コピーは作成しました。\n" +
            "グラデーション、パターン、非対応の色など " + stats.unsupported + " 件は変更できませんでした。"
        );
    }
})();
