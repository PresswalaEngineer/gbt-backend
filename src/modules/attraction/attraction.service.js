import { prisma } from '../../config/db.js';
import { ApiError } from '../../utils/api-error.js';

const RELATIONS = {
    city: { select: { id: true, name: true, countryId: true, country: { select: { id: true, name: true, code: true } } } },
    category: { select: { id: true, name: true } },
};

export async function listAttractions({ search, cityId, categoryId, status, page, limit }) {
    const where = {
        ...(status ? { status } : {}),
        ...(cityId ? { cityId } : {}),
        ...(categoryId ? { categoryId } : {}),
        ...(search
            ? {
                  OR: [
                      { name: { contains: search, mode: 'insensitive' } },
                      { city: { name: { contains: search, mode: 'insensitive' } } },
                      { category: { name: { contains: search, mode: 'insensitive' } } },
                  ],
              }
            : {}),
    };

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
        prisma.attraction.findMany({
            where,
            include: RELATIONS,
            orderBy: { name: 'asc' },
            skip,
            take: limit,
        }),
        prisma.attraction.count({ where }),
    ]);

    return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
}

export async function getAttraction(id) {
    const attraction = await prisma.attraction.findUnique({
        where: { id },
        include: RELATIONS,
    });
    if (!attraction) throw ApiError.notFound('Attraction not found');
    return attraction;
}

async function ensureCity(cityId) {
    if (cityId === undefined) return;
    const city = await prisma.city.findUnique({ where: { id: cityId } });
    if (!city) throw ApiError.badRequest('City does not exist');
}

async function ensureCategory(categoryId) {
    if (categoryId === undefined || categoryId === null) return;
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) throw ApiError.badRequest('Category does not exist');
}

export async function createAttraction(payload) {
    await ensureCity(payload.cityId);
    await ensureCategory(payload.categoryId ?? null);
    return prisma.attraction.create({ data: payload, include: RELATIONS });
}

export async function updateAttraction(id, payload) {
    if (payload.cityId !== undefined) await ensureCity(payload.cityId);
    if (payload.categoryId !== undefined) await ensureCategory(payload.categoryId);
    return prisma.attraction.update({ where: { id }, data: payload, include: RELATIONS });
}

export async function deleteAttraction(id) {
    await prisma.attraction.delete({ where: { id } });
}
