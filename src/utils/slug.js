// URL-safe slug helpers for entities that get public landing pages (cities,
// attractions). Slugs are auto-derived from the name and made unique against a
// supplied "exists" probe so they can power /destinations/:slug etc.

export function slugify(input) {
    return String(input || '')
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '') // strip diacritics
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'item';
}

// base: starting slug; exists: async (slug) => boolean (true if already taken).
// Appends -2, -3, … until free.
export async function uniqueSlug(base, exists) {
    const root = slugify(base);
    let candidate = root;
    let n = 1;
    // eslint-disable-next-line no-await-in-loop
    while (await exists(candidate)) {
        n += 1;
        candidate = `${root}-${n}`;
    }
    return candidate;
}
