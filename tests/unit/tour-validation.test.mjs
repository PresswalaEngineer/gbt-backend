import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTourSchema, updateTourSchema } from '../../src/modules/tour/tour.validation.js';
import {
    ensureTiersMatchTourType,
    SINGLE_DAY_TIERS,
    MULTI_DAY_TIERS,
} from '../../src/modules/tour/tour.tier-rules.js';

const baseTour = {
    name: 'Big Bus London Hop-On Hop-Off',
    productId: 'BB-LON-001',
    apiType: 'NONE',
    countryId: 1,
    cityId: 1,
    meetingPoint: 'Trafalgar Square, Charing Cross WC2N 5DN',
    endingPoint: 'Trafalgar Square, Charing Cross WC2N 5DN',
    startTime: '09:00',
    bookingWindow: 'Up to 24 hours before start',
    minPax: 1,
    maxPax: 99,
};

test('createTourSchema accepts a minimal valid tour', () => {
    const parsed = createTourSchema.parse(baseTour);
    assert.equal(parsed.tourType, 'SINGLE_DAY');
    assert.equal(parsed.pricingMode, 'NETT');
    assert.deepEqual(parsed.priceTiers, []);
});

test('createTourSchema accepts SINGLE_DAY with adult/child price tiers', () => {
    const parsed = createTourSchema.parse({
        ...baseTour,
        tourType: 'SINGLE_DAY',
        currency: 'gbp',
        marginPercent: 15,
        priceTiers: [
            { tier: 'ADULT', nettPrice: 30, grossPrice: 34.5 },
            { tier: 'CHILD', nettPrice: 18, grossPrice: 20.7, originalPrice: 25 },
        ],
    });
    assert.equal(parsed.currency, 'GBP', 'currency uppercased');
    assert.equal(parsed.priceTiers.length, 2);
    assert.equal(parsed.priceTiers[0].grossPrice, 34.5);
});

test('createTourSchema rejects negative price', () => {
    assert.throws(() =>
        createTourSchema.parse({
            ...baseTour,
            priceTiers: [{ tier: 'ADULT', grossPrice: -5 }],
        })
    );
});

test('createTourSchema rejects originalPrice below grossPrice', () => {
    assert.throws(() =>
        createTourSchema.parse({
            ...baseTour,
            priceTiers: [{ tier: 'ADULT', grossPrice: 50, originalPrice: 40 }],
        })
    );
});

test('createTourSchema rejects duplicate tiers', () => {
    assert.throws(() =>
        createTourSchema.parse({
            ...baseTour,
            priceTiers: [
                { tier: 'ADULT', grossPrice: 30 },
                { tier: 'ADULT', grossPrice: 35 },
            ],
        })
    );
});

test('createTourSchema rejects bad currency code length', () => {
    assert.throws(() =>
        createTourSchema.parse({ ...baseTour, currency: 'POUNDS' })
    );
});

test('createTourSchema accepts MULTI_DAY with pax-bucketed tiers', () => {
    const parsed = createTourSchema.parse({
        ...baseTour,
        tourType: 'MULTI_DAY',
        durationDays: 3,
        priceTiers: [
            { tier: 'PAX_1', grossPrice: 800 },
            { tier: 'PAX_2', grossPrice: 600 },
            { tier: 'CHILD_WITH_BED', grossPrice: 300 },
        ],
    });
    assert.equal(parsed.tourType, 'MULTI_DAY');
    assert.equal(parsed.durationDays, 3);
    assert.equal(parsed.priceTiers.length, 3);
});

test('createTourSchema rejects unknown tier value', () => {
    assert.throws(() =>
        createTourSchema.parse({
            ...baseTour,
            priceTiers: [{ tier: 'TEEN', grossPrice: 20 }],
        })
    );
});

test('createTourSchema requires apiId when apiType is set', () => {
    assert.throws(() =>
        createTourSchema.parse({ ...baseTour, apiType: 'TOURCMS' })
    );
});

test('createTourSchema accepts blank optional pricing fields', () => {
    const parsed = createTourSchema.parse({
        ...baseTour,
        marginPercent: '',
        commissionPercent: '',
        durationDays: '',
        currency: '',
    });
    assert.equal(parsed.marginPercent, null);
    assert.equal(parsed.commissionPercent, null);
    assert.equal(parsed.durationDays, null);
    assert.equal(parsed.currency, null);
});

test('updateTourSchema allows partial updates with priceTiers only', () => {
    const parsed = updateTourSchema.parse({
        priceTiers: [{ tier: 'ADULT', grossPrice: 42 }],
    });
    assert.deepEqual(parsed.priceTiers, [
        { tier: 'ADULT', nettPrice: null, grossPrice: 42, originalPrice: null, notes: null },
    ]);
});

test('ensureTiersMatchTourType: SINGLE_DAY accepts ADULT/CHILD/INFANT/SENIOR', () => {
    for (const tier of SINGLE_DAY_TIERS) {
        assert.doesNotThrow(() =>
            ensureTiersMatchTourType('SINGLE_DAY', [{ tier, grossPrice: 1 }])
        );
    }
});

test('ensureTiersMatchTourType: MULTI_DAY accepts pax buckets', () => {
    for (const tier of MULTI_DAY_TIERS) {
        assert.doesNotThrow(() =>
            ensureTiersMatchTourType('MULTI_DAY', [{ tier, grossPrice: 1 }])
        );
    }
});

test('ensureTiersMatchTourType: SINGLE_DAY rejects pax buckets', () => {
    assert.throws(
        () => ensureTiersMatchTourType('SINGLE_DAY', [{ tier: 'PAX_2', grossPrice: 1 }]),
        /not valid for SINGLE_DAY/
    );
});

test('ensureTiersMatchTourType: MULTI_DAY rejects ADULT/CHILD', () => {
    assert.throws(
        () => ensureTiersMatchTourType('MULTI_DAY', [{ tier: 'ADULT', grossPrice: 1 }]),
        /not valid for MULTI_DAY/
    );
});

test('ensureTiersMatchTourType: empty/undefined inputs are no-ops', () => {
    assert.doesNotThrow(() => ensureTiersMatchTourType('SINGLE_DAY', []));
    assert.doesNotThrow(() => ensureTiersMatchTourType('SINGLE_DAY', undefined));
    assert.doesNotThrow(() => ensureTiersMatchTourType(undefined, undefined));
});
