import { prisma } from '../../config/db.js';
import { ApiError } from '../../utils/api-error.js';

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
    return prisma.category.create({ data: payload });
}

export async function updateCategory(id, payload) {
    return prisma.category.update({ where: { id }, data: payload });
}

export async function deleteCategory(id) {
    await prisma.category.delete({ where: { id } });
}
