/*
SCRIPTMETA-BEGIN
Script-ID=org.iwashi.FindLinksByName
Version=1.1
Meta-URL=https://github.com/Yamonov/Iwashiya_Scripts/tree/main/InDesgin
Name=リンクファイル名で検索
Author=Murakami Yoshiteru
Target-App=InDesign
Description-BEGIN
現在のドキュメントのリンクを、ファイル名で検索します。
検索方法は「先頭一致」「部分一致」「拡張子のみ」「正規表現」から選択できます。英字の大文字と小文字は区別しません。
起動時にリンク情報を取得し、一覧上部の入力欄に入力するたびに結果を絞り込みます。入力欄が空なら全件を表示します。
標準の縦型は「S・P・ファイル名」の一覧と、選択したリンクの詳細を左右に表示します。ファイル名・親フォルダのパス・ドライブ名は折り返して全文を表示します。
検索欄右のボタンで横型に切り替えると、リンク状態・ページ番号・ファイル名・パス・実効ppi・形式・カラーモード・配置レイヤーを一覧表示します。
切り替え時も検索条件と選択を維持します。横型の長いパスは先頭を省略します。
ウインドウはリサイズでき、縦型・横型それぞれのサイズを開いている間は維持します。
リンク状態は最左列に、リンク切れを「×」、正常を空欄、その他を「△」で表示します。
正規表現が未完成または無効な間は、直前の結果を残してメッセージを表示します。
結果を選択すると、そのページへ移動し、配置オブジェクトを中央に表示します。一覧は「閉じる」またはEscで閉じます。
Description-END
SCRIPTMETA-END
*/
#target "indesign"

(function () {
    if (app.documents.length === 0) {
        alert("ドキュメントを開いてから実行してください。");
        return;
    }

    var doc = app.activeDocument;
    if (doc.layoutWindows.length === 0) {
        alert("ドキュメントのレイアウトウインドウを開いてから実行してください。");
        return;
    }

    var searchDialog = createSearchDialog(doc, collectLinks(doc));
    searchDialog.show();

    function createMatcher(mode, query) {
        // ファイルシステム由来の分離した濁点・半濁点も、入力欄の文字と照合する。
        query = normalizeKana(String(query));
        if (!query.length) return function () { return true; };
        if (mode === 3) {
            var expression = new RegExp(query, "i");
            return function (entry) { return expression.test(entry.matchName); };
        }
        query = query.toLowerCase();
        if (mode === 2) query = query.replace(/^\./, "");
        return function (entry) {
            if (mode === 0) return entry.foldedName.indexOf(query) === 0;
            if (mode === 1) return entry.foldedName.indexOf(query) !== -1;
            return query.length > 0 && entry.extension === query;
        };
    }

    function normalizeKana(text) {
        var voiced = "かきくけこさしすせそたちつてとはひふへほうゝカキクケコサシスセソタチツテトハヒフヘホウワヰヱヲヽ";
        var composed = "がぎぐげござじずぜぞだぢづでどばびぶべぼゔゞガギグゲゴザジズゼゾダヂヅデドバビブベボヴヷヸヹヺヾ";
        var semiVoiced = "はひふへほハヒフヘホ";
        var semiComposed = "ぱぴぷぺぽパピプペポ";
        return text.replace(/([\u3040-\u30ff])([\u3099\u309a])/g, function (pair, kana, mark) {
            var source = mark === "\u3099" ? voiced : semiVoiced;
            var index = source.indexOf(kana);
            return index < 0 ? pair : (mark === "\u3099" ? composed : semiComposed).charAt(index);
        });
    }

    function collectLinks(document) {
        var results = [];
        var links = document.links.everyItem().getElements();
        var startupDrive = getStartupDriveName();
        for (var i = 0; i < links.length; i++) {
            var link = links[i];
            if (!link.isValid) continue;
            var name = String(link.name);
            var matchName = normalizeKana(name);
            var foldedName = matchName.toLowerCase();
            var dot = foldedName.lastIndexOf(".");
            var item = getPlacementItem(link);
            var page = getParentPage(item);
            var pageOrder = 1000000000;
            var pageName = "—";
            if (page) {
                pageName = String(page.name);
                try {
                    if (page.parent.constructor.name !== "MasterSpread") pageOrder = Number(page.documentOffset);
                } catch (pageOrderError) {}
            }
            var path = "";
            var parentPath = "";
            var drive = "—";
            try {
                if (link.filePath) {
                    var rawPath = String(link.filePath);
                    var file = File(rawPath);
                    path = file.fsName;
                    parentPath = file.parent.fsName;
                    drive = getDriveName(path, rawPath, Folder.fs, startupDrive);
                }
            } catch (pathError) {}
            var details = getLinkDetails(link, item);
            var linkStatus = link.status;
            results.push({
                linkId: link.id,
                name: name,
                matchName: matchName,
                foldedName: foldedName,
                extension: dot > 0 ? foldedName.substring(dot + 1) : "",
                path: path,
                parentPath: parentPath,
                drive: drive,
                pageName: pageName,
                pageOrder: pageOrder,
                status: statusLabel(linkStatus),
                statusIcon: statusIcon(linkStatus),
                effectivePpi: details.effectivePpi,
                format: details.format,
                colorMode: details.colorMode,
                layer: details.layer,
                order: i
            });
        }
        results.sort(function (a, b) {
            return a.pageOrder - b.pageOrder || a.order - b.order;
        });
        return results;
    }

    function getStartupDriveName() {
        if (Folder.fs !== "Macintosh") return "—";
        try {
            var volumes = Folder("/Volumes").getFiles();
            for (var i = 0; i < volumes.length; i++) {
                if (volumes[i] instanceof Folder && volumes[i].fsName === "/") {
                    return String(volumes[i].displayName || File.decode(volumes[i].name));
                }
            }
        } catch (volumeError) {}
        return "—";
    }

    function getDriveName(path, rawPath, fileSystem, startupDrive) {
        var normalized = String(path).replace(/\\/g, "/");
        var match = /^([A-Za-z]:)(?:\/|$)/.exec(normalized);
        if (match) return match[1].toUpperCase();
        match = /^\/\/([^\/]+)\/([^\/]+)/.exec(normalized);
        if (match) return "\\\\" + match[1] + "\\" + match[2];
        if (fileSystem === "Macintosh") {
            // HFS形式なら、未接続のボリューム名も記録されたパスから取得できる。
            match = /^([^\/:]+):/.exec(String(rawPath));
            if (match) return match[1];
            match = /^\/Volumes\/([^\/]+)/.exec(normalized);
            if (match) return match[1];
            if (normalized.charAt(0) === "/") return startupDrive || "—";
        }
        return "—";
    }

    function statusLabel(status) {
        if (status === LinkStatus.NORMAL) return "正常";
        if (status === LinkStatus.LINK_MISSING) return "リンク切れ";
        if (status === LinkStatus.LINK_OUT_OF_DATE) return "要更新";
        if (status === LinkStatus.LINK_EMBEDDED) return "埋め込み";
        if (status === LinkStatus.LINK_INACCESSIBLE) return "アクセス不可";
        return "不明";
    }

    function statusIcon(status) {
        if (status === LinkStatus.NORMAL) return "";
        if (status === LinkStatus.LINK_MISSING) return "×";
        return "△";
    }

    function getLinkDetails(link, item) {
        var details = {effectivePpi: "—", format: "—", colorMode: "—", layer: "—"};
        var graphic = link.parent;
        // 拡張子から推測せず、InDesignが保持するリンク情報を使う。
        try {
            if (link.linkType) {
                var typeName = String(link.linkType);
                // "Portable Network Graphics (PNG)" などは、併記された略称で表示する。
                var abbreviation = /\(([A-Za-z0-9]+)\)$/.exec(typeName);
                details.format = abbreviation ? abbreviation[1] : typeName;
            }
        } catch (formatError) {}
        try { details.effectivePpi = formatPpi(graphic.effectivePpi); } catch (ppiError) {}
        try { if (graphic.space) details.colorMode = String(graphic.space); } catch (colorModeError) {}
        try {
            if (item && item.itemLayer && item.itemLayer.isValid) details.layer = String(item.itemLayer.name);
        } catch (layerError) {}
        return details;
    }

    function formatPpi(ppi) {
        if (!ppi || ppi.length < 2) return "—";
        var horizontal = Number(ppi[0]);
        var vertical = Number(ppi[1]);
        if (!isFinite(horizontal) || !isFinite(vertical) || horizontal <= 0 || vertical <= 0) return "—";
        horizontal = Math.round(horizontal);
        vertical = Math.round(vertical);
        return horizontal === vertical ? String(horizontal) : horizontal + " × " + vertical;
    }

    function getPlacementItem(link) {
        var item = link.parent;
        // 配置したInDesignファイル等の内部リンクは、外側の配置を表示する。
        for (var depth = 0; item && item.constructor.name === "Link" && depth < 16; depth++) {
            item = item.parent;
        }
        if (!item) return null;
        if (item.constructor.name === "Story") {
            try { return item.textContainers.length ? item.textContainers[0] : null; } catch (storyError) { return null; }
        }
        try {
            // Photoshop_InDesignResizeCrop.jsxと同様、画像の外側の配置フレームを選択する。
            if (item.parent && item.parent.isValid && typeof item.parent.select === "function") return item.parent;
        } catch (parentError) {}
        return item;
    }

    function getParentPage(item) {
        for (var depth = 0; item && depth < 32; depth++) {
            try {
                var page = item.parentPage;
                if (page && page.isValid) return page;
            } catch (pageError) {}
            // アンカー付きオブジェクトの親が文字の場合は、その文字の配置先を調べる。
            try {
                if (item.parentTextFrames && item.parentTextFrames.length) {
                    page = item.parentTextFrames[0].parentPage;
                    if (page && page.isValid) return page;
                }
            } catch (textFrameError) {}
            try { item = item.parent; } catch (parentError) { return null; }
        }
        return null;
    }

    function createSearchDialog(document, results) {
        var dialog = new Window("dialog", "リンクファイル名で検索", undefined, {resizeable: true});
        var searchRow = dialog.add("group");
        var method = searchRow.add("dropdownlist", undefined, ["先頭一致", "部分一致", "拡張子のみ", "正規表現"]);
        method.selection = 1;
        method.helpTip = "検索方法";
        var input = searchRow.add("edittext", undefined, "");
        input.helpTip = "入力するたびに絞り込みます。拡張子のみの場合は psd または .psd のように入力します。";
        var toggle = searchRow.add("button", undefined, "横型");
        var message = dialog.add("statictext", undefined, "", {multiline: true});
        var body = dialog.add("group");
        var buttons = dialog.add("group");
        var close = buttons.add("button", undefined, "閉じる", {name: "cancel"});
        dialog.cancelElement = close;
        dialog.defaultElement = null;
        close.onClick = function () { dialog.close(0); };

        var portrait = true;
        var portraitMinimum = [528, 646];
        var portraitSize = [528, 969]; // 従来の内容高646pxの1.5倍。
        var landscapeSize = [1202, 28 + Math.max(4, Math.min(12, results.length)) * 24 + 132];
        var landscapeWidths = [44, 90, 250, 300, 110, 110, 110, 140];
        var list = null;
        var details = null;
        var detailsViewport = null;
        var detailsScroll = null;
        var detailControls = null;
        var detailWidth = 208;
        var lastDetailLinkId = null;
        var fields = [
            ["name", "ファイル名", true],
            ["status", "状態", false],
            ["parentPath", "パス", true],
            ["drive", "ドライブ", true],
            ["pageName", "ページ", false],
            ["layer", "レイヤー", false],
            ["format", "形式", false],
            ["colorMode", "モード", false]
        ];
        var visibleResults = [];
        var updatingList = false;
        var resizing = false;
        var builtBodyWidth = 0;
        var lastQuery = null;
        var lastMode = null;
        var listHelp = "結果を選ぶと配置オブジェクトを表示します。×：リンク切れ、空欄：正常、△：その他。取得できない項目は「—」で表示します。";

        function selectedResult() {
            return list && list.selection ? list.selection.result : null;
        }

        function setBounds(control, x, y, width, height) {
            control.bounds = [x, y, x + width, y + height];
        }

        function listWidthFor(contentWidth) {
            return portrait ? 284 + Math.floor((contentWidth - 504) * 0.55) : contentWidth;
        }

        function layoutControls() {
            if (!list || updatingList) return;
            var width = dialog.size.width;
            var height = dialog.size.height;
            var contentWidth = width - 24;
            var messageHeight = portrait ? 32 : 18;
            var bodyTop = 62 + messageHeight;
            var bodyHeight = height - bodyTop - 52;
            setBounds(searchRow, 12, 12, contentWidth, 26);
            setBounds(method, 0, 0, 100, 26);
            setBounds(input, 108, 0, contentWidth - 176, 26);
            setBounds(toggle, contentWidth - 60, 0, 60, 26);
            setBounds(message, 12, 50, contentWidth, messageHeight);
            setBounds(body, 12, bodyTop, contentWidth, bodyHeight);
            setBounds(buttons, width - 98, height - 40, 86, 28);
            setBounds(close, 0, 0, 86, 28);
            var listWidth = listWidthFor(contentWidth);
            setBounds(list, 0, 0, listWidth, bodyHeight);
            if (portrait) {
                detailWidth = contentWidth - listWidth - 12;
                updateDetails(selectedResult());
            }
        }

        function buildBody(selectedId) {
            updatingList = true;
            try {
                while (body.children.length) body.remove(body.children[0]);
                details = null;
                detailsViewport = null;
                detailsScroll = null;
                detailControls = null;
                var contentWidth = dialog.size.width - 24;
                var listWidth = listWidthFor(contentWidth);
                var widths = portrait ? [28, 44, listWidth - 96] : landscapeWidths.slice(0);
                if (!portrait) widths[3] += contentWidth - 1178;
                var titles = portrait ? ["S", "P", "ファイル名"] :
                    ["状態", "ページ番号", "ファイル名", "パス", "実効ppi", "形式", "カラーモード", "配置レイヤー"];
                list = body.add("listbox", undefined, [], {
                    multiselect: false,
                    numberOfColumns: widths.length,
                    showHeaders: true,
                    columnTitles: titles,
                    columnWidths: widths
                });
                list.helpTip = listHelp;
                list.onChange = selectResult;
                if (portrait) {
                    detailsViewport = body.add("panel");
                    details = detailsViewport.add("group");
                    detailsScroll = body.add("scrollbar", [0, 0, 12, 100], 0, 0, 1);
                    detailsScroll.visible = false;
                    detailsScroll.stepdelta = 20;
                    detailsScroll.onChanging = detailsScroll.onChange = function () {
                        details.location = [0, -Math.round(detailsScroll.value)];
                    };
                    detailControls = {};
                    for (var i = 0; i < fields.length; i++) {
                        var group = details.add("group");
                        var label = fields[i][2] ? group.add("statictext", undefined, fields[i][1]) : null;
                        var value = group.add("statictext", undefined, "—", {multiline: fields[i][2]});
                        detailControls[fields[i][0]] = {group: group, label: label, value: value};
                    }
                } else {
                    for (var j = 0; j < results.length; j++) {
                        results[j].displayPath = shortenPath(results[j].path, widths[3] - 20, list.graphics);
                    }
                }
                builtBodyWidth = contentWidth;
            } finally {
                updatingList = false;
            }
            layoutControls();
            populateList(selectedId);
        }

        function updateDetails(result) {
            if (!detailControls) return;
            for (var i = 0; i < fields.length; i++) {
                var key = fields[i][0];
                var text = result ? String(result[key] || "—") : "—";
                var value = detailControls[key].value;
                if (fields[i][2]) {
                    value.text = text;
                    value.helpTip = text;
                } else {
                    value.text = fields[i][1] + "：" + text;
                    value.helpTip = value.text;
                }
            }
            var linkId = result ? result.linkId : null;
            if (linkId !== lastDetailLinkId) detailsScroll.value = 0;
            lastDetailLinkId = linkId;
            layoutDetails();
        }

        function layoutDetailFields(width) {
            var top = 0;
            for (var i = 0; i < fields.length; i++) {
                var field = detailControls[fields[i][0]];
                var valueHeight = 18;
                if (fields[i][2]) {
                    // ScriptUIと同じフォント・表示幅で、折り返し後の全文の高さを測る。
                    var graphics = field.value.graphics;
                    var measured = graphics.measureString(field.value.text, graphics.font, Math.max(1, width - 4));
                    valueHeight = Math.max(18, Math.ceil(measured[1]) + 4);
                }
                var valueTop = fields[i][2] ? 21 : 0;
                var fieldHeight = valueTop + valueHeight;
                setBounds(field.group, 0, top, width, fieldHeight);
                if (field.label) setBounds(field.label, 0, 0, width, 18);
                setBounds(field.value, 0, valueTop, width, valueHeight);
                top += fieldHeight + 10;
            }
            return top - 10;
        }

        function layoutDetails() {
            var height = layoutDetailFields(detailWidth);
            var scrollNeeded = height > body.size.height;
            var width = scrollNeeded ? detailWidth - 16 : detailWidth;
            if (scrollNeeded) height = layoutDetailFields(width);
            var viewportHeight = Math.min(height, body.size.height);
            setBounds(detailsViewport, list.size.width + 12, 0, width, viewportHeight);
            detailsScroll.maxvalue = Math.max(1, height - viewportHeight);
            detailsScroll.value = scrollNeeded ? Math.min(detailsScroll.value, height - viewportHeight) : 0;
            detailsScroll.jumpdelta = Math.max(20, viewportHeight - 20);
            detailsScroll.visible = scrollNeeded;
            setBounds(detailsScroll, list.size.width + 12 + width + 4, 0, 12, viewportHeight);
            // 収まる場合は上に詰め、長文の場合だけ詳細欄をスクロールする。
            setBounds(details, 0, -Math.round(detailsScroll.value), width, height);
        }

        function populateList(selectedId) {
            updatingList = true;
            try {
                list.removeAll();
                list.helpTip = listHelp;
                for (var i = 0; i < visibleResults.length; i++) {
                    var result = visibleResults[i];
                    var row = list.add("item", result.statusIcon);
                    row.subItems[0].text = result.pageName;
                    row.subItems[1].text = result.name;
                    if (!portrait) {
                        row.subItems[2].text = result.displayPath;
                        row.subItems[3].text = result.effectivePpi;
                        row.subItems[4].text = result.format;
                        row.subItems[5].text = result.colorMode;
                        row.subItems[6].text = result.layer;
                    }
                    row.result = result;
                    if (result.linkId === selectedId) {
                        list.selection = row;
                        list.helpTip = result.status + "\n" + (result.path || "パスなし");
                    }
                }
            } finally {
                updatingList = false;
            }
            updateDetails(selectedResult());
        }

        function updateResults() {
            var query = input.text;
            var mode = method.selection.index;
            if (query === lastQuery && mode === lastMode) return;
            lastQuery = query;
            lastMode = mode;
            var matcher;
            try {
                matcher = createMatcher(mode, query);
            } catch (error) {
                message.text = "正規表現が未完成または無効です。直前の結果を表示しています。";
                return;
            }
            var nextResults = [];
            for (var index = 0; index < results.length; index++) {
                if (matcher(results[index])) nextResults.push(results[index]);
            }
            var changed = visibleResults.length !== nextResults.length;
            for (var j = 0; !changed && j < nextResults.length; j++) {
                if (visibleResults[j].linkId !== nextResults[j].linkId) changed = true;
            }
            if (changed) {
                var selected = selectedResult();
                visibleResults = nextResults;
                populateList(selected ? selected.linkId : null);
            }
            message.text = nextResults.length + "件 / 全" + results.length + "件" +
                (nextResults.length ? "" : "　該当するリンクはありません。");
        }

        function selectResult() {
            // マウスで行を選んでもactiveがfalseの場合があるため、フォーカスでは判定しない。
            if (updatingList) return;
            var selected = selectedResult();
            updateDetails(selected);
            if (!selected) return;
            list.helpTip = selected.status + "\n" + (selected.path || "パスなし");
            try {
                showPlacement(document, selected.linkId);
            } catch (error) {
                alert("配置オブジェクトを表示できません。\n" + String(error.message || error));
            }
        }

        function rememberSize() {
            var size = [dialog.size.width, dialog.size.height];
            if (portrait) portraitSize = size;
            else landscapeSize = size;
        }

        function resizeDialog(finished) {
            if (resizing || updatingList) return;
            resizing = true;
            try {
                var minimum = portrait ? portraitMinimum : [1202, 256];
                if (dialog.size.width < minimum[0] || dialog.size.height < minimum[1]) {
                    dialog.size = [Math.max(minimum[0], dialog.size.width), Math.max(minimum[1], dialog.size.height)];
                }
                // 列幅は作成時にしか設定できないため、幅の変更が終わった時だけ一覧を作り直す。
                if (finished && dialog.size.width - 24 !== builtBodyWidth) {
                    var selected = selectedResult();
                    buildBody(selected ? selected.linkId : null);
                } else {
                    layoutControls();
                }
                rememberSize();
            } finally {
                resizing = false;
            }
        }

        function applyMode(selectedId) {
            resizing = true;
            try {
                dialog.minimumSize = [0, 0];
                dialog.maximumSize = [10000, 10000];
                dialog.minimumSize = portrait ? portraitMinimum : [1202, 256];
                var size = portrait ? portraitSize : landscapeSize;
                dialog.preferredSize = size;
                dialog.size = size;
                toggle.text = portrait ? "横型" : "縦型";
                toggle.helpTip = portrait ? "横型に切り替え" : "縦型に切り替え";
                buildBody(selectedId);
            } finally {
                resizing = false;
            }
        }

        // 自動レイアウトによるサイズの巻き戻りを避け、内容をウインドウの現在サイズに合わせる。
        dialog.layout = {layout: layoutControls, resize: layoutControls};
        dialog.onResizing = function () { resizeDialog(false); };
        dialog.onResize = function () { resizeDialog(true); };
        toggle.onClick = function () {
            var selected = selectedResult();
            rememberSize();
            portrait = !portrait;
            applyMode(selected ? selected.linkId : null);
            if (dialog.visible) dialog.center();
            input.active = true;
        };
        input.onChanging = updateResults;
        input.onChange = updateResults;
        method.onChange = updateResults;
        dialog.onShow = function () { input.active = true; };
        applyMode(null);
        updateResults();
        return dialog;
    }

    function shortenPath(path, maxWidth, graphics) {
        if (!path) return "—";
        function width(text) { return graphics.measureString(text)[0]; }
        if (width(path) <= maxWidth) return path;
        var low = 0;
        var high = path.length;
        while (low < high) {
            var middle = Math.floor((low + high) / 2);
            if (width("…" + path.substring(middle)) <= maxWidth) high = middle;
            else low = middle + 1;
        }
        // サロゲートペアの後半から表示を始めない。
        var code = path.charCodeAt(low);
        if (code >= 0xDC00 && code <= 0xDFFF) low++;
        return "…" + path.substring(low);
    }

    function showPlacement(document, linkId) {
        if (!document.isValid || !document.layoutWindows.length) throw new Error("対象ドキュメントが閉じられています。");
        var link = document.links.itemByID(linkId);
        if (!link.isValid) throw new Error("対象リンクが見つかりません。");
        var item = getPlacementItem(link);
        if (!item || !item.isValid) throw new Error("表示できる配置オブジェクトがありません。");
        var win = document.layoutWindows[0];
        win.bringToFront();
        var page = getParentPage(item);
        if (page) win.activePage = page;
        else {
            var parent = item;
            for (var depth = 0; parent && depth < 32; depth++) {
                if (parent.constructor.name === "Spread" || parent.constructor.name === "MasterSpread") {
                    win.activeSpread = parent;
                    break;
                }
                try { parent = parent.parent; } catch (parentError) { break; }
            }
        }
        item.select();

        // Photoshop/Photoshop_InDesignResizeCrop.jsx の showInInDesignSide / fitSelection を使用。
        var fitSelectionAction = app.menuActions.itemByName("$ID/Fit Selection in Window");
        if (!fitSelectionAction.isValid) throw new Error("選択オブジェクトの中央表示を実行できません。");
        fitSelectionAction.invoke();
        if (win.zoomPercentage > 200) win.zoomPercentage = 200;
    }
})();
