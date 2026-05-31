/*

SCRIPTMETA-BEGIN
Script-ID=org.iwashi.Photoshop_ToggleAllButBottom
Version=1
Release-Date=2026-03-23
Meta-URL=https://github.com/Yamonov/Iwashiya_Scripts/tree/main/Photoshop
Target-App=Photoshop
Description-BEGIN
ドキュメントの最下レイヤーまたはレイヤーグループ以外の表示を切り替えます。レイヤーの目玉マークをoption(alt)クリックした動作と同じです。
Description-END
SCRIPTMETA-END
*/

// --- IDs & helpers (hoisted once) ---
var cid = charIDToTypeID;
var ID_SHOW = cid("Shw ");
var ID_NULL = cid("null");
var ID_LAYER = cid("Lyr ");
var ID_BKG = cid("Bckg");
var ID_TOGGLE = cid("TglO");

function bottomLayerOf(doc) {
    // レイヤーが無い or 非対応なら null
    if (!doc || !doc.layers || doc.layers.length === 0) return null;
    return doc.layers[doc.layers.length - 1];
}

function toggleLayerVisibility() {
    try {
        var doc = app.activeDocument;
        var targetLayer = bottomLayerOf(doc);
        if (!targetLayer) return; // レイヤー無しなら終了

        var ref = new ActionReference();
        if (targetLayer.isBackgroundLayer) {
            ref.putProperty(ID_LAYER, ID_BKG);
        } else {
            ref.putIndex(ID_LAYER, targetLayer.itemIndex);
        }

        var list = new ActionList();
        list.putReference(ref);

        var desc = new ActionDescriptor();
        desc.putList(ID_NULL, list);
        desc.putBoolean(ID_TOGGLE, true);

        executeAction(ID_SHOW, desc, DialogModes.NO);
    } catch (e) {
        // no-op（Photoshopの一時状態で失敗する場合に備える）
    }
}

toggleLayerVisibility();
