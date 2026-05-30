import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convertQuerySchema } from '../../src/modules/exchange-rate/exchange-rate.validation.js';

test('convertQuerySchema accepts a valid query', () => {
    const out = convertQuerySchema.parse({ amount: '100', from: 'usd', to: 'eur' });
    assert.equal(out.amount, 100);
    assert.equal(out.from, 'USD');
    assert.equal(out.to, 'EUR');
});

test('convertQuerySchema rejects non-positive amount', () => {
    assert.throws(() => convertQuerySchema.parse({ amount: '0', from: 'USD', to: 'EUR' }));
    assert.throws(() => convertQuerySchema.parse({ amount: '-5', from: 'USD', to: 'EUR' }));
});

test('convertQuerySchema rejects bad currency codes', () => {
    assert.throws(() => convertQuerySchema.parse({ amount: '10', from: 'US', to: 'EUR' }));
    assert.throws(() => convertQuerySchema.parse({ amount: '10', from: 'USD', to: 'EURO' }));
});

test('convertQuerySchema rejects unknown keys (strict)', () => {
    assert.throws(() =>
        convertQuerySchema.parse({ amount: '10', from: 'USD', to: 'EUR', evil: 1 })
    );
});
