#target photoshop

/*

SCRIPTMETA-BEGIN
Script-ID=org.iwashi.Clone_property_toggle
Version=1
Meta-URL=https://github.com/Yamonov/Iwashiya_Scripts/tree/main/Photoshop
Name=クローンソースとプロパティを表示切り替え
Author=Murakami Yoshiteru
Target-App=Photoshop
Edit-Password-SHA256=BS4FB5f2srYDWER5:56cdf07299c2c26623d132b3dd154b8d9fe7a7a21a86394cd49ab2ee21eb83ea
SCRIPTMETA-END

*/

(function () {
    var stateKey = stringIDToTypeID("yamoClonePropertyToggleState");
    var nextPanelKey = stringIDToTypeID("nextPanel");

    function runCommand(commandName) {
        var commandID = stringIDToTypeID(commandName);
        app.runMenuItem(commandID);
    }

    function readNextPanel() {
        try {
            var descriptor = app.getCustomOptions(stateKey);
            if (descriptor.hasKey(nextPanelKey)) {
                var nextPanel = descriptor.getString(nextPanelKey);
                if (nextPanel === "cloneSource" || nextPanel === "properties") {
                    return nextPanel;
                }
            }
        } catch (e) {
        }

        return "properties";
    }

    function writeNextPanel(nextPanel) {
        try {
            var descriptor = new ActionDescriptor();
            descriptor.putString(nextPanelKey, nextPanel);
            app.putCustomOptions(stateKey, descriptor, true);
        } catch (e) {
        }
    }

    function openCloneSource() {
        runCommand("toggleCloneSourcePalette");
        writeNextPanel("properties");
    }

    function openProperties() {
        runCommand("togglePropertiesPanel");
        writeNextPanel("cloneSource");
    }

    try {
        if (readNextPanel() === "cloneSource") {
            openCloneSource();
        } else {
            openProperties();
        }
    } catch (e) {
        alert("コピーソース / プロパティの切り替えに失敗しました。\n" + e);
    }
}());
