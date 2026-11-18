#target illustrator

(function () {
    var title = "IwashiKit 分版一覧";

    try {
        // 現在の CMYK 文書の版を取得します。入力は空文字列です。
        var response = app.sendScriptMessage("IwashiKit", "listSeparationPlates", "");
        if (typeof response !== "string" || !response) {
            throw new Error("IwashiKit から応答がありません。");
        }
        if (response.indexOf("error:") === 0) {
            throw new Error(response);
        }

        // 先頭行は形式のバージョンで、それ以降は版ごとの情報です。
        var rows = response.split("\n");
        if (rows[0] !== "schemaVersion\t1") {
            throw new Error("分版一覧の応答形式が不明です。");
        }

        var lines = [];
        for (var i = 1; i < rows.length; i++) {
            if (!rows[i]) continue;

            // タブ区切りで plate、版 ID、種別、チャンネル、状態、版名が並びます。
            var fields = rows[i].split("\t");
            if (fields.length !== 6 || fields[0] !== "plate") {
                throw new Error("版の情報を読み取れませんでした。");
            }
            var type = fields[2];
            var channel = fields[3];
            var state = fields[4] === "on" ? "ON（表示）" : "OFF（非表示）";
            // 版名のパーセントエンコードを元の文字列に戻します。
            var name = decodeURIComponent(fields[5]);

            var label = "その他";
            if (type === "process") {
                label = "プロセス " + channel;
            } else if (type === "spot") {
                label = "特色";
            }
            lines.push(label + "  " + name + "  " + state);
        }

        alert(lines.length ? lines.join("\n") : "表示できる版がありません。", title);
    } catch (error) {
        alert("分版一覧を取得できませんでした。\n" + error.message, title);
    }
}());
