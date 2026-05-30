#target illustrator

/*
SCRIPTMETA-BEGIN
Script-ID=org.iwashi.IllustratorCrop_RelinkFitter
Version=0.7
Meta-URL=https://gist.github.com/Yamonov/b63d9c67402ef7af4c17ab33caccce31
Name=Psの伸ばし情報で位置を変えずに再配置
Author=Murakami Yoshiteru
Release-Date=2026-05-13
Target-App=Illustrator
Edit-Password-SHA256=ZOv20mIwVP26NzJj:46c00dfa92b9392774dae9232e5b800346e33ba2dccaa2bdc8e7dfa99a7845bd
Description-BEGIN
Photoshop_Illustrator_Cropで処理した際に追加されるXMPタグを読み込み、Illustrator上のクリッピングマスク位置に合わせてリンク画像を再配置します。

Photoshopでxmpタグを埋め込んでいない場合は動作しません。
Photoshop_Illustrator_Crop.jsxとセットで運用してください。
Description-END
SCRIPTMETA-END
*/

(function () {
    var YAMO_LOCALE_OVERRIDE = ""; // テスト時のみ "ja" または "en" を指定

    var UI_TEXT = {
        noScale: {
            ja: "変倍なし",
            en: "No scaling"
        },
        noDocument: {
            ja: "ドキュメントを開いてから実行してください。",
            en: "Open a document before running this script."
        },
        selectionRequired: {
            ja: "リンク画像、またはリンク画像を含むクリッピンググループを選択してください。",
            en: "Select a linked image, or a clipping group that contains a linked image."
        },
        noXmpPlacedItem: {
            ja: "XMP配置情報を持つリンク画像が見つかりませんでした。",
            en: "No linked image with XMP placement data was found."
        },
        multipleLinksSelected: {
            ja: "複数のリンク画像が選択されています。1つだけ選択してください。",
            en: "Multiple linked images are selected. Select only one."
        },
        noXmpOnSelectedImage: {
            ja: "選択画像から XMP 配置情報が見つかりませんでした。",
            en: "No XMP placement data was found in the selected image."
        },
        currentPlacementUnavailable: {
            ja: "現在の配置情報を取得できませんでした。",
            en: "Could not get the current placement information."
        },
        referenceGeometryUnavailable: {
            ja: "クリッピングマスク、または現在の画像位置から基準座標を取得できませんでした。",
            en: "Could not get reference coordinates from the clipping mask or current image position."
        },
        dialogTitle: {
            ja: "XMP配置で再配置",
            en: "Reposition from XMP Placement"
        },
        mode1Base: {
            ja: "1：元画像全体とマスク範囲を含む画像として配置",
            en: "1: Place as an image containing the full original image and mask area"
        },
        mode2Base: {
            ja: "2：クリッピングマスク範囲として配置",
            en: "2: Place as the clipping mask area"
        },
        modePanelTitle: {
            ja: "元のクリッピングマスクに合わせて配置",
            en: "Place to match the original clipping mask"
        },
        trimmedMaskHint: {
            ja: "※ Photoshop側でマスク範囲にトリムしている場合は、2：を選んでください。",
            en: "If the Photoshop-side crop is trimmed to the mask area, choose 2."
        },
        cancelButton: {
            ja: "キャンセル",
            en: "Cancel"
        },
        optionWithScale: {
            ja: "{base}（{scale}）",
            en: "{base} ({scale})"
        },
        notLinkedImage: {
            ja: "選択画像はリンク画像ではありません。リンク画像を選択してください。",
            en: "The selected image is not a linked image. Select a linked image."
        },
        linkedFileMissing: {
            ja: "リンクファイルが見つかりません。Illustratorのリンクパネルを確認してください。",
            en: "The linked file was not found. Check Illustrator's Links panel."
        },
        linkedFileXmpReadFailed: {
            ja: "リンクファイルから XMP 情報を読み込めませんでした。",
            en: "Could not read XMP information from the linked file."
        },
        missingXmpAfterSave: {
            ja: "選択画像から XMP 配置情報が見つかりませんでした。\nPhotoshop側で処理後、画像を保存してから実行してください。",
            en: "No XMP placement data was found in the selected image.\nAfter processing on the Photoshop side, save the image and run this script again."
        },
        xmpParseFailed: {
            ja: "XMP 配置情報の解析に失敗しました。",
            en: "Failed to parse XMP placement data."
        },
        xmpReadFailedAfterSave: {
            ja: "XMP 配置情報の読み込みに失敗しました。\nPhotoshop側で処理後、画像を保存してから実行してください。",
            en: "Failed to read XMP placement data.\nAfter processing on the Photoshop side, save the image and run this script again."
        },
        unsupportedXmpVersion: {
            ja: "対応していない XMP 配置情報です。Photoshop側の Crop スクリプトと Fitter のバージョンを確認してください。",
            en: "Unsupported XMP placement data. Check the versions of the Photoshop-side Crop script and Fitter."
        },
        unsupportedXmpUnit: {
            ja: "対応していない XMP 配置情報の単位です。Photoshop側で処理し直してください。",
            en: "Unsupported unit in the XMP placement data. Process the image again on the Photoshop side."
        },
        notIllustratorMaskXmp: {
            ja: "Illustratorのクリッピングマスク用ではない XMP 配置情報です。",
            en: "This XMP placement data is not for an Illustrator clipping mask."
        },
        xmpDataInvalid: {
            ja: "XMP 配置情報が不足しているか壊れています。Photoshop側で処理し直してください。",
            en: "XMP placement data is missing required fields or is corrupted. Process the image again on the Photoshop side."
        },
        missingOriginalImageSize: {
            ja: "XMP 配置情報に元画像サイズがありません。Photoshop側で処理し直してください。",
            en: "The XMP placement data does not contain the original image size. Process the image again on the Photoshop side."
        },
        missingLink: {
            ja: "リンク切れ画像です。Illustratorのリンクパネルを確認してください。",
            en: "The linked image is missing. Check Illustrator's Links panel."
        },
        modifiedLink: {
            ja: "リンクが更新されていません。Illustratorのリンクパネルを更新してから実行してください。",
            en: "The link has not been updated. Update it in Illustrator's Links panel, then run this script again."
        }
    };

    var MODE_1 = "mode1";
    var MODE_2 = "mode2";
    var SCALE_DIFF_THRESHOLD = 0.5;
    var NO_SCALE_TEXT = uiText("noScale");
    var XMP_NAMESPACE_URI = "http://ns.yamo.jp/photoshop/illustrator-crop-replacement-data/1.0/";
    var XMP_PREFIX = "yamoAiCrop:";
    var XMP_PROPERTY = "PhotoshopIllustratorCrop_ReplacementData";
    var REPLACEMENT_DATA_VERSION = 1;
    var REPLACEMENT_DATA_UNIT = "mm";
    var SOURCE_APP = "Illustrator";
    var SOURCE_KIND = "IllustratorClippingMask";
    var COORDINATE_SPACE = "image-local";

    if (app.documents.length === 0) {
        alert(uiText("noDocument"));
        return;
    }

    if (!app.selection || app.selection.length === 0) {
        alert(uiText("selectionRequired"));
        return;
    }

    main();

    function main() {
        var preparedTarget = prepareTarget(app.selection);
        if (!preparedTarget.target) {
            alert(preparedTarget.message || uiText("noXmpPlacedItem"));
            return;
        }

        showPreviewDialog(preparedTarget.target);
    }

    function currentLocaleCode() {
        var rawLocale = YAMO_LOCALE_OVERRIDE;

        if (!rawLocale) {
            try {
                rawLocale = $.locale;
            } catch (e) {
                rawLocale = "";
            }
        }

        if (!rawLocale) {
            try {
                rawLocale = app.locale;
            } catch (e2) {
                rawLocale = "";
            }
        }

        rawLocale = rawLocale ? rawLocale.toString().toLowerCase() : "";

        if (rawLocale.indexOf("ja") === 0 || rawLocale.indexOf("japanese") !== -1) {
            return "ja";
        }
        if (rawLocale.indexOf("en") === 0 || rawLocale.indexOf("english") !== -1) {
            return "en";
        }

        return "ja";
    }

    function uiText(key) {
        var textGroup = UI_TEXT[key];
        var localeCode = currentLocaleCode();

        if (!textGroup) {
            return key;
        }

        return textGroup[localeCode] || textGroup.ja || textGroup.en || key;
    }

    function uiFormat(key, values) {
        var text = uiText(key);
        var name;

        for (name in values) {
            if (values.hasOwnProperty(name)) {
                text = text.split("{" + name + "}").join(values[name]);
            }
        }

        return text;
    }

    function prepareTarget(selection) {
        var placedItems = collectSelectedPlacedItems(selection);
        var target = null;

        if (placedItems.length === 0) {
            return {
                target: null,
                message: uiText("selectionRequired")
            };
        }

        if (placedItems.length > 1) {
            return {
                target: null,
                message: uiText("multipleLinksSelected")
            };
        }

        target = buildPreparedTarget(placedItems[0]);
        if (!target.target) {
            return target;
        }

        return target;
    }

    function buildPreparedTarget(item) {
        var linkStatusMessage = getPlacedItemLinkStatusMessage(item);
        var replacementReadResult;
        var replacementData;
        var replacementValidationMessage;
        var originalSnapshot;
        var maskItem;
        var referenceGeometry;

        if (linkStatusMessage) {
            return {
                target: null,
                message: linkStatusMessage
            };
        }

        replacementReadResult = readReplacementDataFromPlacedItem(item);
        replacementData = replacementReadResult.data;
        if (!replacementData) {
            return {
                target: null,
                message: replacementReadResult.message || uiText("noXmpOnSelectedImage")
            };
        }

        replacementValidationMessage = validateReplacementData(replacementData);
        if (replacementValidationMessage) {
            return {
                target: null,
                message: replacementValidationMessage
            };
        }

        originalSnapshot = getCurrentPlacementSnapshot(item);
        if (!originalSnapshot) {
            return {
                target: null,
                message: uiText("currentPlacementUnavailable")
            };
        }

        maskItem = findClippingMaskForPlacedItem(item);
        referenceGeometry = buildReferenceGeometry(item, maskItem, replacementData, originalSnapshot);
        if (!referenceGeometry) {
            return {
                target: null,
                message: uiText("referenceGeometryUnavailable")
            };
        }

        return {
            target: {
                item: item,
                maskItem: maskItem,
                originalTransformSnapshot: originalSnapshot,
                replacementData: replacementData,
                referenceGeometry: referenceGeometry
            },
            message: ""
        };
    }

    function showPreviewDialog(target) {
        var dialog = new Window("dialog", uiText("dialogTitle"));
        var mode1Button;
        var mode2Button;
        var selectedMode = resolveInitialMode(target);
        var mode1Text = buildModeOptionText(target, MODE_1, uiText("mode1Base"));
        var mode2Text = buildModeOptionText(target, MODE_2, uiText("mode2Base"));

        dialog.orientation = "column";
        dialog.alignChildren = ["fill", "top"];
        dialog.spacing = 10;
        dialog.margins = 16;

        var modePanel = dialog.add("panel", undefined, uiText("modePanelTitle"));
        modePanel.orientation = "column";
        modePanel.alignChildren = ["left", "top"];
        modePanel.margins = 12;

        modePanel.add("statictext", undefined, uiText("trimmedMaskHint"));
        mode1Button = modePanel.add("radiobutton", undefined, mode1Text);
        mode2Button = modePanel.add("radiobutton", undefined, mode2Text);
        mode1Button.value = selectedMode === MODE_1;
        mode2Button.value = selectedMode === MODE_2;

        var buttonGroup = dialog.add("group");
        buttonGroup.alignment = ["right", "center"];
        buttonGroup.add("button", undefined, "OK", { name: "ok" });
        buttonGroup.add("button", undefined, uiText("cancelButton"), { name: "cancel" });

        function updatePreview(mode) {
            selectedMode = mode;
            restoreOriginalPlacement(target);
            applyReplacementMode(target, mode);
            try {
                app.redraw();
            } catch (e) {}
        }

        mode1Button.onClick = function () {
            updatePreview(MODE_1);
        };

        mode2Button.onClick = function () {
            updatePreview(MODE_2);
        };

        dialog.onShow = function () {
            updatePreview(selectedMode);
        };

        var result = dialog.show();
        if (result !== 1) {
            restoreOriginalPlacement(target);
            try {
                app.redraw();
            } catch (e2) {}
        }
    }

    function resolveInitialMode(target) {
        if (buildModeScaleDisplayText(target, MODE_2) === NO_SCALE_TEXT) {
            return MODE_2;
        }
        if (buildModeScaleDisplayText(target, MODE_1) === NO_SCALE_TEXT) {
            return MODE_1;
        }
        return MODE_1;
    }

    function buildModeOptionText(target, mode, baseText) {
        var displayText = buildModeScaleDisplayText(target, mode);
        if (displayText === null) {
            return baseText;
        }

        return uiFormat("optionWithScale", { base: baseText, scale: displayText });
    }

    function buildModeScaleDisplayText(target, mode) {
        var source = getReplacementModeData(target.replacementData, mode);
        var baseSize = target.referenceGeometry && target.referenceGeometry.baseSize;
        var targetScale;

        if (!source || !baseSize || baseSize.width === 0 || baseSize.height === 0) {
            return null;
        }

        targetScale = {
            x: mmToPt(source.w) / baseSize.width * 100,
            y: mmToPt(source.h) / baseSize.height * 100
        };

        if (Math.abs(targetScale.x - targetScale.y) <= SCALE_DIFF_THRESHOLD) {
            return NO_SCALE_TEXT;
        }

        return formatScaleLabelValue(targetScale.x) + "×" + formatScaleLabelValue(targetScale.y) + "%";
    }

    function formatScaleLabelValue(value) {
        var rounded = Math.round(value * 10) / 10;
        if (Math.abs(rounded - Math.round(rounded)) < 0.05) {
            return String(Math.round(rounded));
        }
        return rounded.toFixed(1);
    }

    function restoreOriginalPlacement(target) {
        return restoreTransformSnapshot(target.item, target.originalTransformSnapshot);
    }

    function applyReplacementMode(target, mode) {
        var placement = buildModePlacement(target, mode);
        if (!placement) {
            return false;
        }

        return applyPlacement(target.item, placement, target.referenceGeometry);
    }

    function buildModePlacement(target, mode) {
        var source = getReplacementModeData(target.replacementData, mode);
        var reference = target.referenceGeometry;
        var localX;
        var localY;
        var targetTopLeft;

        if (!source || !reference) {
            return null;
        }

        localX = mmToPt(source.x);
        localY = mmToPt(source.y);
        targetTopLeft = localPointToDocumentPoint(localX, localY, reference);

        return {
            topLeft: targetTopLeft,
            width: mmToPt(source.w),
            height: mmToPt(source.h),
            rotation: reference.rotation
        };
    }

    function getReplacementModeData(replacementData, mode) {
        return mode === MODE_2 ? replacementData.mode2 : replacementData.mode1;
    }

    function applyPlacement(item, placement, reference) {
        var baseSize;
        var currentTopLeft;
        var scaleX;
        var scaleY;

        if (!placement || placement.width <= 0 || placement.height <= 0) {
            return false;
        }

        if (!resetItemToBase(item, reference)) {
            return false;
        }

        baseSize = getCurrentItemSize(item);
        if (!baseSize || baseSize.width <= 0 || baseSize.height <= 0) {
            return false;
        }

        scaleX = placement.width / baseSize.width * 100;
        scaleY = placement.height / baseSize.height * 100;

        try {
            item.resize(
                scaleX,
                scaleY,
                true,
                true,
                true,
                true,
                100,
                Transformation.TOPLEFT
            );
        } catch (resizeError) {
            return false;
        }

        if (!rotateItemToReference(item, placement.rotation, reference)) {
            return false;
        }

        currentTopLeft = getCurrentItemTopLeft(item);
        if (!currentTopLeft) {
            return false;
        }

        return translateItem(
            item,
            placement.topLeft[0] - currentTopLeft[0],
            placement.topLeft[1] - currentTopLeft[1]
        );
    }

    function resetItemToBase(item, reference) {
        try {
            item.matrix = buildResetMatrix(reference);
            return true;
        } catch (matrixError) {}

        return false;
    }

    function buildResetMatrix(reference) {
        var matrix = app.getIdentityMatrix();
        if (reference && isFiniteNumber(reference.determinant) && reference.determinant < 0) {
            matrix.mValueD = -1;
        }
        return matrix;
    }

    function rotateItemToReference(item, rotation, reference) {
        var firstScore;
        var secondScore;

        if (Math.abs(rotation) < 0.0001) {
            return true;
        }

        try {
            item.rotate(rotation, true, true, true, true, Transformation.TOPLEFT);
        } catch (rotateError) {
            return false;
        }

        firstScore = getAxisAlignmentScore(item, reference);
        if (firstScore >= 1.998) {
            return true;
        }

        try {
            item.rotate(-2 * rotation, true, true, true, true, Transformation.TOPLEFT);
        } catch (reverseError) {
            return true;
        }

        secondScore = getAxisAlignmentScore(item, reference);
        if (secondScore > firstScore) {
            return true;
        }

        try {
            item.rotate(2 * rotation, true, true, true, true, Transformation.TOPLEFT);
        } catch (restoreRotateError) {}

        return true;
    }

    function getAxisAlignmentScore(item, reference) {
        var axes = getAxesFromItem(item);
        if (!axes || !reference || !reference.axisX || !reference.axisY) {
            return 2;
        }
        return dotProduct(axes.axisX, reference.axisX) + dotProduct(axes.axisY, reference.axisY);
    }

    function buildReferenceGeometry(item, maskItem, replacementData, snapshot) {
        var axes = getAxesFromMatrix(snapshot.transformMatrix);
        var topLeft = null;
        var baseSize = getReplacementImageSize(replacementData);

        if (!axes) {
            axes = getAxesFromItem(item);
        }
        if (!axes || !baseSize) {
            return null;
        }

        if (maskItem && isValidMaskLocalBounds(replacementData.maskLocalBounds)) {
            topLeft = buildReferenceTopLeftFromMask(maskItem, axes, replacementData.maskLocalBounds);
        }

        if (!topLeft) {
            topLeft = buildReferenceTopLeftFromCenter(snapshot.center, axes, baseSize);
        }

        if (!topLeft) {
            return null;
        }

        return {
            topLeft: topLeft,
            axisX: axes.axisX,
            axisY: axes.axisY,
            rotation: axes.rotation,
            determinant: axes.determinant,
            baseSize: baseSize
        };
    }

    function getReplacementImageSize(replacementData) {
        if (!replacementData || !replacementData.imageSize) {
            return null;
        }
        if (!isFiniteNumber(replacementData.imageSize.w) || !isFiniteNumber(replacementData.imageSize.h)) {
            return null;
        }
        return {
            width: mmToPt(replacementData.imageSize.w),
            height: mmToPt(replacementData.imageSize.h)
        };
    }

    function buildReferenceTopLeftFromMask(maskItem, axes, maskLocalBounds) {
        var points = getMaskDocumentPoints(maskItem);
        var minProjectedX = null;
        var minProjectedY = null;
        var localLeft = mmToPt(maskLocalBounds.left);
        var localTop = mmToPt(maskLocalBounds.top);
        var projectedX;
        var projectedY;
        var originDotX;
        var originDotY;

        if (!points || points.length === 0) {
            return null;
        }

        for (var i = 0; i < points.length; i++) {
            projectedX = dotProduct(points[i], axes.axisX);
            projectedY = dotProduct(points[i], axes.axisY);
            if (minProjectedX === null || projectedX < minProjectedX) {
                minProjectedX = projectedX;
            }
            if (minProjectedY === null || projectedY < minProjectedY) {
                minProjectedY = projectedY;
            }
        }

        if (minProjectedX === null || minProjectedY === null) {
            return null;
        }

        originDotX = minProjectedX - localLeft;
        originDotY = minProjectedY - localTop;

        return addPoints(
            scalePoint(axes.axisX, originDotX),
            scalePoint(axes.axisY, originDotY)
        );
    }

    function buildReferenceTopLeftFromCenter(center, axes, baseSize) {
        if (!center || !axes || !baseSize) {
            return null;
        }

        return subtractPoints(
            subtractPoints(center, scalePoint(axes.axisX, baseSize.width / 2)),
            scalePoint(axes.axisY, baseSize.height / 2)
        );
    }

    function localPointToDocumentPoint(localX, localY, reference) {
        return addPoints(
            addPoints(reference.topLeft, scalePoint(reference.axisX, localX)),
            scalePoint(reference.axisY, localY)
        );
    }

    function readReplacementDataFromPlacedItem(item) {
        var file = getPlacedItemFile(item);
        var xmpFile = null;
        var xmpMeta = null;
        var xmpValue = null;
        var parsedData = null;

        if (!file) {
            return {
                data: null,
                message: uiText("notLinkedImage")
            };
        }

        if (!file.exists) {
            return {
                data: null,
                message: uiText("linkedFileMissing")
            };
        }

        try {
            loadXMPLibrary();
            XMPMeta.registerNamespace(XMP_NAMESPACE_URI, XMP_PREFIX);
            xmpFile = new XMPFile(file.fsName, XMPConst.UNKNOWN, XMPConst.OPEN_FOR_READ);
            xmpMeta = xmpFile.getXMP();
            if (!xmpMeta) {
                return {
                    data: null,
                    message: uiText("linkedFileXmpReadFailed")
                };
            }
            xmpValue = xmpMeta.getProperty(XMP_NAMESPACE_URI, XMP_PROPERTY);
            if (!xmpValue || !xmpValue.value) {
                return {
                    data: null,
                    message: uiText("missingXmpAfterSave")
                };
            }
            parsedData = parseJsonText(String(xmpValue.value));
            if (!parsedData) {
                return {
                    data: null,
                    message: uiText("xmpParseFailed")
                };
            }
            return {
                data: parsedData,
                message: ""
            };
        } catch (e) {
            return {
                data: null,
                message: uiText("xmpReadFailedAfterSave")
            };
        } finally {
            if (xmpFile) {
                try {
                    xmpFile.closeFile();
                } catch (e2) {}
            }
        }
    }

    function loadXMPLibrary() {
        if (ExternalObject.AdobeXMPScript === undefined) {
            ExternalObject.AdobeXMPScript = new ExternalObject("lib:AdobeXMPScript");
        }
    }

    function parseJsonText(text) {
        if (!text) {
            return null;
        }

        if (typeof JSON !== "undefined" && JSON.parse) {
            try {
                return JSON.parse(text);
            } catch (e) {}
        }

        try {
            return eval("(" + text + ")");
        } catch (e2) {}

        return null;
    }

    function validateReplacementData(replacementData) {
        if (!replacementData) {
            return uiText("noXmpOnSelectedImage");
        }
        if (Number(replacementData.version) !== REPLACEMENT_DATA_VERSION) {
            return uiText("unsupportedXmpVersion");
        }
        if (String(replacementData.unit || "") !== REPLACEMENT_DATA_UNIT) {
            return uiText("unsupportedXmpUnit");
        }
        if (String(replacementData.sourceApp || "") !== SOURCE_APP ||
                String(replacementData.sourceKind || "") !== SOURCE_KIND ||
                String(replacementData.coordinateSpace || "") !== COORDINATE_SPACE) {
            return uiText("notIllustratorMaskXmp");
        }
        if (!isValidReplacementMode(replacementData.mode1) || !isValidReplacementMode(replacementData.mode2)) {
            return uiText("xmpDataInvalid");
        }
        if (!getReplacementImageSize(replacementData)) {
            return uiText("missingOriginalImageSize");
        }
        return "";
    }

    function isValidReplacementMode(mode) {
        return mode &&
            isFiniteNumber(mode.x) &&
            isFiniteNumber(mode.y) &&
            isFiniteNumber(mode.w) &&
            isFiniteNumber(mode.h) &&
            Number(mode.w) > 0 &&
            Number(mode.h) > 0;
    }

    function isValidMaskLocalBounds(bounds) {
        return bounds &&
            isFiniteNumber(bounds.left) &&
            isFiniteNumber(bounds.top) &&
            isFiniteNumber(bounds.right) &&
            isFiniteNumber(bounds.bottom);
    }

    function isFiniteNumber(value) {
        return typeof value === "number" && isFinite(value);
    }

    function getCurrentPlacementSnapshot(item) {
        var matrix = readItemTransformMatrix(item);
        var topLeft = getCurrentItemTopLeft(item);
        var center = getItemBoundsCenter(item);

        if (!matrix || !topLeft || !center) {
            return null;
        }

        return {
            transformMatrix: matrix,
            topLeft: topLeft,
            center: center
        };
    }

    function readItemTransformMatrix(item) {
        try {
            return copyMatrix(item.matrix);
        } catch (e) {}
        return null;
    }

    function copyMatrix(matrix) {
        var copied = app.getIdentityMatrix();
        copied.mValueA = Number(matrix.mValueA);
        copied.mValueB = Number(matrix.mValueB);
        copied.mValueC = Number(matrix.mValueC);
        copied.mValueD = Number(matrix.mValueD);
        try {
            if (isFinite(Number(matrix.mValueTX))) {
                copied.mValueTX = Number(matrix.mValueTX);
            }
        } catch (txError) {}
        try {
            if (isFinite(Number(matrix.mValueTY))) {
                copied.mValueTY = Number(matrix.mValueTY);
            }
        } catch (tyError) {}
        return copied;
    }

    function restoreTransformSnapshot(item, snapshot) {
        var currentTopLeft;

        if (!snapshot || !snapshot.transformMatrix) {
            return false;
        }

        try {
            item.matrix = copyMatrix(snapshot.transformMatrix);
        } catch (matrixError) {
            return false;
        }

        currentTopLeft = getCurrentItemTopLeft(item);
        if (currentTopLeft && snapshot.topLeft) {
            translateItem(
                item,
                snapshot.topLeft[0] - currentTopLeft[0],
                snapshot.topLeft[1] - currentTopLeft[1]
            );
        }

        return true;
    }

    function getPlacedItemLinkStatusMessage(item) {
        var file = getPlacedItemFile(item);
        var state = readLinkState(item, file);
        if (!file) {
            return uiText("notLinkedImage");
        }
        if (state === "missing") {
            return uiText("missingLink");
        }
        if (state === "modified") {
            return uiText("modifiedLink");
        }
        return "";
    }

    function getPlacedItemFile(item) {
        if (!item || item.typename !== "PlacedItem") {
            return null;
        }
        try {
            if (item.embedded) {
                return null;
            }
        } catch (embeddedError) {}
        try {
            return item.file;
        } catch (fileError) {}
        return null;
    }

    function readLinkState(item, fileObject) {
        try {
            if (typeof item.status !== "undefined") {
                return normalizeLinkState(item.status);
            }
        } catch (statusError) {}
        try {
            if (typeof item.linkStatus !== "undefined") {
                return normalizeLinkState(item.linkStatus);
            }
        } catch (linkStatusError) {}
        try {
            if (fileObject && typeof fileObject.exists !== "undefined" && fileObject.exists === false) {
                return "missing";
            }
        } catch (existsError) {}
        return "ok";
    }

    function normalizeLinkState(value) {
        var text = String(value || "").toLowerCase();
        var numberValue;
        if (text.indexOf("nodata") >= 0 || text.indexOf("missing") >= 0 || text.indexOf("notfound") >= 0) {
            return "missing";
        }
        if (text.indexOf("datamodified") >= 0 || text.indexOf("modified") >= 0 || text.indexOf("outdated") >= 0) {
            return "modified";
        }
        if (text.indexOf("datafromfile") >= 0 || text.indexOf("normal") >= 0 || text.indexOf("ok") >= 0) {
            return "ok";
        }
        numberValue = Number(value);
        if (numberValue === 1) {
            return "missing";
        }
        if (numberValue === 3) {
            return "modified";
        }
        return "ok";
    }

    function collectSelectedPlacedItems(selection) {
        var results = [];
        var seen = {};

        for (var i = 0; i < selection.length; i++) {
            collectPlacedItemsFromItem(selection[i], results, seen, 0);
        }

        return results;
    }

    function collectPlacedItemsFromItem(item, results, seen, depth) {
        var key;
        var children;

        if (!item || depth > 12) {
            return;
        }

        if (safeTypename(item) === "PlacedItem") {
            key = getItemSelectionKey(item);
            if (key && !seen[key]) {
                results.push(item);
                seen[key] = true;
            }
            return;
        }

        children = getChildPageItems(item);
        for (var i = 0; i < children.length; i++) {
            collectPlacedItemsFromItem(children[i], results, seen, depth + 1);
        }
    }

    function getChildPageItems(item) {
        var children = [];
        var collections = ["pageItems", "placedItems", "groupItems", "compoundPathItems"];

        for (var c = 0; c < collections.length; c++) {
            try {
                appendCollectionItems(children, item[collections[c]]);
            } catch (collectionError) {}
        }

        return children;
    }

    function appendCollectionItems(target, collection) {
        if (!collection) {
            return;
        }
        try {
            for (var i = 0; i < collection.length; i++) {
                target.push(collection[i]);
            }
        } catch (e) {}
    }

    function getItemSelectionKey(item) {
        try {
            if (item.uuid) {
                return String(item.uuid);
            }
        } catch (uuidError) {}
        try {
            return safeTypename(item) + ":" + String(item.name || "") + ":" + item.geometricBounds.join(",");
        } catch (boundsError) {}
        return null;
    }

    function findClippingMaskForPlacedItem(item) {
        var parent = null;
        var mask = null;

        try {
            parent = item.parent;
        } catch (parentError) {
            parent = null;
        }

        if (!parent) {
            return null;
        }

        if (safeTypename(parent) === "GroupItem") {
            mask = findClippingMaskInContainer(parent);
            if (mask) {
                return mask;
            }
        }

        try {
            if (parent.parent && parent.parent !== parent && safeTypename(parent.parent) === "GroupItem") {
                return findClippingMaskInContainer(parent.parent);
            }
        } catch (grandParentError) {}

        return null;
    }

    function findClippingMaskInContainer(container) {
        var mask = findClippingPathInCollection(container.pathItems);
        var compoundItems;

        if (mask) {
            return mask;
        }

        try {
            compoundItems = container.compoundPathItems;
            for (var idx = 0; idx < compoundItems.length; idx++) {
                mask = findClippingPathInCollection(compoundItems[idx].pathItems);
                if (mask) {
                    return mask;
                }
            }
        } catch (compoundError) {}

        return null;
    }

    function findClippingPathInCollection(pathItems) {
        if (!pathItems) {
            return null;
        }
        try {
            for (var idx = 0; idx < pathItems.length; idx++) {
                var pathItem = pathItems[idx];
                try {
                    if (pathItem.clipping) {
                        return pathItem;
                    }
                } catch (clippingError) {}
            }
        } catch (collectionError) {}
        return null;
    }

    function getMaskDocumentPoints(maskItem) {
        var points = [];
        var pathPoints;
        var anchor;
        var bounds;

        try {
            pathPoints = maskItem.pathPoints;
            for (var idx = 0; idx < pathPoints.length; idx++) {
                anchor = pathPoints[idx].anchor;
                if (anchor && anchor.length >= 2) {
                    points.push([Number(anchor[0]), Number(anchor[1])]);
                }
            }
        } catch (pathPointError) {
            points = [];
        }

        if (points.length > 0) {
            return points;
        }

        bounds = getBestBounds(maskItem);
        if (!bounds) {
            return null;
        }

        return boundsToQuad(bounds);
    }

    function getCurrentItemTopLeft(item) {
        var quad = getPlacedItemQuad(item);
        if (quad && quad.length >= 4) {
            return quad[0];
        }

        try {
            return [Number(item.left), Number(item.top)];
        } catch (positionError) {}

        return null;
    }

    function getCurrentItemSize(item) {
        try {
            return {
                width: Math.abs(Number(item.width)),
                height: Math.abs(Number(item.height))
            };
        } catch (e) {}
        return null;
    }

    function getItemBoundsCenter(item) {
        var bounds = getBestBounds(item);
        if (!bounds) {
            return null;
        }
        return getBoundsCenter(bounds);
    }

    function getPlacedItemQuad(item) {
        var matrixQuad = getMatrixPlacedItemQuad(item);
        if (matrixQuad) {
            return matrixQuad;
        }
        return boundsToQuad(getBestBounds(item));
    }

    function getMatrixPlacedItemQuad(item) {
        try {
            var matrix = item.matrix;
            var box = item.boundingBox;
            var bounds = getBestBounds(item);
            var scaleX;
            var scaleY;
            var width;
            var height;
            var axisX;
            var axisY;
            var center;
            var halfX;
            var halfY;

            if (!matrix || !box || box.length < 4 || !bounds || bounds.length < 4) {
                return null;
            }

            scaleX = vectorLength([getNumber(matrix.mValueA), getNumber(matrix.mValueB)]);
            scaleY = vectorLength([getNumber(matrix.mValueC), getNumber(matrix.mValueD)]);
            width = Math.abs(getNumber(box[2]) - getNumber(box[0])) * scaleX;
            height = Math.abs(getNumber(box[1]) - getNumber(box[3])) * scaleY;
            if (width <= 0 || height <= 0) {
                return null;
            }

            axisX = normalizeVector([getNumber(matrix.mValueA), -getNumber(matrix.mValueB)]);
            axisY = normalizeVector([-getNumber(matrix.mValueC), getNumber(matrix.mValueD)]);
            if (!vectorLength(axisX) || !vectorLength(axisY)) {
                return null;
            }

            center = getBoundsCenter(bounds);
            halfX = scalePoint(axisX, width / 2);
            halfY = scalePoint(axisY, height / 2);

            return [
                subtractPoints(subtractPoints(center, halfX), halfY),
                subtractPoints(addPoints(center, halfX), halfY),
                addPoints(addPoints(center, halfX), halfY),
                addPoints(subtractPoints(center, halfX), halfY)
            ];
        } catch (matrixQuadError) {
            return null;
        }
    }

    function getAxesFromItem(item) {
        try {
            return getAxesFromMatrix(item.matrix);
        } catch (matrixError) {}
        return null;
    }

    function getAxesFromMatrix(matrix) {
        var axisX;
        var axisY;

        if (!matrix) {
            return null;
        }

        axisX = normalizeVector([getNumber(matrix.mValueA), -getNumber(matrix.mValueB)]);
        axisY = normalizeVector([-getNumber(matrix.mValueC), getNumber(matrix.mValueD)]);
        if (!vectorLength(axisX) || !vectorLength(axisY)) {
            return null;
        }

        return {
            axisX: axisX,
            axisY: axisY,
            rotation: Math.atan2(getNumber(matrix.mValueB), getNumber(matrix.mValueA)) * 180 / Math.PI,
            determinant: getNumber(matrix.mValueA) * getNumber(matrix.mValueD) - getNumber(matrix.mValueB) * getNumber(matrix.mValueC)
        };
    }

    function getBestBounds(item) {
        try {
            var geometricBounds = item.geometricBounds;
            if (geometricBounds && geometricBounds.length >= 4) {
                return [
                    Number(geometricBounds[0]),
                    Number(geometricBounds[1]),
                    Number(geometricBounds[2]),
                    Number(geometricBounds[3])
                ];
            }
        } catch (geometricBoundsError) {}

        try {
            var visibleBounds = item.visibleBounds;
            if (visibleBounds && visibleBounds.length >= 4) {
                return [
                    Number(visibleBounds[0]),
                    Number(visibleBounds[1]),
                    Number(visibleBounds[2]),
                    Number(visibleBounds[3])
                ];
            }
        } catch (visibleBoundsError) {}

        return null;
    }

    function boundsToQuad(bounds) {
        if (!bounds || bounds.length < 4) {
            return null;
        }
        return [
            [getNumber(bounds[0]), getNumber(bounds[1])],
            [getNumber(bounds[2]), getNumber(bounds[1])],
            [getNumber(bounds[2]), getNumber(bounds[3])],
            [getNumber(bounds[0]), getNumber(bounds[3])]
        ];
    }

    function getBoundsCenter(bounds) {
        return [
            (getNumber(bounds[0]) + getNumber(bounds[2])) / 2,
            (getNumber(bounds[1]) + getNumber(bounds[3])) / 2
        ];
    }

    function translateItem(item, dx, dy) {
        try {
            item.translate(dx, dy);
            return true;
        } catch (translateError) {}

        try {
            item.left = Number(item.left) + dx;
            item.top = Number(item.top) + dy;
            return true;
        } catch (positionError) {}

        return false;
    }

    function safeTypename(item) {
        try {
            return String(item.typename || "");
        } catch (typenameError) {}
        return "";
    }

    function getNumber(value) {
        var numberValue = Number(value);
        if (!isFinite(numberValue)) {
            return 0;
        }
        return numberValue;
    }

    function addPoints(a, b) {
        return [getNumber(a[0]) + getNumber(b[0]), getNumber(a[1]) + getNumber(b[1])];
    }

    function subtractPoints(a, b) {
        return [getNumber(a[0]) - getNumber(b[0]), getNumber(a[1]) - getNumber(b[1])];
    }

    function scalePoint(point, scale) {
        return [getNumber(point[0]) * scale, getNumber(point[1]) * scale];
    }

    function normalizeVector(vector) {
        var length = vectorLength(vector);
        if (length === 0) {
            return [0, 0];
        }

        return [getNumber(vector[0]) / length, getNumber(vector[1]) / length];
    }

    function vectorLength(vector) {
        return Math.sqrt(getNumber(vector[0]) * getNumber(vector[0]) + getNumber(vector[1]) * getNumber(vector[1]));
    }

    function dotProduct(a, b) {
        return getNumber(a[0]) * getNumber(b[0]) + getNumber(a[1]) * getNumber(b[1]);
    }

    function mmToPt(value) {
        return UnitValue(value, "mm").as("pt");
    }
})();
