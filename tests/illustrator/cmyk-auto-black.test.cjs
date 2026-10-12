const test = require('node:test');
const assert = require('node:assert/strict');
const { context, spot, main } = require('./helpers/cmyk-converter.cjs');

const k100 = { c: 0, m: 0, y: 0, k: 100 };
const y1k100 = { c: 0, m: 0, y: 1, k: 100 };
const jaName = '自動墨ノセ回避K100';
const enName = 'K100 Auto Overprint Avoidance';

function setup(enabled = true) {
    const ctx = context();
    ctx.SpotColor = function () { this.typename = 'SpotColor'; this.tint = 100; };
    ctx.AVOID_AUTO_BLACK_OVERPRINT_ENABLED = enabled;
    ctx.buildAdjustedColorResult = orig => {
        ctx.conversions++;
        return { changed: !(orig.c === 0 && orig.m === 0 && orig.y === 0 && orig.k === 100), reason: orig.c === 0 && orig.m === 0 && orig.y === 0 && orig.k === 100 ? 'same' : null, out: { ...k100 } };
    };
    const data = { swatches: [], collectionReads: 0, additions: 0, removals: 0 };
    const doc = {
        typename: 'Document', data,
        get swatches() { data.collectionReads++; return data.swatches; },
        get pageItems() { assert.fail('must not scan unselected artwork'); },
        spots: { add() {
            data.additions++;
            const created = addGlobal(ctx, doc, 'temporary ' + data.additions, k100);
            created.remove = () => { data.removals++; data.swatches = data.swatches.filter(s => s.color.spot !== created); };
            return created;
        } },
    };
    ctx.app.activeDocument = doc;
    const layer = { typename: 'Layer', opacity: 100, parent: doc };
    return { ctx, doc, layer };
}

function makeColor(ctx, cmyk) { return ctx.makeCMYK(cmyk.c, cmyk.m, cmyk.y, cmyk.k); }
function globalColor(ctx, item, tint = 100) { const color = new ctx.SpotColor(); color.spot = item; color.tint = tint; return color; }
function addGlobal(ctx, doc, name, cmyk, model = 'process') {
    const item = spot(name, { colorType: model, index: doc.data.swatches.length });
    item.state.color = makeColor(ctx, cmyk);
    doc.data.swatches.push({ get name() { return item.name; }, get color() { return globalColor(ctx, item); } });
    return item;
}
function path(ctx, layer, cmyk = k100, opacity = 100) {
    return { typename: 'PathItem', filled: true, stroked: false, fillColor: makeColor(ctx, cmyk), fillOverprint: false, strokeOverprint: false, opacity, parent: layer };
}
function entryFor(ctx, item) { return ctx.makeSelectionArtItemEntry(item, item.typename, item); }
function convert(ctx, entry) { return ctx.applySelectionArtItemEntry(entry); }
function values(color) { return [color.cyan, color.magenta, color.yellow, color.black]; }

test('flag defaults off', () => {
    const ctx = context();
    assert.equal(ctx.DEFAULT_AVOID_AUTO_BLACK_OVERPRINT_ENABLED, false);
    assert.equal(ctx.AVOID_AUTO_BLACK_OVERPRINT_ENABLED, false);
});

test('off performs no special color checks, opacity access, queuing or swatch lookup', () => {
    const { ctx, doc, layer } = setup(false);
    const item = path(ctx, layer);
    Object.defineProperty(item, 'opacity', { get() { assert.fail('opacity read while off'); } });
    for (const name of ['isK100CMYK', 'isAutoBlackOverprintCMYK', 'isAutoBlackOverprintSwatchName', 'isAutoBlackOverprintDefinition', 'readFullyOpaqueState', 'readSolidProcessCMYK', 'getAutoBlackOverprintSpot', 'queueAutoBlackOverprintTask', 'applyAutoBlackOverprintTask']) {
        ctx[name] = () => assert.fail(name + ' called while off');
    }
    ctx.autoBlackOverprintState.tasks.push = () => assert.fail('queued while off');
    convert(ctx, entryFor(ctx, item));
    assert.equal(ctx.applyAutoBlackOverprint(doc), 0);
    const previous = addGlobal(ctx, doc, jaName, y1k100);
    const second = path(ctx, layer);
    second.fillColor = globalColor(ctx, previous);
    convert(ctx, entryFor(ctx, second));
    assert.equal(previous.color.yellow, 0, 'off uses ordinary conversion');
    assert.equal(doc.data.collectionReads, 0);
    assert.equal(doc.data.additions, 0);
});

test('postprocessing unifies newly converted and pre-existing K100 into one process swatch', () => {
    const { ctx, doc, layer } = setup();
    const before = path(ctx, layer);
    const converted = path(ctx, layer, { c: 10, m: 10, y: 10, k: 90 });
    const a = entryFor(ctx, before); const b = entryFor(ctx, converted);
    assert.equal(convert(ctx, a), 0);
    assert.equal(convert(ctx, b), 1);
    assert.equal(before.fillColor.typename, 'CMYKColor');
    assert.equal(converted.fillColor.yellow, 0);
    assert.equal(doc.data.additions, 0);
    assert.equal(ctx.applyAutoBlackOverprint(doc), 1, 'only previously unchanged paint adds to the existing change count');
    assert.equal(doc.data.additions, 1);
    assert.equal(before.fillColor.spot, converted.fillColor.spot);
    assert.equal(before.fillColor.spot.name, jaName);
    assert.equal(before.fillColor.spot.colorType, 'process');
    assert.deepEqual(values(before.fillColor.spot.color), [0, 0, 1.01, 100]);
    assert.equal(before.fillColor.tint, 100);
});

test('final color determines eligibility even for originally pure K100', () => {
    const { ctx, doc, layer } = setup();
    ctx.buildAdjustedColorResult = () => ({ changed: true, out: { c: 15, m: 20, y: 0, k: 80 } });
    const item = path(ctx, layer);
    Object.defineProperty(item, 'opacity', { get() { assert.fail('not K100: must not check opacity'); } });
    convert(ctx, entryFor(ctx, item));
    ctx.applyAutoBlackOverprint(doc);
    assert.deepEqual(values(item.fillColor), [15, 20, 0, 80]);
    assert.equal(doc.data.collectionReads, 0);
    assert.equal(doc.data.additions, 0);
});

test('all final option flags are applied before the shared color is assigned', () => {
    const { ctx, doc, layer } = setup();
    ctx.K_BOOST_ENABLED = true; ctx.CMY_K_BALANCE_ENABLED = true; ctx.SATURATION_BOOST_ENABLED = true;
    ctx.buildAdjustedColorResult = () => {
        assert.equal(ctx.K_BOOST_ENABLED, true);
        assert.equal(ctx.CMY_K_BALANCE_ENABLED, true);
        assert.equal(ctx.SATURATION_BOOST_ENABLED, true);
        assert.equal(doc.data.additions, 0);
        return { changed: true, out: { ...k100 } };
    };
    const item = path(ctx, layer, { c: 10, m: 20, y: 30, k: 40 });
    convert(ctx, entryFor(ctx, item));
    assert.equal(item.fillColor.yellow, 0);
    ctx.applyAutoBlackOverprint(doc);
    assert.deepEqual(values(item.fillColor.spot.color), [0, 0, 1.01, 100]);
});

for (const opacity of [0, 50, 99.999]) {
    test('excludes object opacity ' + opacity, () => {
        const { ctx, doc, layer } = setup();
        const item = path(ctx, layer, k100, opacity);
        convert(ctx, entryFor(ctx, item));
        ctx.applyAutoBlackOverprint(doc);
        assert.equal(item.fillColor.typename, 'CMYKColor');
        assert.equal(doc.data.collectionReads, 0);
    });
}

for (const kind of ['GroupItem', 'CompoundPathItem', 'Layer']) {
    test('excludes semi-transparent ancestor ' + kind, () => {
        const { ctx, doc, layer } = setup();
        const ancestor = { typename: kind, opacity: 50, parent: layer };
        const item = path(ctx, ancestor);
        convert(ctx, entryFor(ctx, item));
        ctx.applyAutoBlackOverprint(doc);
        assert.equal(item.fillColor.typename, 'CMYKColor');
        assert.equal(doc.data.additions, 0);
    });
}

test('opacity acquisition failure is reported without treating unknown as opaque', () => {
    const { ctx, doc, layer } = setup();
    const item = path(ctx, layer);
    Object.defineProperty(layer, 'opacity', { get() { throw new Error('cannot read'); } });
    const entry = entryFor(ctx, item);
    convert(ctx, entry);
    ctx.applyAutoBlackOverprint(doc);
    assert.equal(entry.skipped, true);
    assert.equal(ctx.gSkipBreakdown[0].key, 'process:opacityReadFailed');
    assert.equal(doc.data.additions, 0);
});

test('checks object and parent opacity once for both fill and stroke', () => {
    const { ctx, doc, layer } = setup();
    const item = path(ctx, layer);
    item.stroked = true; item.strokeColor = makeColor(ctx, k100);
    let reads = 0;
    Object.defineProperty(item, 'opacity', { get() { reads++; return 100; } });
    convert(ctx, entryFor(ctx, item));
    assert.equal(ctx.applyAutoBlackOverprint(doc), 2);
    assert.equal(reads, 1);
    assert.equal(item.fillColor.spot, item.strokeColor.spot);
});

test('shared globals detach only selected opaque full-tint paints', () => {
    const { ctx, doc, layer } = setup();
    const original = addGlobal(ctx, doc, 'ブランド色', { c: 10, m: 10, y: 10, k: 90 });
    const full = path(ctx, layer); full.fillColor = globalColor(ctx, original);
    const half = path(ctx, layer, k100, 50); half.fillColor = globalColor(ctx, original);
    const tint = path(ctx, layer); tint.fillColor = globalColor(ctx, original, 50);
    const unselected = path(ctx, layer); unselected.fillColor = globalColor(ctx, original);
    for (const item of [full, half, tint]) convert(ctx, entryFor(ctx, item));
    ctx.applyAutoBlackOverprint(doc);
    assert.notEqual(full.fillColor.spot, original);
    assert.equal(full.fillColor.spot.name, jaName);
    for (const item of [half, tint, unselected]) assert.equal(item.fillColor.spot, original);
    assert.equal(tint.fillColor.tint, 50);
    assert.deepEqual(values(original.color), [0, 0, 0, 100], 'normal shared color conversion is retained; Y1 is local to the new swatch');
    ctx.applyPendingSpotRenames(doc);
    assert.equal(full.fillColor.spot.name, jaName, 'generic swatch naming must not touch the dedicated name');
});

test('multiple existing K100 globals all map to the one new global', () => {
    const { ctx, doc, layer } = setup();
    const items = ['赤', '青', '緑'].map(name => {
        const original = addGlobal(ctx, doc, name, k100);
        const item = path(ctx, layer); item.fillColor = globalColor(ctx, original);
        convert(ctx, entryFor(ctx, item));
        return item;
    });
    assert.equal(ctx.applyAutoBlackOverprint(doc), 3);
    assert.equal(doc.data.additions, 1);
    assert.ok(items.every(item => item.fillColor.spot === items[0].fillColor.spot));
});

for (const model of ['spot', 'registration']) {
    test('does not convert true ' + model + ' colors into process globals', () => {
        const { ctx, doc, layer } = setup();
        const original = addGlobal(ctx, doc, 'original', k100, model);
        const item = path(ctx, layer); item.fillColor = globalColor(ctx, original);
        convert(ctx, entryFor(ctx, item));
        ctx.applyAutoBlackOverprint(doc);
        assert.equal(item.fillColor.spot, original);
        assert.equal(doc.data.additions, 0);
    });
}

test('gradient stops do not become opaque-object shared colors', () => {
    const { ctx, doc, layer } = setup();
    const gradient = { name: 'shared gradient', gradientStops: [{ color: makeColor(ctx, k100) }, { color: makeColor(ctx, k100) }] };
    const item = path(ctx, layer); item.fillColor = { typename: 'GradientColor', gradient };
    convert(ctx, entryFor(ctx, item));
    ctx.applyAutoBlackOverprint(doc);
    assert.equal(gradient.gradientStops[0].color.typename, 'CMYKColor');
    assert.equal(ctx.autoBlackOverprintState.tasks.length, 0);
    assert.equal(doc.data.additions, 0);
});

for (const name of [jaName, enName]) {
    test('reuses an existing dedicated swatch: ' + name, () => {
        const { ctx, doc, layer } = setup();
        const existing = addGlobal(ctx, doc, name, y1k100);
        const item = path(ctx, layer);
        convert(ctx, entryFor(ctx, item));
        ctx.applyAutoBlackOverprint(doc);
        assert.equal(item.fillColor.spot, existing);
        assert.equal(doc.data.additions, 0);
    });
}

test('creates the English dedicated name in English UI', () => {
    const { ctx, doc, layer } = setup(); ctx.$.locale = 'en';
    const item = path(ctx, layer);
    convert(ctx, entryFor(ctx, item)); ctx.applyAutoBlackOverprint(doc);
    assert.equal(item.fillColor.spot.name, enName);
});

test('repairs the legacy yellow value observed in Illustrator without a name conflict', () => {
    const { ctx, doc, layer } = setup();
    const existing = addGlobal(ctx, doc, jaName, { c: 0, m: 0, y: 0.99999997764826, k: 100 });
    const item = path(ctx, layer);
    const run = configureAutoMain(ctx, doc, [item], true);
    main.runInContext(ctx);
    assert.equal(item.fillColor.spot, existing);
    assert.equal(existing.color.yellow, 1.01);
    assert.equal(doc.data.additions, 0);
    assert.equal(run.result.skippedCount, 0);
    assert.equal(run.result.showAutoBlackOverprintNotice, true);
});

test('an object already using the below-minimum legacy swatch is repaired too', () => {
    const { ctx, doc, layer } = setup();
    const existing = addGlobal(ctx, doc, jaName, { c: 0, m: 0, y: 0.99999997764826, k: 100 });
    const item = path(ctx, layer); item.fillColor = globalColor(ctx, existing);
    convert(ctx, entryFor(ctx, item));
    assert.equal(existing.state.colorWrites, 0, 'conversion must not strip legacy yellow');
    assert.equal(ctx.applyAutoBlackOverprint(doc), 1);
    assert.equal(existing.color.yellow, 1.01);
    assert.equal(doc.data.additions, 0);
});

test('reuses the native round-trip value for the new 1.01 percent yellow', () => {
    const { ctx, doc, layer } = setup();
    const existing = addGlobal(ctx, doc, jaName, { c: 0, m: 0, y: 1.00999996066093, k: 100 });
    const item = path(ctx, layer);
    convert(ctx, entryFor(ctx, item)); ctx.applyAutoBlackOverprint(doc);
    assert.equal(item.fillColor.spot, existing);
    assert.ok(existing.color.yellow >= 1);
    assert.equal(existing.state.colorWrites, 0);
    assert.equal(doc.data.additions, 0);
});

test('0.9 percent yellow is a different same-name color, not a floating-point tolerance match', () => {
    const { ctx, doc, layer } = setup();
    const existing = addGlobal(ctx, doc, jaName, { c: 0, m: 0, y: 0.9, k: 100 });
    const item = path(ctx, layer); const entry = entryFor(ctx, item);
    convert(ctx, entry); ctx.applyAutoBlackOverprint(doc);
    assert.equal(existing.color.yellow, 0.9);
    assert.equal(item.fillColor.typename, 'CMYKColor');
    assert.equal(ctx.gSkipBreakdown[0].key, 'process:autoBlackOverprintNameConflict');
});

test('a newly created swatch cannot be applied if its stored yellow is below one percent', () => {
    const { ctx, doc, layer } = setup();
    let removed = 0;
    doc.spots.add = () => {
        let stored;
        return {
            colorType: 'process', name: '',
            get color() { return stored; },
            set color(value) { stored = { ...value, yellow: 0.99999997764826 }; },
            remove() { removed++; }
        };
    };
    const item = path(ctx, layer); const entry = entryFor(ctx, item);
    convert(ctx, entry); ctx.applyAutoBlackOverprint(doc);
    assert.equal(item.fillColor.typename, 'CMYKColor');
    assert.equal(removed, 1);
    assert.equal(ctx.autoBlackOverprintState.colorApplied, false);
    assert.equal(ctx.gSkipBreakdown[0].key, 'process:autoBlackOverprintVerifyFailed');
});

test('a failed legacy correction restores the old definition and reports verification failure', () => {
    const { ctx, doc, layer } = setup();
    const legacyYellow = 0.99999997764826;
    let stored = makeColor(ctx, { c: 0, m: 0, y: legacyYellow, k: 100 });
    const existing = {
        name: jaName, colorType: 'process',
        get color() { return stored; },
        set color(value) { stored = value.yellow === 1.01 ? { ...value, yellow: 0.9 } : value; }
    };
    doc.data.swatches.push({ name: jaName, color: globalColor(ctx, existing) });
    const item = path(ctx, layer); const entry = entryFor(ctx, item);
    convert(ctx, entry); ctx.applyAutoBlackOverprint(doc);
    assert.equal(existing.color.yellow, legacyYellow);
    assert.equal(item.fillColor.typename, 'CMYKColor');
    assert.equal(ctx.gSkipBreakdown[0].key, 'process:autoBlackOverprintVerifyFailed');
});

test('wrong-color same-name global is not overwritten or reused', () => {
    const { ctx, doc, layer } = setup();
    const existing = addGlobal(ctx, doc, jaName, { c: 0, m: 0, y: 0, k: 50 });
    const item = path(ctx, layer); const entry = entryFor(ctx, item);
    convert(ctx, entry); ctx.applyAutoBlackOverprint(doc);
    assert.equal(existing.color.black, 50);
    assert.equal(item.fillColor.typename, 'CMYKColor');
    assert.equal(doc.data.additions, 0);
    assert.equal(entry.skipped, true);
});

test('same-name ordinary swatch blocks creation without changing that swatch', () => {
    const { ctx, doc, layer } = setup();
    doc.data.swatches.push({ name: jaName, color: makeColor(ctx, y1k100) });
    const item = path(ctx, layer); const entry = entryFor(ctx, item);
    convert(ctx, entry); ctx.applyAutoBlackOverprint(doc);
    assert.equal(doc.data.additions, 0);
    assert.equal(entry.skipped, true);
    assert.equal(item.fillColor.typename, 'CMYKColor');
});

test('one failed setup is not retried for every target', () => {
    const { ctx, doc, layer } = setup();
    let attempts = 0; doc.spots.add = () => { attempts++; throw new Error('cannot add'); };
    const entries = Array.from({ length: 10 }, () => entryFor(ctx, path(ctx, layer)));
    entries.forEach(entry => convert(ctx, entry));
    ctx.applyAutoBlackOverprint(doc);
    assert.equal(attempts, 1);
    assert.equal(doc.data.collectionReads, 1);
    assert.ok(entries.every(entry => entry.skipped));
});

test('a later run can retry swatch setup after a previous run failed', () => {
    const { ctx, doc, layer } = setup();
    const add = doc.spots.add;
    doc.spots.add = () => { throw new Error('temporary setup failure'); };
    const first = path(ctx, layer);
    const firstEntry = entryFor(ctx, first);
    convert(ctx, firstEntry);
    ctx.applyAutoBlackOverprint(doc);
    assert.equal(firstEntry.skipped, true);
    assert.equal(first.fillColor.typename, 'CMYKColor');

    ctx.cleanupAfterRun();
    ctx.AVOID_AUTO_BLACK_OVERPRINT_ENABLED = true;
    doc.spots.add = add;
    const second = path(ctx, layer);
    const secondEntry = entryFor(ctx, second);
    convert(ctx, secondEntry);
    ctx.applyAutoBlackOverprint(doc);
    assert.equal(secondEntry.skipped, false);
    assert.equal(second.fillColor.spot.name, jaName);
    assert.equal(doc.data.additions, 1);
    assert.equal(doc.data.collectionReads, 2);
});

test('failed paint assignment leaves the computed K100 and reports that object', () => {
    const { ctx, doc, layer } = setup();
    const item = path(ctx, layer); let color = item.fillColor;
    Object.defineProperty(item, 'fillColor', { get() { return color; }, set(next) { if (next.typename === 'SpotColor') throw new Error('locked'); color = next; } });
    const entry = entryFor(ctx, item);
    convert(ctx, entry); ctx.applyAutoBlackOverprint(doc);
    assert.deepEqual(values(item.fillColor), [0, 0, 0, 100]);
    assert.equal(entry.skipped, true);
});

test('repeat execution evaluates options but keeps dedicated Y1 when computed output is pure K100', () => {
    const { ctx, doc, layer } = setup();
    const existing = addGlobal(ctx, doc, jaName, y1k100);
    const item = path(ctx, layer); item.fillColor = globalColor(ctx, existing);
    convert(ctx, entryFor(ctx, item));
    assert.equal(ctx.conversions, 1, 'ordinary option-dependent conversion must still run');
    assert.equal(existing.state.colorWrites, 0);
    ctx.applyAutoBlackOverprint(doc); ctx.applyPendingSpotRenames(doc);
    assert.deepEqual(values(existing.color), [0, 0, 1, 100]);
    assert.equal(existing.name, jaName);
    assert.equal(item.fillColor.spot, existing);
    assert.equal(doc.data.additions, 0);
});

test('dedicated color can change when final option result is not K100', () => {
    const { ctx, doc, layer } = setup();
    ctx.buildAdjustedColorResult = () => ({ changed: true, out: { c: 20, m: 15, y: 0, k: 80 } });
    const existing = addGlobal(ctx, doc, jaName, y1k100);
    const item = path(ctx, layer); item.fillColor = globalColor(ctx, existing);
    convert(ctx, entryFor(ctx, item)); ctx.applyAutoBlackOverprint(doc);
    assert.deepEqual(values(existing.color), [20, 15, 0, 80]);
    assert.equal(doc.data.additions, 0);
});

test('no dedicated-color exemption applies to unrelated Y1K100 globals', () => {
    const { ctx, doc, layer } = setup();
    const original = addGlobal(ctx, doc, '独自の黒', y1k100);
    const item = path(ctx, layer); item.fillColor = globalColor(ctx, original);
    convert(ctx, entryFor(ctx, item)); ctx.applyAutoBlackOverprint(doc);
    assert.deepEqual(values(original.color), [0, 0, 0, 100]);
    assert.equal(item.fillColor.spot.name, jaName);
});

test('selected text runs use the frame opacity and share one color for fill and stroke', () => {
    const { ctx, doc, layer } = setup();
    const frame = { typename: 'TextFrame', opacity: 100, parent: layer };
    const attrs = { fillColor: makeColor(ctx, k100), strokeColor: makeColor(ctx, k100) };
    ctx.makeTextSubRange = () => ({ characterAttributes: attrs });
    const entry = { target: frame, typeName: 'TextFrame', owner: frame, skipped: false };
    ctx.applySelectionTask(entry, { kind: 'textRun', start: 0, end: 3, steps: 2 });
    assert.equal(ctx.applyAutoBlackOverprint(doc), 2);
    assert.equal(attrs.fillColor.spot, attrs.strokeColor.spot);
    assert.equal(doc.data.additions, 1);
});

test('1,000 final K100 paints use one swatch scan and one creation', () => {
    const { ctx, doc, layer } = setup();
    const items = Array.from({ length: 1000 }, () => path(ctx, layer));
    items.forEach(item => convert(ctx, entryFor(ctx, item)));
    assert.equal(ctx.applyAutoBlackOverprint(doc), 1000);
    assert.equal(doc.data.collectionReads, 1);
    assert.equal(doc.data.additions, 1);
});

function configureAutoMain(ctx, doc, items, enabled, error = null) {
    const entries = items.map(item => entryFor(ctx, item));
    const events = []; let result = null;
    ctx.validateActiveDocument = () => doc;
    ctx.collectSelectionStats = () => ({ items: entries, planned: entries.length, selectedObjectCount: entries.length, unsupportedObjectCount: 0, unsupportedBreakdown: [] });
    ctx.showConvertOptionsDialog = () => ({ ok: true, enableSaturationBoost: false, saturationBoostPct: 0, enableCMYKBalance: false, cmyKBalanceValue: 0, enableKBoost: false, enableLightColorProtect: false, avoidAutoBlackOverprint: enabled, selectSkippedObjects: false });
    ctx.createProgressBar = () => ({ step() {}, checkpoint() {}, close() { events.push('cleanup'); } });
    const originalApply = ctx.applyToSelection;
    ctx.applyToSelection = entries => { const result = originalApply(entries); events.push('converted'); if (error) throw error; return result; };
    const originalAuto = ctx.applyAutoBlackOverprint;
    ctx.applyAutoBlackOverprint = doc => { events.push('auto'); return originalAuto(doc); };
    const originalRename = ctx.applyPendingSpotRenames;
    ctx.applyPendingSpotRenames = doc => { events.push('rename'); originalRename(doc); };
    ctx.app.redraw = () => events.push('redraw');
    ctx.showCompletionDialog = info => { result = info; events.push('completion'); };
    return { events, get result() { return result; } };
}

test('main runs auto mapping after all conversions and ordinary name updates', () => {
    const { ctx, doc, layer } = setup(); const item = path(ctx, layer);
    const run = configureAutoMain(ctx, doc, [item], true);
    main.runInContext(ctx);
    assert.deepEqual(run.events, ['converted', 'rename', 'auto', 'cleanup', 'redraw', 'completion']);
    assert.equal(run.result.updatedColors, 1);
    assert.equal(run.result.showAutoBlackOverprintNotice, true);
    assert.equal(item.fillColor.spot.name, jaName);
    assert.equal(ctx.AVOID_AUTO_BLACK_OVERPRINT_ENABLED, false);
    assert.equal(ctx.autoBlackOverprintState.tasks.length, 0);
    assert.equal(ctx.autoBlackOverprintState.spot, null);
    assert.equal(ctx.autoBlackOverprintState.spotFailureReason, null);
    assert.equal(ctx.autoBlackOverprintState.colorApplied, false);
});

test('main never invokes auto postprocessing when checkbox is off', () => {
    const { ctx, doc, layer } = setup(false); const item = path(ctx, layer);
    const run = configureAutoMain(ctx, doc, [item], false);
    ctx.applyAutoBlackOverprint = () => assert.fail('called while off');
    main.runInContext(ctx);
    assert.equal(item.fillColor.typename, 'CMYKColor');
    assert.equal(doc.data.collectionReads, 0);
    assert.equal(run.result.showAutoBlackOverprintNotice, false);
});

for (const locale of ['ja', 'en']) {
    test('reported time includes cleanup, redraw and selection with a localized breakdown: ' + locale, () => {
        const { ctx, doc, layer } = setup(false); ctx.$.locale = locale;
        const item = path(ctx, layer);
        const run = configureAutoMain(ctx, doc, [item], false);
        let elapsed = 0;
        ctx.nowMs = () => elapsed;
        ctx.buildAdjustedColorResult = () => { elapsed += 100; return { changed: false, reason: 'same' }; };
        ctx.$.gc = () => { elapsed += 200; };
        ctx.app.redraw = () => { elapsed += 5000; };
        ctx.clearSelection = () => { elapsed += 1200; };
        const options = ctx.showConvertOptionsDialog;
        ctx.showConvertOptionsDialog = () => ({ ...options(), selectSkippedObjects: true });
        main.runInContext(ctx);
        const unit = locale === 'ja' ? '秒' : 'sec';
        assert.equal(run.result.processingTime, '6.5 ' + unit);
        for (const value of ['0.1', '5.2', '1.2']) assert.ok(run.result.processingTimeHelp.includes(value + ' ' + unit));
        assert.ok(run.result.processingTimeHelp.includes(locale === 'ja' ? '後処理・画面更新' : 'Cleanup and redraw'));
    });
}

test('successful registration also shows the notice when reusing a dedicated swatch', () => {
    const { ctx, doc, layer } = setup();
    addGlobal(ctx, doc, jaName, y1k100);
    const item = path(ctx, layer);
    const run = configureAutoMain(ctx, doc, [item], true);
    main.runInContext(ctx);
    assert.equal(item.fillColor.spot.name, jaName);
    assert.equal(doc.data.additions, 0);
    assert.equal(run.result.showAutoBlackOverprintNotice, true);
});

test('creating a swatch without a successful paint assignment does not claim registration', () => {
    const { ctx, doc, layer } = setup();
    const item = path(ctx, layer);
    const oldColor = item.fillColor;
    Object.defineProperty(item, 'fillColor', { get() { return oldColor; }, set() { throw new Error('paint assignment failed'); } });
    const run = configureAutoMain(ctx, doc, [item], true);
    main.runInContext(ctx);
    assert.equal(doc.data.additions, 1);
    assert.equal(item.fillColor, oldColor);
    assert.equal(run.result.showAutoBlackOverprintNotice, false);
    assert.equal(run.result.skippedCount, 1);
});

test('a dedicated swatch converted to a different final color is renamed before creating a new dedicated black', () => {
    const { ctx, doc, layer } = setup();
    ctx.buildAdjustedColorResult = orig => orig.y === 1 ? { changed: true, out: { c: 20, m: 15, y: 0, k: 80 } } : { changed: false, reason: 'same' };
    const previous = addGlobal(ctx, doc, jaName, y1k100);
    const changed = path(ctx, layer); changed.fillColor = globalColor(ctx, previous);
    const unchangedBlack = path(ctx, layer);
    configureAutoMain(ctx, doc, [changed, unchangedBlack], true);
    main.runInContext(ctx);
    assert.equal(previous.name, 'C=20 M=15 Y=0 K=80 (' + jaName + ')');
    assert.deepEqual(values(previous.color), [20, 15, 0, 80]);
    assert.equal(unchangedBlack.fillColor.spot.name, jaName);
    assert.notEqual(unchangedBlack.fillColor.spot, previous);
    assert.deepEqual(values(unchangedBlack.fillColor.spot.color), [0, 0, 1.01, 100]);
});

test('cancelled conversion does not start another mutation phase', () => {
    const { ctx, doc, layer } = setup(); const item = path(ctx, layer);
    const cancel = new Error('cancelled'); cancel.name = ctx.USER_CANCELLED_ERROR_NAME;
    const run = configureAutoMain(ctx, doc, [item], true, cancel);
    main.runInContext(ctx);
    assert.deepEqual(run.events, ['converted', 'rename', 'cleanup', 'redraw']);
    assert.equal(doc.data.additions, 0);
    assert.equal(ctx.autoBlackOverprintState.tasks.length, 0);
});

test('turns off path fill overprint only on the qualifying fill', () => {
    const { ctx, doc, layer } = setup();
    const item = path(ctx, layer);
    item.fillOverprint = true; item.strokeOverprint = true;
    convert(ctx, entryFor(ctx, item));
    assert.equal(ctx.applyAutoBlackOverprint(doc), 1);
    assert.equal(item.fillOverprint, false);
    assert.equal(item.strokeOverprint, true);
});

test('turns off path stroke overprint only on the qualifying stroke', () => {
    const { ctx, doc, layer } = setup();
    const item = path(ctx, layer);
    item.filled = false; item.stroked = true; item.strokeColor = makeColor(ctx, k100);
    item.fillOverprint = true; item.strokeOverprint = true;
    convert(ctx, entryFor(ctx, item));
    ctx.applyAutoBlackOverprint(doc);
    assert.equal(item.fillOverprint, true);
    assert.equal(item.strokeOverprint, false);
});

test('non-K100 paint overprint is preserved on a partly qualifying object', () => {
    const { ctx, doc, layer } = setup();
    ctx.buildAdjustedColorResult = () => ({ changed: false, reason: 'same' });
    const item = path(ctx, layer);
    item.stroked = true; item.strokeColor = makeColor(ctx, { c: 50, m: 0, y: 0, k: 0 });
    item.fillOverprint = true; item.strokeOverprint = true;
    convert(ctx, entryFor(ctx, item));
    ctx.applyAutoBlackOverprint(doc);
    assert.equal(item.fillOverprint, false);
    assert.equal(item.strokeOverprint, true);
});

test('overprint is cleared after color assignment, including a host side effect that enables it', () => {
    const { ctx, doc, layer } = setup();
    const item = path(ctx, layer); let color = item.fillColor;
    const events = []; let overprint = false;
    Object.defineProperty(item, 'fillColor', { get() { return color; }, set(value) { color = value; overprint = true; events.push('color'); } });
    Object.defineProperty(item, 'fillOverprint', { get() { return overprint; }, set(value) { overprint = value; events.push('overprint'); } });
    convert(ctx, entryFor(ctx, item));
    ctx.applyAutoBlackOverprint(doc);
    assert.deepEqual(events, ['color', 'overprint']);
    assert.equal(overprint, false);
});

test('existing dedicated paint needs no new color assignment to clear overprint', () => {
    const { ctx, doc, layer } = setup();
    const dedicated = addGlobal(ctx, doc, jaName, y1k100);
    const item = path(ctx, layer); const oldColor = globalColor(ctx, dedicated);
    Object.defineProperty(item, 'fillColor', { get() { return oldColor; }, set() { assert.fail('unnecessary color assignment'); } });
    item.fillOverprint = true;
    convert(ctx, entryFor(ctx, item));
    assert.equal(ctx.applyAutoBlackOverprint(doc), 1);
    assert.equal(item.fillOverprint, false);
    assert.equal(item.fillColor, oldColor);
    assert.equal(doc.data.additions, 0);
    assert.equal(doc.data.collectionReads, 0);
});

test('already-cleared dedicated paint adds no writes or change count', () => {
    const { ctx, doc, layer } = setup();
    const dedicated = addGlobal(ctx, doc, jaName, y1k100);
    const item = path(ctx, layer); item.fillColor = globalColor(ctx, dedicated);
    Object.defineProperty(item, 'fillOverprint', { get() { return false; }, set() { assert.fail('unnecessary overprint write'); } });
    convert(ctx, entryFor(ctx, item));
    assert.equal(ctx.applyAutoBlackOverprint(doc), 0);
    assert.equal(doc.data.collectionReads, 0);
});

test('text uses overprintFill and overprintStroke, not the PathItem property names', () => {
    const { ctx, doc, layer } = setup();
    const frame = { typename: 'TextFrame', opacity: 100, parent: layer };
    const attrs = { fillColor: makeColor(ctx, k100), strokeColor: makeColor(ctx, k100), overprintFill: true, overprintStroke: true };
    for (const name of ['fillOverprint', 'strokeOverprint']) Object.defineProperty(attrs, name, { get() { assert.fail('wrong property'); }, set() { assert.fail('wrong property'); } });
    ctx.makeTextSubRange = () => ({ characterAttributes: attrs });
    ctx.applySelectionTask({ target: frame, typeName: 'TextFrame', owner: frame, skipped: false }, { kind: 'textRun', start: 0, end: 3, steps: 2 });
    assert.equal(ctx.applyAutoBlackOverprint(doc), 2);
    assert.equal(attrs.overprintFill, false);
    assert.equal(attrs.overprintStroke, false);
});

for (const typeName of ['PathItem', 'TextFrame']) {
    test('uses captured paint information without a late object-type read: ' + typeName, () => {
        const { ctx, doc, layer } = setup();
        const owner = path(ctx, layer);
        owner.typename = typeName;
        const target = typeName === 'TextFrame' ? { fillColor: makeColor(ctx, k100), overprintFill: true } : owner;
        if (typeName === 'PathItem') target.fillOverprint = true;
        const entry = ctx.makeSelectionArtItemEntry(owner, typeName, owner);
        ctx.processColorPropertyCore(target, 'fillColor', false, entry);
        entry.autoBlackOverprintOpacityState = 1;
        Object.defineProperty(owner, 'typename', { get() { assert.fail('redundant object-type read'); } });
        ctx.applyAutoBlackOverprint(doc);
        assert.equal(target[typeName === 'TextFrame' ? 'overprintFill' : 'fillOverprint'], false);
        assert.equal(entry.skipped, false);
    });
}

test('off performs no overprint reads, writes or helper calls', () => {
    const { ctx, doc, layer } = setup(false);
    const item = path(ctx, layer);
    ctx.clearPaintOverprint = () => assert.fail('called while off');
    Object.defineProperty(item, 'fillOverprint', { get() { assert.fail('read while off'); }, set() { assert.fail('write while off'); } });
    convert(ctx, entryFor(ctx, item));
    assert.equal(ctx.applyAutoBlackOverprint(doc), 0);
});

for (const dedicated of [false, true]) {
    test('semi-transparent paint does not have its overprint inspected: dedicated=' + dedicated, () => {
        const { ctx, doc, layer } = setup();
        const item = path(ctx, layer, k100, 50);
        if (dedicated) item.fillColor = globalColor(ctx, addGlobal(ctx, doc, jaName, y1k100));
        Object.defineProperty(item, 'fillOverprint', { get() { assert.fail('read on excluded object'); }, set() { assert.fail('write on excluded object'); } });
        convert(ctx, entryFor(ctx, item));
        ctx.applyAutoBlackOverprint(doc);
        assert.equal(doc.data.additions, 0);
    });
}

test('a half-tint dedicated swatch is not treated as K100 for overprint clearing', () => {
    const { ctx, doc, layer } = setup();
    const item = path(ctx, layer);
    item.fillColor = globalColor(ctx, addGlobal(ctx, doc, jaName, y1k100), 50);
    item.fillOverprint = true;
    convert(ctx, entryFor(ctx, item));
    ctx.applyAutoBlackOverprint(doc);
    assert.equal(item.fillOverprint, true);
});

test('overprint write failure is reported while retaining the successfully assigned color', () => {
    const { ctx, doc, layer } = setup();
    const item = path(ctx, layer);
    Object.defineProperty(item, 'fillOverprint', { get() { return true; }, set() { throw new Error('cannot write'); } });
    const entry = entryFor(ctx, item);
    convert(ctx, entry);
    assert.equal(ctx.applyAutoBlackOverprint(doc), 1);
    assert.equal(item.fillColor.spot.name, jaName);
    assert.equal(entry.skipped, true);
    assert.equal(ctx.gSkipBreakdown[0].key, 'process:overprintWriteFailed');
});

test('an overprint setter that silently ignores the write is not reported as success', () => {
    const { ctx, doc, layer } = setup();
    const item = path(ctx, layer);
    Object.defineProperty(item, 'fillOverprint', { get() { return true; }, set() {} });
    const entry = entryFor(ctx, item);
    convert(ctx, entry); ctx.applyAutoBlackOverprint(doc);
    assert.equal(entry.skipped, true);
    assert.equal(ctx.gSkipBreakdown[0].key, 'process:overprintWriteFailed');
});

test('failure on an existing dedicated paint does not inflate successful-change count', () => {
    const { ctx, doc, layer } = setup();
    const item = path(ctx, layer);
    item.fillColor = globalColor(ctx, addGlobal(ctx, doc, jaName, y1k100));
    Object.defineProperty(item, 'fillOverprint', { get() { throw new Error('cannot read'); } });
    const entry = entryFor(ctx, item);
    convert(ctx, entry);
    assert.equal(ctx.applyAutoBlackOverprint(doc), 0);
    assert.equal(entry.skipped, true);
});

test('undefined mixed text overprint can be explicitly set to false', () => {
    const { ctx, doc, layer } = setup();
    const frame = { typename: 'TextFrame', opacity: 100, parent: layer };
    const attrs = { fillColor: makeColor(ctx, k100), overprintFill: undefined };
    const entry = { target: frame, typeName: 'TextFrame', owner: frame, skipped: false };
    ctx.processColorPropertyCore(attrs, 'fillColor', false, entry);
    ctx.applyAutoBlackOverprint(doc);
    assert.equal(attrs.overprintFill, false);
    assert.equal(entry.skipped, false);
});

test('compound path clears the representative PathItem attribute', () => {
    const { ctx, doc, layer } = setup();
    const owner = { typename: 'CompoundPathItem', opacity: 100, parent: layer };
    const item = path(ctx, owner); item.fillOverprint = true;
    const entry = ctx.makeSelectionArtItemEntry(item, 'PathItem', owner);
    convert(ctx, entry); ctx.applyAutoBlackOverprint(doc);
    assert.equal(item.fillOverprint, false);
    assert.equal(owner.fillOverprint, undefined);
});

for (const locale of ['ja', 'en']) {
    for (const checked of [false, true]) {
        test('UI option is independent of K balance, default-off and localized: ' + locale + '/' + checked, () => {
            const { ctx } = setup(); ctx.$.locale = locale;
            ctx.setStaticTextMuted = () => {};
            const controls = [];
            function control(type, text) {
                const result = { type, text, enabled: true, preferredSize: {}, layout: { layout() {} }, add(kind, bounds, label) { const child = control(kind, label); controls.push(child); return child; } };
                if (type === 'dropdownlist') result.selection = { text: '10%', index: 0 };
                if (type === 'slider') result.value = 0;
                return result;
            }
            ctx.Window = function () {
                const dialog = control('dialog', '');
                dialog.show = () => {
                    const checkbox = controls.find(item => item.text === (locale === 'ja' ? 'K100の自動墨ノセを回避' : 'Avoid automatic overprint for K100'));
                    assert.ok(checkbox);
                    assert.equal(checkbox.value, false);
                    assert.equal(checkbox.enabled, true);
                    assert.ok(checkbox.helpTip);
                    checkbox.value = checked;
                    return 1;
                };
                return dialog;
            };
            const options = ctx.showConvertOptionsDialog({ selectedObjectCount: 1, unsupportedObjectCount: 0, planned: 1 });
            assert.equal(options.avoidAutoBlackOverprint, checked);
            assert.equal(options.enableCMYKBalance, false);
        });
    }
}
