import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    normalizeSearchTours,
    normalizeShowTour,
} from '../../src/services/integrations/tourcms/normalize.js';
import {
    normalizeProductsList,
    normalizeShowProduct,
    octoMoneyToMajor,
    extractPriceTiers,
    pickProductCurrency,
} from '../../src/services/integrations/ventrata/normalize.js';

test('TourCMS: normalizeShowTour pulls currency + best-effort ADULT tier from from_price', () => {
    const tour = normalizeShowTour({
        tour: {
            tour_id: 1234,
            channel_id: 3930,
            tour_name: 'London Hop-On Hop-Off',
            tour_code: 'LHO-001',
            from_price: '32.50',
            from_price_currency: 'gbp',
            description: 'See London from a double-decker.',
            meeting_point: 'Trafalgar Square',
            start_time: '09:00:00',
        },
    });
    assert.equal(tour.apiType, 'TOURCMS');
    assert.equal(tour.productId, 'LHO-001');
    assert.equal(tour.currency, 'GBP');
    assert.equal(tour.startTime, '09:00');
    assert.deepEqual(tour.priceTiers, [{ tier: 'ADULT', grossPrice: 32.5 }]);
});

test('TourCMS: priceTiers stays empty when no price is present', () => {
    const tour = normalizeShowTour({
        tour: { tour_id: 1, channel_id: 1, tour_name: 'X' },
    });
    assert.deepEqual(tour.priceTiers, []);
    assert.equal(tour.currency, null);
});

test('TourCMS: normalizeSearchTours flattens response.tour into id/name/thumbnail', () => {
    const list = normalizeSearchTours({
        tour: [
            {
                tour_id: 1,
                channel_id: 3930,
                tour_name: 'A',
                start_location: 'London',
                country: 'UK',
                image: { url_large: 'https://example/a.jpg' },
            },
        ],
    });
    assert.equal(list[0].tourId, '1');
    assert.equal(list[0].location, 'London, UK');
    assert.equal(list[0].thumbnailUrl, 'https://example/a.jpg');
});

test('Ventrata: octoMoneyToMajor converts cents to major-unit decimal', () => {
    assert.equal(octoMoneyToMajor(0), 0);
    assert.equal(octoMoneyToMajor(3450), 34.5);
    assert.equal(octoMoneyToMajor(99), 0.99);
    assert.equal(octoMoneyToMajor(null), null);
    assert.equal(octoMoneyToMajor('not-a-number'), null);
    assert.equal(octoMoneyToMajor(-5), null);
});

test('Ventrata: extractPriceTiers maps ADULT/CHILD/INFANT/SENIOR units', () => {
    const tiers = extractPriceTiers({
        options: [
            {
                units: [
                    { id: 'adult', type: 'ADULT', pricingFrom: [{ original: 3000, currency: 'EUR' }] },
                    { id: 'child', type: 'CHILD', pricingFrom: [{ retail: 1500, currency: 'EUR' }] },
                    { id: 'baby', type: 'INFANT', pricingFrom: [{ original: 0 }] },
                ],
            },
        ],
    });
    assert.deepEqual(tiers, [
        { tier: 'ADULT', grossPrice: 30 },
        { tier: 'CHILD', grossPrice: 15 },
        { tier: 'INFANT', grossPrice: 0 },
    ]);
});

test('Ventrata: extractPriceTiers buckets YOUTH/STUDENT into CHILD when no CHILD unit exists', () => {
    const tiers = extractPriceTiers({
        options: [
            {
                units: [
                    { id: 'adult', type: 'ADULT', pricingFrom: [{ original: 4000 }] },
                    { id: 'youth-13-17', type: 'YOUTH', pricingFrom: [{ original: 2000 }] },
                ],
            },
        ],
    });
    assert.equal(tiers.find((t) => t.tier === 'CHILD').grossPrice, 20);
});

test('Ventrata: extractPriceTiers dedupes — first match for a tier wins', () => {
    const tiers = extractPriceTiers({
        options: [
            {
                units: [
                    { id: 'adult-a', type: 'ADULT', pricingFrom: [{ original: 5000 }] },
                    { id: 'adult-b', type: 'ADULT', pricingFrom: [{ original: 9999 }] },
                ],
            },
        ],
    });
    assert.equal(tiers.length, 1);
    assert.equal(tiers[0].grossPrice, 50);
});

test('Ventrata: extractPriceTiers returns empty array when no pricing exists', () => {
    assert.deepEqual(extractPriceTiers({ options: [{ units: [] }] }), []);
    assert.deepEqual(extractPriceTiers({}), []);
    assert.deepEqual(extractPriceTiers({ options: null }), []);
});

test('Ventrata: pickProductCurrency falls back through candidates', () => {
    assert.equal(pickProductCurrency({ defaultCurrency: 'usd' }), 'USD');
    assert.equal(
        pickProductCurrency({
            availableCurrencies: ['eur'],
            options: [{ units: [{ pricingFrom: [{ currency: 'gbp' }] }] }],
        }),
        'EUR'
    );
    assert.equal(
        pickProductCurrency({
            options: [{ units: [{ pricingFrom: [{ currency: 'inr' }] }] }],
        }),
        'INR'
    );
    assert.equal(pickProductCurrency({}), null);
    assert.equal(pickProductCurrency({ defaultCurrency: 'rupees' }), null);
});

test('Ventrata: normalizeShowProduct wires currency + priceTiers into form-ready payload', () => {
    const product = {
        id: 'tootbus-london-001',
        title: 'Tootbus London Discovery',
        reference: 'TLD',
        defaultCurrency: 'gbp',
        coverImageUrl: 'https://cdn.example/cover.jpg',
        galleryImages: ['https://cdn.example/g1.jpg', 'https://cdn.example/g2.jpg'],
        instantConfirmation: true,
        options: [
            {
                id: 'classic',
                title: 'Classic 24h',
                reference: 'CL-24',
                units: [
                    { id: 'adult', type: 'ADULT', pricingFrom: [{ original: 4500 }] },
                    { id: 'child', type: 'CHILD', pricingFrom: [{ original: 2200 }] },
                ],
            },
        ],
    };
    const out = normalizeShowProduct(product);
    assert.equal(out.apiType, 'VENTRATA');
    assert.equal(out.currency, 'GBP');
    assert.equal(out.thumbnail, 'https://cdn.example/cover.jpg');
    assert.equal(out.images.length, 2);
    assert.equal(out.options.length, 1);
    assert.deepEqual(out.priceTiers, [
        { tier: 'ADULT', grossPrice: 45 },
        { tier: 'CHILD', grossPrice: 22 },
    ]);
});

test('Ventrata: normalizeProductsList returns search-shape items', () => {
    const list = normalizeProductsList([
        {
            id: 'a',
            title: 'Alpha Tour',
            reference: 'A1',
            internalName: 'alpha',
            coverImageUrl: 'https://cdn/a.jpg',
            instantConfirmation: false,
        },
    ]);
    assert.equal(list[0].productId, 'a');
    assert.equal(list[0].name, 'Alpha Tour');
    assert.equal(list[0].thumbnailUrl, 'https://cdn/a.jpg');
});
