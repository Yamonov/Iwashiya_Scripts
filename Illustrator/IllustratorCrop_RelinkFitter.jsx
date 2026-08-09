#target illustrator

/*
SCRIPTMETA-BEGIN
Script-ID=org.iwashi.IllustratorCrop_RelinkFitter
Version=1.0
Meta-URL=https://github.com/Yamonov/Iwashiya_Scripts/tree/main/Illustrator
Name=Psの伸ばし情報で位置を変えずに再配置
Author=Murakami Yoshiteru
Release-Date=2026-08-10
Target-App=Illustrator
Edit-Password-SHA256=ZOv20mIwVP26NzJj:46c00dfa92b9392774dae9232e5b800346e33ba2dccaa2bdc8e7dfa99a7845bd
Description-BEGIN
Photoshop側のIllustrator ResizeCropスクリプトで追加されるXMPタグを読み込み、Illustrator上のクリッピングマスク位置に合わせてリンク画像を再配置します。

Photoshopでxmpタグを埋め込んでいない場合は動作しません。
Photoshop側のIllustrator ResizeCropスクリプトとセットで運用してください。
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
            ja: "クリッピングマスクから基準座標を取得できませんでした。マスクが変更されていないか確認してください。",
            en: "Could not get reference coordinates from the clipping mask. Check whether the mask has changed."
        },
        placementMismatch: {
            ja: "このXMP配置情報は、選択した配置画像用ではありません。Photoshop側で対象配置を選び直して処理してください。",
            en: "This XMP placement data belongs to a different placed item. Select the intended placement on the Photoshop side and process it again."
        },
        clippingMaskUnavailable: {
            ja: "選択画像のクリッピングマスクを安全に取得できませんでした。",
            en: "The clipping mask for the selected image could not be obtained safely."
        },
        noClippingMask: {
            ja: "選択画像がクリッピングマスク内にありません。",
            en: "The selected image is not inside a clipping mask."
        },
        nestedClippingMasks: {
            ja: "多重クリッピングマスクは安全に処理できません。",
            en: "Nested clipping masks cannot be processed safely."
        },
        multipleClippingPaths: {
            ja: "独立したクリッピングパスが複数あります。",
            en: "Multiple independent clipping paths were found."
        },
        clippingPathUnavailable: {
            ja: "クリッピングパスを確認できません。",
            en: "The clipping path could not be verified."
        },
        openClippingPath: {
            ja: "開いたクリッピングパスは安全に処理できません。",
            en: "An open clipping path cannot be processed safely."
        },
        previewFailed: {
            ja: "配置プレビューを適用できませんでした。OKは実行できません。",
            en: "The placement preview could not be applied. The operation cannot be confirmed."
        },
        restoreFailed: {
            ja: "元の配置へ完全に戻せませんでした。取り消してからリンクと変形を確認してください。",
            en: "The original placement could not be fully restored. Undo, then check the link and transform."
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
            ja: "対応していない XMP 配置情報です。Photoshop側の ResizeCrop スクリプトと Fitter のバージョンを確認してください。",
            en: "Unsupported XMP placement data. Check the versions of the Photoshop-side ResizeCrop script and Fitter."
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
    var GEOMETRY_EPSILON = 0.000000000001;
    var MASK_BOUNDS_TOLERANCE_PT = 0.05;

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
        var maskDescriptor;
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
        if (!replacementDataMatchesItem(item, replacementData)) {
            return {
                target: null,
                message: uiText("placementMismatch")
            };
        }

        originalSnapshot = getCurrentPlacementSnapshot(item);
        if (!originalSnapshot) {
            return {
                target: null,
                message: uiText("currentPlacementUnavailable")
            };
        }

        maskDescriptor = findClippingMaskForPlacedItem(item);
        if (!maskDescriptor || maskDescriptor.status !== "ok") {
            return {
                target: null,
                message: maskDescriptor && maskDescriptor.reason
                    ? maskDescriptor.reason
                    : uiText("clippingMaskUnavailable")
            };
        }
        referenceGeometry = buildReferenceGeometry(maskDescriptor, replacementData, originalSnapshot);
        if (!referenceGeometry) {
            return {
                target: null,
                message: uiText("referenceGeometryUnavailable")
            };
        }

        return {
            target: {
                item: item,
                maskDescriptor: maskDescriptor,
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
        var okButton;
        var statusText;
        var selectedMode = resolveInitialMode(target);
        var mode1Text = buildModeOptionText(target, MODE_1, uiText("mode1Base"));
        var mode2Text = buildModeOptionText(target, MODE_2, uiText("mode2Base"));
        var previewSucceeded = false;
        var accepted = false;

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
        okButton = buttonGroup.add("button", undefined, "OK", { name: "ok" });
        buttonGroup.add("button", undefined, uiText("cancelButton"), { name: "cancel" });
        statusText = dialog.add("statictext", undefined, " ");

        function updatePreview(mode) {
            selectedMode = mode;
            previewSucceeded = applyPreviewModeSafely(target, mode);
            okButton.enabled = previewSucceeded;
            statusText.text = previewSucceeded ? " " : uiText("previewFailed");
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
        okButton.onClick = function () {
            if (previewSucceeded) dialog.close(1);
        };

        try {
            accepted = dialog.show() === 1 && previewSucceeded;
        } catch (dialogError) {
            accepted = false;
            alert(dialogError);
        } finally {
            if (!accepted && !restoreOriginalPlacement(target)) {
                alert(uiText("restoreFailed"));
            }
            if (!accepted) {
                try {
                    app.redraw();
                } catch (e2) {}
            }
        }
    }

    function applyPreviewModeSafely(target, mode) {
        if (!restoreOriginalPlacement(target)) return false;
        if (applyReplacementMode(target, mode)) return true;
        if (!restoreOriginalPlacement(target)) alert(uiText("restoreFailed"));
        return false;
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
            height: mmToPt(source.h)
        };
    }

    function getReplacementModeData(replacementData, mode) {
        return mode === MODE_2 ? replacementData.mode2 : replacementData.mode1;
    }

    function applyPlacement(item, placement, reference) {
        var placementMatrix;
        var currentTopLeft;

        if (!placement || placement.width <= 0 || placement.height <= 0) {
            return false;
        }

        placementMatrix = buildPlacementMatrix(item, placement, reference);
        if (!placementMatrix) return false;
        try { item.matrix = placementMatrix; } catch (matrixError) { return false; }

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

    function buildPlacementMatrix(item, placement, reference) {
        var sourceSize = getPlacedItemSourceSize(item);
        if (!sourceSize || !reference || !reference.axisX || !reference.axisY ||
                placement.width <= 0 || placement.height <= 0) {
            return null;
        }
        var matrix = app.getIdentityMatrix();
        matrix.mValueA = reference.axisX[0] * placement.width / sourceSize.width;
        matrix.mValueB = -reference.axisX[1] * placement.width / sourceSize.width;
        matrix.mValueC = -reference.axisY[0] * placement.height / sourceSize.height;
        matrix.mValueD = reference.axisY[1] * placement.height / sourceSize.height;
        return matrix;
    }

    function buildReferenceGeometry(maskDescriptor, replacementData, snapshot) {
        var axes = getAxesFromMatrix(snapshot.transformMatrix);
        var baseSize = getReplacementImageSize(replacementData);
        if (!axes || !baseSize || !isValidMaskLocalBounds(replacementData.maskLocalBounds)) return null;
        var topLeft = buildReferenceTopLeftFromMask(
            maskDescriptor,
            axes,
            replacementData.maskLocalBounds
        );
        if (!topLeft) return null;

        return {
            topLeft: topLeft,
            axisX: axes.axisX,
            axisY: axes.axisY,
            baseSize: baseSize
        };
    }

    function getReplacementImageSize(replacementData) {
        if (!replacementData || !replacementData.imageSize) {
            return null;
        }
        if (!isFiniteNumber(replacementData.imageSize.w) || !isFiniteNumber(replacementData.imageSize.h) ||
                Number(replacementData.imageSize.w) <= 0 || Number(replacementData.imageSize.h) <= 0) {
            return null;
        }
        return {
            width: mmToPt(replacementData.imageSize.w),
            height: mmToPt(replacementData.imageSize.h)
        };
    }

    function buildReferenceTopLeftFromMask(maskDescriptor, axes, maskLocalBounds) {
        var segments = getMaskBezierSegments(maskDescriptor);
        var projectedBounds = getBezierBounds(segments, axes);
        var localLeft = mmToPt(maskLocalBounds.left);
        var localTop = mmToPt(maskLocalBounds.top);
        var localRight = mmToPt(maskLocalBounds.right);
        var localBottom = mmToPt(maskLocalBounds.bottom);
        if (!projectedBounds || !boundsDimensionsMatch(
                projectedBounds,
                localRight - localLeft,
                localBottom - localTop
        )) return null;
        var originCoordinateX = projectedBounds.minX - localLeft;
        var originCoordinateY = projectedBounds.minY - localTop;

        return addPoints(
            scalePoint(axes.axisX, originCoordinateX),
            scalePoint(axes.axisY, originCoordinateY)
        );
    }

    function boundsDimensionsMatch(bounds, expectedWidth, expectedHeight) {
        var width = bounds.maxX - bounds.minX;
        var height = bounds.maxY - bounds.minY;
        return Math.abs(width - expectedWidth) <= MASK_BOUNDS_TOLERANCE_PT + Math.max(width, expectedWidth) * 0.000001 &&
            Math.abs(height - expectedHeight) <= MASK_BOUNDS_TOLERANCE_PT + Math.max(height, expectedHeight) * 0.000001;
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
        if (!isValidMaskLocalBounds(replacementData.maskLocalBounds)) {
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
            isFiniteNumber(bounds.bottom) &&
            Number(bounds.right) > Number(bounds.left) &&
            Number(bounds.bottom) > Number(bounds.top);
    }

    function replacementDataMatchesItem(item, replacementData) {
        var expectedUuid = String(replacementData && replacementData.placedItemUuid || "");
        return !expectedUuid || expectedUuid === getItemUuid(item);
    }

    function isFiniteNumber(value) {
        return typeof value === "number" && isFinite(value);
    }

    function getCurrentPlacementSnapshot(item) {
        var matrix = readItemTransformMatrix(item);
        var topLeft = getCurrentItemTopLeft(item);

        if (!matrix || !topLeft) {
            return null;
        }

        return {
            transformMatrix: matrix,
            topLeft: topLeft
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
        if (!currentTopLeft || !snapshot.topLeft) return false;
        return translateItem(
            item,
            snapshot.topLeft[0] - currentTopLeft[0],
            snapshot.topLeft[1] - currentTopLeft[1]
        );
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
        var visited = {};

        for (var i = 0; i < selection.length; i++) {
            collectPlacedItemsFromItem(selection[i], results, seen, visited, 0);
        }

        return results;
    }

    function collectPlacedItemsFromItem(item, results, seen, visited, depth) {
        var key;
        var children;

        if (!item || depth >= 64) return;

        key = getItemSelectionKey(item);
        if (key && visited[key]) return;
        if (key) visited[key] = true;

        if (safeTypename(item) === "PlacedItem") {
            if (key && !seen[key]) {
                results.push(item);
                seen[key] = true;
            }
            return;
        }

        children = getChildPageItems(item);
        for (var i = 0; i < children.length; i++) {
            collectPlacedItemsFromItem(children[i], results, seen, visited, depth + 1);
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

    function getItemUuid(item) {
        if (!item) return "";
        try { return String(item.uuid || ""); } catch (uuidError) { return ""; }
    }

    function findClippingMaskForPlacedItem(item) {
        var found = [];
        var ancestor = null;
        try { ancestor = item.parent; } catch (parentError) { ancestor = null; }
        var depth = 0;
        while (ancestor && depth < 64) {
            if (safeTypename(ancestor) === "GroupItem" && isClippedGroup(ancestor)) {
                found.push(findMaskInDirectChildren(ancestor));
            }
            var next = null;
            try { next = ancestor.parent; } catch (ancestorError) { next = null; }
            if (!next || next === ancestor) break;
            ancestor = next;
            depth++;
        }
        if (!found.length) {
            return {status: "none", reason: uiText("noClippingMask"), group: null, maskRoot: null, paths: []};
        }
        for (var index = 0; index < found.length; index++) {
            if (found[index].status !== "ok") return found[index];
        }
        if (found.length > 1) {
            return {status: "unsupported", reason: uiText("nestedClippingMasks"), group: null, maskRoot: null, paths: []};
        }
        return found[0];
    }

    function findMaskInDirectChildren(group) {
        var roots = [];
        var pageItems = group.pageItems;
        for (var index = 0; index < pageItems.length; index++) {
            var child = pageItems[index];
            if (!hasDirectParent(child, group)) continue;
            var type = safeTypename(child);
            if (type === "PathItem" && isClippingPath(child)) {
                roots.push({root: child, paths: [child]});
            } else if (type === "CompoundPathItem") {
                var compoundPaths = collectCompoundClippingPaths(child);
                if (compoundPaths.length) roots.push({root: child, paths: compoundPaths});
            }
        }
        if (roots.length !== 1) {
            return {
                status: "unsupported",
                reason: roots.length ? uiText("multipleClippingPaths") : uiText("clippingPathUnavailable"),
                group: group,
                maskRoot: null,
                paths: []
            };
        }
        for (var pathIndex = 0; pathIndex < roots[0].paths.length; pathIndex++) {
            if (!isClosedPath(roots[0].paths[pathIndex])) {
                return {
                    status: "unsupported",
                    reason: uiText("openClippingPath"),
                    group: group,
                    maskRoot: roots[0].root,
                    paths: []
                };
            }
        }
        return {
            status: "ok",
            reason: "",
            group: group,
            maskRoot: roots[0].root,
            paths: roots[0].paths
        };
    }

    function collectCompoundClippingPaths(compound) {
        var paths = [];
        var hasClippingFlag = false;
        try {
            for (var index = 0; index < compound.pathItems.length; index++) {
                var path = compound.pathItems[index];
                if (isClippingPath(path)) hasClippingFlag = true;
                paths.push(path);
            }
        } catch (compoundError) { return []; }
        return hasClippingFlag ? paths : [];
    }

    function getMaskBezierSegments(maskDescriptor) {
        var segments = [];
        var paths = maskDescriptor && maskDescriptor.paths ? maskDescriptor.paths : [];
        for (var pathIndex = 0; pathIndex < paths.length; pathIndex++) {
            var path = paths[pathIndex];
            var points = path.pathPoints;
            if (!points || points.length < 2 || !isClosedPath(path)) return [];
            for (var pointIndex = 0; pointIndex < points.length; pointIndex++) {
                var nextIndex = (pointIndex + 1) % points.length;
                var start = readPoint(points[pointIndex].anchor);
                var control1 = readPoint(points[pointIndex].rightDirection);
                var control2 = readPoint(points[nextIndex].leftDirection);
                var end = readPoint(points[nextIndex].anchor);
                if (!start || !control1 || !control2 || !end) return [];
                segments.push([start, control1, control2, end]);
            }
        }
        return segments;
    }

    function getBezierBounds(segments, axes) {
        if (!segments || !segments.length || !axes) return null;
        var result = null;
        for (var index = 0; index < segments.length; index++) {
            var projected = [];
            for (var pointIndex = 0; pointIndex < segments[index].length; pointIndex++) {
                projected.push(projectPointToAxes(segments[index][pointIndex], axes));
            }
            result = mergeBounds(result, getCubicBounds(projected));
        }
        return result;
    }

    function projectPointToAxes(point, axes) {
        var determinant = axes.axisX[0] * axes.axisY[1] - axes.axisX[1] * axes.axisY[0];
        if (Math.abs(determinant) <= GEOMETRY_EPSILON) return [NaN, NaN];
        return [
            (point[0] * axes.axisY[1] - point[1] * axes.axisY[0]) / determinant,
            (axes.axisX[0] * point[1] - axes.axisX[1] * point[0]) / determinant
        ];
    }

    function getCubicBounds(segment) {
        var xParameters = [0, 1];
        var yParameters = [0, 1];
        appendCubicRoots(xParameters, segment[0][0], segment[1][0], segment[2][0], segment[3][0]);
        appendCubicRoots(yParameters, segment[0][1], segment[1][1], segment[2][1], segment[3][1]);
        var xs = [];
        var ys = [];
        var index;
        for (index = 0; index < xParameters.length; index++) {
            xs.push(evaluateCubic(segment[0][0], segment[1][0], segment[2][0], segment[3][0], xParameters[index]));
        }
        for (index = 0; index < yParameters.length; index++) {
            ys.push(evaluateCubic(segment[0][1], segment[1][1], segment[2][1], segment[3][1], yParameters[index]));
        }
        return {minX: arrayMin(xs), maxX: arrayMax(xs), minY: arrayMin(ys), maxY: arrayMax(ys)};
    }

    function appendCubicRoots(values, p0, p1, p2, p3) {
        var a = 3 * (-p0 + 3 * p1 - 3 * p2 + p3);
        var b = 2 * (3 * p0 - 6 * p1 + 3 * p2);
        var c = -3 * p0 + 3 * p1;
        var scale = Math.max(1, Math.abs(a), Math.abs(b), Math.abs(c));
        var epsilon = GEOMETRY_EPSILON * scale;
        if (Math.abs(a) <= epsilon) {
            if (Math.abs(b) > epsilon) appendUnitRoot(values, -c / b);
            return;
        }
        var discriminant = b * b - 4 * a * c;
        if (discriminant < -epsilon * scale) return;
        if (discriminant < 0) discriminant = 0;
        var squareRoot = Math.sqrt(discriminant);
        appendUnitRoot(values, (-b + squareRoot) / (2 * a));
        appendUnitRoot(values, (-b - squareRoot) / (2 * a));
    }

    function appendUnitRoot(values, value) {
        if (!(value > 0 && value < 1)) return;
        for (var index = 0; index < values.length; index++) {
            if (Math.abs(values[index] - value) <= GEOMETRY_EPSILON) return;
        }
        values.push(value);
    }

    function evaluateCubic(p0, p1, p2, p3, t) {
        var inverse = 1 - t;
        return inverse * inverse * inverse * p0 +
            3 * inverse * inverse * t * p1 +
            3 * inverse * t * t * p2 +
            t * t * t * p3;
    }

    function getCurrentItemTopLeft(item) {
        var quad = getPlacedItemQuad(item);
        return quad && quad.length >= 4 ? quad[0] : null;
    }

    function getPlacedItemQuad(item) {
        try {
            var matrix = item.matrix;
            var sourceSize = getPlacedItemSourceSize(item);
            var bounds = readNumberArray(item.geometricBounds, 4);
            if (!matrix || !sourceSize || !bounds) return null;
            var a = readFiniteNumber(matrix.mValueA);
            var b = readFiniteNumber(matrix.mValueB);
            var c = readFiniteNumber(matrix.mValueC);
            var d = readFiniteNumber(matrix.mValueD);
            if (a === null || b === null || c === null || d === null) return null;
            var edgeX = [sourceSize.width * a, sourceSize.width * -b];
            var edgeY = [sourceSize.height * -c, sourceSize.height * d];
            var center = [(bounds[0] + bounds[2]) / 2, (bounds[1] + bounds[3]) / 2];
            var topLeft = subtractPoints(center, scalePoint(addPoints(edgeX, edgeY), 0.5));
            var topRight = addPoints(topLeft, edgeX);
            var bottomLeft = addPoints(topLeft, edgeY);
            return [
                topLeft,
                topRight,
                addPoints(topRight, edgeY),
                bottomLeft
            ];
        } catch (quadError) {
            return null;
        }
    }

    function getPlacedItemSourceSize(item) {
        var box = null;
        try { box = readNumberArray(item.boundingBox, 4); } catch (boundingBoxError) { box = null; }
        if (!box) return null;
        var width = Math.abs(box[2] - box[0]);
        var height = Math.abs(box[1] - box[3]);
        return width > GEOMETRY_EPSILON && height > GEOMETRY_EPSILON
            ? {width: width, height: height}
            : null;
    }

    function getAxesFromMatrix(matrix) {
        if (!matrix) return null;
        var a = readFiniteNumber(matrix.mValueA);
        var b = readFiniteNumber(matrix.mValueB);
        var c = readFiniteNumber(matrix.mValueC);
        var d = readFiniteNumber(matrix.mValueD);
        if (a === null || b === null || c === null || d === null) return null;
        var axisX = normalizeVector([a, -b]);
        var axisY = normalizeVector([-c, d]);
        var determinant = axisX[0] * axisY[1] - axisX[1] * axisY[0];
        if (Math.abs(determinant) <= GEOMETRY_EPSILON) return null;
        return {axisX: axisX, axisY: axisY, determinant: determinant};
    }

    function translateItem(item, dx, dy) {
        try {
            item.translate(dx, dy);
            return true;
        } catch (translateError) {}
        return false;
    }

    function hasDirectParent(item, parent) {
        try { return item.parent === parent; } catch (parentError) { return false; }
    }

    function isClippedGroup(group) {
        try { return group.clipped === true; } catch (clippedError) { return false; }
    }

    function isClippingPath(path) {
        try { return path.clipping === true; } catch (clippingError) { return false; }
    }

    function isClosedPath(path) {
        try { return path.closed === true; } catch (closedError) { return false; }
    }

    function readPoint(value) {
        return readNumberArray(value, 2);
    }

    function readNumberArray(value, minimumLength) {
        if (!value || value.length < minimumLength) return null;
        var result = [];
        for (var index = 0; index < minimumLength; index++) {
            var numberValue = readFiniteNumber(value[index]);
            if (numberValue === null) return null;
            result.push(numberValue);
        }
        return result;
    }

    function readFiniteNumber(value) {
        var numberValue = Number(value);
        return isFinite(numberValue) ? numberValue : null;
    }

    function mergeBounds(first, second) {
        if (!first) return second;
        return {
            minX: Math.min(first.minX, second.minX),
            maxX: Math.max(first.maxX, second.maxX),
            minY: Math.min(first.minY, second.minY),
            maxY: Math.max(first.maxY, second.maxY)
        };
    }

    function arrayMin(values) {
        var result = values[0];
        for (var index = 1; index < values.length; index++) if (values[index] < result) result = values[index];
        return result;
    }

    function arrayMax(values) {
        var result = values[0];
        for (var index = 1; index < values.length; index++) if (values[index] > result) result = values[index];
        return result;
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

    function mmToPt(value) {
        return UnitValue(value, "mm").as("pt");
    }
})();
