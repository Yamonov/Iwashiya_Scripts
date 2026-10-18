/*
SCRIPTMETA-BEGIN
Script-ID=org.iwashi.FindLinksByName
Version=1
Meta-URL=https://github.com/Yamonov/Iwashiya_Scripts/tree/main/InDesgin
Name=リンクファイル名で検索
Author=Murakami Yoshiteru
Target-App=InDesign
Description-BEGIN
現在のドキュメントのリンクを、ファイル名で検索します。
検索方法は「先頭一致」「部分一致」「拡張子のみ」「正規表現」から選択できます。英字の大文字と小文字は区別しません。
起動時にリンク情報を取得し、一覧上部の入力欄に入力するたびに結果を絞り込みます。入力欄が空なら全件を表示します。
リンク状態・ページ番号・ファイル名・パス・実効ppi・形式・カラーモード・配置レイヤーを一覧表示します。長いパスは先頭を省略します。
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
            try { if (link.filePath) path = File(link.filePath).fsName; } catch (pathError) {}
            var details = getLinkDetails(link, item);
            var linkStatus = link.status;
            results.push({
                linkId: link.id,
                name: name,
                matchName: matchName,
                foldedName: foldedName,
                extension: dot > 0 ? foldedName.substring(dot + 1) : "",
                path: path,
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
        var dialog = new Window("dialog", "リンクファイル名で検索");
        dialog.orientation = "column";
        dialog.alignChildren = ["fill", "top"];
        dialog.spacing = 12;
        dialog.margins = 12;

        var searchRow = dialog.add("group");
        searchRow.orientation = "row";
        searchRow.alignChildren = ["left", "center"];
        searchRow.spacing = 8;
        var method = searchRow.add("dropdownlist", undefined, ["先頭一致", "部分一致", "拡張子のみ", "正規表現"]);
        method.selection = 1;
        method.helpTip = "検索方法";
        var input = searchRow.add("edittext", undefined, "");
        input.alignment = ["fill", "center"];
        input.helpTip = "入力するたびに絞り込みます。拡張子のみの場合は psd または .psd のように入力します。";
        var message = dialog.add("statictext", undefined, "");
        // メッセージの長さや検索件数によってダイアログの高さを変えない。
        message.preferredSize.height = 18;

        var widths = [44, 90, 250, 300, 110, 110, 110, 140];
        var listWidth = 24;
        for (var column = 0; column < widths.length; column++) listWidth += widths[column];
        var list = dialog.add("listbox", undefined, [], {
            multiselect: false,
            numberOfColumns: widths.length,
            showHeaders: true,
            columnTitles: ["状態", "ページ番号", "ファイル名", "パス", "実効ppi", "形式", "カラーモード", "配置レイヤー"],
            columnWidths: widths
        });
        list.preferredSize = [listWidth, 28 + Math.max(4, Math.min(12, results.length)) * 24];
        var listHelp = "結果を選ぶと配置オブジェクトを表示します。×：リンク切れ、空欄：正常、△：その他。取得できない項目は「—」で表示します。";
        list.helpTip = listHelp;
        for (var i = 0; i < results.length; i++) {
            results[i].displayPath = shortenPath(results[i].path, widths[3] - 20, list.graphics);
        }

        var visibleResults = [];
        var updatingList = false;
        var lastQuery = null;
        var lastMode = null;

        function updateResults() {
            var query = input.text;
            var mode = method.selection.index;
            if (query === lastQuery && mode === lastMode) return;
            lastQuery = query;
            lastMode = mode;
            var matcher;
            try {
                // 正規表現は入力更新ごとに一度だけ作成する。
                matcher = createMatcher(mode, query);
            } catch (error) {
                message.text = "正規表現が未完成または無効です。直前の結果を表示しています。";
                return;
            }
            var nextResults = [];
            for (var index = 0; index < results.length; index++) {
                if (matcher(results[index])) nextResults.push(results[index]);
            }

            // 一致する配置が同じなら、選択やスクロール位置を保って再描画を省く。
            var changed = visibleResults.length !== nextResults.length;
            for (var j = 0; !changed && j < nextResults.length; j++) {
                if (visibleResults[j].linkId !== nextResults[j].linkId) changed = true;
            }
            if (changed) {
                var selectedId = list.selection ? list.selection.result.linkId : null;
                updatingList = true;
                try {
                    list.removeAll();
                    list.helpTip = listHelp;
                    for (var k = 0; k < nextResults.length; k++) {
                        var result = nextResults[k];
                        var row = list.add("item", result.statusIcon);
                        row.subItems[0].text = result.pageName;
                        row.subItems[1].text = result.name;
                        row.subItems[2].text = result.displayPath;
                        row.subItems[3].text = result.effectivePpi;
                        row.subItems[4].text = result.format;
                        row.subItems[5].text = result.colorMode;
                        row.subItems[6].text = result.layer;
                        row.result = result;
                        if (result.linkId === selectedId) {
                            list.selection = row;
                            list.helpTip = result.status + "\n" + (result.path || "パスなし");
                        }
                    }
                    visibleResults = nextResults;
                } finally {
                    updatingList = false;
                }
            }
            message.text = nextResults.length + "件 / 全" + results.length + "件" +
                (nextResults.length ? "" : "　該当するリンクはありません。");
        }

        // 参照元の候補一覧と同じく、行の選択でInDesign側の表示を切り替える。
        list.onChange = function () {
            // マウスで行を選んでもactiveがfalseの場合があるため、フォーカスでは判定しない。
            if (updatingList || !list.selection) return;
            var selected = list.selection.result;
            list.helpTip = selected.status + "\n" + (selected.path || "パスなし");
            try {
                showPlacement(document, selected.linkId);
            } catch (error) {
                alert("配置オブジェクトを表示できません。\n" + String(error.message || error));
            }
        };

        var buttons = dialog.add("group");
        buttons.alignment = ["right", "top"];
        var close = buttons.add("button", undefined, "閉じる", {name: "cancel"});
        dialog.cancelElement = close;
        dialog.defaultElement = null;
        close.onClick = function () { dialog.close(0); };

        // 入力欄の内容・フォーカスには触れず、IMEの変換操作は入力欄に任せる。
        input.onChanging = updateResults;
        input.onChange = updateResults;
        method.onChange = updateResults;
        dialog.onShow = function () { input.active = true; };
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
