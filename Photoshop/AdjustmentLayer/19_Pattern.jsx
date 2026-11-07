#target photoshop

/*
SCRIPTMETA-BEGIN
Script-ID=org.iwashi.adjustmentLayer_pattern
Meta-Default-language=ja
Name=塗り: パターン
Name[en]=Add Pattern Fill Layer
Tags=塗りつぶし,fill layer,パターン,pattern
Target-App=Photoshop
SCRIPTMETA-END
*/

var item = { key: "patternLayer", name: "塗り: パターン", shortName: "Pa", kind: "fill", type: "patternLayer" };
var layerClass = item.kind === "fill" ? "contentLayer" : "adjustmentLayer";
var desc = new ActionDescriptor();
var ref = new ActionReference();
var usingDesc = new ActionDescriptor();
ref.putClass(stringIDToTypeID(layerClass));
desc.putReference(stringIDToTypeID("null"), ref);
usingDesc.putClass(stringIDToTypeID("type"), stringIDToTypeID(item.type));
desc.putObject(stringIDToTypeID("using"), stringIDToTypeID(layerClass), usingDesc);
executeAction(stringIDToTypeID("make"), desc, DialogModes.NO);
