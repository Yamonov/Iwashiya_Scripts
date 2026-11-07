#target photoshop

/*
SCRIPTMETA-BEGIN
Script-ID=org.iwashi.adjustmentLayer_colorLookup
Meta-Default-language=ja
Name=カラールックアップ
Name[en]=Add Color Lookup Adjustment Layer
Tags=調整レイヤー,adjustment layer,カラー,color
Target-App=Photoshop
SCRIPTMETA-END
*/

var item = { key: "colorLookup", name: "カラールックアップ", shortName: "CL", kind: "adjustment", type: "colorLookup" };
var layerClass = item.kind === "fill" ? "contentLayer" : "adjustmentLayer";
var desc = new ActionDescriptor();
var ref = new ActionReference();
var usingDesc = new ActionDescriptor();
ref.putClass(stringIDToTypeID(layerClass));
desc.putReference(stringIDToTypeID("null"), ref);
usingDesc.putClass(stringIDToTypeID("type"), stringIDToTypeID(item.type));
desc.putObject(stringIDToTypeID("using"), stringIDToTypeID(layerClass), usingDesc);
executeAction(stringIDToTypeID("make"), desc, DialogModes.NO);
