const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../../InDesgin');
const source = name => fs.readFileSync(path.join(root, name), 'utf8').replace(/^#target[^\n]*/gm, '');
const scripts = fs.readdirSync(root).filter(name => name.endsWith('.jsx'));

function context(overrides = {}) {
    const messages = [];
    const undoNames = [];
    const app = {
        documents: [{}], selection: [],
        doScript(fn, language, args, mode, name) { undoNames.push(name); return fn(); },
        scriptPreferences: { measurementUnit: 'original' },
        refresh() {},
    };
    const ctx = vm.createContext({
        app, alert: message => messages.push(message), confirm: () => true,
        ScriptLanguage: { JAVASCRIPT: 1 }, UndoModes: { ENTIRE_SCRIPT: 1 },
        MeasurementUnits: { POINTS: 1 },
        CoordinateSpaces: { SPREAD_COORDINATES: 1, INNER_COORDINATES: 2 },
        AnchorPoint: { TOP_LEFT_ANCHOR: 1, TOP_RIGHT_ANCHOR: 2, BOTTOM_LEFT_ANCHOR: 3, TOP_CENTER_ANCHOR: 4, LEFT_CENTER_ANCHOR: 5, CENTER_ANCHOR: 6, RIGHT_CENTER_ANCHOR: 7, BOTTOM_CENTER_ANCHOR: 8, BOTTOM_RIGHT_ANCHOR: 9 },
        BoundingBoxLimits: { GEOMETRIC_PATH_BOUNDS: 1 },
        ResizeMethods: { MULTIPLYING_CURRENT_DIMENSIONS_BY: 1 },
        MatrixContent: { SCALE_VALUES: 1, SHEAR_VALUE: 2, ROTATION_VALUE: 3, TRANSLATION_VALUES: 4 },
        LinkStatus: { NORMAL: 1, LINK_MISSING: 2, LINK_INACCESSIBLE: 3, LINK_EMBEDDED: 4, LINK_OUT_OF_DATE: 5 },
        $: { locale: 'ja' }, ...overrides,
    });
    return { ctx, app: ctx.app, messages, undoNames };
}
function run(name, state) { return new vm.Script(source(name), { filename: name }).runInContext(state.ctx); }
function fitter(overrides = {}) {
    const state = context(overrides);
    const names = [
        'parseJsonText', 'validateReplacementData', 'collectSelectedGraphics',
        'ensureGraphicLinkIsCurrent', 'showPreviewDialog', 'restoreTransformSnapshot',
        'getCurrentPlacementSnapshot', 'getRectangleCornerPoints', 'getItemSize',
        'applyPlacementInPoints', 'restoreOriginalPlacement', 'applyReplacementMode',
        'convertPointToFrameSpace', 'convertFrameSpaceToSpreadPoint',
    ];
    const exported = 'return {' + names.map(name => name + ':' + name).join(',') +
        ', setPreviewHooks:function(restore,apply){restoreOriginalPlacement=restore;applyReplacementMode=apply;}' +
        ', setSnapshotHooks:function(placement,matrix){getCurrentPlacementInfo=placement;readGraphicTransformMatrix=matrix;}' +
        ', setDialogLabels:function(){resolveInitialMode=function(){return "mode1";};buildModeOptionText=function(){return "mode";};}' +
        '};\n';
    state.api = new vm.Script(source('InDesignCrop_RelinkFitter.jsx').replace('    if (app.documents.length === 0) {', exported + '    if (app.documents.length === 0) {')).runInContext(state.ctx);
    return state;
}
const data = () => ({version: 1, unit: 'mm', rotation: 0, mode1: {x: -1, y: 2, w: 30, h: 40}, mode2: {x: 0, y: 0, w: 20, h: 25}});

for (const name of scripts) {
    test(name + ': no document never accesses activeDocument', () => {
        const state = context();
        state.app.documents = [];
        Object.defineProperty(state.app, 'activeDocument', { get() { throw Error('unexpected document access'); } });
        run(name, state);
        assert.equal(state.messages.length, 1);
        assert.match(state.messages[0], /ドキュメント/);
    });
}

for (const native of [true, false]) {
    test('XMP parser accepts JSON without executing code, native=' + native, () => {
        const {api, ctx} = fitter(native ? {} : {JSON: undefined});
        const payload = data();
        payload.note = '改行\n引用"と\\と\t';
        assert.equal(JSON.stringify(api.parseJsonText(JSON.stringify(payload))), JSON.stringify(payload));
        ctx.executed = false;
        for (const bad of [
            '(function(){executed=true;return {};})()',
            '{"version":(executed=true,1)}',
            '{version:1}', '{"version":1,}', '{"x":[1,]}', '{"x":01}',
            '{"x":"bad\nstring"}', '{"x":"\\q"}', '{"x":1} trailing',
        ]) assert.equal(api.parseJsonText(bad), null, bad);
        assert.equal(ctx.executed, false);
        assert.equal(api.parseJsonText('{"x":"\\u65e5","y":-1.2e+3}').x, '日');
    });
}

test('XMP rejects zero/negative dimensions and missing/nonfinite rotations', () => {
    const {api} = fitter();
    assert.equal(api.validateReplacementData(data()), '');
    for (const change of [
        d => d.mode1.w = 0, d => d.mode2.h = -2,
        d => d.rotation = undefined, d => d.rotation = Infinity,
        d => d.mode1.rotation = '0', d => d.version = true,
        d => d.mode2.x = NaN,
    ]) { const d = data(); change(d); assert.notEqual(api.validateReplacementData(d), ''); }
    const d = data(); delete d.rotation; d.mode1.rotation = 0; d.mode2.rotation = 20;
    assert.equal(api.validateReplacementData(d), '');
});

test('XMP group selection includes every image and deduplicates repeated selections', () => {
    const {api} = fitter();
    const frame = {isValid: true};
    const image = id => ({id, constructor: {name: 'Image'}, parent: frame, itemLink: {isValid: true}});
    const first = image(1), second = image(2);
    assert.equal(api.collectSelectedGraphics([{allGraphics: [first, second]}, first]).length, 2);
});

test('XMP accepts a linked Graphic reference without requiring a concrete constructor name', () => {
    const {api} = fitter();
    const graphic = {id: 7, constructor: {name: 'Graphic'}, parent: {isValid: true}, itemLink: {isValid: true}};
    assert.equal(api.collectSelectedGraphics([graphic]).length, 1);
});

test('XMP refuses an update that leaves the link out of date', () => {
    const {api, ctx} = fitter();
    const frame = {isValid: true};
    const link = {isValid: true, status: ctx.LinkStatus.LINK_OUT_OF_DATE, update() { return this; }};
    const graphic = {isValid: true, itemLink: link, parent: frame}; link.parent = graphic;
    assert.match(api.ensureGraphicLinkIsCurrent(frame, graphic).message, /自動更新できません/);
    link.update = function () { this.status = ctx.LinkStatus.NORMAL; return this; };
    assert.equal(api.ensureGraphicLinkIsCurrent(frame, graphic).message, '');
});

test('XMP does not preview without an exact transform snapshot', () => {
    const {api} = fitter();
    api.setSnapshotHooks(() => ({width: 10}), () => null);
    assert.equal(api.getCurrentPlacementSnapshot({}, {}), null);
});

test('XMP frame coordinates round-trip through a sheared frame and reject collapsed axes', () => {
    const {api} = fitter();
    const corners = [[100, 200], [180, 200], [130, 260]];
    const point = api.convertFrameSpaceToSpreadPoint(12, -9, ...corners);
    const local = api.convertPointToFrameSpace(point, ...corners);
    assert.ok(Math.abs(local.x - 12) < 1e-10);
    assert.ok(Math.abs(local.y + 9) < 1e-10);
    assert.equal(api.convertPointToFrameSpace([5, 5], [0, 0], [10, 0], [20, 0]), null);
});

test('XMP transform restoration explicitly replaces shear, rotation, scale and translation', () => {
    const {api} = fitter();
    let args;
    assert.equal(api.restoreTransformSnapshot({transform(...values) { args = values; }}, {transformMatrix: [1, 0, 0.2, 1, 20, 30]}), true);
    assert.equal(JSON.stringify(args[1]), '[0,0]');
    assert.equal(JSON.stringify(args[3]), '[1,2,3,4]');
});

function dialogState({result = 1, applyFails = false, throwFromShow = false, restoreFails = false} = {}) {
    let closed = false, restores = 0, applies = 0;
    function Window() {
        const dialog = {add() { return {add: dialog.add}; }, close() { closed = true; }, show() {
            this.onShow();
            if (throwFromShow) throw Error('dialog failed');
            return closed ? 0 : result;
        }};
        return dialog;
    }
    const state = fitter({Window});
    state.api.setDialogLabels();
    state.api.setPreviewHooks(() => { restores++; return !restoreFails; }, () => { applies++; return !applyFails; });
    return {...state, stats: () => ({restores, applies})};
}
for (const options of [{result: 0}, {throwFromShow: true}, {applyFails: true}, {restoreFails: true}]) {
    test('XMP restores preview on cancel or failure: ' + JSON.stringify(options), () => {
        const state = dialogState(options);
        if (options.result === 0) state.api.showPreviewDialog({});
        else assert.throws(() => state.api.showPreviewDialog({}));
        assert.equal(state.stats().restores, 2);
    });
}
test('XMP keeps a successful accepted preview', () => {
    const state = dialogState(); state.api.showPreviewDialog({});
    assert.deepEqual(state.stats(), {restores: 1, applies: 1});
});

function alignmentState(accept, {mode = 2, matchAngle = false, keyAngle = 0, targetAngle = 0, rotationPoint = 0, toggleAngle = false} = {}) {
    const state = context(); let shown = 0, keyWrites = 0;
    const pointAnchors = [1, 4, 2, 5, 6, 7, 3, 8, 9];
    const ui = {};
    function item(id, width, height, angle) {
        return {
            id, width, height, absoluteRotationAngle: angle, origin: [3, 2], isValid: true, itemLayer: {locked: false},
            get geometricBounds() { throw Error('Axis-aligned bounds must not be used'); },
            resolve(location, space, rulerUnits) {
                assert.equal(location[1], state.ctx.BoundingBoxLimits.GEOMETRIC_PATH_BOUNDS);
                assert.equal(location[2], state.ctx.CoordinateSpaces.INNER_COORDINATES);
                assert.equal(space, state.ctx.CoordinateSpaces.SPREAD_COORDINATES);
                assert.equal(rulerUnits, false);
                const index = pointAnchors.indexOf(location[0]);
                assert.notEqual(index, -1);
                const x = (index % 3) * this.width / 2;
                const y = Math.floor(index / 3) * this.height / 2;
                const radians = this.absoluteRotationAngle * Math.PI / 180;
                return [[this.origin[0] + x * Math.cos(radians) + y * Math.sin(radians), this.origin[1] - x * Math.sin(radians) + y * Math.cos(radians)]];
            },
            resize(space, anchor, method, factors) {
                assert.equal(space[0], state.ctx.CoordinateSpaces.INNER_COORDINATES);
                assert.equal(method, state.ctx.ResizeMethods.MULTIPLYING_CURRENT_DIMENSIONS_BY);
                const before = this.resolve(anchor, state.ctx.CoordinateSpaces.SPREAD_COORDINATES, false)[0];
                this.width *= factors[0]; this.height *= factors[1];
                const after = this.resolve(anchor, state.ctx.CoordinateSpaces.SPREAD_COORDINATES, false)[0];
                this.origin = [this.origin[0] + before[0] - after[0], this.origin[1] + before[1] - after[1]];
            },
            transform(space, origin, matrix) {
                assert.equal(space, state.ctx.CoordinateSpaces.SPREAD_COORDINATES);
                this.rotationPivot = Array.from(origin);
                const radians = matrix.counterclockwiseRotationAngle * Math.PI / 180;
                const dx = this.origin[0] - origin[0], dy = this.origin[1] - origin[1];
                this.origin = [origin[0] + dx * Math.cos(radians) + dy * Math.sin(radians), origin[1] - dx * Math.sin(radians) + dy * Math.cos(radians)];
                this.absoluteRotationAngle += matrix.counterclockwiseRotationAngle;
            },
        };
    }
    const target = item(2, 6, 5, targetAngle);
    const selectedKey = {id: 1, resize() {keyWrites++;}, transform() {keyWrites++;}};
    const key = item(1, 30, 20, keyAngle);
    state.app.activeDocument = {selection: [selectedKey, target], selectionKeyObject: key};
    state.app.transformationMatrices = {add(properties) {return properties;}};
    state.app.generalPreferences = {uiBrightnessPreference: 0};
    function element(type, parent, text = '') {
        const result = {type, parent, text, children: [], value: false, enabled: true, events: {},
            add(type, bounds, text) {const child = element(type, this, text);this.children.push(child);return child;},
            addEventListener(name, fn) {this.events[name] = fn;},
            notify(name) {if(this[name])this[name]();},
            update() {},
        };
        result.graphics = {
            PenType: {SOLID_COLOR: 1}, BrushType: {SOLID_COLOR: 1},
            newPen(type, color) {result.lastColor = Array.from(color);return {};}, newBrush() {return {};},
            newPath() {result.currentRect = null;}, moveTo() {}, lineTo() {}, strokePath() {},
            rectPath(x, y, w, h) {result.currentRect = [x, y, w, h];},
            fillPath() {result.selectedRect = result.currentRect.slice();},
        };
        return result;
    }
    state.ctx.Window = function (type, title) {
        const dialog = element(type, null, title);
        dialog.show = function () {
            shown++;
            const body = this.children[0];
            assert.equal(body.orientation, 'row');
            const sizeColumn = body.children[0], angleColumn = body.children[1];
            const checkbox = angleColumn.children[0], preview = angleColumn.children[1];
            Object.assign(ui, {dialog, checkbox, preview});
            assert.equal(checkbox.text, '角度を一致');
            assert.equal(checkbox.value, false, 'angle matching must default to off');
            assert.equal(preview.enabled, false);
            for (const property of ['preferredSize', 'minimumSize', 'maximumSize']) assert.deepEqual(Array.from(preview[property]), [60, 60]);
            preview.onDraw(); assert.equal(preview.lastColor[0], 0.42, 'initial picker is dimmed');
            preview.events.mousedown({button: 0, clientX: 50, clientY: 50});
            assert.equal(preview.helpTip, '回転中心：左上', 'disabled clicks must not change the pivot');
            sizeColumn.children.forEach((button, index) => button.value = index === mode);
            checkbox.value = matchAngle; checkbox.onClick();
            assert.equal(preview.enabled, matchAngle);
            assert.equal(preview.lastColor[0], matchAngle ? 0.94 : 0.42);
            preview.events.mousedown({button: 0, clientX: 8 + (rotationPoint % 3) * 22, clientY: 8 + Math.floor(rotationPoint / 3) * 22});
            const selected = matchAngle ? rotationPoint : 0;
            assert.deepEqual(preview.selectedRect, [3.5 + (selected % 3) * 22, 3.5 + Math.floor(selected / 3) * 22, 9, 9], 'the clicked point and filled point must match');
            assert.equal(preview.helpTip, '回転中心：' + ['左上', '上中央', '右上', '左中央', '中央', '右中央', '左下', '下中央', '右下'][selected]);
            if (toggleAngle) {
                const tip = preview.helpTip;
                checkbox.value = false; checkbox.onClick();
                assert.equal(preview.enabled, false); assert.equal(preview.lastColor[0], 0.42);
                preview.events.mousedown({button: 0, clientX: 10, clientY: 10});
                assert.equal(preview.helpTip, tip, 'disabling the picker retains its selection');
                checkbox.value = true; checkbox.onClick();
            }
            return accept ? 1 : 0;
        };
        return dialog;
    };
    return {...state, target, key, ui, pointAnchors, stats: () => ({shown, keyWrites})};
}
test('Alignment skips the key by ID even when DOM references differ and uses the ScriptUI dialog', () => {
    const state = alignmentState(true); run('AlignToKeyObject.jsx', state);
    assert.deepEqual(state.stats(), {shown: 1, keyWrites: 0});
    assert.equal(state.target.width, 30); assert.equal(state.target.height, 20);
    assert.equal(state.undoNames.length, 1);
});
test('Alignment cancellation closes the ScriptUI dialog without modifying objects', () => {
    const state = alignmentState(false); run('AlignToKeyObject.jsx', state);
    assert.equal(state.stats().shown, 1);
    assert.equal(state.target.width, 6); assert.equal(state.target.height, 5);
    assert.equal(state.undoNames.length, 0);
});

for (const mode of [0, 1, 2]) {
    for (const matchAngle of [false, true]) {
        test('Alignment measures rotated edges and optionally matches angle: mode=' + mode + ' matchAngle=' + matchAngle, () => {
            const state = alignmentState(true, {mode, matchAngle, keyAngle: 30, targetAngle: -25});
            run('AlignToKeyObject.jsx', state);
            assert.equal(state.messages.length, 0);
            assert.ok(Math.abs(state.target.width - (mode === 1 ? 6 : 30)) < 1e-10);
            assert.ok(Math.abs(state.target.height - (mode === 0 ? 5 : 20)) < 1e-10);
            assert.equal(state.target.absoluteRotationAngle, matchAngle ? 30 : -25);
            assert.deepEqual(state.target.origin, [3, 2]);
            assert.deepEqual([state.key.width, state.key.height, state.key.absoluteRotationAngle], [30, 20, 30]);
        });
    }
}
test('Alignment keeps width and height distinct for a key rotated 90 degrees', () => {
    const state = alignmentState(true, {keyAngle: 90}); run('AlignToKeyObject.jsx', state);
    assert.ok(Math.abs(state.target.width - 30) < 1e-10);
    assert.ok(Math.abs(state.target.height - 20) < 1e-10);
});
test('Alignment can match zero degrees to remove the target rotation', () => {
    const state = alignmentState(true, {matchAngle: true, keyAngle: 0, targetAngle: 45}); run('AlignToKeyObject.jsx', state);
    assert.equal(state.target.absoluteRotationAngle, 0);
});

for (let rotationPoint = 0; rotationPoint < 9; rotationPoint++) {
    for (const mode of [0, 1, 2]) {
        test('Alignment preserves original selected point ' + rotationPoint + ' across resize and rotation, mode=' + mode, () => {
            const state = alignmentState(true, {mode, matchAngle: true, rotationPoint, keyAngle: 35, targetAngle: -20});
            const location = [state.pointAnchors[rotationPoint], 1, 2];
            const before = state.target.resolve(location, 1, false)[0];
            run('AlignToKeyObject.jsx', state);
            assert.equal(state.messages.length, 0);
            assert.equal(state.target.absoluteRotationAngle, 35);
            assert.ok(Math.abs(state.target.width - (mode === 1 ? 6 : 30)) < 1e-10);
            assert.ok(Math.abs(state.target.height - (mode === 0 ? 5 : 20)) < 1e-10);
            const after = state.target.resolve(location, 1, false)[0];
            assert.ok(Math.hypot(after[0] - before[0], after[1] - before[1]) < 1e-10, 'the point selected in the UI must stay at its pre-run position');
            assert.ok(Math.hypot(state.target.rotationPivot[0] - before[0], state.target.rotationPivot[1] - before[1]) < 1e-10, 'rotation must use that same pre-run position');
        });
    }
}
test('Alignment preserves the original center even when the angle is already matched', () => {
    const state = alignmentState(true, {matchAngle: true, rotationPoint: 4, keyAngle: 35, targetAngle: 35});
    const before = state.target.resolve([state.ctx.AnchorPoint.CENTER_ANCHOR, 1, 2], 1, false)[0];
    run('AlignToKeyObject.jsx', state);
    const after = state.target.resolve([state.ctx.AnchorPoint.CENTER_ANCHOR, 1, 2], 1, false)[0];
    assert.ok(Math.hypot(after[0] - before[0], after[1] - before[1]) < 1e-10);
    assert.equal(state.target.absoluteRotationAngle, 35);
});
test('Alignment keeps the selected pivot across dimming and re-enabling', () => {
    const state = alignmentState(true, {matchAngle: true, rotationPoint: 4, toggleAngle: true, keyAngle: 35});
    run('AlignToKeyObject.jsx', state);
    assert.equal(state.messages.length, 0);
    assert.equal(state.ui.preview.helpTip, '回転中心：中央');
    assert.equal(state.ui.preview.enabled, true);
});

test('Frame fitting continues past locked/failing frames and processes each frame once', () => {
    function Rectangle(id) { Object.assign(this, {id, visible: true, itemLayer: {visible: true}, parentPage: {id: 10, name: '1', documentOffset: 0, isValid: true}, frameFittingOptions: {autoFit: true}}); }
    const locked = new Rectangle(1); locked.locked = true;
    const failed = new Rectangle(2); Object.defineProperty(failed.frameFittingOptions, 'autoFit', {get() {return true;},set() {throw Error('locked group');}});
    const good = new Rectangle(3); let writes = 0, enabled = true;
    Object.defineProperty(good.frameFittingOptions, 'autoFit', {get() {return enabled;},set(value) {writes++;enabled=value;}});
    const state = context({Rectangle, Oval: class {}, Polygon: class {}});
    state.app.activeDocument = {allGraphics: [locked, failed, good, good].map(parent => ({parent}))};
    run('ClearFrameFittingOptions.jsx', state);
    assert.equal(writes, 1); assert.equal(enabled, false);
    assert.match(state.messages[0], /1ページ（1アイテム）/);
    assert.match(state.messages[0], /処理できなかった画像フレーム：2件/);
});

test('Embedding visits a stable snapshot and continues after a broken link', () => {
    const state = context(); const calls = [];
    const links = ['first', 'missing', 'last'].map((name, i) => ({name, isValid: true, status: i === 1 ? 2 : 1, unlink() {calls.push(name);this.status=4;}}));
    state.app.activeDocument = {links: {length: 3, everyItem() {return {getElements() {return links.slice();}};}}};
    run('EmbedAllLinks.jsx', state);
    assert.deepEqual(calls, ['first', 'last']);
    assert.match(state.messages[0], /埋め込み済み：2件/);
    assert.match(state.messages[0], /埋め込めなかったリンク：1件/);
});

test('Embedding does not count a silent unlink failure as success', () => {
    const state = context();
    const link = {name: 'outdated', isValid: true, status: 5, unlink() {}};
    state.app.activeDocument = {links: {length: 1, everyItem() {return {getElements() {return [link];}};}}};
    run('EmbedAllLinks.jsx', state);
    assert.match(state.messages[0], /埋め込み済み：0件/);
    assert.match(state.messages[0], /埋め込めなかったリンク：1件/);
});

test('Color matching rolls back already assigned profiles after a later setter fails', () => {
    const state = context(); let rgbPolicy = 'old-rgb-policy';
    const doc = {cmykProfile: 'old-cmyk', rgbProfile: 'old-rgb', cmykPolicy: 'old-cmyk-policy'};
    Object.defineProperty(doc, 'rgbPolicy', {get() {return rgbPolicy;}, set(value) {if(value === 'new-rgb-policy') throw Error('rejected');rgbPolicy=value;}});
    state.app.activeDocument = doc;
    state.app.colorSettings = {workingSpaceCMYK: 'new-cmyk', workingSpaceRGB: 'new-rgb', cmykPolicy: 'new-cmyk-policy', rgbPolicy: 'new-rgb-policy'};
    run('MatchApplicationColorSettings.jsx', state);
    assert.equal(doc.cmykProfile, 'old-cmyk'); assert.equal(doc.rgbProfile, 'old-rgb');
    assert.equal(doc.cmykPolicy, 'old-cmyk-policy'); assert.equal(doc.rgbPolicy, 'old-rgb-policy');
    assert.match(state.messages[0], /変更前の設定に戻しました/);
});

for (const errorNumber of [2, 99]) {
    test('Link options distinguish cancellation from placement errors: ' + errorNumber, () => {
        const state = context({File: name => ({exists: true, name})});
        const graphic = {itemLink: {isValid: true, status: 1, filePath: 'image.png'}, place() {throw Object.assign(Error('failed'), {number: errorNumber});}};
        state.app.selection = [graphic];
        run('ShowLinkOption.jsx', state);
        assert.equal(state.messages.length, errorNumber === 2 ? 0 : 1);
    });
}

test('Document color viewer is read-only and leaves no global helper names behind', () => {
    const state = context();
    state.app.activeDocument = Object.freeze({rgbProfile: 'RGB', cmykProfile: 'CMYK', rgbPolicy: 'PRESERVE_EMBEDDED_PROFILES', cmykPolicy: 'COLOR_POLICY_OFF'});
    state.app.colorSettings = {workingSpaceRGB: 'RGB', workingSpaceCMYK: 'CMYK'};
    run('DocumentColorSettings.jsx', state);
    assert.match(state.messages[0], /作業用と同じ/);
    assert.equal(state.ctx.UI_TEXT, undefined);
    assert.equal(state.ctx.currentLocaleCode, undefined);
});
