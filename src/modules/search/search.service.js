import { prisma } from '../../config/db.js';

// Unified typeahead across tours, cities, countries and attractions.
// (Postgres ILIKE via Prisma `contains`/insensitive — fast enough for this
// catalogue; a dedicated search engine would be overkill here.)
export async function suggest(q, limit = 8) {
    const term = String(q || '').trim();
    if (!term) return [];
    const like = { contains: term, mode: 'insensitive' };

    const [tours, cities, countries, attractions] = await Promise.all([
        prisma.tour.findMany({
            where: { status: 'ACTIVE', name: like },
            select: {
                id: true,
                name: true,
                productSlug: true,
                thumbnail: true,
                city: { select: { name: true } },
                country: { select: { name: true } },
            },
            take: limit,
            orderBy: { bookingCount: 'desc' },
        }),
        prisma.city.findMany({
            where: { name: like },
            select: { id: true, name: true, country: { select: { name: true } } },
            take: 5,
        }),
        prisma.country.findMany({
            where: { name: like },
            select: { id: true, name: true },
            take: 5,
        }),
        prisma.attraction.findMany({
            where: { status: 'ACTIVE', name: like },
            select: { id: true, name: true, city: { select: { id: true, name: true } } },
            take: 5,
        }),
    ]);

    const items = [
        ...tours.map((t) => ({
            type: 'tour',
            id: t.id,
            name: t.name,
            slug: t.productSlug || String(t.id),
            image: t.thumbnail || null,
            subtitle: [t.city?.name, t.country?.name].filter(Boolean).join(', ') || 'Tour',
        })),
        ...cities.map((c) => ({ type: 'city', id: c.id, name: c.name, subtitle: c.country?.name || 'City' })),
        ...countries.map((c) => ({ type: 'country', id: c.id, name: c.name, subtitle: 'Country' })),
        ...attractions.map((a) => ({
            type: 'attraction',
            id: a.id,
            name: a.name,
            cityId: a.city?.id ?? null,
            subtitle: a.city?.name || 'Attraction',
        })),
    ];

    // Prefix matches first, then by type priority (tour > city > country > attraction).
    const ql = term.toLowerCase();
    const pri = { tour: 0, city: 1, country: 2, attraction: 3 };
    items.sort((a, b) => {
        const ap = a.name.toLowerCase().startsWith(ql) ? 0 : 1;
        const bp = b.name.toLowerCase().startsWith(ql) ? 0 : 1;
        if (ap !== bp) return ap - bp;
        return pri[a.type] - pri[b.type];
    });

    return items.slice(0, limit);
}
