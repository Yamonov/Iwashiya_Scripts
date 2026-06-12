/*

SCRIPTMETA-BEGIN
Script-ID=org.iwashi.Photoshop_ClippingViewDelete
Version=1
Meta-URL=https://github.com/Yamonov/Iwashiya_Scripts/tree/main/Photoshop
Name=クリッピング表示レイヤーグループを削除
Author=Murakami Yoshiteru
Release-Date=2026-05-18
Target-App=Photoshop
Edit-Password-SHA256=XuQlCwV1t7x0Dxf6:27ff384138df6c038ba4cf81b26e35fffe3db5a94715ec922acce0882cc76f84
Description=「クリッピング表示」で作成したレイヤーグループを、内部レイヤー構成を確認してから削除します。
SCRIPTMETA-END


*/

if (app.documents.length) {
    app.activeDocument.suspendHistory("クリッピング表示を削除", "main()");
} else {
    alert("ドキュメントがありません。");
}

function main() {
    var doc = app.activeDocument;
    var group = findValidClippingViewGroup(doc);

    if (!group) {
        alert("削除対象のクリッピング表示レイヤーグループが見つかりません。");
        return;
    }

    group.remove();
    alert("クリッピング表示レイヤーグループを削除しました。");
}

function findValidClippingViewGroup(doc) {
    var rgbGroup = findTopLevelLayerSetByName(doc, "Clipping_View_RGB");
    if (rgbGroup && isValidRGBGroup(rgbGroup)) {
        return rgbGroup;
    }

    var cmykGroup = findTopLevelLayerSetByName(doc, "Clipping_View_CMYK");
    if (cmykGroup && isValidCMYKGroup(cmykGroup)) {
        return cmykGroup;
    }

    return null;
}

function findTopLevelLayerSetByName(doc, groupName) {
    for (var i = 0; i < doc.layers.length; i++) {
        var layer = doc.layers[i];
        if (layer.typename === "LayerSet" && layer.name === groupName) {
            return layer;
        }
    }
    return null;
}

function isValidRGBGroup(group) {
    if (group.layers.length !== 2) {
        return false;
    }

    return hasDirectArtLayerNamed(group, "Highlight") &&
        hasDirectArtLayerNamed(group, "Shadow");
}

function isValidCMYKGroup(group) {
    if (group.layers.length !== 3) {
        return false;
    }

    return hasDirectArtLayerNamed(group, "Highlight") &&
        hasDirectArtLayerNamed(group, "TAC2Gary") &&
        hasDirectArtLayerMatching(group, /^TAC値[:：]\s*\d+(?:\.\d+)?%?$/);
}

function hasDirectArtLayerNamed(group, layerName) {
    for (var i = 0; i < group.layers.length; i++) {
        var layer = group.layers[i];
        if (layer.typename === "ArtLayer" && layer.name === layerName) {
            return true;
        }
    }
    return false;
}

function hasDirectArtLayerMatching(group, pattern) {
    for (var i = 0; i < group.layers.length; i++) {
        var layer = group.layers[i];
        if (layer.typename === "ArtLayer" && pattern.test(layer.name)) {
            return true;
        }
    }
    return false;
}
