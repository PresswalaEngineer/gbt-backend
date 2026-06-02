import { prisma } from '../../config/db.js';
import { ApiError } from '../../utils/api-error.js';
import { uniqueSlug } from '../../utils/slug.js';

const RELATIONS = {
    city: { select: { id: true, name: true, slug: true, countryId: true, country: { select: { id: true, name: true, code: true } } } },
    category: { select: { id: true, name: true } },
};

async function buildAttractionSlug(name, excludeId) {
    return uniqueSlug(name, async (slug) => {
        const existing = await prisma.attraction.findUnique({ where: { slug }, select: { id: true } });
        return !!existing && existing.id !== excludeId;
    });
}

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

export async function getAttractionBySlug(slug) {
    const attraction = await prisma.attraction.findUnique({ where: { slug }, include: RELATIONS });
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
    const slug = await buildAttractionSlug(payload.slug || payload.name);
    return prisma.attraction.create({ data: { ...payload, slug }, include: RELATIONS });
}

export async function updateAttraction(id, payload) {
    if (payload.cityId !== undefined) await ensureCity(payload.cityId);
    if (payload.categoryId !== undefined) await ensureCategory(payload.categoryId);
    const data = { ...payload };
    if (payload.slug) {
        data.slug = await buildAttractionSlug(payload.slug, id);
    } else if (payload.name) {
        const current = await prisma.attraction.findUnique({ where: { id }, select: { slug: true } });
        if (!current?.slug) data.slug = await buildAttractionSlug(payload.name, id);
    }
    return prisma.attraction.update({ where: { id }, data, include: RELATIONS });
}

export async function deleteAttraction(id) {
    await prisma.attraction.delete({ where: { id } });
}
