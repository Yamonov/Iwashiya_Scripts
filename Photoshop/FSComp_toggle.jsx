#target photoshop

/*

SCRIPTMETA-BEGIN
Script-ID=org.iwashi.FSComp_toggle
Version=1
Meta-URL=https://github.com/Yamonov/Iwashiya_Scripts/tree/main/Photoshop
Name=周波数分離カンプ表示トグル
Author=Murakami Yoshiteru
Target-App=Photoshop
Edit-Password-SHA256=debd6f5a695b46db:77f90c46448f5afe0569dd0a7850510c30a80e28d3d7b44fb2f7a48fb94896ad
Description=実行する度に、FrequencySeparation_compで作成したレイヤーカンプを切り替えます。
SCRIPTMETA-END

*/

(function () {
    var SUFFIX_NORMAL = "NORMAL";
    var SUFFIX_TEXTURE = "TEXTURE";

    if (app.documents.length === 0) {
        alert("ドキュメントを開いてから実行してください。");
        return;
    }

    var doc = app.activeDocument;
    var currentComp = getCurrentLayerComp(doc);
    if (!currentComp) {
        alert("現在のレイヤーカンプが見つかりません。");
        return;
    }

    var currentName = normalizeCompName(currentComp.name);
    var targetName = getToggleTargetName(currentName);

    if (!targetName) {
        alert(
            "現在のレイヤーカンプ名が「接頭辞:NORMAL」または「接頭辞:TEXTURE」ではありません。\n" +
            "取得した名前: " + currentComp.name
        );
        return;
    }

    var targetComp = findLayerCompByName(doc, targetName);

    if (!targetComp) {
        alert("切り替え先のレイヤーカンプが見つかりません: " + targetName);
        return;
    }

    targetComp.apply();

    function getCurrentLayerComp(documentRef) {
        var appliedComp = getAppliedLayerComp(documentRef);
        if (appliedComp) {
            return appliedComp;
        }
        return getSelectedLayerComp(documentRef);
    }

    function getAppliedLayerComp(documentRef) {
        try {
            var ref = new ActionReference();
            ref.putProperty(charIDToTypeID("Prpr"), stringIDToTypeID("json"));
            ref.putEnumerated(charIDToTypeID("Dcmn"), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));

            var desc = executeActionGet(ref);
            var jsonText = desc.getString(stringIDToTypeID("json"));
            var jsonObject = eval("(" + jsonText + ")");
            var compsInfo = jsonObject.comps;
            var comps = documentRef.layerComps;

            if (!compsInfo || !comps) {
                return null;
            }

            for (var i = 0; i < comps.length && i < compsInfo.length; i++) {
                if (compsInfo[i].applied) {
                    return comps[i];
                }
            }
        } catch (e) {
        }
        return null;
    }

    function getSelectedLayerComp(documentRef) {
        var comps = documentRef.layerComps;
        for (var i = 0; i < comps.length; i++) {
            if (comps[i].selected) {
                return comps[i];
            }
        }
        return null;
    }

    function findLayerCompByName(documentRef, compName) {
        var comps = documentRef.layerComps;
        for (var i = 0; i < comps.length; i++) {
            if (normalizeCompName(comps[i].name) === compName) {
                return comps[i];
            }
        }
        return null;
    }

    function getToggleTargetName(compName) {
        if (hasSuffix(compName, SUFFIX_NORMAL)) {
            return compName.substring(0, compName.length - SUFFIX_NORMAL.length) + SUFFIX_TEXTURE;
        }
        if (hasSuffix(compName, SUFFIX_TEXTURE)) {
            return compName.substring(0, compName.length - SUFFIX_TEXTURE.length) + SUFFIX_NORMAL;
        }
        return "";
    }

    function normalizeCompName(text) {
        return String(text).replace(/\s+/g, "").replace(/：/g, ":");
    }

    function hasSuffix(text, suffix) {
        return text.substring(text.length - suffix.length) === suffix;
    }
})();
