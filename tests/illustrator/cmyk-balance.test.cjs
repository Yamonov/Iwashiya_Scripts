const test = require('node:test');
const assert = require('node:assert/strict');
const { context } = require('./helpers/cmyk-converter.cjs');

// CMMだけを線形モデルで代用し、本体の探索・補正・最終丸め・保護判定を実行する。
// Illustratorのプロファイルごとの色再現を保証するテストではない。
function calculationContext(lightnessPerCMY, bluePerCMY) {
    const ctx = context({ mockAdjustedResult: false });
    ctx.ImageColorSpace = { CMYK: 'CMYK', LAB: 'LAB' };
    ctx.ColorConvertPurpose = { defaultpurpose: 'default' };
    ctx.app.convertSampleColor = (source, values, destination, purpose) => {
        assert.equal(source, 'CMYK');
        assert.equal(destination, 'LAB');
        assert.equal(purpose, 'default');
        const [c, m, y, k] = values;
        return [100 - lightnessPerCMY * (c + m + y) - 0.5 * k, 0.5 * (m - c), y - bluePerCMY * (c + m)];
    };
    ctx.CMY_K_BALANCE_ENABLED = true;
    ctx.CMY_K_BALANCE_VALUE = 50;
    return ctx;
}

const paleColor = { c: 4, m: 4, y: 0, k: 0 };

test('K+ rejects a color that exceeds the allowed difference after final rounding', () => {
    const ctx = calculationContext(0.5, 0.75);
    const result = ctx.buildAdjustedColorResult(paleColor);
    assert.equal(result.changed, false, 'the unrounded candidate must not allow all plates to disappear');
    assert.equal(result.reason, 'same');
});

test('light-color protection retains CMY when rounded K provides no replacement', () => {
    const unprotected = calculationContext(0.01, 0.3);
    const unprotectedResult = unprotected.buildAdjustedColorResult(paleColor);
    assert.equal(unprotectedResult.changed, true, 'this fixture is within the color-difference allowance');
    assert.deepEqual({ ...unprotectedResult.out }, { c: 0, m: 0, y: 0, k: 0 });

    const protectedColor = calculationContext(0.01, 0.3);
    protectedColor.LIGHT_COLOR_PROTECT_ENABLED = true;
    const result = protectedColor.buildAdjustedColorResult(paleColor);
    assert.equal(result.changed, false, 'K removed by final rounding cannot compensate for removed CMY');
    assert.equal(result.reason, 'same');
});

for (const balance of [50, 100]) {
    test('K+' + balance + ' still accepts a permitted rounded result with sufficient K', () => {
        const ctx = calculationContext(0.2, 0.3);
        ctx.CMY_K_BALANCE_VALUE = balance;
        ctx.LIGHT_COLOR_PROTECT_ENABLED = true;
        const input = { c: 10, m: 10, y: 0, k: 20 };
        const result = ctx.buildAdjustedColorResult(input);
        assert.equal(result.changed, true);
        assert.ok(result.out.k > input.k);
        assert.ok(result.out.c + result.out.m < input.c + input.m);
        for (const value of Object.values(result.out)) {
            assert.equal(value, Math.round(value));
            assert.ok(value >= 0 && value <= 100);
        }
    });
}

test('disabled balance preserves the unadjusted pale color', () => {
    const ctx = calculationContext(0.5, 0.75);
    ctx.CMY_K_BALANCE_ENABLED = false;
    const result = ctx.buildAdjustedColorResult(paleColor);
    assert.equal(result.changed, false);
    assert.equal(result.reason, 'same');
});

for (const enabled of [false, true]) {
    test('final rounding keeps 1 to 3 percent only with light-color protection: ' + enabled, () => {
        const ctx = calculationContext(0.2, 0.3);
        ctx.LIGHT_COLOR_PROTECT_ENABLED = enabled;
        const output = ctx.finalizeCMYK({ c: 0.4, m: 0.5, y: 2.5, k: 3.4 });
        assert.deepEqual({ ...output }, enabled ? { c: 0, m: 1, y: 3, k: 3 } : { c: 0, m: 0, y: 0, k: 0 });
        assert.equal(ctx.roundCMYKValue(3.5, true), 4);
    });
}

for (const channel of ['c', 'm', 'y', 'k']) {
    for (const value of [1, 2, 3]) {
        test('protected ' + channel + '=' + value + ' survives the complete color search', () => {
            const ctx = calculationContext(0.2, 0.3);
            ctx.LIGHT_COLOR_PROTECT_ENABLED = true;
            const input = { c: 0, m: 0, y: 0, k: 0, [channel]: value };
            const result = ctx.buildAdjustedColorResult(input);
            assert.equal(result.changed, false, 'search scoring and final output must use the same threshold policy');
            assert.equal(result.reason, 'same');
        });
    }
}

test('protected K+ balance can retain low CMY and compensating K after integer rounding', () => {
    const ctx = calculationContext(0.2, 0.3);
    ctx.LIGHT_COLOR_PROTECT_ENABLED = true;
    const result = ctx.buildAdjustedColorResult(paleColor);
    assert.equal(result.changed, true);
    assert.deepEqual({ ...result.out }, { c: 3, m: 3, y: 0, k: 1 });
});

for (const value of [1, 2, 3]) {
    test('K boost retains protected K=' + value, () => {
        const ctx = calculationContext(0.2, 0.3);
        ctx.CMY_K_BALANCE_VALUE = 100;
        ctx.K_BOOST_ENABLED = true;
        ctx.LIGHT_COLOR_PROTECT_ENABLED = true;
        const result = ctx.buildAdjustedColorResult({ c: 0, m: 0, y: 0, k: value });
        assert.equal(result.changed, false);
        assert.equal(result.reason, 'same');
    });
}
