#target photoshop

/*
SCRIPTMETA-BEGIN
Script-ID=org.iwashi.adjustmentLayer_threshold
Meta-Default-language=ja
Name=二階調化
Name[en]=Add Threshold Adjustment Layer
Tags=調整レイヤー,adjustment layer,白黒,black and white
Target-App=Photoshop
SCRIPTMETA-END
*/

var item = { key: "thresholdClassEvent", name: "二階調化", shortName: "二", kind: "adjustment", type: "thresholdClassEvent" };
var layerClass = item.kind === "fill" ? "contentLayer" : "adjustmentLayer";
var desc = new ActionDescriptor();
var ref = new ActionReference();
var usingDesc = new ActionDescriptor();
ref.putClass(stringIDToTypeID(layerClass));
desc.putReference(stringIDToTypeID("null"), ref);
usingDesc.putClass(stringIDToTypeID("type"), stringIDToTypeID(item.type));
desc.putObject(stringIDToTypeID("using"), stringIDToTypeID(layerClass), usingDesc);
executeAction(stringIDToTypeID("make"), desc, DialogModes.NO);
