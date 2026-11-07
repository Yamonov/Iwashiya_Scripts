#target photoshop

/*
SCRIPTMETA-BEGIN
Script-ID=org.iwashi.adjustmentLayer_clarity
Meta-Default-language=ja
Name=効果: かすみ
Name[en]=Add Clarity Adjustment Layer
Tags=調整レイヤー,adjustment layer,コントラスト,contrast
Target-App=Photoshop
SCRIPTMETA-END
*/

var item = { key: "clarity", name: "効果: かすみ", shortName: "霞", kind: "adjustment", type: "clarity" };
var layerClass = item.kind === "fill" ? "contentLayer" : "adjustmentLayer";
var desc = new ActionDescriptor();
var ref = new ActionReference();
var usingDesc = new ActionDescriptor();
ref.putClass(stringIDToTypeID(layerClass));
desc.putReference(stringIDToTypeID("null"), ref);
usingDesc.putClass(stringIDToTypeID("type"), stringIDToTypeID(item.type));
desc.putObject(stringIDToTypeID("using"), stringIDToTypeID(layerClass), usingDesc);
executeAction(stringIDToTypeID("make"), desc, DialogModes.NO);
