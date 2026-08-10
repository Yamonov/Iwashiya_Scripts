#target illustrator

/*

SCRIPTMETA-BEGIN
Script-ID=org.iwashi.textframewidthchanger
Version=1
Name=テキストフレーム幅を文字サイズの倍数に
Author=Murakami Yoshiteru
Target-App=Illustrator
Description=実行時とカーソル左右の操作で、テキストフレームの幅をフォントサイズの倍数に整えます。
SCRIPTMETA-END

*/

// Resize Area Text Width to a Multiple of the Font Size
// テキスト枠幅を文字サイズの倍数に調整
//
// 横組み・1段のエリア内文字が対象です。
// 選択範囲またはテキストフレームの先頭文字から文字サイズを取得します。
// 起動時に、枠の内側幅を最も近い文字サイズの倍数に合わせます。
// ScriptUIの←／→で、1倍分ずつ縮小／拡大します。
// カーソル左右でも操作でき、Esc／Return／Enterで閉じます。

(function () {
    var SCRIPT_NAME = "テキスト枠幅を文字サイズの倍数に調整";
    var CONTROLLER_TITLE = "文字サイズ倍数";
    var SIZE_TOLERANCE = 0.001;
    var POINTS_PER_INCH = 72;
    var MILLIMETERS_PER_INCH = 25.4;
    var INFO_TEXT_WIDTH = 260;
    var INFO_TEXT_HEIGHT = 16;
    var INFO_FONT_SIZE = 10;

    if (app.documents.length === 0) {
        alert("ドキュメントを開いてください", SCRIPT_NAME);
        return;
    }

    var target = getTarget(app.activeDocument);
    if (target.error) {
        alert(target.error, SCRIPT_NAME);
        return;
    }

    var frame = target.frame;
    var range = target.range;

    if (frame.kind !== TextType.AREATEXT) {
        alert("横組みのエリア内文字を1つ選択してください", SCRIPT_NAME);
        return;
    }

    if (frame.orientation !== TextOrientation.HORIZONTAL) {
        alert("縦組みには対応していません。横組みのエリア内文字を選択してください", SCRIPT_NAME);
        return;
    }

    if (getColumnCount(frame) !== 1) {
        alert("複数段のテキストフレームには対応していません", SCRIPT_NAME);
        return;
    }

    if (isThreaded(frame)) {
        alert("連結されたテキストフレームには対応していません", SCRIPT_NAME);
        return;
    }

    var sizeResult = getFirstEffectiveCharacterSize(range);
    if (sizeResult.error) {
        alert(sizeResult.error, SCRIPT_NAME);
        return;
    }

    // 枠内余白を除いた幅を、文字サイズの最も近い整数倍にする。
    // 有効文字サイズには水平比率を反映する。
    var insetSpacing = getInsetSpacing(frame);
    var innerWidth = Number(frame.width) - insetSpacing * 2;

    if (!isFinite(innerWidth) || innerWidth <= 0) {
        alert("現在のテキスト枠の幅を取得できませんでした", SCRIPT_NAME);
        return;
    }

    var currentMultiple = Math.max(1, Math.round(innerWidth / sizeResult.size));

    try {
        // ダイアログを表示する前に、最寄りの文字サイズ倍数へ調整する。
        setFrameToMultiple(frame, currentMultiple, sizeResult.size, insetSpacing);
        app.redraw();
    } catch (e) {
        alert("テキスト枠の幅を変更できませんでした\n" + e, SCRIPT_NAME);
        return;
    }

    showController(
        frame,
        currentMultiple,
        sizeResult.size,
        insetSpacing,
        sizeResult.fontSize,
        getCurrentTextUnit()
    );

    function showController(textFrame, initialMultiple, unitSize, spacing, fontSize, textUnit) {
        var multiple = initialMultiple;
        var win = new Window(
            "dialog",
            CONTROLLER_TITLE,
            undefined,
            { closeButton: true, maximizeButton: false, minimizeButton: false }
        );
        // 表示するUIと0×0のキー入力用部品を重ね、見えない部品が
        // 横方向の配置に影響しないようにする。
        win.orientation = "stack";
        win.alignChildren = ["center", "center"];
        win.spacing = 0;
        win.margins = 14;

        var contentGroup = win.add("group");
        contentGroup.orientation = "column";
        contentGroup.alignChildren = ["center", "top"];
        contentGroup.alignment = ["center", "center"];
        contentGroup.spacing = 8;
        contentGroup.margins = 0;

        var buttonGroup = contentGroup.add("group");
        buttonGroup.orientation = "row";
        buttonGroup.alignChildren = ["center", "center"];
        buttonGroup.alignment = ["center", "center"];
        buttonGroup.spacing = 10;
        buttonGroup.margins = 0;

        var decreaseButton = buttonGroup.add("button", undefined, "←");
        var increaseButton = buttonGroup.add("button", undefined, "→");

        var infoGroup = contentGroup.add("group");
        infoGroup.orientation = "column";
        infoGroup.alignChildren = ["left", "top"];
        infoGroup.alignment = ["center", "top"];
        infoGroup.spacing = 2;
        infoGroup.margins = 0;

        var fontSizeText = infoGroup.add("statictext", undefined, "文字サイズ：");
        var frameSizeText = infoGroup.add("statictext", undefined, "フレームサイズ：");
        fontSizeText.preferredSize = [INFO_TEXT_WIDTH, INFO_TEXT_HEIGHT];
        frameSizeText.preferredSize = [INFO_TEXT_WIDTH, INFO_TEXT_HEIGHT];
        setSmallFont(fontSizeText);
        setSmallFont(frameSizeText);

        // 初期状態で表示ボタンをフォーカスせずにキー入力を受け取るための
        // 表示領域0×0のボタン。画面上には表示されない。
        var keyFocusReceiver = win.add("button", [0, 0, 0, 0], "");
        // Return／EnterとEscをScriptUI標準の方法で受け取るためのボタン。
        var returnCloseButton = win.add("button", [0, 0, 0, 0], "", { name: "ok" });
        var escapeCloseButton = win.add("button", [0, 0, 0, 0], "", { name: "cancel" });
        decreaseButton.preferredSize = [72, 36];
        increaseButton.preferredSize = [72, 36];
        decreaseButton.helpTip = "テキスト枠を1文字サイズ分縮める";
        increaseButton.helpTip = "テキスト枠を1文字サイズ分伸ばす";

        returnCloseButton.onClick = function () {
            win.close(1);
        };
        escapeCloseButton.onClick = function () {
            win.close(0);
        };
        win.defaultElement = returnCloseButton;
        win.cancelElement = escapeCloseButton;

        // カーソル左右で幅を変更し、Esc／Return／Enterで閉じる。
        // capturePhaseを使い、フォーカス中のボタンにキーが渡る前に処理する。
        win.addEventListener("keydown", handleKeyDown, true);

        // 表示直後は画面に見えない受け取り先へフォーカスを設定し、
        // 2つの操作ボタンにはフォーカス表示を出さない。
        win.onShow = function () {
            keyFocusReceiver.active = true;
        };

        updateController();

        decreaseButton.onClick = function () {
            if (multiple <= 1) {
                return;
            }
            applyChange(multiple - 1);
        };

        increaseButton.onClick = function () {
            applyChange(multiple + 1);
        };

        function handleKeyDown(event) {
            var keyName = event.keyName;

            if (keyName === "Left" || keyName === "ArrowLeft") {
                consumeKeyEvent(event);
                if (multiple > 1) {
                    decreaseButton.active = true;
                    applyChange(multiple - 1);
                } else {
                    // 無効なボタンはフォーカスできないため、表示上の
                    // フォーカスを消したままキー入力だけを受け取る。
                    keyFocusReceiver.active = true;
                }
                return;
            }

            if (keyName === "Right" || keyName === "ArrowRight") {
                consumeKeyEvent(event);
                increaseButton.active = true;
                applyChange(multiple + 1);
                return;
            }

            if (
                keyName === "Escape" ||
                keyName === "Esc" ||
                keyName === "Return" ||
                keyName === "Enter"
            ) {
                consumeKeyEvent(event);
                win.close();
            }
        }

        function consumeKeyEvent(event) {
            try {
                event.preventDefault();
            } catch (e) {}

            try {
                event.stopPropagation();
            } catch (e2) {}
        }

        function applyChange(nextMultiple) {
            try {
                setFrameToMultiple(textFrame, nextMultiple, unitSize, spacing);
                multiple = nextMultiple;
                updateController();
                app.redraw();
            } catch (e) {
                alert("テキスト枠の幅を変更できませんでした\n" + e, SCRIPT_NAME);
            }
        }

        function updateController() {
            var moveFocusOffDecrease = multiple <= 1 && decreaseButton.active;
            decreaseButton.enabled = multiple > 1;
            fontSizeText.text = "文字サイズ：" +
                formatTextSize(fontSize, textUnit) +
                "（" + multiple + "文字）";
            frameSizeText.text = "フレームサイズ：" +
                formatMillimeters(Number(textFrame.width));

            // フォーカス中の「←」を無効にするときは、見えない受け取り先へ
            // 移してカーソルキー操作を継続可能にする。
            if (moveFocusOffDecrease) {
                keyFocusReceiver.active = true;
            }

            try {
                win.update();
            } catch (e) {}
        }

        win.center();
        win.show();
    }

    function setFrameToMultiple(textFrame, multiple, unitSize, spacing) {
        var newWidth = unitSize * multiple + spacing * 2;

        if (!isFinite(newWidth) || newWidth <= 0) {
            throw new Error("計算した幅が正しくありません");
        }

        if (Math.abs(Number(textFrame.width) - newWidth) > SIZE_TOLERANCE) {
            resizeAreaTextWidthPreservingFormatting(textFrame, newWidth);
        }

        textFrame.selected = true;
    }

    function getTarget(document) {
        var selection = document.selection;

        if (!selection) {
            return { error: "文字列またはテキストフレームを1つ選択してください" };
        }

        // 文字ツールで文字列を選択している場合。
        if (selection.typename === "TextRange") {
            if (!selection.contents || selection.contents.length === 0) {
                return { error: "文字ツールで、幅の基準にする文字列を選択してください" };
            }

            var storyFrames = selection.story.textFrames;
            if (!storyFrames || storyFrames.length !== 1) {
                return { error: "連結されていないエリア内文字の文字列を選択してください" };
            }

            return {
                frame: storyFrames[0],
                range: selection
            };
        }

        // 選択ツールでテキストフレームを選択している場合。
        if (typeof selection.length !== "number" || selection.length !== 1) {
            return { error: "文字列またはテキストフレームを1つ選択してください" };
        }

        var item = selection[0];
        if (!item || item.typename !== "TextFrame") {
            return { error: "エリア内文字を1つ選択してください" };
        }

        return {
            frame: item,
            range: item.textRange
        };
    }

    function getFirstEffectiveCharacterSize(textRange) {
        var characters = textRange.characters;

        for (var i = 0; i < characters.length; i++) {
            var character = characters[i];
            var characterContents = "";

            try {
                characterContents = String(character.contents);
            } catch (e) {}

            if (isLineBreak(characterContents)) {
                continue;
            }

            var size;
            var horizontalScale;

            try {
                size = Number(character.size);
                horizontalScale = Number(character.horizontalScale);
            } catch (e2) {
                return { error: "文字サイズを取得できませんでした" };
            }

            if (!isFinite(size) || size <= 0 || !isFinite(horizontalScale) || horizontalScale <= 0) {
                return { error: "文字サイズまたは水平比率を取得できませんでした" };
            }

            return {
                size: size * horizontalScale / 100,
                fontSize: size
            };
        }

        return { error: "文字サイズを取得できませんでした" };
    }

    function isLineBreak(contents) {
        return contents === "\r" || contents === "\n" || contents === "\u0003";
    }

    function getCurrentTextUnit() {
        var code = 2;

        try {
            code = Number(app.preferences.getIntegerPreference("text/units"));
        } catch (e) {}

        switch (code) {
            case 0:
                return { label: "in", factor: 1 / POINTS_PER_INCH, decimals: 3 };
            case 1:
                return {
                    label: "mm",
                    factor: MILLIMETERS_PER_INCH / POINTS_PER_INCH,
                    decimals: 2
                };
            case 3:
                return { label: "pica", factor: 1 / 12, decimals: 2 };
            case 4:
                return {
                    label: "cm",
                    factor: MILLIMETERS_PER_INCH / 10 / POINTS_PER_INCH,
                    decimals: 3
                };
            case 5:
                return {
                    label: "級",
                    factor: MILLIMETERS_PER_INCH * 4 / POINTS_PER_INCH,
                    decimals: 2
                };
            case 6:
                return { label: "px", factor: 1, decimals: 2 };
            case 2:
            default:
                return { label: "pt", factor: 1, decimals: 2 };
        }
    }

    function formatTextSize(sizeInPoints, unit) {
        return formatNumber(sizeInPoints * unit.factor, unit.decimals) + " " + unit.label;
    }

    function formatMillimeters(sizeInPoints) {
        var sizeInMillimeters = sizeInPoints * MILLIMETERS_PER_INCH / POINTS_PER_INCH;
        return formatNumber(sizeInMillimeters, 2) + " mm";
    }

    function formatNumber(value, decimals) {
        if (!isFinite(value)) {
            return "—";
        }

        var text = Number(value).toFixed(decimals);
        return text.replace(/\.?0+$/, "");
    }

    function setSmallFont(control) {
        try {
            control.graphics.font = ScriptUI.newFont(
                "dialog",
                ScriptUI.FontStyle.REGULAR,
                INFO_FONT_SIZE
            );
        } catch (e) {
            try {
                control.graphics.font = ScriptUI.newFont("dialog", "REGULAR", INFO_FONT_SIZE);
            } catch (e2) {}
        }
    }

    function getColumnCount(textFrame) {
        try {
            return Number(textFrame.columnCount);
        } catch (e) {
            return 1;
        }
    }

    function getInsetSpacing(textFrame) {
        try {
            var spacing = Number(textFrame.spacing);
            return isFinite(spacing) ? spacing : 0;
        } catch (e) {
            return 0;
        }
    }

    function isThreaded(textFrame) {
        try {
            if (textFrame.story && textFrame.story.textFrames.length > 1) {
                return true;
            }
        } catch (e) {}

        return false;
    }

    function resizeAreaTextWidthPreservingFormatting(textFrame, newWidth) {
        var backup = textFrame.duplicate();
        var originalLeft = textFrame.left;
        var originalTop = textFrame.top;

        try {
            // TextFrame.widthの変更で文字自体が変形される場合があるため、
            // 複製側に保持した元のテキストを、枠変更後に戻す。
            textFrame.width = newWidth;
            textFrame.left = originalLeft;
            textFrame.top = originalTop;

            textFrame.textRange.remove();
            backup.textRange.move(textFrame, ElementPlacement.PLACEATBEGINNING);
            backup.remove();
        } catch (e) {
            try {
                if (textFrame.contents.length === 0) {
                    backup.textRange.move(textFrame, ElementPlacement.PLACEATBEGINNING);
                }
            } catch (restoreError) {}

            try {
                backup.remove();
            } catch (removeError) {}

            throw e;
        }
    }
})();
