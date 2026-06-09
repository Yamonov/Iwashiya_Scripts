#target photoshop

/*

SCRIPTMETA-BEGIN
Script-ID=org.iwashi.StarLayerToggle
Version=1
Meta-URL=https://github.com/Yamonov/Iwashiya_Scripts/tree/main/Photoshop
Name=★マークレイヤーを表示・非表示
Target-App=Photoshop
SCRIPTMETA-END

*/

if (app.documents.length > 0) {
    app.activeDocument.suspendHistory("Toggle Starred Layers", "main()");
}

function main() {
    var prefix = "★";
    var layers = collectAllLayers(app.activeDocument);

    for (var i = 0; i < layers.length; i++) {
        if (layers[i].name.indexOf(prefix) === 0) {
            layers[i].visible = !layers[i].visible;
        }
    }
}

function collectAllLayers(parent) {
    var result = [];

    for (var i = 0; i < parent.layers.length; i++) {
        var layer = parent.layers[i];
        result.push(layer);

        if (layer.typename === "LayerSet") {
            result = result.concat(collectAllLayers(layer));
        }
    }

    return result;
}