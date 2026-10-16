/*
SCRIPTMETA-BEGIN
Script-ID=org.iwashi.MatchApplicationColorSettings
Version=1
Meta-URL=https://github.com/Yamonov/Iwashiya_Scripts/tree/main/InDesgin
Name=ドキュメントのカラー設定をアプリに合わせる
Author=Murakami Yoshiteru
Target-App=InDesign
Description-BEGIN
アクティブドキュメントのRGB・CMYKプロファイルとカラーマネジメントポリシーを、アプリケーションの現在のカラー設定に合わせます。
変更後のプロファイル名とポリシーをアラートで表示します。
Description-END
SCRIPTMETA-END
*/

(function () {
    if (app.documents.length === 0) {
        alert("ドキュメントを開いてから実行してください。");
        return;
    }

    var doc = app.activeDocument;
    var settings = app.colorSettings;
    var names = ["cmykProfile", "rgbProfile", "cmykPolicy", "rgbPolicy"];
    var desired = [settings.workingSpaceCMYK, settings.workingSpaceRGB, settings.cmykPolicy, settings.rgbPolicy];
    var original = [];
    for (var i = 0; i < names.length; i++) original.push(doc[names[i]]);
    var failure = null;
    var restoreFailed = false;

    app.doScript(function () {
        try {
            for (var i = 0; i < names.length; i++) doc[names[i]] = desired[i];
        } catch (error) {
            failure = error;
            // 一部の項目だけ変更された場合も、変更前の設定に戻す。
            for (var j = names.length - 1; j >= 0; j--) {
                try {
                    if (String(doc[names[j]]) !== String(original[j])) doc[names[j]] = original[j];
                } catch (restoreError) {
                    restoreFailed = true;
                }
            }
        }
    }, ScriptLanguage.JAVASCRIPT, [], UndoModes.ENTIRE_SCRIPT, "ドキュメントのカラー設定をアプリに合わせる");

    if (failure) {
        alert("カラー設定を変更できませんでした。\n" + String(failure.message || failure) +
            (restoreFailed ? "\n一部の設定を元に戻せませんでした。「取り消し」で確認してください。" : "\n変更前の設定に戻しました。"));
        return;
    }

    function policyDescription(policy) {
        var policies = {
            "COLOR_POLICY_OFF": "✅オフ（作業用を使用）",
            "COMBINATION_OF_PRESERVE_AND_SAFE_CMYK": "✅CMYK値保持（画像プロファイル破棄）",
            "CONVERT_TO_WORKING_SPACE": "⚠️作業用に全変換",
            "PRESERVE_EMBEDDED_PROFILES": "➡️埋め込みを保持"
        };
        var key = policy.toString();
        return policies[key] || key;
    }

    alert("埋め込みプロファイルを\nRGB：" + doc.rgbProfile + "\nCMYK：" + doc.cmykProfile +
        "\n\nドキュメントのポリシーを\nRGB：" + policyDescription(doc.rgbPolicy) +
        "\nCMYK：" + policyDescription(doc.cmykPolicy) + "\nに変更しました。");
})();
