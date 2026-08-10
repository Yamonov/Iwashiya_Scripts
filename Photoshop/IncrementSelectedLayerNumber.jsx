#target photoshop

/*

SCRIPTMETA-BEGIN
Script-ID=org.iwashi.IncrementSelectedLayerNumber
Version=1
Name=選択レイヤー名をカウントアップ
Author=Murakami Yoshiteru
Target-App=Photoshop
SCRIPTMETA-END

*/

function renameLayerWithIncrement() {
    if (!app.documents.length) return;

    var doc = app.activeDocument;
    var layer = doc.activeLayer;
    var originalName = layer.name;

    // レイヤー名と末尾の数字（スペース区切り）を分離
    var nameMatch = originalName.match(/^(.*?)(?:\s+(\d+))?$/);
    var baseName = (nameMatch && nameMatch[1])
        ? ("" + nameMatch[1]).replace(/\s+$/, "")
        : originalName;

    // 既に末尾番号がある場合は次の番号から開始
    var number = (nameMatch && nameMatch[2])
        ? parseInt(nameMatch[2], 10) + 1
        : 1;

    // 使用されていない名前を探す
    var newName, exists;
    do {
        var paddedNumber = ("0" + number).slice(-2); // 2桁ゼロ埋め
        newName = baseName + " " + paddedNumber;

        exists = false;
        for (var i = 0; i < doc.layers.length; i++) {
            if (doc.layers[i].name === newName && doc.layers[i] !== layer) {
                exists = true;
                break;
            }
        }

        number++;
    } while (exists);

    layer.name = newName;
}

renameLayerWithIncrement();