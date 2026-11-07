#target photoshop

/*
SCRIPTMETA-BEGIN
Script-ID=org.iwashi.adjustmentLayer_hueSaturation
Meta-Default-language=ja
Name=色相・彩度
Name[en]=Add Hue and Saturation Adjustment Layer
Tags=調整レイヤー,adjustment layer,カラー,color
Target-App=Photoshop
SCRIPTMETA-END
*/

var item = { key: "hueSaturation", name: "色相・彩度", shortName: "色", kind: "adjustment", type: "hueSaturation" };
var layerClass = item.kind === "fill" ? "contentLayer" : "adjustmentLayer";
var desc = new ActionDescriptor();
var ref = new ActionReference();
var usingDesc = new ActionDescriptor();
ref.putClass(stringIDToTypeID(layerClass));
desc.putReference(stringIDToTypeID("null"), ref);
usingDesc.putClass(stringIDToTypeID("type"), stringIDToTypeID(item.type));
desc.putObject(stringIDToTypeID("using"), stringIDToTypeID(layerClass), usingDesc);
executeAction(stringIDToTypeID("make"), desc, DialogModes.NO);
