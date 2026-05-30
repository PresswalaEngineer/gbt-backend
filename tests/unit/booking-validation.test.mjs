import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    createBookingSchema,
    cancelBookingSchema,
    refundBookingSchema,
    listBookingSchema,
} from '../../src/modules/booking/booking.validation.js';
import { priceFor, generateReferenceNumber } from '../../src/modules/booking/booking.pricing.js';

test('createBookingSchema accepts a minimal valid booking', () => {
    const parsed = createBookingSchema.parse({
        tourId: 1,
        leadGuestName: 'Jane Doe',
        leadGuestEmail: 'jane@example.com',
        paxBreakdown: { ADULT: 2, CHILD: 1 },
        travelDate: '2026-08-15',
    });
    assert.equal(parsed.tourId, 1);
    assert.deepEqual(parsed.paxBreakdown, { ADULT: 2, CHILD: 1 });
});

test('createBookingSchema rejects invalid email', () => {
    assert.throws(() =>
        createBookingSchema.parse({
            tourId: 1,
            leadGuestName: 'Jane',
            leadGuestEmail: 'not-an-email',
            paxBreakdown: { ADULT: 1 },
            travelDate: '2026-08-15',
        })
    );
});

test('cancelBookingSchema requires reason', () => {
    assert.throws(() => cancelBookingSchema.parse({}));
    const parsed = cancelBookingSchema.parse({ reason: 'Customer changed plans' });
    assert.equal(parsed.reason, 'Customer changed plans');
});

test('refundBookingSchema enforces non-negative amount', () => {
    assert.throws(() => refundBookingSchema.parse({ amount: -1 }));
    const parsed = refundBookingSchema.parse({ amount: 50 });
    assert.equal(parsed.amount, 50);
});

test('listBookingSchema applies sane defaults', () => {
    const parsed = listBookingSchema.parse({});
    assert.equal(parsed.page, 1);
    assert.equal(parsed.limit, 50);
});

test('priceFor computes total for SINGLE_DAY tour', () => {
    const tour = {
        tourType: 'SINGLE_DAY',
        currency: 'USD',
        minPax: 1,
        maxPax: 10,
        priceTiers: [
            { tier: 'ADULT', grossPrice: '100', nettPrice: '80' },
            { tier: 'CHILD', grossPrice: '60', nettPrice: '50' },
            { tier: 'INFANT', grossPrice: '0', nettPrice: '0' },
        ],
    };
    const result = priceFor(tour, { ADULT: 2, CHILD: 1, INFANT: 1 });
    assert.equal(result.gross, 260);
    assert.equal(result.nett, 210);
    assert.equal(result.totalPax, 3, 'infants do not count toward pax cap');
});

test('priceFor rejects tier mismatch with tourType', () => {
    const tour = {
        tourType: 'SINGLE_DAY',
        currency: 'USD',
        minPax: 1,
        maxPax: 10,
        priceTiers: [{ tier: 'PAX_1', grossPrice: '100' }],
    };
    assert.throws(() => priceFor(tour, { PAX_1: 1 }), /not valid for SINGLE_DAY/);
});

test('priceFor rejects pax above max', () => {
    const tour = {
        tourType: 'SINGLE_DAY',
        currency: 'USD',
        minPax: 1,
        maxPax: 2,
        priceTiers: [{ tier: 'ADULT', grossPrice: '100' }],
    };
    assert.throws(() => priceFor(tour, { ADULT: 3 }), /exceeds max pax/);
});

test('generateReferenceNumber produces BK-YYYYMMDD-XXXXXX', () => {
    const ref = generateReferenceNumber();
    assert.match(ref, /^BK-\d{8}-[A-Z0-9]{6}$/);
});
