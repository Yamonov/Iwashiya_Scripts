#target photoshop

/*
SCRIPTMETA-BEGIN
Script-ID=org.iwashi.adjustmentLayer_gradientMap
Meta-Default-language=ja
Name=グラデーションマップ
Name[en]=Add Gradient Map Adjustment Layer
Tags=調整レイヤー,adjustment layer,グラデーション,gradient
Target-App=Photoshop
SCRIPTMETA-END
*/

var item = { key: "gradientMapClass", name: "グラデーションマップ", shortName: "GM", kind: "adjustment", type: "gradientMapClass" };
var layerClass = item.kind === "fill" ? "contentLayer" : "adjustmentLayer";
var desc = new ActionDescriptor();
var ref = new ActionReference();
var usingDesc = new ActionDescriptor();
ref.putClass(stringIDToTypeID(layerClass));
desc.putReference(stringIDToTypeID("null"), ref);
usingDesc.putClass(stringIDToTypeID("type"), stringIDToTypeID(item.type));
desc.putObject(stringIDToTypeID("using"), stringIDToTypeID(layerClass), usingDesc);
executeAction(stringIDToTypeID("make"), desc, DialogModes.NO);
