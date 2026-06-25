import { prisma } from '../../config/db.js';
import { ApiError } from '../../utils/api-error.js';
import { uniqueSlug } from '../../utils/slug.js';

async function buildCategorySlug(name, excludeId) {
    return uniqueSlug(name, async (slug) => {
        const existing = await prisma.category.findFirst({
            where: { slug },
            select: { id: true },
        });
        return !!existing && existing.id !== excludeId;
    });
}

export async function listCategories({ search, status, page, limit }) {
    const where = {
        ...(status ? { status } : {}),
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    };

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
        prisma.category.findMany({
            where,
            orderBy: { name: 'asc' },
            skip,
            take: limit,
            include: { _count: { select: { attractions: true } } },
        }),
        prisma.category.count({ where }),
    ]);

    return {
        items: items.map(({ _count, ...rest }) => ({ ...rest, attractionsCount: _count.attractions })),
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
    };
}

export async function getCategory(id) {
    const category = await prisma.category.findUnique({
        where: { id },
        include: { _count: { select: { attractions: true } } },
    });
    if (!category) throw ApiError.notFound('Category not found');
    const { _count, ...rest } = category;
    return { ...rest, attractionsCount: _count.attractions };
}

export async function createCategory(payload) {
    const slug = await buildCategorySlug(payload.slug || payload.name);
    return prisma.category.create({ data: { ...payload, slug } });
}

export async function updateCategory(id, payload) {
    const data = { ...payload };
    if (payload.slug) {
        data.slug = await buildCategorySlug(payload.slug, id);
    } else if (payload.name) {
        const current = await prisma.category.findUnique({
            where: { id },
            select: { slug: true },
        });
        if (!current?.slug) data.slug = await buildCategorySlug(payload.name, id);
    }
    return prisma.category.update({ where: { id }, data });
}

export async function deleteCategory(id) {
    await prisma.category.delete({ where: { id } });
}
