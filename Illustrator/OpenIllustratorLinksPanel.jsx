#target "illustrator"

/*

SCRIPTMETA-BEGIN
Script-ID=org.iwashi.OpenIllustratorLinksPanel
Meta-Default-language=ja
Version=1
Meta-URL=https://github.com/Yamonov/Iwashiya_Scripts/tree/main/Illustrator
Name=リンクパネルを表示・非表示
Name[en]=Toggle the Links Panel
Tags=リンク,links,パネル,panel
Author=Murakami Yoshiteru
Target-App=Illustrator
Edit-Password-SHA256=nctKXgHsvLycDgVw:c12b07688ead9b5e623e5c1d0a7e8062d0858464a2ae5a0a2fc9913aa7a7bd51
Description-BEGIN
[ja]
123

[en]
123
Description-END
SCRIPTMETA-END


*/

(function () {
    var commandName = "Adobe LinkPalette Menu Item";

    try {
        // リンクパネル（ウィンドウ > リンク）
        app.executeMenuCommand(commandName);
    } catch (e) {
        alert("リンクパネルを開けませんでした。\nCommand: " + commandName + "\n" + e);
    }
}());
