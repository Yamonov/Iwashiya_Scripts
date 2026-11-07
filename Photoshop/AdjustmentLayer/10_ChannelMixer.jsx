#target photoshop

/*
SCRIPTMETA-BEGIN
Script-ID=org.iwashi.adjustmentLayer_channelMixer
Meta-Default-language=ja
Name=チャンネルミキサー
Name[en]=Add Channel Mixer Adjustment Layer
Tags=調整レイヤー,adjustment layer,カラー,color
Target-App=Photoshop
SCRIPTMETA-END
*/

var item = { key: "channelMixer", name: "チャンネルミキサー", shortName: "CM", kind: "adjustment", type: "channelMixer" };
var layerClass = item.kind === "fill" ? "contentLayer" : "adjustmentLayer";
var desc = new ActionDescriptor();
var ref = new ActionReference();
var usingDesc = new ActionDescriptor();
ref.putClass(stringIDToTypeID(layerClass));
desc.putReference(stringIDToTypeID("null"), ref);
usingDesc.putClass(stringIDToTypeID("type"), stringIDToTypeID(item.type));
desc.putObject(stringIDToTypeID("using"), stringIDToTypeID(layerClass), usingDesc);
executeAction(stringIDToTypeID("make"), desc, DialogModes.NO);
