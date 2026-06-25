import { prisma } from '../../config/db.js';
import { ApiError } from '../../utils/api-error.js';
import { uniqueSlug } from '../../utils/slug.js';

async function buildCountrySlug(name, excludeId) {
    return uniqueSlug(name, async (slug) => {
        const existing = await prisma.country.findFirst({
            where: { slug },
            select: { id: true },
        });
        return !!existing && existing.id !== excludeId;
    });
}

export async function listCountries({ search, status, page, limit }) {
    const where = {
        ...(status ? { status } : {}),
        ...(search
            ? {
                  OR: [
                      { name: { contains: search, mode: 'insensitive' } },
                      { code: { contains: search, mode: 'insensitive' } },
                      { currency: { contains: search, mode: 'insensitive' } },
                  ],
              }
            : {}),
    };

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
        prisma.country.findMany({
            where,
            orderBy: { name: 'asc' },
            skip,
            take: limit,
            include: { _count: { select: { cities: true } } },
        }),
        prisma.country.count({ where }),
    ]);

    return {
        items: items.map(({ _count, ...rest }) => ({ ...rest, citiesCount: _count.cities })),
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
    };
}

export async function getCountry(id) {
    const country = await prisma.country.findUnique({
        where: { id },
        include: { _count: { select: { cities: true } } },
    });
    if (!country) throw ApiError.notFound('Country not found');
    const { _count, ...rest } = country;
    return { ...rest, citiesCount: _count.cities };
}

export async function getCountryBySlug(slug) {
    const country = await prisma.country.findUnique({
        where: { slug },
        include: { _count: { select: { cities: true } } },
    });
    if (!country) throw ApiError.notFound('Country not found');
    const { _count, ...rest } = country;
    return { ...rest, citiesCount: _count.cities };
}

export async function createCountry(payload) {
    const slug = await buildCountrySlug(payload.slug || payload.name);
    return prisma.country.create({ data: { ...payload, slug } });
}

export async function updateCountry(id, payload) {
    const data = { ...payload };
    if (payload.slug) {
        data.slug = await buildCountrySlug(payload.slug, id);
    } else if (payload.name) {
        const current = await prisma.country.findUnique({
            where: { id },
            select: { slug: true },
        });
        if (!current?.slug) data.slug = await buildCountrySlug(payload.name, id);
    }
    return prisma.country.update({ where: { id }, data });
}

export async function deleteCountry(id) {
    await prisma.country.delete({ where: { id } });
}
