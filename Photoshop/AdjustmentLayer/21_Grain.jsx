#target photoshop

/*
SCRIPTMETA-BEGIN
Script-ID=org.iwashi.adjustmentLayer_grain
Meta-Default-language=ja
Name=効果: 粒子
Name[en]=Add Grain Adjustment Layer
Tags=調整レイヤー,adjustment layer,粒子,grain
Target-App=Photoshop
SCRIPTMETA-END
*/

var item = { key: "grainAdjustment", name: "効果: 粒子", shortName: "粒", kind: "adjustment", type: "grainAdjustment" };
var layerClass = item.kind === "fill" ? "contentLayer" : "adjustmentLayer";
var desc = new ActionDescriptor();
var ref = new ActionReference();
var usingDesc = new ActionDescriptor();
ref.putClass(stringIDToTypeID(layerClass));
desc.putReference(stringIDToTypeID("null"), ref);
usingDesc.putClass(stringIDToTypeID("type"), stringIDToTypeID(item.type));
desc.putObject(stringIDToTypeID("using"), stringIDToTypeID(layerClass), usingDesc);
executeAction(stringIDToTypeID("make"), desc, DialogModes.NO);
