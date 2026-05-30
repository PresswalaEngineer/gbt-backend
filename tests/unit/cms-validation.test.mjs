import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    createFaqSchema,
    replaceFaqsSchema,
    updateFaqSchema,
} from '../../src/modules/faq/faq.validation.js';
import {
    MAX_BANNERS,
    createBannerSchema,
    updateBannerSchema,
} from '../../src/modules/banner/banner.validation.js';
import {
    createDestCatSchema,
    listDestCatSchema,
} from '../../src/modules/destination-category/destination-category.validation.js';

test('createFaqSchema accepts a valid faq', () => {
    const out = createFaqSchema.parse({ question: 'How do I book?', answer: 'Click book.' });
    assert.equal(out.question, 'How do I book?');
});

test('createFaqSchema rejects empty answer', () => {
    assert.throws(() => createFaqSchema.parse({ question: 'Valid question?', answer: '' }));
});

test('createFaqSchema rejects unknown keys (strict)', () => {
    assert.throws(() => createFaqSchema.parse({ question: 'Valid?', answer: 'Yes', evil: 1 }));
});

test('updateFaqSchema allows partial', () => {
    const out = updateFaqSchema.parse({ answer: 'Updated answer' });
    assert.equal(out.answer, 'Updated answer');
});

test('replaceFaqsSchema requires at least one faq', () => {
    assert.throws(() => replaceFaqsSchema.parse({ faqs: [] }));
});

test('replaceFaqsSchema accepts an array of faqs', () => {
    const out = replaceFaqsSchema.parse({ faqs: [{ question: 'Q one?', answer: 'A1' }] });
    assert.equal(out.faqs.length, 1);
});

test('MAX_BANNERS is 7', () => {
    assert.equal(MAX_BANNERS, 7);
});

test('createBannerSchema accepts valid banner', () => {
    const out = createBannerSchema.parse({
        imageUrl: 'https://cdn.example.com/banner.jpg',
        content: 'Summer sale 20% off',
    });
    assert.equal(out.content, 'Summer sale 20% off');
});

test('createBannerSchema rejects non-url image', () => {
    assert.throws(() => createBannerSchema.parse({ imageUrl: 'not-a-url', content: 'x' }));
});

test('createBannerSchema rejects content over 100 chars', () => {
    assert.throws(() =>
        createBannerSchema.parse({
            imageUrl: 'https://cdn.example.com/b.jpg',
            content: 'x'.repeat(101),
        })
    );
});

test('updateBannerSchema allows partial content-only update', () => {
    const out = updateBannerSchema.parse({ content: 'New text' });
    assert.equal(out.content, 'New text');
});

test('createDestCatSchema accepts Destination', () => {
    const out = createDestCatSchema.parse({ name: 'Paris', type: 'Destination' });
    assert.equal(out.type, 'Destination');
});

test('createDestCatSchema accepts Category', () => {
    const out = createDestCatSchema.parse({ name: 'Adventure', type: 'Category' });
    assert.equal(out.type, 'Category');
});

test('createDestCatSchema rejects unknown type', () => {
    assert.throws(() => createDestCatSchema.parse({ name: 'X', type: 'Region' }));
});

test('createDestCatSchema rejects empty name', () => {
    assert.throws(() => createDestCatSchema.parse({ name: '', type: 'Destination' }));
});

test('listDestCatSchema applies default pagination', () => {
    const out = listDestCatSchema.parse({});
    assert.equal(out.page, 1);
    assert.equal(out.limit, 200);
});
