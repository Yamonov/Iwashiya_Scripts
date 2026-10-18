const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const scriptPath = path.resolve(__dirname, '../../Photoshop/PhotoshopIllustratorResizeCrop.jsx');
const source = fs.readFileSync(scriptPath, 'utf8');

function section(start, end) {
    const first = source.indexOf(start);
    const last = source.indexOf(end, first);
    assert.ok(first >= 0 && last > first, `Source section: ${start}`);
    return source.slice(first, last);
}

function context(os = 'Windows') {
    const ctx = vm.createContext({$: {os}});
    vm.runInContext(
        section('function toSourceLiteral(', 'function sendBridgeTalkAndWait(') +
        section('function parseJsonResponse(', 'function buildPaddedLabel(') +
        section('    function splitPath(', '    function splitFileName('),
        ctx
    );
    return ctx;
}

const strings = [
    '',
    '1979-063n_Data.psd',
    'C:\\temp\\new\\bin\\1979-063n_Data.psd',
    '\\\\server\\share\\日本語 フォルダー\\1979-043n_Data.psd',
    '/Volumes/Images/日本語 フォルダー/1978-050n_Data.psd',
    '引用 "double" と \'single\'、100% と #',
    Array.from({length: 32}, (_, code) => String.fromCharCode(code)).join(''),
    'line\u2028paragraph\u2029end',
    'emoji \uD83D\uDE00; lone high \uD800; lone low \uDC00',
    'long \\path "引用"\u0000'.repeat(140),
];

test('string values survive the production response parser', () => {
    const ctx = context();
    for (const value of strings) {
        const literal = ctx.toSourceLiteral(value);
        assert.equal(ctx.parseJsonResponse(literal), value);
        assert.doesNotMatch(literal, /[\u0000-\u001f\u2028\u2029]/);
        assert.ok(!literal.includes('\\'), 'Transport source must not require backslash escapes');
    }
});

test('the serializer remains self-contained when compiled from its function source', () => {
    const ctx = context();
    vm.runInContext('remoteSerializer = (' + ctx.toSourceLiteral.toString() + ');', ctx);
    for (const value of strings) {
        assert.equal(ctx.parseJsonResponse(ctx.remoteSerializer(value)), value);
    }
});

test('nested placement payloads preserve paths, arrays, numbers and booleans', () => {
    const ctx = context();
    const placement = {
        documentPath: 'C:\\temp\\new\\日本語 文書.ai',
        linkPath: 'C:\\temp\\bin\\1979-063n_Data.psd',
        itemUuid: 'sample-uuid',
        pathMatches: true,
        geometryFingerprint: {
            linkPath: '\\\\server\\share\\1979-063n_Data.psd',
            imageQuad: [[0, 0], [100.5, 0], [100.5, -20], [0, -20]],
            normalizedMaskBounds: null,
        },
        candidates: [{label: '画像 "A"', selected: false}],
    };
    ctx.fixtureJSON = JSON.stringify(placement);
    const result = vm.runInContext('parseJsonResponse(toSourceLiteral(JSON.parse(fixtureJSON)))', ctx);
    assert.equal(JSON.stringify(result), JSON.stringify(placement));
});

test('existing primitive value types are retained', () => {
    const ctx = context();
    for (const value of [null, undefined, true, false, 0, -12.5, Infinity, NaN]) {
        assert.ok(Object.is(ctx.parseJsonResponse(ctx.toSourceLiteral(value)), value));
    }
});

test('Windows drive paths preserve the complete filename', () => {
    const ctx = context();
    for (const name of ['1979-063n_Data.psd', '1979-043n_Data.psd', '1978-050n_Data.psd', 'uACEF035.psd']) {
        const result = ctx.splitPath('C:\\日本語 Images\\' + name);
        assert.equal(result.folderPath, 'C:/日本語 Images');
        assert.equal(result.fileName, name);
    }
});

test('Windows splitting preserves UNC prefixes and accepts mixed separators', () => {
    const ctx = context();
    assert.equal(ctx.splitPath('\\\\server\\share\\image.psd').folderPath, '//server/share');
    assert.equal(ctx.splitPath('C:/Images\\image.psd').folderPath, 'C:/Images');
    assert.equal(ctx.splitPath('image.psd').folderPath, '');
    assert.equal(ctx.splitPath('image.psd').fileName, 'image.psd');
});

test('macOS paths retain their existing splitting behavior', () => {
    const ctx = context('Macintosh');
    const result = ctx.splitPath('/Volumes/Images/日本語 フォルダー/1979-063n_Data.psd');
    assert.equal(result.folderPath, '/Volumes/Images/日本語 フォルダー');
    assert.equal(result.fileName, '1979-063n_Data.psd');
});

test('the complete JSX source passes JavaScript syntax validation', () => {
    new vm.Script(source.replace(/^#target[^\n]*/gm, ''), {filename: scriptPath});
});
