#target photoshop

/*
SCRIPTMETA-BEGIN
Script-ID=org.iwashi.adjustmentLayer_solidColor
Meta-Default-language=ja
Name=塗り: ベタ
Name[en]=Add Solid Color Fill Layer
Tags=塗りつぶし,fill layer,ベタ塗り,solid color
Target-App=Photoshop
SCRIPTMETA-END
*/

var item = { key: "solidColorLayer", name: "塗り: ベタ", shortName: "塗", kind: "fill", type: "solidColorLayer" };
var layerClass = item.kind === "fill" ? "contentLayer" : "adjustmentLayer";
var desc = new ActionDescriptor();
var ref = new ActionReference();
var usingDesc = new ActionDescriptor();
ref.putClass(stringIDToTypeID(layerClass));
desc.putReference(stringIDToTypeID("null"), ref);
usingDesc.putClass(stringIDToTypeID("type"), stringIDToTypeID(item.type));
desc.putObject(stringIDToTypeID("using"), stringIDToTypeID(layerClass), usingDesc);
executeAction(stringIDToTypeID("make"), desc, DialogModes.NO);
