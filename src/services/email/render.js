function get(obj, path) {
    if (!path) return undefined;
    return path.split('.').reduce((acc, key) => (acc !== undefined && acc !== null ? acc[key] : undefined), obj);
}

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

export function renderTemplate(template, payload = {}) {
    if (typeof template !== 'string') return '';
    return template.replace(PLACEHOLDER_RE, (_, key) => {
        const value = get(payload, key);
        if (value === undefined || value === null) return '';
        return String(value);
    });
}

export function extractPlaceholders(...templates) {
    const seen = new Set();
    for (const tpl of templates) {
        if (typeof tpl !== 'string') continue;
        let match;
        const re = new RegExp(PLACEHOLDER_RE.source, 'g');
        while ((match = re.exec(tpl)) !== null) {
            seen.add(match[1]);
        }
    }
    return [...seen];
}
