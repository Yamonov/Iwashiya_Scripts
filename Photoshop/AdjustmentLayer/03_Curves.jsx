#target photoshop

/*
SCRIPTMETA-BEGIN
Script-ID=org.iwashi.adjustmentLayer_curves
Meta-Default-language=ja
Name=トーンカーブ
Name[en]=Add Curves Adjustment Layer
Tags=調整レイヤー,adjustment layer,階調,tone
Target-App=Photoshop
SCRIPTMETA-END
*/

var item = { key: "curves", name: "トーンカーブ", shortName: "Cv", kind: "adjustment", type: "curves" };
var layerClass = item.kind === "fill" ? "contentLayer" : "adjustmentLayer";
var desc = new ActionDescriptor();
var ref = new ActionReference();
var usingDesc = new ActionDescriptor();
ref.putClass(stringIDToTypeID(layerClass));
desc.putReference(stringIDToTypeID("null"), ref);
usingDesc.putClass(stringIDToTypeID("type"), stringIDToTypeID(item.type));
desc.putObject(stringIDToTypeID("using"), stringIDToTypeID(layerClass), usingDesc);
executeAction(stringIDToTypeID("make"), desc, DialogModes.NO);
