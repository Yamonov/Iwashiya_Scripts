/*

SCRIPTMETA-BEGIN
Script-ID=org.iwashi.Photoshop_toggle_mask
Version=1
Release-Date=2026-03-23
Meta-URL=https://github.com/Yamonov/Iwashiya_Scripts/tree/main/Photoshop
Target-App=Photoshop
Description-BEGIN
レイヤーマスクやクイックマスクの表示を、実行するたびに
通常表示→オーバーレイ表示→マスクのみ表示
と順に切り替えます。
Description-END
SCRIPTMETA-END

*/
if (app.documents.length) {
    main();
}

//実行部分
function main() {
    var myDoc = app.activeDocument;
    var myCh = myDoc.channels;
    var myVisibleCh = getChannel();
    var myChID = [];

    //モード判別
    try {
        switch (myDoc.mode) {
            case DocumentMode.LAB:
                var myMode = 3;
                myChID = ['Lght', 'A   ', 'B   '];
                break;
            case DocumentMode.GRAYSCALE:
                var myMode = 1;
                myChID = ['Blck'];
                break;
            case DocumentMode.RGB:
                var myMode = 3;
                myChID = ['Rd  ', 'Grn ', 'Bl  '];
                break;
            case DocumentMode.CMYK:
                var myMode = 4;
                myChID = ['Cyn ', 'Mgnt', 'Yllw', 'Blck'];
                break;
            case DocumentMode.INDEXCOLOR:
                var myMode = 1;
                myChID = ['RGB '];
                break;
            case DocumentMode.MULTICHANNEL:
            case DocumentMode.BITMAP:
                alert('このモードは未対応です');
                return;
                break;
        }
    } catch (e) {
        return
    };

    //var myChVis=getVisible ();

    //クイックマスクモード
    if (myDoc.quickMaskMode) {
        if (getVisible()) {
            SwHdComponents(myChID, 'Hd  ');
        } else {
            SwHdComponents(myChID, 'Shw ');
        };
        return;
    };

    //レイヤーマスクの有無
    if (!hasLayerMask()) {
        return;
    };

    //レイヤーマスク表示・非表示
    if (myVisibleCh > myMode) {
        ShowMask();
        return;
    };
    if (myVisibleCh == myMode && myMode != 1) {
        ShowwithMask();
        return;
    };
    if (myMode == 1) {
        if (myVisibleCh == 1 && getVisible() == 1) {
            ShowwithMask();
        } else {
            HideMask();
        };
    } else {
        HideMask()
    };
} //mainここまで

//コンポーネントチャンネルが表示されているか　Buliarca Cristian http://buliarcatools.blog.fc2.com/blog-entry-5.html
function getVisible() {
    var map = {}
    map[DocumentMode.GRAYSCALE] = charIDToTypeID('Blck');
    map[DocumentMode.RGB] = charIDToTypeID('RGB ');
    map[DocumentMode.CMYK] = charIDToTypeID('CMYK');
    map[DocumentMode.LAB] = charIDToTypeID('Lab ');
    var ref = new ActionReference();
    ref.putEnumerated(charIDToTypeID('Chnl'), charIDToTypeID('Chnl'), map[app.activeDocument.mode]);
    var vis = executeActionGet(ref).getInteger(stringIDToTypeID('visible'));
    return vis;
}

//コンポーネントチャンネルを表示・非表示
function SwHdComponents(myQMID, mySH) {
    var myQMIDLength = myQMID.length;
    var myADSwHd = charIDToTypeID(mySH);
    var myADDesc = new ActionDescriptor();
    var idnull = charIDToTypeID('null');
    var myADList = new ActionList();

    for (i = 0; i < myQMIDLength; i++) {
        var myADRef = new ActionReference();
        var idChnl = charIDToTypeID('Chnl');
        var idRd = charIDToTypeID(myQMID[i]);
        myADRef.putEnumerated(idChnl, idChnl, idRd);
        myADList.putReference(myADRef);
    }
    myADDesc.putList(idnull, myADList);
    executeAction(myADSwHd, myADDesc, DialogModes.NO);
}

//マスク非表示
function HideMask() {
    var idSlct = charIDToTypeID('slct');
    var idNull = charIDToTypeID('null');
    var idChnl = charIDToTypeID('Chnl');
    var idMsk = charIDToTypeID('Msk ');
    var idMkVs = charIDToTypeID('MkVs');
    var switchToMaskDescriptor = new ActionDescriptor();
    var actionRef = new ActionReference();
    actionRef.putEnumerated(idChnl, idChnl, idMsk);
    switchToMaskDescriptor.putReference(idNull, actionRef);
    switchToMaskDescriptor.putBoolean(idMkVs, false);
    executeAction(idSlct, switchToMaskDescriptor, DialogModes.NO);
}

//マスクのみ表示
function ShowMask() {
    var idSlct = charIDToTypeID('slct');
    var idNull = charIDToTypeID('null');
    var idChnl = charIDToTypeID('Chnl');
    var idMsk = charIDToTypeID('Msk ');
    var idMkVs = charIDToTypeID('MkVs');
    var switchToMaskDescriptor = new ActionDescriptor();
    var actionRef = new ActionReference();
    actionRef.putEnumerated(idChnl, idChnl, idMsk);
    switchToMaskDescriptor.putReference(idNull, actionRef);
    switchToMaskDescriptor.putBoolean(idMkVs, true);
    executeAction(idSlct, switchToMaskDescriptor, DialogModes.NO);
}

//マスクオーバーレイ
function ShowwithMask() {
    var idShw = charIDToTypeID('Shw ');
    var desc = new ActionDescriptor();
    var idnull = charIDToTypeID('null');
    var list = new ActionList();
    var ref = new ActionReference();
    var idChnl = charIDToTypeID('Chnl');
    var idMsk = charIDToTypeID('Msk ');
    ref.putEnumerated(idChnl, idChnl, idMsk);
    list.putReference(ref);
    desc.putList(idnull, list);
    executeAction(idShw, desc, DialogModes.NO);
}

//レイヤーマスクの有無判定　Paul Riggott https://forums.adobe.com/thread/909630
function hasLayerMask() {
    var hasLayerMask = false;
    try {
        var ref = new ActionReference();
        var keyUserMaskEnabled = app.charIDToTypeID('UsrM');
        ref.putProperty(app.charIDToTypeID('Prpr'), keyUserMaskEnabled);
        ref.putEnumerated(app.charIDToTypeID('Lyr '), app.charIDToTypeID('Ordn'), app.charIDToTypeID('Trgt'));
        var desc = executeActionGet(ref);
        if (desc.hasKey(keyUserMaskEnabled)) {
            hasLayerMask = true;
        }
    } catch (e) {
        hasLayerMask = false;
    }
    return hasLayerMask;
}

//表示されているチャンネル数取得 Buliarca Cristian http://buliarcatools.blog.fc2.com/blog-entry-5.html
function getChannel() {
    var ref = new ActionReference();
    var keyVisChannels = app.stringIDToTypeID('visibleChannels');
    ref.putEnumerated(app.charIDToTypeID('Lyr '), app.charIDToTypeID('Ordn'), app.charIDToTypeID('Trgt'));
    var desc = executeActionGet(ref);
    return desc.getList(keyVisChannels).count;
}