#target photoshop

/*
SCRIPTMETA-BEGIN
Script-ID=org.iwashi.adjustmentLayer_gradient
Meta-Default-language=ja
Name=塗り: グラデーション
Name[en]=Add Gradient Fill Layer
Tags=塗りつぶし,fill layer,グラデーション,gradient
Target-App=Photoshop
SCRIPTMETA-END
*/

var item = { key: "gradientLayer", name: "塗り: グラデーション", shortName: "グ", kind: "fill", type: "gradientLayer" };
var layerClass = item.kind === "fill" ? "contentLayer" : "adjustmentLayer";
var desc = new ActionDescriptor();
var ref = new ActionReference();
var usingDesc = new ActionDescriptor();
ref.putClass(stringIDToTypeID(layerClass));
desc.putReference(stringIDToTypeID("null"), ref);
usingDesc.putClass(stringIDToTypeID("type"), stringIDToTypeID(item.type));
desc.putObject(stringIDToTypeID("using"), stringIDToTypeID(layerClass), usingDesc);
executeAction(stringIDToTypeID("make"), desc, DialogModes.NO);
