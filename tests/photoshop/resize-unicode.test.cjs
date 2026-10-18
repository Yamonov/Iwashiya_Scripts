const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '../../Photoshop');
const scripts = ['Photoshop_InDesignResizeCrop.jsx', 'PhotoshopIllustratorResizeCrop.jsx'];
const decomposed = 'カ\u3099ハ\u309Aウ\u3099 e\u0301 A\u0300 o\u0302 u\u0308 n\u0303 A\u030A a\u0304 c\u030C Z\u0307 a\u0328 c\u0327';
const composed = decomposed.normalize('NFC');

function section(source, first, last) {
    const start = source.indexOf(first);
    const end = source.indexOf(last, start);
    assert.ok(start >= 0 && end > start, first);
    return source.slice(start, end);
}

function context(name, os) {
    const source = fs.readFileSync(path.join(root, name), 'utf8');
    const ctx = vm.createContext({
        $: {os},
        File: function (value) { return {fsName: String(value), resolve() { return null; }}; },
    });
    vm.runInContext(section(source, 'function toNFCJa(s)', 'var NORM_HELPER_SRC_ID'), ctx);
    ctx._normPath = ctx._normPathLocal;
    if (name.includes('InDesign')) {
        vm.runInContext(
            section(source, 'function _decodeAndNormalizePath(', '// InDesign側: 一致するリンク一覧を返す') +
            section(source, '    function isPathSeparatorCode(', '    function getLinkStatusCode('), ctx
        );
        ctx.isWindows = os.includes('Windows');
    } else {
        vm.runInContext(section(source, '    function splitFileName(', '    function getDocumentPath('), ctx);
    }
    return ctx;
}

for (const name of scripts) {
    test(name + ': kana and supported Latin compositions survive function-source evaluation', () => {
        const ctx = context(name, 'Macintosh');
        assert.equal(ctx.toNFCJa(decomposed), composed);
        assert.equal(ctx.toNFCJa(composed), composed);
        vm.runInContext('remoteNormalizer = (' + ctx.toNFCJa.toString() + ');', ctx);
        assert.equal(ctx.remoteNormalizer(decomposed), composed);
        assert.equal(ctx.toNFCJa('1979-063n_Data.psd'), '1979-063n_Data.psd');
    });

    test(name + ': macOS comparison paths use NFC', () => {
        const ctx = context(name, 'Macintosh');
        const input = '/Volumes/カ\u3099イト\u3099/cafe\u0301/ハ\u309Aターン.psd';
        assert.equal(ctx._normPathLocal(input), input.normalize('NFC'));
    });

    test(name + ': Windows keeps canonically distinct real paths distinct', () => {
        const ctx = context(name, 'Windows');
        const nfd = 'C:\\Images\\カ\u3099_e\u0301.psd';
        const nfc = nfd.normalize('NFC');
        assert.equal(ctx._normPathLocal(nfd), nfd);
        assert.equal(ctx._normPathLocal(nfc), nfc);
        assert.notEqual(ctx._normPathLocal(nfd), ctx._normPathLocal(nfc));
        ctx.File = function () { throw Error('File unavailable'); };
        assert.equal(ctx._normPathLocal(nfd), nfd);
    });

    for (const os of ['Macintosh', 'Windows']) {
        test(name + ': comparison basenames accept NFC and NFD on ' + os, () => {
            const ctx = context(name, os);
            const split = ctx.splitFileNameInfo || ctx.splitFileName;
            const nfd = 'カ\u3099ハ\u309A_e\u0301_1979-063n_Data.psd';
            assert.equal(split(nfd).baseName, split(nfd.normalize('NFC')).baseName);
            assert.notEqual(split(nfd).baseName, split(nfd.replace('063', '043')).baseName);
        });
    }
}

for (const os of ['Macintosh', 'Windows']) {
    test('InDesign decoders preserve the platform-specific path policy on ' + os, () => {
        const ctx = context(scripts[0], os);
        const nfd = (os === 'Windows' ? 'C:\\Images\\' : '/Images/') + 'カ\u3099_e\u0301.psd';
        const expected = os === 'Windows' ? nfd : nfd.normalize('NFC');
        assert.equal(ctx._decodePathRaw(encodeURIComponent(nfd)), expected);
        assert.equal(ctx._decodeAndNormalizePath(encodeURIComponent(nfd)), expected);
    });
}
