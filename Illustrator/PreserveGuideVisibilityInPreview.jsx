#target "illustrator"

/*
SCRIPTMETA-BEGIN
Script-ID=org.iwashi.PreserveGuideVisibilityInPreview
Version=1
Meta-URL=https://github.com/Yamonov/Iwashiya_Scripts/tree/main/Illustrator
Name=ガイド表示を維持してトリミング表示を切り替え
Author=Murakami Yoshiteru
Release-Date=2026-08-21
Target-App=Illustrator
Description=トリミング表示を切り替えます。通常表示でガイドが表示されていた場合は、トリミング表示へ切り替えたあともガイドを表示します。
SCRIPTMETA-END
*/

(function () {
    var SCRIPT_NAME = "ガイド表示を維持してトリミング表示を切り替え";

    if (app.documents.length === 0) {
        alert("ドキュメントを開いてください。", SCRIPT_NAME);
        return;
    }

    var documentRef = app.activeDocument;

    if (
        typeof documentRef.isTrimViewEnabled !== "function" ||
        typeof documentRef.isGuideVisible !== "function"
    ) {
        alert("このIllustratorでは表示状態を取得できません。", SCRIPT_NAME);
        return;
    }

    try {
        // トリミング表示中なら、そのまま通常表示へ戻す。
        if (documentRef.isTrimViewEnabled()) {
            app.executeMenuCommand("TrimView");
            app.redraw();
            return;
        }

        // 通常表示でガイドが表示されていたかを、切り替え前に記憶する。
        var guidesWereVisible = documentRef.isGuideVisible();

        app.executeMenuCommand("TrimView");

        // トリミング表示への切り替えで非表示になったガイドだけを再表示する。
        if (guidesWereVisible && !documentRef.isGuideVisible()) {
            app.executeMenuCommand("showguide");
        }

        app.redraw();
    } catch (error) {
        alert("トリミング表示を切り替えられませんでした。\n" + error, SCRIPT_NAME);
    }
}());
