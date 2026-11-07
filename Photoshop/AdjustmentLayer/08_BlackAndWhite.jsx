#target photoshop

/*
SCRIPTMETA-BEGIN
Script-ID=org.iwashi.adjustmentLayer_blackAndWhite
Meta-Default-language=ja
Name=白黒
Name[en]=Add Black and White Adjustment Layer
Tags=調整レイヤー,adjustment layer,白黒,black and white
Target-App=Photoshop
SCRIPTMETA-END
*/

var item = { key: "blackAndWhite", name: "白黒", shortName: "白", kind: "adjustment", type: "blackAndWhite" };
var layerClass = item.kind === "fill" ? "contentLayer" : "adjustmentLayer";
var desc = new ActionDescriptor();
var ref = new ActionReference();
var usingDesc = new ActionDescriptor();
ref.putClass(stringIDToTypeID(layerClass));
desc.putReference(stringIDToTypeID("null"), ref);
usingDesc.putClass(stringIDToTypeID("type"), stringIDToTypeID(item.type));
desc.putObject(stringIDToTypeID("using"), stringIDToTypeID(layerClass), usingDesc);
executeAction(stringIDToTypeID("make"), desc, DialogModes.NO);
