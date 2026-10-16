/*
SCRIPTMETA-BEGIN
Script-ID=org.iwashi.ShowLinkOption
Version=1
Meta-URL=https://github.com/Yamonov/Iwashiya_Scripts/tree/main/InDesgin
Name=リンク画像の読み込みオプションを表示
Author=Murakami Yoshiteru
Target-App=InDesign
Description-BEGIN
選択した画像フレーム内のリンク画像を、読み込みオプションを表示して同じファイルから再配置します。
画像フレームを選択して実行してください。複数選択時は最初のフレーム内の最初の画像を対象にします。
Description-END
SCRIPTMETA-END
*/

(function () {
    if (app.documents.length === 0) {
        alert("ドキュメントを開いてから実行してください。");
        return;
    }
    if (app.selection.length === 0) {
        alert("リンク画像を含む画像フレームを選択してください。");
        return;
    }

    var graphic = null;
    var item = app.selection[0];
    try {
        if (item.itemLink && item.itemLink.isValid) graphic = item;
    } catch (error) {}
    if (!graphic) {
        try {
            if (item.graphics.length) graphic = item.graphics[0];
        } catch (error2) {}
    }
    if (!graphic) {
        alert("リンク画像を含む画像フレームを選択してください。");
        return;
    }

    try {
        var link = graphic.itemLink;
        if (!link || !link.isValid || link.status === LinkStatus.LINK_EMBEDDED) {
            alert("埋め込み画像には読み込みオプションを表示できません。外部ファイルへのリンクがある画像を選択してください。");
            return;
        }
        var file = File(link.filePath);
        if (!file.exists) {
            alert("リンクファイルが見つかりません。InDesignのリンクパネルを確認してください。");
            return;
        }
        app.doScript(function () {
            graphic.place(file, true);
        }, ScriptLanguage.JAVASCRIPT, [], UndoModes.ENTIRE_SCRIPT, "リンク画像の読み込みオプションを変更");
    } catch (error3) {
        // InDesignの「ユーザーによるキャンセル」は操作の失敗として表示しない。
        if (Number(error3.number) !== 2) {
            alert("リンク画像を再配置できませんでした。\n" + String(error3.message || error3));
        }
    }
})();
