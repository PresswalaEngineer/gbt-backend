import { prisma } from '../../config/db.js';
import { ApiError } from '../../utils/api-error.js';
import { logger } from '../../utils/logger.js';
import { cleanupUploads } from '../upload/upload.service.js';
import {
    collectBlogImageUrls,
    diffImageUrls,
    extractImageUrls,
} from '../../services/storage/html-image-diff.js';

const STAFF_AUDIT_SELECT = { id: true, name: true, email: true };

const BLOG_INCLUDE = {
    createdBy: { select: STAFF_AUDIT_SELECT },
    modifiedBy: { select: STAFF_AUDIT_SELECT },
};

function stripHtml(html) {
    if (!html) return '';
    return String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function calculateReadingMinutes(content) {
    const text = stripHtml(content);
    if (!text) return null;
    const words = text.split(/\s+/).filter(Boolean).length;
    if (!words) return null;
    return Math.max(1, Math.round(words / 220));
}

function resolvePublishedAt(status, providedDate, current) {
    if (status === 'PUBLISHED') {
        if (providedDate) return new Date(providedDate);
        return current ?? new Date();
    }
    if (status === 'SCHEDULED') {
        if (providedDate) return new Date(providedDate);
        return current ?? null;
    }
    return null;
}

function buildContentImageList(content, providedList) {
    const fromContent = extractImageUrls(content);
    if (!providedList || !providedList.length) return fromContent;
    const merged = new Set([...providedList, ...fromContent]);
    return Array.from(merged);
}

async function safeCleanup(urls) {
    if (!urls || urls.length === 0) return;
    try {
        await cleanupUploads({ urls });
    } catch (err) {
        logger.warn({ err, urls }, 'blog image cleanup failed');
    }
}

export async function listBlogs({ search, status, category, isFeatured, tag, page, limit }) {
    const where = {
        ...(status ? { status } : {}),
        ...(category ? { category } : {}),
        ...(typeof isFeatured === 'boolean' ? { isFeatured } : {}),
        ...(tag ? { tags: { has: tag } } : {}),
        ...(search
            ? {
                  OR: [
                      { title: { contains: search, mode: 'insensitive' } },
                      { excerpt: { contains: search, mode: 'insensitive' } },
                      { author: { contains: search, mode: 'insensitive' } },
                      { slug: { contains: search, mode: 'insensitive' } },
                  ],
              }
            : {}),
    };

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
        prisma.blog.findMany({
            where,
            orderBy: [{ createdAt: 'desc' }],
            skip,
            take: limit,
            include: BLOG_INCLUDE,
        }),
        prisma.blog.count({ where }),
    ]);

    return {
        items,
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
    };
}

export async function getBlog(id) {
    const blog = await prisma.blog.findUnique({ where: { id }, include: BLOG_INCLUDE });
    if (!blog) throw ApiError.notFound('Blog post not found');
    return blog;
}

export async function getBlogBySlug(slug) {
    const blog = await prisma.blog.findUnique({ where: { slug }, include: BLOG_INCLUDE });
    if (!blog) throw ApiError.notFound('Blog post not found');
    return blog;
}

export async function createBlog(payload, { actorId } = {}) {
    const contentImages = buildContentImageList(payload.content, payload.contentImages);
    const publishedAt = resolvePublishedAt(payload.status ?? 'DRAFT', payload.publishedAt, null);
    const readingMinutes = calculateReadingMinutes(payload.content);

    return prisma.blog.create({
        data: {
            title: payload.title,
            slug: payload.slug,
            excerpt: payload.excerpt,
            content: payload.content,
            contentImages,
            bannerImage: payload.bannerImage,
            thumbnailImage: payload.thumbnailImage,
            ogImage: payload.ogImage ?? null,
            author: payload.author,
            category: payload.category,
            tags: payload.tags ?? [],
            status: payload.status ?? 'DRAFT',
            isFeatured: payload.isFeatured ?? false,
            publishedAt,
            readingMinutes,
            seoTitle: payload.seoTitle ?? null,
            seoDescription: payload.seoDescription ?? null,
            seoKeywords: payload.seoKeywords ?? null,
            canonicalUrl: payload.canonicalUrl ?? null,
            schema: payload.schema ?? null,
            createdById: actorId ?? null,
            modifiedById: actorId ?? null,
        },
        include: BLOG_INCLUDE,
    });
}

export async function updateBlog(id, payload, { actorId } = {}) {
    const existing = await prisma.blog.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound('Blog post not found');

    const oldUrls = collectBlogImageUrls(existing);

    const data = { modifiedById: actorId ?? null };
    if (payload.title !== undefined) data.title = payload.title;
    if (payload.slug !== undefined) data.slug = payload.slug;
    if (payload.excerpt !== undefined) data.excerpt = payload.excerpt;
    if (payload.content !== undefined) {
        data.content = payload.content;
        data.contentImages = buildContentImageList(payload.content, payload.contentImages);
        data.readingMinutes = calculateReadingMinutes(payload.content);
    } else if (payload.contentImages !== undefined) {
        data.contentImages = buildContentImageList(existing.content, payload.contentImages);
    }
    if (payload.bannerImage !== undefined) data.bannerImage = payload.bannerImage;
    if (payload.thumbnailImage !== undefined) data.thumbnailImage = payload.thumbnailImage;
    if (payload.ogImage !== undefined) data.ogImage = payload.ogImage;
    if (payload.author !== undefined) data.author = payload.author;
    if (payload.category !== undefined) data.category = payload.category;
    if (payload.tags !== undefined) data.tags = payload.tags;
    if (payload.isFeatured !== undefined) data.isFeatured = payload.isFeatured;
    if (payload.seoTitle !== undefined) data.seoTitle = payload.seoTitle;
    if (payload.seoDescription !== undefined) data.seoDescription = payload.seoDescription;
    if (payload.seoKeywords !== undefined) data.seoKeywords = payload.seoKeywords;
    if (payload.canonicalUrl !== undefined) data.canonicalUrl = payload.canonicalUrl;
    if (payload.schema !== undefined) data.schema = payload.schema;
    if (payload.status !== undefined || payload.publishedAt !== undefined) {
        const nextStatus = payload.status ?? existing.status;
        data.status = nextStatus;
        data.publishedAt = resolvePublishedAt(nextStatus, payload.publishedAt, existing.publishedAt);
    }

    const updated = await prisma.blog.update({
        where: { id },
        data,
        include: BLOG_INCLUDE,
    });

    const newUrls = collectBlogImageUrls(updated);
    const { removed } = diffImageUrls(oldUrls, newUrls);
    if (removed.length) {
        await safeCleanup(removed);
    }

    return updated;
}

export async function deleteBlog(id) {
    const existing = await prisma.blog.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound('Blog post not found');

    const urls = collectBlogImageUrls(existing);
    await prisma.blog.delete({ where: { id } });
    if (urls.length) {
        await safeCleanup(urls);
    }
}
