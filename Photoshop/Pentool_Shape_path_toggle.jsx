/*

SCRIPTMETA-BEGIN
Script-ID=org.iwashi.pentool_shape_path_toggle
Version=1
Meta-URL=https://github.com/Yamonov/Iwashiya_Scripts/tree/main/Photoshop
Name=ペンツールのシェイプとパスを切り替える
Author=Yoshiteru Murakami
Release-Date=2026-05-24
Target-App=Photoshop
Edit-Password-SHA256=1FYSAB6FvmjMBEBL:9e1c2560dbe96376f1dab34336226ddbf657ed4db6748fc442b180ceb0a329d7
Description-BEGIN
ペンツール選択時、実行する度にシェイプモードとパスモードを切り替えます
Description-END
SCRIPTMETA-END

*/

(function () {
    var s2t = stringIDToTypeID;
    var toolID = s2t("tool");
    var penToolID = s2t("penTool");
    var modeID = s2t("geometryToolMode");

    var readRef = new ActionReference();
    readRef.putProperty(s2t("property"), toolID);
    readRef.putEnumerated(s2t("application"), s2t("ordinal"), s2t("targetEnum"));

    var toolDesc = executeActionGet(readRef);
    var toolClass = toolDesc.getEnumerationType(toolID);
    if (toolClass !== penToolID) {
        return;
    }

    var options = toolDesc.getObjectValue(s2t("currentToolOptions"));
    if (!options.hasKey(modeID)) {
        return;
    }

    var currentMode = typeIDToStringID(options.getEnumerationValue(modeID));
    var nextMode;
    if (currentMode === "shape") {
        nextMode = "path";
    } else if (currentMode === "path") {
        nextMode = "shape";
    } else {
        return;
    }

    options.putEnumerated(modeID, modeID, s2t(nextMode));

    var setRef = new ActionReference();
    setRef.putClass(toolClass);

    var desc = new ActionDescriptor();
    desc.putReference(s2t("null"), setRef);
    desc.putObject(s2t("to"), s2t("null"), options);

    executeAction(s2t("set"), desc, DialogModes.NO);
}());
