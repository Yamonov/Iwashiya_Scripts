#target photoshop

/*
SCRIPTMETA-BEGIN
Script-ID=org.iwashi.adjustmentLayer_exposure
Meta-Default-language=ja
Name=露光量
Name[en]=Add Exposure Adjustment Layer
Tags=調整レイヤー,adjustment layer,露光量,exposure
Target-App=Photoshop
SCRIPTMETA-END
*/

var item = { key: "exposure", name: "露光量", shortName: "露", kind: "adjustment", type: "exposure" };
var layerClass = item.kind === "fill" ? "contentLayer" : "adjustmentLayer";
var desc = new ActionDescriptor();
var ref = new ActionReference();
var usingDesc = new ActionDescriptor();
ref.putClass(stringIDToTypeID(layerClass));
desc.putReference(stringIDToTypeID("null"), ref);
usingDesc.putClass(stringIDToTypeID("type"), stringIDToTypeID(item.type));
desc.putObject(stringIDToTypeID("using"), stringIDToTypeID(layerClass), usingDesc);
executeAction(stringIDToTypeID("make"), desc, DialogModes.NO);
