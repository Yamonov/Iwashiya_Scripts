/*
SCRIPTMETA-BEGIN
Script-ID=org.iwashi.EmbedAllLinks
Version=1
Meta-URL=https://github.com/Yamonov/Iwashiya_Scripts/tree/main/InDesgin
Name=すべてのリンクを埋め込む
Author=Murakami Yoshiteru
Target-App=InDesign
Description-BEGIN
アクティブドキュメント内のすべてのリンクを埋め込みます。
選択状態にかかわらず、ドキュメント全体のリンクを対象にします。
Description-END
SCRIPTMETA-END
*/

(function () {
    if (app.documents.length === 0) {
        alert("ドキュメントを開いてから実行してください。");
        return;
    }
    var doc = app.activeDocument;
    if (doc.links.length === 0) {
        alert("埋め込むリンクがありません。");
        return;
    }

    // 埋め込みでリンクコレクションが変化しても、後続の対象を取りこぼさない。
    var links = doc.links.everyItem().getElements();
    var completed = 0;
    var failures = [];
    app.doScript(function () {
        for (var i = 0; i < links.length; i++) {
            var name = "リンク " + (i + 1);
            try {
                var link = links[i];
                name = link.name;
                if (link.status === LinkStatus.LINK_EMBEDDED) continue;
                if (link.status === LinkStatus.LINK_MISSING || link.status === LinkStatus.LINK_INACCESSIBLE) {
                    throw new Error("リンクファイルを参照できません。");
                }
                link.unlink();
                if (link.isValid && link.status !== LinkStatus.LINK_EMBEDDED) {
                    throw new Error("埋め込みが完了しませんでした。リンクの更新状態を確認してください。");
                }
                completed++;
            } catch (error) {
                failures.push(name + "：" + String(error.message || error));
            }
        }
    }, ScriptLanguage.JAVASCRIPT, [], UndoModes.ENTIRE_SCRIPT, "すべてのリンクを埋め込む");

    if (failures.length) {
        alert("埋め込み済み：" + completed + "件\n埋め込めなかったリンク：" + failures.length + "件\n\n" + failures.slice(0, 10).join("\n"));
    } else if (!completed) {
        alert("埋め込むリンクがありません。");
    }
})();
