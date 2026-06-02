import { prisma } from '../../config/db.js';
import { ApiError } from '../../utils/api-error.js';
import { uniqueSlug } from '../../utils/slug.js';

const COUNTRY_SELECT = {
    country: { select: { id: true, name: true, code: true, currency: true } },
};

async function buildCitySlug(name, excludeId) {
    return uniqueSlug(name, async (slug) => {
        const existing = await prisma.city.findUnique({ where: { slug }, select: { id: true } });
        return !!existing && existing.id !== excludeId;
    });
}

export async function listCities({ search, countryId, status, page, limit }) {
    const where = {
        ...(status ? { status } : {}),
        ...(countryId ? { countryId } : {}),
        ...(search
            ? {
                  OR: [
                      { name: { contains: search, mode: 'insensitive' } },
                      { country: { name: { contains: search, mode: 'insensitive' } } },
                  ],
              }
            : {}),
    };

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
        prisma.city.findMany({
            where,
            include: COUNTRY_SELECT,
            orderBy: { name: 'asc' },
            skip,
            take: limit,
        }),
        prisma.city.count({ where }),
    ]);

    return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
}

export async function getCity(id) {
    const city = await prisma.city.findUnique({ where: { id }, include: COUNTRY_SELECT });
    if (!city) throw ApiError.notFound('City not found');
    return city;
}

export async function getCityBySlug(slug) {
    const city = await prisma.city.findUnique({ where: { slug }, include: COUNTRY_SELECT });
    if (!city) throw ApiError.notFound('City not found');
    return city;
}

async function ensureCountryExists(countryId) {
    if (countryId === undefined) return;
    const country = await prisma.country.findUnique({ where: { id: countryId } });
    if (!country) throw ApiError.badRequest('Country does not exist');
}

export async function createCity(payload) {
    await ensureCountryExists(payload.countryId);
    const slug = await buildCitySlug(payload.slug || payload.name);
    return prisma.city.create({ data: { ...payload, slug }, include: COUNTRY_SELECT });
}

export async function updateCity(id, payload) {
    if (payload.countryId !== undefined) await ensureCountryExists(payload.countryId);
    const data = { ...payload };
    // Re-slug when an explicit slug is sent, or when the name changes and no
    // slug currently exists. Keep existing slugs stable otherwise (SEO).
    if (payload.slug) {
        data.slug = await buildCitySlug(payload.slug, id);
    } else if (payload.name) {
        const current = await prisma.city.findUnique({ where: { id }, select: { slug: true } });
        if (!current?.slug) data.slug = await buildCitySlug(payload.name, id);
    }
    return prisma.city.update({ where: { id }, data, include: COUNTRY_SELECT });
}

export async function deleteCity(id) {
    await prisma.city.delete({ where: { id } });
}
