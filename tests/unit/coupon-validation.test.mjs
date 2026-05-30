import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    createCouponSchema,
    updateCouponSchema,
    applyCouponSchema,
} from '../../src/modules/coupon/coupon.validation.js';

const base = {
    name: 'Summer 25',
    code: 'summer25',
    discountType: 'PERCENTAGE',
    discountAmount: 25,
    startDate: '2026-06-01',
    endDate: '2026-08-31',
    eligibility: 'ALL',
};

test('createCouponSchema accepts a valid percentage coupon', () => {
    const parsed = createCouponSchema.parse(base);
    assert.equal(parsed.code, 'SUMMER25', 'code uppercased');
    assert.equal(parsed.discountAmount, 25);
    assert.equal(parsed.eligibility, 'ALL');
});

test('createCouponSchema rejects percentage > 100', () => {
    assert.throws(
        () => createCouponSchema.parse({ ...base, discountAmount: 150 }),
        /Percentage discount must be ≤ 100/
    );
});

test('createCouponSchema rejects endDate before startDate', () => {
    assert.throws(
        () => createCouponSchema.parse({ ...base, startDate: '2026-09-01', endDate: '2026-06-01' }),
        /End date must be on\/after start date/
    );
});

test('createCouponSchema rejects targeted eligibility without target', () => {
    assert.throws(
        () => createCouponSchema.parse({ ...base, eligibility: 'CITY' }),
        /Pick a target/
    );
});

test('createCouponSchema accepts targeted eligibility with target', () => {
    const parsed = createCouponSchema.parse({ ...base, eligibility: 'TOUR', targetTourId: 42 });
    assert.equal(parsed.eligibility, 'TOUR');
    assert.equal(parsed.targetTourId, 42);
});

test('updateCouponSchema allows partial updates', () => {
    const parsed = updateCouponSchema.parse({ status: 'INACTIVE' });
    assert.equal(parsed.status, 'INACTIVE');
});

test('applyCouponSchema validates input', () => {
    const parsed = applyCouponSchema.parse({ code: 'SUMMER25', tourId: 7, amount: 100 });
    assert.equal(parsed.tourId, 7);
});
