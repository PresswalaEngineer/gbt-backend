import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderTemplate, extractPlaceholders } from '../../src/services/email/render.js';

test('renderTemplate fills placeholders', () => {
    const out = renderTemplate('Hi {{name}}, your booking {{ref}} is confirmed.', {
        name: 'Vimal',
        ref: 'BK-1',
    });
    assert.equal(out, 'Hi Vimal, your booking BK-1 is confirmed.');
});

test('renderTemplate replaces missing keys with empty string', () => {
    const out = renderTemplate('Hi {{name}}, code {{code}}', { name: 'X' });
    assert.equal(out, 'Hi X, code ');
});

test('renderTemplate handles dotted paths', () => {
    const out = renderTemplate('Hello {{user.name}}', { user: { name: 'Test' } });
    assert.equal(out, 'Hello Test');
});

test('extractPlaceholders dedupes across templates', () => {
    const list = extractPlaceholders('Hi {{name}}', '{{name}} - {{ref}}');
    assert.deepEqual(list.sort(), ['name', 'ref']);
});
