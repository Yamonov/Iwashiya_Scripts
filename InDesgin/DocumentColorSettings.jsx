/*

SCRIPTMETA-BEGIN
Script-ID=org.iwashi.documentcolorsettingsviewer
Name=ドキュメントに埋め込まれたカラー設定を表示
Author=Murakami Yoshiteru
Version=0.5
Meta-URL=https://github.com/Yamonov/Iwashiya_Scripts/tree/main/InDesgin
Target-App=InDesign
Edit-Password-SHA256=DYW2QUKqdGvnurN6:b5f02a2380ac64a637b022c788943e6192c84e3e09d89bef779b938a32c5dd75
Description-BEGIN
ドキュメントのRGB・CMYKプロファイルをアプリ側の作業用プロファイルと比較し、ドキュメントのカラーマネジメントポリシーとともに表示します。設定は変更しません。
Description-END
SCRIPTMETA-END

*/

(function () {
    var YAMO_LOCALE_OVERRIDE = ""; // テスト時のみ "ja" または "en" を指定

    var UI_TEXT = {
        readFailed: {
            ja: "ドキュメントのカラー設定を取得できませんでした。",
            en: "Could not read the document color settings."
        },
        noDocument: {
            ja: "ドキュメントを開いてから実行してください。",
            en: "Open a document before running this script."
        },
        untagged: {
            ja: "⚠️タグなし\n作業用（{profile}）を一時的に使用",
            en: "⚠️ Untagged\nTemporarily using the working space ({profile})"
        },
        sameAsWorking: {
            ja: "🙂作業用と同じ（{profile}）",
            en: "🙂 Same as working space ({profile})"
        },
        differentFromWorking: {
            ja: "{profile}\n⚠️作業用（{working}）と異なります",
            en: "{profile}\n⚠️ Different from the working space ({working})"
        },
        policyOff: {
            ja: "✅オフ（作業用を使用）",
            en: "✅ Off (use working space)"
        },
        preserveSafeCMYK: {
            ja: "✅CMYK値保持（画像プロファイル破棄）",
            en: "✅ Preserve CMYK numbers (discard image profiles)"
        },
        convertToWorking: {
            ja: "⚠️作業用に全変換",
            en: "⚠️ Convert all to working space"
        },
        preserveEmbedded: {
            ja: "➡️埋め込みを保持",
            en: "➡️ Preserve embedded profiles"
        },
        title: {
            ja: "ドキュメントのカラー設定",
            en: "Document Color Settings"
        },
        policyTitle: {
            ja: "ドキュメントのポリシー",
            en: "Document Policies"
        }
    };

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

    function getProfileStatus(docProfile, defProfile) {
        if (!docProfile) {
            return uiFormat("untagged", { profile: defProfile });
        } else if (docProfile === defProfile) {
            return uiFormat("sameAsWorking", { profile: docProfile });
        } else {
            return uiFormat("differentFromWorking", { profile: docProfile, working: defProfile });
        }
    }

    function getPolicyDescription(docPolicy) {
        var policies = {
            "COLOR_POLICY_OFF": uiText("policyOff"),
            "COMBINATION_OF_PRESERVE_AND_SAFE_CMYK": uiText("preserveSafeCMYK"),
            "CONVERT_TO_WORKING_SPACE": uiText("convertToWorking"),
            "PRESERVE_EMBEDDED_PROFILES": uiText("preserveEmbedded")
        };
        return policies[docPolicy] || docPolicy;
    }

    function getDocumentAndApplicationColorSettings() {
        var myDoc = app.activeDocument;
        var myCol = app.colorSettings;

        return {
            defCMYK: myCol.workingSpaceCMYK,
            docCMYK: myDoc.cmykProfile,
            defRGB: myCol.workingSpaceRGB,
            docRGB: myDoc.rgbProfile,
            docCMYKPolicy: getPolicyDescription(myDoc.cmykPolicy.toString()),
            docRGBPolicy: getPolicyDescription(myDoc.rgbPolicy.toString())
        };
    }

    function displayColorProfilesAndPolicies() {
        if (app.documents.length === 0) {
            alert(uiText("noDocument"));
            return;
        }

        var colorSettings;
        try {
            colorSettings = getDocumentAndApplicationColorSettings();
        } catch (error) {
            alert(uiText("readFailed") + "\n" + String(error.message || error));
            return;
        }

        var cmykStatus = getProfileStatus(colorSettings.docCMYK, colorSettings.defCMYK);
        var rgbStatus = getProfileStatus(colorSettings.docRGB, colorSettings.defRGB);

        alert(uiText("title") + "\n■■■■■ CMYK ■■■■■\n" + cmykStatus + "\n\n■■■■■ RGB ■■■■■\n" + rgbStatus + "\n\n\n■ " + uiText("policyTitle") + " ■\n■■CMYK■■\n" + colorSettings.docCMYKPolicy + "\n\n■■RGB■■\n" + colorSettings.docRGBPolicy);
    }

    displayColorProfilesAndPolicies();
})();
