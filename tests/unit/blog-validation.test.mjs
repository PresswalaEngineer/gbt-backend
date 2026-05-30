import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    createBlogSchema,
    listBlogSchema,
    updateBlogSchema,
} from '../../src/modules/blog/blog.validation.js';

const BASE = {
    title: 'Top 10 Things to Do in Paris',
    slug: 'top-10-things-paris',
    excerpt: 'A curated guide to the best Parisian experiences for first-time travelers.',
    content: '<p>Some content goes here.</p>',
    bannerImage: 'https://cdn.example.com/banner.jpg',
    thumbnailImage: 'https://cdn.example.com/thumb.jpg',
    author: 'Jane Doe',
    category: 'TRAVEL_GUIDE',
};

test('createBlogSchema accepts a minimal valid payload', () => {
    const out = createBlogSchema.parse(BASE);
    assert.equal(out.title, BASE.title);
    assert.equal(out.status, 'DRAFT');
    assert.equal(out.isFeatured, false);
});

test('createBlogSchema rejects invalid slug', () => {
    assert.throws(() =>
        createBlogSchema.parse({ ...BASE, slug: 'Not A Slug!' }),
        /Slug/
    );
});

test('createBlogSchema rejects too-short excerpt', () => {
    assert.throws(() =>
        createBlogSchema.parse({ ...BASE, excerpt: 'short' }),
    );
});

test('createBlogSchema rejects unknown category', () => {
    assert.throws(() =>
        createBlogSchema.parse({ ...BASE, category: 'UNKNOWN' }),
    );
});

test('createBlogSchema rejects unknown extra keys (strict)', () => {
    assert.throws(() =>
        createBlogSchema.parse({ ...BASE, evil: 'data' }),
    );
});

test('createBlogSchema accepts optional SEO + tags + content images', () => {
    const out = createBlogSchema.parse({
        ...BASE,
        tags: ['paris', 'travel'],
        contentImages: ['https://cdn.example.com/inline.jpg'],
        seoTitle: 'SEO Title',
        seoDescription: 'SEO description',
        canonicalUrl: 'https://example.com/blog/paris',
    });
    assert.deepEqual(out.tags, ['paris', 'travel']);
    assert.equal(out.canonicalUrl, 'https://example.com/blog/paris');
});

test('updateBlogSchema accepts partial payloads', () => {
    const out = updateBlogSchema.parse({ title: 'New Title' });
    assert.equal(out.title, 'New Title');
});

test('updateBlogSchema rejects invalid status', () => {
    assert.throws(() => updateBlogSchema.parse({ status: 'TRASH' }));
});

test('listBlogSchema coerces page/limit and parses booleans', () => {
    const out = listBlogSchema.parse({ page: '2', limit: '20', isFeatured: 'true' });
    assert.equal(out.page, 2);
    assert.equal(out.limit, 20);
    assert.equal(out.isFeatured, true);
});

test('listBlogSchema applies defaults', () => {
    const out = listBlogSchema.parse({});
    assert.equal(out.page, 1);
    assert.equal(out.limit, 50);
});
