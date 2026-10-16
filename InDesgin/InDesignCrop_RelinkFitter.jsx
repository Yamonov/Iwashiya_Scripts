#target indesign

/*
SCRIPTMETA-BEGIN
Script-ID=org.iwashi.InDesignCrop_RelinkFitter
Version=2
Meta-URL=https://github.com/Yamonov/Iwashiya_Scripts/tree/main/InDesgin
Name=Psで処理したXMPを読み取り、正確な位置に配置
Author=Murakami Yoshiteru
Release-Date=2026-08-09
Target-App=InDesign
Edit-Password-SHA256=KQKaYksEnVBdnx7G:dd55774c95f3bacda14e9860dfebf5c4c26c4a2452870c28dc2bb331d7218f7a
Description-BEGIN
Photoshop_InDesignResizeCropで処理した際に追加されるXMPタグを読み込み、2種類の配置方法をプレビューしながら適用します。
リンクが更新されていない場合は、自動更新してから処理します。
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
            ja: "リンク画像を含む画像フレームを選択してください。",
            en: "Select an image frame that contains a linked image."
        },
        undoName: {
            ja: "XMP配置情報で再配置",
            en: "Reposition from XMP Placement Data"
        },
        noXmpPlacedItem: {
            ja: "XMP配置情報を持つリンク画像が見つかりませんでした。",
            en: "No linked image with XMP placement data was found."
        },
        multipleFramesSelected: {
            ja: "複数の画像フレームが選択されています。1つだけ選択してください。",
            en: "Multiple image frames are selected. Select only one."
        },
        noXmpOnSelectedImage: {
            ja: "選択画像から XMP 配置情報が見つかりませんでした。",
            en: "No XMP placement data was found in the selected image."
        },
        currentPlacementUnavailable: {
            ja: "現在の配置情報を取得できませんでした。",
            en: "Could not get the current placement information."
        },
        dialogTitle: {
            ja: "XMP配置で再配置",
            en: "Reposition from XMP Placement"
        },
        mode1Base: {
            ja: "1：単純に伸ばしただけのものを配置",
            en: "1: Place the simply extended image"
        },
        mode2Base: {
            ja: "2：食い込み分をトリム処理したものを配置",
            en: "2: Place the image with the overlap trimmed"
        },
        modePanelTitle: {
            ja: "元のトリミングに合わせて配置",
            en: "Place to match the original crop"
        },
        trimmedMaskHint: {
            ja: "※ Photoshopで食い込み分をトリミングしている場合は、2：を選んでください。",
            en: "If the overlap was trimmed in Photoshop, choose 2."
        },
        cancelButton: {
            ja: "キャンセル",
            en: "Cancel"
        },
        optionWithScale: {
            ja: "{base}（{scale}）",
            en: "{base} ({scale})"
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
        xmpDataInvalid: {
            ja: "XMP 配置情報が不足しているか壊れています。Photoshop側で処理し直してください。",
            en: "XMP placement data is missing required fields or is corrupted. Process the image again on the Photoshop side."
        },
        missingLink: {
            ja: "リンク切れ画像です。InDesignのリンクパネルを確認してください。",
            en: "The linked image is missing. Check InDesign's Links panel."
        },
        modifiedLink: {
            ja: "リンクが更新されていません。InDesignのリンクパネルを更新してから実行してください。",
            en: "The link has not been updated. Update it in InDesign's Links panel, then run this script again."
        },
        linkUpdateFailed: {
            ja: "リンクを自動更新できませんでした。InDesignのリンクパネルを確認してください。",
            en: "The link could not be updated automatically. Check InDesign's Links panel."
        },
        placementFailed: {
            ja: "画像の再配置に失敗しました。",
            en: "Could not reposition the image."
        },
        placementRestoreFailed: {
            ja: "画像を元の配置に戻せませんでした。「取り消し」で配置を確認してください。",
            en: "Could not restore the original placement. Use Undo and check the image placement."
        }
    };

    var MODE_1 = "mode1";
    var MODE_2 = "mode2";
    var SCALE_DIFF_THRESHOLD = 0.5;
    var NO_SCALE_TEXT = uiText("noScale");
    var XMP_NAMESPACE_URI = "http://ns.yamo.jp/photoshop/crop-replacement-data/1.0/";
    var XMP_PREFIX = "yamoCrop:";
    var XMP_PROPERTY = "PhotoshopCrop_ReplacementData";
    var REPLACEMENT_DATA_VERSION = 1;
    var REPLACEMENT_DATA_UNIT = "mm";

    if (app.documents.length === 0) {
        alert(uiText("noDocument"));
        return;
    }

    if (app.selection.length === 0) {
        alert(uiText("selectionRequired"));
        return;
    }

    app.doScript(
        function () {
            main();
        },
        ScriptLanguage.JAVASCRIPT,
        undefined,
        UndoModes.ENTIRE_SCRIPT,
        uiText("undoName")
    );

    function main() {
        var originalUnit = app.scriptPreferences.measurementUnit;
        var preparedTarget = null;

        try {
            app.scriptPreferences.measurementUnit = MeasurementUnits.POINTS;

            preparedTarget = prepareTarget(app.selection);
            if (!preparedTarget.target) {
                alert(preparedTarget.message || uiText("noXmpPlacedItem"));
                return;
            }

            showPreviewDialog(preparedTarget.target);
        } catch (error) {
            alert(String(error.message || error));
        } finally {
            app.scriptPreferences.measurementUnit = originalUnit;
        }
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
        var graphics = collectSelectedGraphics(selection);
        var target = null;

        if (graphics.length === 0) {
            return {
                target: null,
                message: uiText("selectionRequired")
            };
        }

        if (graphics.length > 1) {
            return {
                target: null,
                message: uiText("multipleFramesSelected")
            };
        }

        target = buildPreparedTarget(graphics[0].frame, graphics[0].graphic);
        if (!target.target) {
            return target;
        }

        return target;
    }

    function buildPreparedTarget(frame, graphic) {
        var linkPreparation = ensureGraphicLinkIsCurrent(frame, graphic);
        var replacementReadResult;
        var replacementData;
        var replacementValidationMessage;
        var originalSnapshot;

        if (linkPreparation.message) {
            return {
                target: null,
                message: linkPreparation.message
            };
        }

        frame = linkPreparation.frame;
        graphic = linkPreparation.graphic;

        replacementReadResult = readReplacementDataFromGraphic(graphic);
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

        originalSnapshot = getCurrentPlacementSnapshot(frame, graphic);
        if (!originalSnapshot) {
            return {
                target: null,
                message: uiText("currentPlacementUnavailable")
            };
        }

        return {
            target: {
                frame: frame,
                graphic: graphic,
                originalPlacement: originalSnapshot.placement,
                originalTransformSnapshot: originalSnapshot,
                replacementData: replacementData
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
        var previewSucceeded = false;
        var previewError = null;
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
        buttonGroup.add("button", undefined, "OK", { name: "ok" });
        buttonGroup.add("button", undefined, uiText("cancelButton"), { name: "cancel" });

        function updatePreview(mode) {
            previewSucceeded = false;
            try {
                if (!restoreOriginalPlacement(target)) {
                    throw new Error(uiText("placementRestoreFailed"));
                }
                if (!applyReplacementMode(target, mode)) {
                    throw new Error(uiText("placementFailed"));
                }
                selectedMode = mode;
                previewSucceeded = true;
            } catch (error) {
                previewError = error;
                dialog.close(0);
                return;
            }
            try {
                app.refresh();
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

        try {
            var result = dialog.show();
            if (previewError) throw previewError;
            accepted = result === 1 && previewSucceeded;
        } finally {
            if (!accepted && !restoreOriginalPlacement(target)) {
                throw new Error(uiText("placementRestoreFailed"));
            }
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
        var baseSize;
        var targetScale;
        var modePlacement = buildModePlacementInPoints(target, mode);
        if (!modePlacement) {
            return null;
        }

        baseSize = estimateResetSize(target.originalPlacement);
        if (!baseSize) {
            return null;
        }

        targetScale = buildTargetScale(baseSize, modePlacement);

        if (Math.abs(targetScale.x - targetScale.y) <= SCALE_DIFF_THRESHOLD) {
            return NO_SCALE_TEXT;
        }

        return formatScaleLabelValue(targetScale.x) + "×" + formatScaleLabelValue(targetScale.y) + "%";
    }

    function buildModePlacementInPoints(target, mode) {
        var source = getReplacementModeData(target.replacementData, mode);
        if (!source) {
            return null;
        }

        return {
            leftTopX: mmToPt(source.x),
            leftTopY: mmToPt(source.y),
            width: mmToPt(source.w),
            height: mmToPt(source.h),
            rotation: source.rotation !== undefined ? source.rotation : target.replacementData.rotation
        };
    }

    function getReplacementModeData(replacementData, mode) {
        return mode === MODE_2 ? replacementData.mode2 : replacementData.mode1;
    }

    function estimateResetSize(placement) {
        var horizontalScale = Math.abs(Number(placement.horizontalScale));
        var verticalScale = Math.abs(Number(placement.verticalScale));
        if (!horizontalScale || !verticalScale) {
            return null;
        }

        return {
            width: placement.width * 100 / horizontalScale,
            height: placement.height * 100 / verticalScale
        };
    }

    function formatScaleLabelValue(value) {
        var rounded = Math.round(value * 10) / 10;
        if (Math.abs(rounded - Math.round(rounded)) < 0.05) {
            return String(Math.round(rounded));
        }
        return rounded.toFixed(1);
    }

    function restoreOriginalPlacement(target) {
        return restoreTransformSnapshot(target.graphic, target.originalTransformSnapshot);
    }

    function applyReplacementMode(target, mode) {
        var placement = buildModePlacementInPoints(target, mode);
        if (!placement) {
            return false;
        }

        return applyPlacementInPoints(target.frame, target.graphic, placement);
    }

    function applyPlacementInPoints(frame, graphic, placement) {
        var frameCorners = getRectangleCornerPoints(frame);
        var currentSize;
        var targetScale;
        var targetTL;
        var currentCorners;
        if (!frameCorners || !placement) {
            return false;
        }

        var frameTL = frameCorners.topLeft;
        var frameTR = frameCorners.topRight;
        var frameBL = frameCorners.bottomLeft;

        if (!resetGraphicPlacement(frame, graphic, frameTL)) {
            return false;
        }

        targetTL = convertFrameSpaceToSpreadPoint(placement.leftTopX, placement.leftTopY, frameTL, frameTR, frameBL);
        currentSize = getItemSize(graphic);
        if (!currentSize || currentSize.width === 0 || currentSize.height === 0) {
            return false;
        }

        targetScale = buildTargetScale(currentSize, {
            width: placement.width,
            height: placement.height
        });

        try {
            graphic.rotationAngle = placement.rotation;
        } catch (e) {
            return false;
        }

        if (!applyGraphicScale(graphic, targetScale)) {
            return false;
        }

        currentCorners = getRectangleCornerPoints(graphic);
        if (!currentCorners) {
            return false;
        }

        return translateItem(
            graphic,
            targetTL[0] - currentCorners.topLeft[0],
            targetTL[1] - currentCorners.topLeft[1]
        );
    }

    function buildTargetScale(currentSize, targetSize) {
        var scaleX = targetSize.width / currentSize.width * 100;
        var scaleY = targetSize.height / currentSize.height * 100;
        var maxScale;

        if (Math.abs(scaleX - scaleY) > SCALE_DIFF_THRESHOLD) {
            return {
                x: scaleX,
                y: scaleY
            };
        }

        maxScale = Math.max(scaleX, scaleY);
        return {
            x: maxScale,
            y: maxScale
        };
    }

    function applyGraphicScale(graphic, targetScale) {
        if (!isFiniteNumber(targetScale.x) || !isFiniteNumber(targetScale.y) || targetScale.x <= 0 || targetScale.y <= 0) {
            return false;
        }
        try {
            graphic.horizontalScale = targetScale.x;
            graphic.verticalScale = targetScale.y;
            return true;
        } catch (e) {}

        return false;
    }

    function resetGraphicPlacement(frame, graphic, frameTL) {
        try {
            graphic.clearTransformations();
        } catch (e) {
            return false;
        }

        try {
            frame.fit(FitOptions.CENTER_CONTENT);
        } catch (e6) {
            return false;
        }

        var currentCorners = getRectangleCornerPoints(graphic);
        if (!currentCorners) {
            return false;
        }

        return translateItem(
            graphic,
            frameTL[0] - currentCorners.topLeft[0],
            frameTL[1] - currentCorners.topLeft[1]
        );
    }

    function readReplacementDataFromGraphic(graphic) {
        var link = getGraphicLink(graphic);
        var xmpFile = null;
        var xmpMeta = null;
        var xmpValue = null;
        var parsedData = null;

        if (!link) {
            return {
                data: null,
                message: uiText("selectionRequired")
            };
        }

        try {
            loadXMPLibrary();
            XMPMeta.registerNamespace(XMP_NAMESPACE_URI, XMP_PREFIX);
            xmpFile = new XMPFile(File(link.filePath).fsName, XMPConst.UNKNOWN, XMPConst.OPEN_FOR_READ);
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

        if (typeof JSON !== "undefined" && JSON && typeof JSON.parse === "function") {
            try {
                return JSON.parse(text);
            } catch (e) {
                return null;
            }
        }

        // JSONのないExtendScript環境でも、外部ファイルの値をコードとして実行しない。
        var position = 0;
        function skipWhitespace() {
            while (position < text.length && /[\x20\t\r\n]/.test(text.charAt(position))) position++;
        }
        function readString() {
            var match = /^"((?:[^"\\\x00-\x1f]|\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4}))*)"/.exec(text.substring(position));
            if (!match) throw new Error("Invalid JSON string");
            position += match[0].length;
            return match[1].replace(/\\(["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, function (escape, value) {
                var escapes = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
                return value.charAt(0) === "u" ? String.fromCharCode(parseInt(value.substring(1), 16)) : escapes[value];
            });
        }
        function readValue(depth) {
            if (depth > 64) throw new Error("JSON nesting is too deep");
            skipWhitespace();
            var token = text.charAt(position);
            var result;
            var key;
            if (token === '"') return readString();
            if (token === "{" || token === "[") {
                var isObject = token === "{";
                var end = isObject ? "}" : "]";
                result = isObject ? {} : [];
                position++;
                skipWhitespace();
                if (text.charAt(position) === end) {
                    position++;
                    return result;
                }
                while (position < text.length) {
                    skipWhitespace();
                    if (isObject) {
                        key = readString();
                        if (key === "__proto__") throw new Error("Invalid JSON key");
                        skipWhitespace();
                        if (text.charAt(position++) !== ":") throw new Error("Expected colon");
                        result[key] = readValue(depth + 1);
                    } else {
                        result.push(readValue(depth + 1));
                    }
                    skipWhitespace();
                    token = text.charAt(position++);
                    if (token === end) return result;
                    if (token !== ",") throw new Error("Expected comma");
                }
                throw new Error("Unterminated JSON value");
            }
            var literal = /^(true|false|null)/.exec(text.substring(position));
            if (literal) {
                position += literal[0].length;
                return literal[0] === "null" ? null : literal[0] === "true";
            }
            var number = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(text.substring(position));
            if (!number) throw new Error("Invalid JSON value");
            position += number[0].length;
            return Number(number[0]);
        }
        try {
            var parsed = readValue(0);
            skipWhitespace();
            return position === text.length ? parsed : null;
        } catch (e2) {}

        return null;
    }

    function validateReplacementData(replacementData) {
        if (!replacementData || typeof replacementData !== "object" || replacementData instanceof Array) {
            return uiText("noXmpOnSelectedImage");
        }
        if (replacementData.version !== REPLACEMENT_DATA_VERSION) {
            return uiText("unsupportedXmpVersion");
        }
        if (String(replacementData.unit || "") !== REPLACEMENT_DATA_UNIT) {
            return uiText("unsupportedXmpUnit");
        }
        if (!isValidReplacementMode(replacementData.mode1) || !isValidReplacementMode(replacementData.mode2)) {
            return uiText("xmpDataInvalid");
        }
        if (!isFiniteNumber(replacementData.mode1.rotation !== undefined ? replacementData.mode1.rotation : replacementData.rotation) ||
            !isFiniteNumber(replacementData.mode2.rotation !== undefined ? replacementData.mode2.rotation : replacementData.rotation)) {
            return uiText("xmpDataInvalid");
        }
        return "";
    }

    function isValidReplacementMode(mode) {
        return mode && typeof mode === "object" && !(mode instanceof Array) &&
            isFiniteNumber(mode.x) &&
            isFiniteNumber(mode.y) &&
            isFiniteNumber(mode.w) &&
            isFiniteNumber(mode.h) && mode.w > 0 && mode.h > 0;
    }

    function isFiniteNumber(value) {
        return typeof value === "number" && isFinite(value);
    }

    function getCurrentPlacementSnapshot(frame, graphic) {
        var placement = getCurrentPlacementInfo(frame, graphic);
        var matrix = readGraphicTransformMatrix(graphic);
        if (!placement || !matrix) {
            return null;
        }
        return {
            placement: placement,
            transformMatrix: matrix
        };
    }

    function readGraphicTransformMatrix(graphic) {
        try {
            var values = graphic.transformValuesOf(CoordinateSpaces.SPREAD_COORDINATES);
            if (values && values.length > 0) {
                var matrix = values[0].matrixValues;
                if (!matrix || matrix.length !== 6) return null;
                for (var i = 0; i < matrix.length; i++) {
                    if (!isFiniteNumber(matrix[i])) return null;
                }
                return matrix.slice(0);
            }
        } catch (e) {}
        return null;
    }

    function restoreTransformSnapshot(graphic, snapshot) {
        if (!snapshot || !snapshot.transformMatrix) {
            return false;
        }
        try {
            graphic.transform(
                CoordinateSpaces.SPREAD_COORDINATES,
                [0, 0],
                snapshot.transformMatrix,
                [MatrixContent.SCALE_VALUES, MatrixContent.SHEAR_VALUE, MatrixContent.ROTATION_VALUE, MatrixContent.TRANSLATION_VALUES],
                false
            );
            return true;
        } catch (e) {}
        return false;
    }

    function getCurrentPlacementInfo(frame, graphic) {
        var graphicSize = getItemSize(graphic);
        var frameCorners = getRectangleCornerPoints(frame);
        var graphicCorners = getRectangleCornerPoints(graphic);
        var scale = getGraphicScaleInfo(graphic);

        if (!graphicSize || !frameCorners || !graphicCorners) {
            return null;
        }

        var localTL = convertPointToFrameSpace(
            graphicCorners.topLeft,
            frameCorners.topLeft,
            frameCorners.topRight,
            frameCorners.bottomLeft
        );
        if (!localTL) return null;

        return {
            leftTopX: localTL.x,
            leftTopY: localTL.y,
            width: graphicSize.width,
            height: graphicSize.height,
            rotation: getGraphicRotation(graphic),
            horizontalScale: scale.horizontal,
            verticalScale: scale.vertical
        };
    }

    function getGraphicRotation(graphic) {
        try {
            return Number(graphic.rotationAngle) || 0;
        } catch (e) {}
        return 0;
    }

    function getGraphicScaleInfo(graphic) {
        return {
            horizontal: readGraphicScaleValue(graphic, "horizontalScale", "absoluteHorizontalScale"),
            vertical: readGraphicScaleValue(graphic, "verticalScale", "absoluteVerticalScale")
        };
    }

    function readGraphicScaleValue(graphic, primaryProperty, fallbackProperty) {
        try {
            return Number(graphic[primaryProperty]) || 100;
        } catch (e) {}

        try {
            return Number(graphic[fallbackProperty]) || 100;
        } catch (e2) {}

        return 100;
    }

    function ensureGraphicLinkIsCurrent(frame, graphic) {
        var link = getGraphicLink(graphic);
        var updatedLink = null;
        var refreshedTarget = null;

        if (!link) {
            return createLinkPreparationResult(null, null, uiText("selectionRequired"));
        }
        try {
            if (link.status === LinkStatus.NORMAL) {
                return createLinkPreparationResult(frame, graphic, "");
            }
            if (link.status === LinkStatus.LINK_MISSING) {
                return createLinkPreparationResult(null, null, uiText("missingLink"));
            }
            if (link.status === LinkStatus.LINK_OUT_OF_DATE) {
                try {
                    updatedLink = link.update();
                    refreshedTarget = resolveGraphicAfterLinkUpdate(frame, graphic, updatedLink);
                    if (refreshedTarget && getGraphicLink(refreshedTarget.graphic).status === LinkStatus.NORMAL) {
                        return createLinkPreparationResult(
                            refreshedTarget.frame,
                            refreshedTarget.graphic,
                            ""
                        );
                    }
                    return createLinkPreparationResult(null, null, uiText("linkUpdateFailed"));
                } catch (updateError) {
                    refreshedTarget = resolveGraphicAfterLinkUpdate(frame, graphic, updatedLink);
                    if (refreshedTarget) {
                        link = getGraphicLink(refreshedTarget.graphic);
                    }
                    if (refreshedTarget && link) {
                        try {
                            if (link.status === LinkStatus.NORMAL) {
                                return createLinkPreparationResult(
                                    refreshedTarget.frame,
                                    refreshedTarget.graphic,
                                    ""
                                );
                            }
                            if (link.status === LinkStatus.LINK_MISSING) {
                                return createLinkPreparationResult(null, null, uiText("missingLink"));
                            }
                        } catch (updatedStatusError) {}
                    }
                    return createLinkPreparationResult(null, null, uiText("linkUpdateFailed"));
                }
            }
        } catch (e) {}
        return createLinkPreparationResult(null, null, uiText("modifiedLink"));
    }

    function createLinkPreparationResult(frame, graphic, message) {
        return {
            frame: frame,
            graphic: graphic,
            message: message
        };
    }

    function resolveGraphicAfterLinkUpdate(frame, previousGraphic, updatedLink) {
        var graphic = getGraphicFromLink(updatedLink);
        var refreshedFrame = null;

        if (!graphic) {
            graphic = getGraphicFromSelection(frame);
        }
        if (!graphic && getGraphicLink(previousGraphic)) {
            graphic = previousGraphic;
        }
        if (!graphic || !getGraphicLink(graphic)) {
            return null;
        }

        refreshedFrame = getGraphicFrame(graphic);
        if (!refreshedFrame) {
            try {
                if (frame && frame.isValid) {
                    refreshedFrame = frame;
                }
            } catch (e) {}
        }
        if (!refreshedFrame) {
            return null;
        }

        return {
            frame: refreshedFrame,
            graphic: graphic
        };
    }

    function getGraphicFromLink(link) {
        var graphic = null;

        try {
            if (link && link.isValid && link.parent && link.parent.isValid) {
                graphic = link.parent;
            }
        } catch (e) {}

        if (graphic && getGraphicLink(graphic)) {
            return graphic;
        }

        return null;
    }

    function getGraphicLink(graphic) {
        try {
            if (graphic.itemLink && graphic.itemLink.isValid) {
                return graphic.itemLink;
            }
        } catch (e) {}
        return null;
    }

    function collectSelectedGraphics(selection) {
        var results = [];
        var seen = {};

        for (var i = 0; i < selection.length; i++) {
            var candidates = getGraphicsFromSelection(selection[i]);
            for (var j = 0; j < candidates.length; j++) {
                var candidate = candidates[j];
                var key = getGraphicSelectionKey(candidate);
                if (!key || seen[key]) continue;
                if (!appendSelectedGraphicResult(results, candidate)) continue;
                seen[key] = true;
            }
        }

        return results;
    }

    function appendSelectedGraphicResult(results, candidate) {
        var frame = getGraphicFrame(candidate);
        var link = getGraphicLink(candidate);
        if (!frame || !link) {
            return false;
        }

        results.push({
            frame: frame,
            graphic: candidate
        });

        return true;
    }

    function getGraphicFromSelection(item) {
        var graphics = getGraphicsFromSelection(item);
        return graphics.length === 1 ? graphics[0] : null;
    }

    function getGraphicsFromSelection(item) {
        // graphics[0]などから取得した参照は、具体的な型名ではなくGraphicを返すことがある。
        if (getGraphicLink(item)) {
            return [item];
        }

        try {
            if (item.allGraphics && item.allGraphics.length > 0) {
                return item.allGraphics;
            }
        } catch (e2) {}

        try {
            if (item.graphics && item.graphics.length > 0) {
                return item.graphics.everyItem().getElements();
            }
        } catch (e3) {}

        return [];
    }

    function getGraphicFrame(graphic) {
        try {
            if (graphic.parent && graphic.parent.isValid) {
                return graphic.parent;
            }
        } catch (e) {}

        return null;
    }

    function getGraphicSelectionKey(item) {
        try {
            if (item.id !== undefined) {
                return String(item.id);
            }
        } catch (e) {}

        try {
            if (item.toSpecifier) {
                return item.toSpecifier();
            }
        } catch (e2) {}

        return null;
    }

    function translateItem(item, dx, dy) {
        try {
            item.move(undefined, [dx, dy]);
            return true;
        } catch (e) {}

        try {
            var matrix = app.transformationMatrices.add({
                horizontalTranslation: dx,
                verticalTranslation: dy
            });
            item.transform(CoordinateSpaces.SPREAD_COORDINATES, AnchorPoint.TOP_LEFT_ANCHOR, matrix);
            return true;
        } catch (e2) {}

        return false;
    }

    function getItemSize(item) {
        var corners = getRectangleCornerPoints(item);
        if (!corners) {
            return null;
        }

        var width = distance(corners.topLeft, corners.topRight);
        var height = distance(corners.topLeft, corners.bottomLeft);
        return isFiniteNumber(width) && isFiniteNumber(height) && width > 0 && height > 0 ? {width: width, height: height} : null;
    }

    function getRectangleCornerPoints(item) {
        var pointSet = collectRectanglePointSet(item);
        if (!pointSet) {
            return null;
        }

        return {
            topLeft: pointSet.spreadPoints[pointSet.pointIndexMap.topLeft],
            topRight: pointSet.spreadPoints[pointSet.pointIndexMap.topRight],
            bottomRight: pointSet.spreadPoints[pointSet.pointIndexMap.bottomRight],
            bottomLeft: pointSet.spreadPoints[pointSet.pointIndexMap.bottomLeft]
        };
    }

    function collectRectanglePointSet(item) {
        var localPoints = getRectanglePoints(item, CoordinateSpaces.INNER_COORDINATES);
        var spreadPoints = getRectanglePoints(item, CoordinateSpaces.SPREAD_COORDINATES);
        if (!localPoints || !spreadPoints || localPoints.length < 4 || spreadPoints.length < 4) {
            return null;
        }

        return {
            localPoints: localPoints,
            spreadPoints: spreadPoints,
            pointIndexMap: findRectanglePointIndices(localPoints)
        };
    }

    function getRectanglePoints(item, coordinateSpace) {
        var anchors = [
            AnchorPoint.TOP_LEFT_ANCHOR,
            AnchorPoint.TOP_RIGHT_ANCHOR,
            AnchorPoint.BOTTOM_RIGHT_ANCHOR,
            AnchorPoint.BOTTOM_LEFT_ANCHOR
        ];
        var points = [];

        for (var i = 0; i < anchors.length; i++) {
            var point = resolvePoint(item, anchors[i], coordinateSpace);
            if (!point) {
                return null;
            }
            points.push(point);
        }

        return points;
    }

    function findRectanglePointIndices(points) {
        var topLeft = 0;
        var topRight = 1;
        var bottomLeft = 3;
        var bestTopLeftScore = null;
        var bestTopRightScore = null;
        var bestBottomLeftScore = null;

        for (var i = 0; i < points.length; i++) {
            var point = points[i];
            var topLeftScore = point[0] + point[1];
            var topRightScore = point[0] - point[1];
            var bottomLeftScore = point[1] - point[0];

            if (bestTopLeftScore === null || topLeftScore < bestTopLeftScore) {
                bestTopLeftScore = topLeftScore;
                topLeft = i;
            }
            if (bestTopRightScore === null || topRightScore > bestTopRightScore) {
                bestTopRightScore = topRightScore;
                topRight = i;
            }
            if (bestBottomLeftScore === null || bottomLeftScore > bestBottomLeftScore) {
                bestBottomLeftScore = bottomLeftScore;
                bottomLeft = i;
            }
        }

        return {
            topLeft: topLeft,
            topRight: topRight,
            bottomRight: findBottomRightIndex(points.length, topLeft, topRight, bottomLeft),
            bottomLeft: bottomLeft
        };
    }

    function findBottomRightIndex(pointCount, topLeft, topRight, bottomLeft) {
        for (var i = 0; i < pointCount; i++) {
            if (i !== topLeft && i !== topRight && i !== bottomLeft) {
                return i;
            }
        }

        return 2;
    }

    function resolvePoint(item, anchorPoint, coordinateSpace) {
        var targetSpace = coordinateSpace || CoordinateSpaces.SPREAD_COORDINATES;

        try {
            return toNumberPoint(item.resolve(anchorPoint, targetSpace, false));
        } catch (e) {}

        try {
            return toNumberPoint(item.resolve([anchorPoint, BoundingBoxLimits.GEOMETRIC_PATH_BOUNDS], targetSpace, false));
        } catch (e2) {}

        return null;
    }

    function toNumberPoint(value) {
        if (value instanceof Array) {
            if (value.length === 2 && !(value[0] instanceof Array)) {
                var x = Number(value[0]);
                var y = Number(value[1]);
                return isFiniteNumber(x) && isFiniteNumber(y) ? [x, y] : null;
            }
            if (value.length > 0) {
                return toNumberPoint(value[0]);
            }
        }

        return null;
    }

    function convertPointToFrameSpace(point, frameTL, frameTR, frameBL) {
        var xAxis = normalizeVector(subtractPoints(frameTR, frameTL));
        var yAxis = normalizeVector(subtractPoints(frameBL, frameTL));
        var vector = subtractPoints(point, frameTL);
        var determinant = xAxis[0] * yAxis[1] - xAxis[1] * yAxis[0];
        if (Math.abs(determinant) < 0.0000000001) return null;

        return {
            x: (vector[0] * yAxis[1] - vector[1] * yAxis[0]) / determinant,
            y: (xAxis[0] * vector[1] - xAxis[1] * vector[0]) / determinant
        };
    }

    function convertFrameSpaceToSpreadPoint(x, y, frameTL, frameTR, frameBL) {
        var xAxis = normalizeVector(subtractPoints(frameTR, frameTL));
        var yAxis = normalizeVector(subtractPoints(frameBL, frameTL));

        return [
            frameTL[0] + xAxis[0] * x + yAxis[0] * y,
            frameTL[1] + xAxis[1] * x + yAxis[1] * y
        ];
    }

    function subtractPoints(p1, p2) {
        return [p1[0] - p2[0], p1[1] - p2[1]];
    }

    function normalizeVector(vector) {
        var length = Math.sqrt(vector[0] * vector[0] + vector[1] * vector[1]);
        if (length === 0) {
            return [0, 0];
        }

        return [vector[0] / length, vector[1] / length];
    }

    function distance(p1, p2) {
        var dy = p2[0] - p1[0];
        var dx = p2[1] - p1[1];
        return Math.sqrt(dx * dx + dy * dy);
    }

    function mmToPt(value) {
        return UnitValue(value, "mm").as("pt");
    }
})();
