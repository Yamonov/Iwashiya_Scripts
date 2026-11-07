#target photoshop

/*
SCRIPTMETA-BEGIN
Script-ID=org.iwashi.adjustmentLayer_photoFilter
Meta-Default-language=ja
Name=レンズフィルター
Name[en]=Add Photo Filter Adjustment Layer
Tags=調整レイヤー,adjustment layer,カラー,color
Target-App=Photoshop
SCRIPTMETA-END
*/

var item = { key: "photoFilter", name: "レンズフィルター", shortName: "PF", kind: "adjustment", type: "photoFilter" };
var layerClass = item.kind === "fill" ? "contentLayer" : "adjustmentLayer";
var desc = new ActionDescriptor();
var ref = new ActionReference();
var usingDesc = new ActionDescriptor();
ref.putClass(stringIDToTypeID(layerClass));
desc.putReference(stringIDToTypeID("null"), ref);
usingDesc.putClass(stringIDToTypeID("type"), stringIDToTypeID(item.type));
desc.putObject(stringIDToTypeID("using"), stringIDToTypeID(layerClass), usingDesc);
executeAction(stringIDToTypeID("make"), desc, DialogModes.NO);
