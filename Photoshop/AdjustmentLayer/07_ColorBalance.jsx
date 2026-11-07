#target photoshop

/*
SCRIPTMETA-BEGIN
Script-ID=org.iwashi.adjustmentLayer_colorBalance
Meta-Default-language=ja
Name=カラーバランス
Name[en]=Add Color Balance Adjustment Layer
Tags=調整レイヤー,adjustment layer,カラー,color
Target-App=Photoshop
SCRIPTMETA-END
*/

var item = { key: "colorBalance", name: "カラーバランス", shortName: "CB", kind: "adjustment", type: "colorBalance" };
var layerClass = item.kind === "fill" ? "contentLayer" : "adjustmentLayer";
var desc = new ActionDescriptor();
var ref = new ActionReference();
var usingDesc = new ActionDescriptor();
ref.putClass(stringIDToTypeID(layerClass));
desc.putReference(stringIDToTypeID("null"), ref);
usingDesc.putClass(stringIDToTypeID("type"), stringIDToTypeID(item.type));
desc.putObject(stringIDToTypeID("using"), stringIDToTypeID(layerClass), usingDesc);
executeAction(stringIDToTypeID("make"), desc, DialogModes.NO);
