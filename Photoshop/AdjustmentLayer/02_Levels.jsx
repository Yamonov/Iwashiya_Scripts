#target photoshop

/*
SCRIPTMETA-BEGIN
Script-ID=org.iwashi.adjustmentLayer_levels
Meta-Default-language=ja
Name=レベル補正
Name[en]=Add Levels Adjustment Layer
Tags=調整レイヤー,adjustment layer,階調,tone
Target-App=Photoshop
SCRIPTMETA-END
*/

var item = { key: "levels", name: "レベル補正", shortName: "Lv", kind: "adjustment", type: "levels" };
var layerClass = item.kind === "fill" ? "contentLayer" : "adjustmentLayer";
var desc = new ActionDescriptor();
var ref = new ActionReference();
var usingDesc = new ActionDescriptor();
ref.putClass(stringIDToTypeID(layerClass));
desc.putReference(stringIDToTypeID("null"), ref);
usingDesc.putClass(stringIDToTypeID("type"), stringIDToTypeID(item.type));
desc.putObject(stringIDToTypeID("using"), stringIDToTypeID(layerClass), usingDesc);
executeAction(stringIDToTypeID("make"), desc, DialogModes.NO);
