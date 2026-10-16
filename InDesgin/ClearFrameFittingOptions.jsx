/*

SCRIPTMETA-BEGIN
Script-ID=local.yamo.script_tgjzc681xeev
Version=1
Meta-URL=https://github.com/Yamonov/Iwashiya_Scripts/tree/main/InDesgin
Name=フレーム調整オプションを消去
Author=Murakami Yoshiteru
Target-App=InDesign
Description-BEGIN
ドキュメント内の画像フレームの「自動調整」をオフにします。
ページ上にあり、フレームとレイヤーが表示されているものを対象に、変更した件数をページごとに表示します。
Description-END
SCRIPTMETA-END

*/

(function () {
    if (app.documents.length === 0) {
        alert("ドキュメントを開いてから実行してください。");
        return;
    }
    if (!confirm("リンク画像フレームの自動調整をオフにしますか？")) return;

    var graphics = app.activeDocument.allGraphics;
    var seen = {};
    var pages = [];
    var pageCounts = {};
    var failures = 0;

    app.doScript(function () {
        for (var i = 0; i < graphics.length; i++) {
            try {
                var frame = graphics[i].parent;
                if (!(frame instanceof Rectangle || frame instanceof Oval || frame instanceof Polygon)) continue;
                var frameKey = "frame" + frame.id;
                if (seen[frameKey]) continue;
                seen[frameKey] = true;
                var page = frame.parentPage;
                if (!page || !page.isValid || !frame.visible || !frame.itemLayer.visible || !frame.frameFittingOptions.autoFit) continue;
                if (frame.locked || frame.itemLayer.locked) {
                    failures++;
                    continue;
                }
                frame.frameFittingOptions.autoFit = false;
                var pageKey = "page" + page.id;
                if (!pageCounts[pageKey]) {
                    pageCounts[pageKey] = {name: page.name, order: page.documentOffset, count: 0};
                    pages.push(pageCounts[pageKey]);
                }
                pageCounts[pageKey].count++;
            } catch (error) {
                failures++;
            }
        }
    }, ScriptLanguage.JAVASCRIPT, [], UndoModes.ENTIRE_SCRIPT, "フレームの自動調整をオフ");

    pages.sort(function (a, b) { return a.order - b.order; });
    var lines = [];
    for (var j = 0; j < pages.length; j++) {
        lines.push(pages[j].name + "ページ（" + pages[j].count + "アイテム）");
    }
    var message = lines.length ? "処理したアイテムと含まれるページ\n\n" + lines.join("\n") : "処理したアイテムはありませんでした。";
    if (failures) message += "\n\nロックなどにより処理できなかった画像フレーム：" + failures + "件";
    alert(message);
})();
