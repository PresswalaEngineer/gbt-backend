import { prisma } from '../../config/db.js';
import { ApiError } from '../../utils/api-error.js';
import { logger } from '../../utils/logger.js';
import { cleanupUploads } from '../upload/upload.service.js';
import { MAX_BANNERS } from './banner.validation.js';

const ORDER = [{ orderIndex: 'asc' }, { id: 'asc' }];

async function safeCleanup(urls) {
    const list = (urls || []).filter(Boolean);
    if (list.length === 0) return;
    try {
        await cleanupUploads({ urls: list });
    } catch (err) {
        logger.warn({ err, urls: list }, 'banner image cleanup failed');
    }
}

export async function listBanners({ search, page, limit }) {
    const where = search ? { content: { contains: search, mode: 'insensitive' } } : {};
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
        prisma.banner.findMany({ where, orderBy: ORDER, skip, take: limit }),
        prisma.banner.count({ where }),
    ]);
    return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
}

export async function getBanner(id) {
    const banner = await prisma.banner.findUnique({ where: { id } });
    if (!banner) throw ApiError.notFound('Banner not found');
    return banner;
}

export async function createBanner({ imageUrl, content }) {
    const count = await prisma.banner.count();
    if (count >= MAX_BANNERS) {
        throw ApiError.badRequest(`Banner limit reached — a maximum of ${MAX_BANNERS} banners is allowed`, {
            code: 'BANNER_LIMIT_REACHED',
        });
    }
    const top = await prisma.banner.findFirst({
        orderBy: { orderIndex: 'desc' },
        select: { orderIndex: true },
    });
    return prisma.banner.create({
        data: {
            imageUrl,
            content,
            orderIndex: (top?.orderIndex ?? -1) + 1,
            isActive: count === 0,
        },
    });
}

export async function updateBanner(id, payload) {
    const existing = await getBanner(id);
    const banner = await prisma.banner.update({ where: { id }, data: payload });
    if (payload.imageUrl && payload.imageUrl !== existing.imageUrl) {
        await safeCleanup([existing.imageUrl]);
    }
    return banner;
}

export async function activateBanner(id) {
    await getBanner(id);
    return prisma.$transaction(async (tx) => {
        await tx.banner.updateMany({ where: { isActive: true }, data: { isActive: false } });
        return tx.banner.update({ where: { id }, data: { isActive: true } });
    });
}

export async function deactivateBanner(id) {
    await getBanner(id);
    return prisma.banner.update({ where: { id }, data: { isActive: false } });
}

export async function deleteBanner(id) {
    const existing = await getBanner(id);
    await prisma.banner.delete({ where: { id } });
    if (existing.isActive) {
        const next = await prisma.banner.findFirst({ orderBy: ORDER });
        if (next) await prisma.banner.update({ where: { id: next.id }, data: { isActive: true } });
    }
    await safeCleanup([existing.imageUrl]);
}
