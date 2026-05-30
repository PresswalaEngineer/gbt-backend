import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    extractImageUrls,
    diffImageUrls,
    collectBlogImageUrls,
} from '../../src/services/storage/html-image-diff.js';

test('extractImageUrls pulls src URLs from HTML', () => {
    const html = `
        <p>Lead</p>
        <img src="https://cdn.example.com/a.png" alt="a" />
        <img src='https://cdn.example.com/b.jpg' />
        <img alt="no src" />
    `;
    const urls = extractImageUrls(html);
    assert.equal(urls.length, 2);
    assert.ok(urls.includes('https://cdn.example.com/a.png'));
    assert.ok(urls.includes('https://cdn.example.com/b.jpg'));
});

test('extractImageUrls deduplicates same URL repeated', () => {
    const html = `<img src="https://x/a.png"><img src="https://x/a.png">`;
    assert.deepEqual(extractImageUrls(html), ['https://x/a.png']);
});

test('extractImageUrls ignores base64 data URLs', () => {
    const html = `<img src="data:image/png;base64,AAAA"><img src="https://r2.example/keep.png">`;
    assert.deepEqual(extractImageUrls(html), ['https://r2.example/keep.png']);
});

test('extractImageUrls handles empty / null / non-string input', () => {
    assert.deepEqual(extractImageUrls(''), []);
    assert.deepEqual(extractImageUrls(null), []);
    assert.deepEqual(extractImageUrls(undefined), []);
    assert.deepEqual(extractImageUrls(42), []);
});

test('diffImageUrls computes added and removed', () => {
    const oldUrls = ['a', 'b', 'c'];
    const newUrls = ['b', 'c', 'd'];
    const { removed, added } = diffImageUrls(oldUrls, newUrls);
    assert.deepEqual(removed.sort(), ['a']);
    assert.deepEqual(added.sort(), ['d']);
});

test('diffImageUrls handles empty inputs safely', () => {
    assert.deepEqual(diffImageUrls(null, null), { removed: [], added: [] });
    assert.deepEqual(diffImageUrls(['a'], null), { removed: ['a'], added: [] });
    assert.deepEqual(diffImageUrls(null, ['a']), { removed: [], added: ['a'] });
});

test('collectBlogImageUrls combines banner, thumbnail, og, contentImages, and content HTML', () => {
    const blog = {
        bannerImage: 'https://r2/banner.jpg',
        thumbnailImage: 'https://r2/thumb.jpg',
        ogImage: 'https://r2/og.jpg',
        contentImages: ['https://r2/already-tracked.jpg'],
        content: `<p>Hi <img src="https://r2/inline.jpg"></p>`,
    };
    const urls = collectBlogImageUrls(blog);
    assert.ok(urls.includes('https://r2/banner.jpg'));
    assert.ok(urls.includes('https://r2/thumb.jpg'));
    assert.ok(urls.includes('https://r2/og.jpg'));
    assert.ok(urls.includes('https://r2/already-tracked.jpg'));
    assert.ok(urls.includes('https://r2/inline.jpg'));
    assert.equal(new Set(urls).size, urls.length, 'should be deduped');
});

test('collectBlogImageUrls tolerates missing fields', () => {
    const urls = collectBlogImageUrls({ content: '' });
    assert.deepEqual(urls, []);
});
