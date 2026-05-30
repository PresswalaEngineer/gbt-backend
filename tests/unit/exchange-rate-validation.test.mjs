import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    createExchangeRateSchema,
    updateExchangeRateSchema,
} from '../../src/modules/exchange-rate/exchange-rate.validation.js';

test('createExchangeRateSchema accepts valid input', () => {
    const parsed = createExchangeRateSchema.parse({ fromCurrency: 'usd', toCurrency: 'eur', rate: 0.92 });
    assert.equal(parsed.fromCurrency, 'USD');
    assert.equal(parsed.toCurrency, 'EUR');
    assert.equal(parsed.rate, 0.92);
});

test('createExchangeRateSchema rejects same from/to', () => {
    assert.throws(
        () => createExchangeRateSchema.parse({ fromCurrency: 'usd', toCurrency: 'usd', rate: 1 }),
        /must differ/
    );
});

test('createExchangeRateSchema rejects negative rate', () => {
    assert.throws(() => createExchangeRateSchema.parse({ fromCurrency: 'USD', toCurrency: 'EUR', rate: -1 }));
});

test('updateExchangeRateSchema allows partial', () => {
    const parsed = updateExchangeRateSchema.parse({ rate: 1.5 });
    assert.equal(parsed.rate, 1.5);
});
