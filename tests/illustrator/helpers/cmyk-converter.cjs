// Adobe DOMを模擬化する。既定では変換結果も模擬値とし、Illustratorの起動・操作は行わない。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const scriptPath = require('node:path').resolve(__dirname, '../../../Illustrator/CMYKto100GCRConverter_ai.jsx');
const source = fs.readFileSync(scriptPath, 'utf8').replace(/^#target[^\n]*\n/, '');
const mainOffset = source.lastIndexOf('(\n    function main()');
assert.ok(mainOffset > 0);
const definitions = new vm.Script(source.slice(0, mainOffset), { filename: scriptPath });
const main = new vm.Script(source.slice(mainOffset), { filename: scriptPath + ':main' });
const output = { c: 0, m: 5, y: 71, k: 54 };
const prefix = 'C=0 M=5 Y=71 K=54';

function context({ mockAdjustedResult = true } = {}) {
    const ctx = vm.createContext({
        File: function () {
            this.open = () => true;
            this.read = count => source.slice(0, count);
            this.close = () => {};
        },
        $: { fileName: scriptPath, locale: 'ja', gc() {} },
        CMYKColor: function () { this.typename = 'CMYKColor'; },
        ColorModel: { PROCESS: 'process', SPOT: 'spot', REGISTRATION: 'registration' },
        app: { redraw() {} },
        alert() {},
    });
    definitions.runInContext(ctx);
    ctx.conversions = 0;
    if (mockAdjustedResult) {
        ctx.buildAdjustedColorResult = () => {
            ctx.conversions++;
            return { changed: true, out: { ...output } };
        };
    }
    return ctx;
}

function spot(name, options = {}) {
    const state = {
        name,
        color: { typename: 'CMYKColor', cyan: 15, magenta: 15, yellow: 75, black: 45 },
        nameReads: 0, nameWrites: 0, colorWrites: 0, events: [],
    };
    const object = { colorType: options.colorType || 'process', state };
    if (options.index !== undefined) object.index = options.index;
    Object.defineProperty(object, 'name', {
        get() {
            state.nameReads++;
            if (options.getName) return options.getName(state);
            return state.name;
        },
        set(value) {
            state.nameWrites++;
            state.events.push('name');
            if (options.setName) options.setName(state, value);
            else state.name = value;
        },
    });
    Object.defineProperty(object, 'color', {
        get() { return state.color; },
        set(value) {
            if (options.failColorWrite) throw new Error('color write rejected');
            state.colorWrites++;
            state.events.push('color');
            state.color = value;
        },
    });
    return object;
}

function document(spots, extraNames = []) {
    const stats = { collectionReads: 0, nameReads: 0 };
    const swatches = spots.map(item => ({ get name() { stats.nameReads++; return item.name; } }))
        .concat(extraNames.map(name => ({ get name() { stats.nameReads++; return name; } })));
    return { stats, get swatches() { stats.collectionReads++; return swatches; } };
}

function process(ctx, item) {
    return ctx.processSpotColor({ typename: 'SpotColor', spot: item, tint: 50 });
}


module.exports = { context, spot, document, process, main, output, prefix };
