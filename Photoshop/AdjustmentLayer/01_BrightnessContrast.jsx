#target photoshop

/*
SCRIPTMETA-BEGIN
Script-ID=org.iwashi.adjustmentLayer_brightnessContrast
Meta-Default-language=ja
Name=明るさ・コントラスト
Name[en]=Add Brightness and Contrast Adjustment Layer
Tags=調整レイヤー,adjustment layer,階調,tone
Target-App=Photoshop
SCRIPTMETA-END
*/

var item = { key: "brightnessEvent", name: "明るさ・コントラスト", shortName: "明", kind: "adjustment", type: "brightnessEvent", useLegacy: true };
var layerClass = item.kind === "fill" ? "contentLayer" : "adjustmentLayer";
var desc = new ActionDescriptor();
var ref = new ActionReference();
var usingDesc = new ActionDescriptor();
var typeDesc = new ActionDescriptor();
ref.putClass(stringIDToTypeID(layerClass));
desc.putReference(stringIDToTypeID("null"), ref);
typeDesc.putBoolean(stringIDToTypeID("useLegacy"), item.useLegacy);
usingDesc.putObject(stringIDToTypeID("type"), stringIDToTypeID(item.type), typeDesc);
desc.putObject(stringIDToTypeID("using"), stringIDToTypeID(layerClass), usingDesc);
executeAction(stringIDToTypeID("make"), desc, DialogModes.NO);
