#target photoshop

/*
SCRIPTMETA-BEGIN
Script-ID=org.iwashi.adjustmentLayer_posterize
Meta-Default-language=ja
Name=ポスタリゼーション
Name[en]=Add Posterize Adjustment Layer
Tags=調整レイヤー,adjustment layer,階調,tone
Target-App=Photoshop
SCRIPTMETA-END
*/

var item = { key: "posterization", name: "ポスタリゼーション", shortName: "Po", kind: "adjustment", type: "posterization" };
var layerClass = item.kind === "fill" ? "contentLayer" : "adjustmentLayer";
var desc = new ActionDescriptor();
var ref = new ActionReference();
var usingDesc = new ActionDescriptor();
ref.putClass(stringIDToTypeID(layerClass));
desc.putReference(stringIDToTypeID("null"), ref);
usingDesc.putClass(stringIDToTypeID("type"), stringIDToTypeID(item.type));
desc.putObject(stringIDToTypeID("using"), stringIDToTypeID(layerClass), usingDesc);
executeAction(stringIDToTypeID("make"), desc, DialogModes.NO);
