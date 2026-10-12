const test = require('node:test');
const assert = require('node:assert/strict');
const { context, main } = require('./helpers/cmyk-converter.cjs');

function postprocessingContext(count, shouldCancel) {
    const ctx = context();
    const stats = { updates: 0, polls: 0, assignments: 0, creations: 0 };
    const doc = {
        typename: 'Document',
        swatches: [],
        spots: { add() { stats.creations++; return {}; } },
    };
    ctx.SpotColor = function () { this.typename = 'SpotColor'; };
    ctx.AVOID_AUTO_BLACK_OVERPRINT_ENABLED = true;
    for (let i = 0; i < count; i++) {
        let color = ctx.makeCMYK(0, 0, 0, 100);
        const item = {
            typename: 'PathItem', opacity: 100, parent: doc, fillOverprint: true,
            get fillColor() { return color; },
            set fillColor(value) { color = value; stats.assignments++; },
        };
        ctx.queueAutoBlackOverprintTask(item, 'fillColor', { target: item, typeName: 'PathItem', skipped: false }, false);
    }
    ctx.Window = function () {
        return {
            add() { return {}; }, addEventListener() {}, layout: { layout() {} },
            center() {}, show() {}, update() { stats.updates++; }, close() {},
        };
    };
    ctx.ScriptUI = { environment: {
        get keyboardState() {
            stats.polls++;
            return { keyName: shouldCancel(stats) ? 'Escape' : '' };
        },
    } };
    ctx.gProgress = ctx.createProgressBar(count);
    stats.updates = 0; // 初回表示は後処理中の更新回数から除く。
    return { ctx, doc, stats };
}

test('K100 postprocessing responds to Escape within 100 paints', () => {
    const { ctx, doc, stats } = postprocessingContext(5000, () => true);
    assert.throws(() => ctx.applyAutoBlackOverprint(doc), error => ctx.isUserCancelledError(error));
    assert.ok(stats.assignments < 100);
    assert.equal(stats.polls, 1);
});

test('K100 postprocessing also responds to Escape pressed after processing starts', () => {
    const { ctx, doc, stats } = postprocessingContext(5000, stats => stats.assignments >= 1050);
    assert.throws(() => ctx.applyAutoBlackOverprint(doc), error => ctx.isUserCancelledError(error));
    assert.ok(stats.assignments >= 1050 && stats.assignments < 1150);
});

test('K100 postprocessing keeps UI updates throttled while completing every paint', () => {
    const { ctx, doc, stats } = postprocessingContext(5000, () => false);
    assert.equal(ctx.applyAutoBlackOverprint(doc), 5000);
    assert.equal(stats.assignments, 5000);
    assert.equal(stats.creations, 1);
    assert.equal(stats.updates, 50);
    assert.equal(stats.polls, 50);
    assert.equal(ctx.autoBlackOverprintState.tasks.length, 0);
});

function runSelectionResult(locale, selectable) {
    const ctx = context();
    ctx.$.locale = locale;
    let clearCommands = 0;
    let completion;
    const items = (selectable.length ? selectable : [true]).map((allowed, index) => {
        let selected = false;
        return {
            typename: 'PathItem', uuid: 'item-' + index,
            filled: selectable.length > 0, stroked: false,
            fillColor: { typename: 'PatternColor' },
            get selected() { return selected; },
            set selected(value) { if (!allowed) throw new Error('selection rejected'); selected = value; },
        };
    });
    const entries = items.map(item => ctx.makeSelectionArtItemEntry(item, 'PathItem', item));
    const doc = { selection: items, swatches: [] };
    ctx.app.activeDocument = doc;
    ctx.app.executeMenuCommand = command => { assert.equal(command, 'deselectall'); clearCommands++; };
    ctx.validateActiveDocument = () => doc;
    ctx.collectSelectionStats = () => ({ items: entries, planned: entries.length, selectedObjectCount: entries.length, unsupportedObjectCount: 0, unsupportedBreakdown: [] });
    ctx.showConvertOptionsDialog = () => ({ ok: true, selectSkippedObjects: true, avoidAutoBlackOverprint: false });
    ctx.createProgressBar = () => ({ step() {}, checkpoint() {}, close() {} });
    ctx.showCompletionDialog = info => { completion = info; };
    main.runInContext(ctx);
    return { ctx, completion, clearCommands };
}

for (const locale of ['ja', 'en']) {
    for (const selectable of [[false, false], [true, false], [true, true], []]) {
        test('completion reports selection outcome: ' + locale + '/' + JSON.stringify(selectable), () => {
            const { ctx, completion, clearCommands } = runSelectionResult(locale, selectable);
            const total = selectable.length;
            const selected = selectable.filter(Boolean).length;
            assert.equal(completion.skippedCount, total);
            const expected = total === 0 ? '' : selected < total ?
                ctx.uiFormat('skippedObjectsPartiallySelected', { selected, total }) : ctx.uiText('skippedObjectsSelected');
            assert.equal(completion.skippedMessage, expected);
            assert.equal(clearCommands, 1, 'clearing a failed selection again adds unnecessary host work');
        });
    }
}
