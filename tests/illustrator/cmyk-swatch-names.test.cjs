const test = require('node:test');
const assert = require('node:assert/strict');
const { context, spot, document, process, main, output, prefix } = require('./helpers/cmyk-converter.cjs');

const namingCases = [
    ['default', 'C=15 M=15 Y=75 K=45', prefix],
    ['decimals', 'C=15.0 M=15.00 Y=75 K=45', prefix],
    ['spacing', ' C = 15  M = 15\tY = 75 K = 45 ', prefix],
    ['bounds', 'C=0 M=100 Y=0.00 K=100.0', prefix],
    ['stale numbers', 'C=1 M=2 Y=3 K=4', prefix],
    ['custom Japanese', '本文用の赤', prefix + ' (本文用の赤)'],
    ['only M', 'M=30', prefix + ' (M=30)'],
    ['only CMY', 'C=20 M=30 Y=40', prefix + ' (C=20 M=30 Y=40)'],
    ['missing equals', 'C15 M15 Y75 K45', prefix + ' (C15 M15 Y75 K45)'],
    ['lowercase', 'c=15 m=15 y=75 k=45', prefix + ' (c=15 m=15 y=75 k=45)'],
    ['custom prefix', 'ブランド色 C=15 M=15 Y=75 K=45', prefix + ' (ブランド色 C=15 M=15 Y=75 K=45)'],
    ['custom suffix', 'C=15 M=15 Y=75 K=45 コピー', prefix + ' (C=15 M=15 Y=75 K=45 コピー)'],
    ['component order', 'M=15 C=15 Y=75 K=45', prefix + ' (M=15 C=15 Y=75 K=45)'],
    ['percent', 'C=15% M=15% Y=75% K=45%', prefix + ' (C=15% M=15% Y=75% K=45%)'],
    ['out of range', 'C=101 M=15 Y=75 K=45', prefix + ' (C=101 M=15 Y=75 K=45)'],
    ['negative', 'C=-1 M=15 Y=75 K=45', prefix + ' (C=-1 M=15 Y=75 K=45)'],
    ['full width', 'Ｃ＝１５ Ｍ＝１５ Ｙ＝７５ Ｋ＝４５', prefix + ' (Ｃ＝１５ Ｍ＝１５ Ｙ＝７５ Ｋ＝４５)'],
    ['nested parentheses', 'ブランド色 (春)', prefix + ' (ブランド色 (春))'],
    ['previously renamed', 'C=1 M=2 Y=3 K=4 (本文用の赤)', prefix + ' (本文用の赤)'],
    ['renamed nested', 'C=1 M=2 Y=3 K=4 (ブランド色 (春))', prefix + ' (ブランド色 (春))'],
    ['renamed custom numbers', 'C=1 M=2 Y=3 K=4 (M=30)', prefix + ' (M=30)'],
    ['empty parentheses', 'C=1 M=2 Y=3 K=4 ()', prefix + ' ()'],
    ['custom whitespace', ' 本文用の赤 ', prefix + ' ( 本文用の赤 )'],
    ['parenthesis in custom name', 'ブランド色 )', prefix + ' (ブランド色 ))'],
    ['line break in custom name', 'ブランド\n色', prefix + ' (ブランド\n色)'],
    ['default followed by line break', 'C=1 M=2 Y=3 K=4\n', prefix + ' (C=1 M=2 Y=3 K=4\n)'],
];
for (const [label, original, expected] of namingCases) {
    test('name: ' + label, () => {
        const ctx = context();
        assert.equal(ctx.buildGlobalCMYKSwatchName(original, output), expected);
        assert.equal(ctx.buildGlobalCMYKSwatchName(expected, output), expected, 'a repeated run must not grow the name');
        const next = { c: 10, m: 20, y: 30, k: 40 };
        assert.equal(ctx.buildGlobalCMYKSwatchName(expected, next), expected.replace(prefix, 'C=10 M=20 Y=30 K=40'));
    });
}

test('shared spot is converted once and renamed only after processing, preserving tint and reference', () => {
    const ctx = context();
    const item = spot('本文用の赤'); // deliberately no index: name is the processing key
    const color = { typename: 'SpotColor', spot: item, tint: 20 };
    const owner = { fillColor: color };
    const entry = { skipped: false };
    assert.equal(ctx.processColorPropertyCore(owner, 'fillColor', true, entry), 1);
    assert.equal(ctx.processColorPropertyCore(owner, 'fillColor', true, entry), 0);
    assert.equal(ctx.conversions, 1);
    assert.equal(item.name, '本文用の赤');
    assert.equal(item.state.colorWrites, 1);
    assert.equal(item.state.nameWrites, 0);
    assert.equal(ctx.pendingSpotRenames.length, 1);
    assert.equal(owner.fillColor, color);
    assert.equal(color.tint, 20);
    ctx.applyPendingSpotRenames(document([item]));
    assert.equal(item.name, prefix + ' (本文用の赤)');
    assert.deepEqual(item.state.events, ['color', 'name']);
    assert.equal(ctx.pendingSpotRenames.length, 0);
});

test('shared spot in gradient stops uses the same queue once', () => {
    const ctx = context();
    const item = spot('M=30');
    const gradient = { name: 'gradient', gradientStops: [20, 80].map(tint => ({ color: { typename: 'SpotColor', spot: item, tint } })) };
    const gc = { gradient };
    ctx.processGradientColor(gc, { skipped: false });
    ctx.processGradientColor(gc, { skipped: false });
    assert.equal(ctx.conversions, 1);
    assert.equal(ctx.pendingSpotRenames.length, 1);
    ctx.applyPendingSpotRenames(document([item]));
    assert.equal(item.name, prefix + ' (M=30)');
    assert.deepEqual(gradient.gradientStops.map(x => x.color.tint), [20, 80]);
});

for (const model of ['spot', 'registration']) {
    test(model + ' is excluded', () => {
        const ctx = context();
        const item = spot('C=15 M=15 Y=75 K=45', { colorType: model });
        assert.equal(process(ctx, item).reason, 'nonCMYK');
        assert.equal(ctx.conversions, 0);
        assert.equal(item.state.nameWrites, 0);
        assert.equal(item.state.colorWrites, 0);
        assert.equal(ctx.pendingSpotRenames.length, 0);
    });
}

for (const reason of ['same', 'noCandidate']) {
    test('no color update (' + reason + ') does not rename', () => {
        const ctx = context();
        ctx.buildAdjustedColorResult = () => ({ changed: false, reason });
        const item = spot('本文用の赤');
        process(ctx, item);
        assert.equal(ctx.pendingSpotRenames.length, 0);
        assert.equal(item.state.nameWrites, 0);
    });
}

test('failed color write does not enqueue a rename', () => {
    const ctx = context();
    const item = spot('本文用の赤', { failColorWrite: true });
    assert.equal(process(ctx, item).reason, 'spotWriteFailed');
    assert.equal(ctx.pendingSpotRenames.length, 0);
    assert.equal(ctx.spotRenameSkippedCount, 0);
});

test('name read failure does not block successful color conversion', () => {
    const ctx = context();
    const item = spot('本文用の赤', { index: 1, getName() { throw new Error('name inaccessible'); } });
    assert.equal(process(ctx, item).changed, true);
    assert.equal(item.state.colorWrites, 1);
    assert.equal(ctx.pendingSpotRenames.length, 0);
    assert.equal(ctx.spotRenameSkippedCount, 1);
});

test('ordinary swatch name conflict preserves both swatches and converted color', () => {
    const ctx = context();
    const item = spot('C=15 M=15 Y=75 K=45');
    process(ctx, item);
    ctx.applyPendingSpotRenames(document([item], [prefix]));
    assert.equal(item.name, 'C=15 M=15 Y=75 K=45');
    assert.equal(item.state.nameWrites, 0);
    assert.equal(item.color.magenta, 5);
    assert.equal(ctx.spotRenameSkippedCount, 1);
});

test('two queued renames cannot take the same name', () => {
    const ctx = context();
    const a = spot('C=15 M=15 Y=75 K=45');
    const b = spot('C=1 M=2 Y=3 K=4');
    process(ctx, a); process(ctx, b);
    ctx.applyPendingSpotRenames(document([a, b]));
    assert.equal(a.name, prefix);
    assert.equal(b.name, 'C=1 M=2 Y=3 K=4');
    assert.equal(ctx.spotRenameSkippedCount, 1);
});

test('a name changed after queuing is preserved', () => {
    const ctx = context();
    const item = spot('本文用の赤');
    process(ctx, item);
    item.state.name = '外部で変更した名前';
    ctx.applyPendingSpotRenames(document([item]));
    assert.equal(item.name, '外部で変更した名前');
    assert.equal(item.state.nameWrites, 0);
    assert.equal(ctx.spotRenameSkippedCount, 1);
});

test('failure to read the swatch catalog skips all names without affecting converted colors', () => {
    const ctx = context();
    const a = spot('赤'); const b = spot('青');
    process(ctx, a); process(ctx, b);
    ctx.applyPendingSpotRenames({ get swatches() { throw new Error('catalog unavailable'); } });
    assert.equal(a.state.nameWrites + b.state.nameWrites, 0);
    assert.equal(a.state.colorWrites + b.state.colorWrites, 2);
    assert.equal(ctx.spotRenameSkippedCount, 2);
});

test('name write failure keeps the old name and permits later independent renames', () => {
    const ctx = context();
    const a = spot('赤', { setName() { throw new Error('name write denied'); } });
    const b = spot('青');
    process(ctx, a); process(ctx, b);
    ctx.applyPendingSpotRenames(document([a, b]));
    assert.equal(a.name, '赤');
    assert.equal(b.name, prefix + ' (青)');
    assert.equal(ctx.spotRenameSkippedCount, 1);
});

test('truncated custom names are restored and not silently accepted', () => {
    const ctx = context();
    const a = spot('大切な独自名', { setName(state, value) { state.name = value.startsWith('C=') ? value.slice(0, 8) : value; } });
    const b = spot('青');
    process(ctx, a); process(ctx, b);
    ctx.applyPendingSpotRenames(document([a, b]));
    assert.equal(a.name, '大切な独自名');
    assert.equal(a.state.nameWrites, 2);
    assert.equal(b.name, prefix + ' (青)');
    assert.equal(ctx.spotRenameSkippedCount, 1);
});

test('failure to restore a name stops remaining renames conservatively', () => {
    const ctx = context();
    const a = spot('赤', { setName(state) { state.name = 'unexpected'; throw new Error('partial setter failure'); } });
    const b = spot('青');
    process(ctx, a); process(ctx, b);
    ctx.applyPendingSpotRenames(document([a, b]));
    assert.equal(b.name, '青');
    assert.equal(b.state.nameWrites, 0);
    assert.equal(ctx.spotRenameSkippedCount, 2);
    assert.equal(ctx.pendingSpotRenames.length, 0);
});

test('unchanged proposed names perform no rename or swatch scan', () => {
    const ctx = context();
    const item = spot(prefix + ' (赤)');
    process(ctx, item);
    assert.equal(ctx.pendingSpotRenames.length, 0);
    ctx.applyPendingSpotRenames({ get swatches() { assert.fail('unnecessary scan'); } });
    assert.equal(item.state.nameWrites, 0);
});

test('10,000 references and 10 shared spots cause 10 conversions, 10 name writes and one catalog scan', () => {
    const ctx = context();
    const items = Array.from({ length: 10 }, (_, i) => spot('色 ' + i));
    const doc = document(items, Array.from({ length: 50 }, (_, i) => 'unused ' + i));
    for (let i = 0; i < 10000; i++) process(ctx, items[i % 10]);
    assert.equal(ctx.conversions, 10);
    assert.equal(ctx.pendingSpotRenames.length, 10);
    ctx.applyPendingSpotRenames(doc);
    assert.equal(items.reduce((sum, item) => sum + item.state.nameWrites, 0), 10);
    assert.equal(doc.stats.collectionReads, 1);
    assert.equal(doc.stats.nameReads, 60);
});

function configureMain(ctx, doc, item, error = null) {
    const events = [];
    let completion = null;
    ctx.validateActiveDocument = () => doc;
    ctx.collectSelectionStats = () => ({ items: [], planned: 1, selectedObjectCount: 1, unsupportedObjectCount: 0, unsupportedBreakdown: [] });
    ctx.showConvertOptionsDialog = () => ({ ok: true, enableSaturationBoost: false, saturationBoostPct: 0, enableCMYKBalance: false, cmyKBalanceValue: 0, enableKBoost: false, enableLightColorProtect: false, selectSkippedObjects: false });
    ctx.createProgressBar = () => ({ close() { events.push('close'); } });
    ctx.applyToSelection = () => { process(ctx, item); events.push('converted'); if (error) throw error; return { count: 1 }; };
    ctx.collectFinalSkippedItems = () => { events.push('summary'); assert.equal(item.name, prefix + ' (赤)'); return []; };
    const rename = ctx.applyPendingSpotRenames;
    ctx.applyPendingSpotRenames = doc => { events.push('rename'); rename(doc); };
    ctx.app.redraw = () => { events.push('redraw'); };
    ctx.showCompletionDialog = info => { completion = info; events.push('completion'); };
    return { events, get completion() { return completion; } };
}

test('normal main flow renames before summary and cleanup', () => {
    const ctx = context(); const item = spot('赤'); const doc = document([item]);
    const result = configureMain(ctx, doc, item);
    main.runInContext(ctx);
    assert.deepEqual(result.events, ['converted', 'rename', 'summary', 'close', 'redraw', 'completion']);
    assert.equal(result.completion.updatedColors, 1);
    assert.equal(result.completion.swatchRenameSkippedCount, 0);
    assert.equal(ctx.pendingSpotRenames.length, 0);
});

test('cancellation renames successful conversions before cleanup without completion dialog', () => {
    const ctx = context(); const item = spot('赤'); const doc = document([item]);
    const error = new Error('cancelled'); error.name = ctx.USER_CANCELLED_ERROR_NAME;
    const result = configureMain(ctx, doc, item, error);
    main.runInContext(ctx);
    assert.equal(item.name, prefix + ' (赤)');
    assert.deepEqual(result.events, ['converted', 'rename', 'close', 'redraw']);
    assert.equal(result.completion, null);
    assert.equal(ctx.pendingSpotRenames.length, 0);
});

test('unexpected error retains the original error, renames successful conversions, and cleans up', () => {
    const ctx = context(); const item = spot('赤'); const doc = document([item]);
    const error = new Error('processing failed');
    const result = configureMain(ctx, doc, item, error);
    assert.throws(() => main.runInContext(ctx), value => value === error);
    assert.equal(item.name, prefix + ' (赤)');
    assert.deepEqual(result.events, ['converted', 'rename', 'close', 'redraw']);
    assert.equal(ctx.pendingSpotRenames.length, 0);
});

test('name failures are reported separately from skipped objects and survive cleanup in completion info', () => {
    const ctx = context(); const item = spot('赤'); const doc = document([item], [prefix + ' (赤)']);
    const result = configureMain(ctx, doc, item);
    ctx.collectFinalSkippedItems = () => [];
    main.runInContext(ctx);
    assert.equal(item.name, '赤');
    assert.equal(result.completion.swatchRenameSkippedCount, 1);
    assert.equal(result.completion.skippedCount, 0);
    assert.equal(result.completion.updatedColors, 1);
    assert.equal(ctx.spotRenameSkippedCount, 0);
});

for (const locale of ['ja', 'en']) {
    test('completion name-failure line is localized and shown only when needed: ' + locale, () => {
        const ctx = context();
        ctx.$.locale = locale;
        ctx.completionMetricWidths = () => ({ left: 190, right: 150 });
        ctx.setControlBold = () => {};
        const controls = [];
        function control(type) {
            return { type, preferredSize: {}, add(type, bounds, text, options) { const child = control(type); child.parent = this; child.text = text; child.options = options; controls.push(child); return child; }, show() {} };
        }
        ctx.Window = function () { return control('dialog'); };
        ctx.showCompletionDialog({ swatchRenameSkippedCount: 1, skippedCount: 0 });
        const row = controls.find(x => x.helpTip);
        assert.ok(row);
        assert.match(row.text, locale === 'ja' ? /スウォッチ名の未更新/ : /Swatch names not updated/);
        controls.length = 0;
        ctx.showCompletionDialog({ swatchRenameSkippedCount: 0, skippedCount: 0 });
        assert.equal(controls.some(x => x.helpTip), false);
        assert.equal(controls.some(x => x.text === ctx.uiText('autoBlackOverprintNotice')), false);
        controls.length = 0;
        ctx.showCompletionDialog({ swatchRenameSkippedCount: 0, skippedCount: 0, showAutoBlackOverprintNotice: true });
        const notice = controls.find(x => x.text === ctx.uiText('autoBlackOverprintNotice'));
        assert.ok(notice);
        assert.equal(notice.parent.type, 'panel');
        assert.equal(notice.parent.parent.type, 'dialog');
        assert.equal(notice.options.multiline, true);
        assert.ok(notice.preferredSize.height > 17);
        if (locale === 'ja') {
            assert.equal(notice.text, '自動墨ノセ処理回避のため、K100オブジェクトをK100/Y1のグローバルスウォッチに登録しました。ノセにしたいものは個別に選択し、K100にしてください。');
        }
        controls.length = 0;
        ctx.showCompletionDialog({
            swatchRenameSkippedCount: 0,
            skippedCount: 2,
            skippedMessage: ctx.uiText('skippedObjectsSelected'),
            skippedDetails: [{ label: 'Pattern', count: 2 }],
            showAutoBlackOverprintNotice: true,
            processingTime: '6.5',
            processingTimeHelp: 'phase timings'
        });
        const panels = controls.filter(x => x.type === 'panel' && x.parent.type === 'dialog');
        const noticeWithSkipped = controls.find(x => x.text === ctx.uiText('autoBlackOverprintNotice'));
        assert.equal(panels.length, 2);
        assert.equal(noticeWithSkipped.parent, panels[1]);
        assert.ok(panels[1].preferredSize.width >= panels[0].preferredSize.width);
        const timeCell = controls.find(x => x.text === ctx.formatMetricText('processingTime', '6.5'));
        assert.equal(timeCell.helpTip, 'phase timings');
    });
}
