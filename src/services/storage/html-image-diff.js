const IMG_SRC_RE = /<img\b[^>]*?\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)')/gi;

export function extractImageUrls(html) {
    if (!html || typeof html !== 'string') return [];
    const urls = new Set();
    let match;
    IMG_SRC_RE.lastIndex = 0;
    while ((match = IMG_SRC_RE.exec(html)) !== null) {
        const url = (match[1] ?? match[2] ?? '').trim();
        if (url && !url.startsWith('data:')) urls.add(url);
    }
    return Array.from(urls);
}

export function diffImageUrls(oldUrls, newUrls) {
    const oldSet = new Set((oldUrls ?? []).filter(Boolean));
    const newSet = new Set((newUrls ?? []).filter(Boolean));
    const removed = [...oldSet].filter((url) => !newSet.has(url));
    const added = [...newSet].filter((url) => !oldSet.has(url));
    return { removed, added };
}

export function collectBlogImageUrls(blog) {
    if (!blog) return [];
    const urls = new Set();
    if (blog.bannerImage) urls.add(blog.bannerImage);
    if (blog.thumbnailImage) urls.add(blog.thumbnailImage);
    if (blog.ogImage) urls.add(blog.ogImage);
    for (const url of blog.contentImages ?? []) urls.add(url);
    for (const url of extractImageUrls(blog.content)) urls.add(url);
    return Array.from(urls);
}
