#target illustrator

(function () {
    // true にした版は、実行するたびに現在の表示状態が反転します。
    // false の版はそのままです。特色の設定はすべての特色版に適用します。
    var TOGGLE_C = false;
    var TOGGLE_M = false;
    var TOGGLE_Y = false;
    var TOGGLE_K = true;
    var TOGGLE_SPOTS = true;

    var title = "IwashiKit 分版切り替え";
    var processPlates = { C: TOGGLE_C, M: TOGGLE_M, Y: TOGGLE_Y, K: TOGGLE_K };

    if (!TOGGLE_C && !TOGGLE_M && !TOGGLE_Y && !TOGGLE_K && !TOGGLE_SPOTS) {
        return;
    }

    function requestPlateRows(selector, input) {
        var response = app.sendScriptMessage("IwashiKit", selector, input);
        if (typeof response !== "string" || !response) {
            throw new Error("IwashiKit から応答がありません。");
        }
        if (response.indexOf("error:") === 0) {
            throw new Error(response);
        }

        var rows = response.split("\n");
        if (rows.shift() !== "schemaVersion\t1") {
            throw new Error("IwashiKit の応答形式が不明です。");
        }
        return rows;
    }

    try {
        // 一覧から、冒頭の設定で true にした版の ID を集めます。
        var rows = requestPlateRows("listSeparationPlates", "");
        var ids = [];
        for (var i = 0; i < rows.length; i++) {
            if (!rows[i]) continue;

            // タブ区切りで plate、版 ID、種別、チャンネル、状態、版名が並びます。
            var fields = rows[i].split("\t");
            if (fields.length !== 6 || fields[0] !== "plate" || !fields[1]) {
                throw new Error("版の情報を読み取れませんでした。");
            }
            var plateId = fields[1];
            var type = fields[2];
            var channel = fields[3];
            var toggleProcess = type === "process" && processPlates[channel] === true;
            var toggleSpot = type === "spot" && TOGGLE_SPOTS;

            if (toggleProcess || toggleSpot) {
                ids.push(plateId);
            }
        }

        if (!ids.length) {
            alert("指定した版は現在の文書にありません。", title);
            return;
        }

        // ID を改行でつなぎ、対象の版を１回の呼び出しで反転します。
        requestPlateRows("toggleSeparationPlates", ids.join("\n"));
        app.redraw();
    } catch (error) {
        alert("分版プレビューを切り替えられませんでした。\n" + error.message, title);
    }
}());
