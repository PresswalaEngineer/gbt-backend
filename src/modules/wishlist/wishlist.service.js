import { prisma } from '../../config/db.js';
import { ApiError } from '../../utils/api-error.js';
import { toPublicTour } from '../tour/tour.public.js';

const TOUR_SELECT = {
    id: true,
    name: true,
    productSlug: true,
    thumbnail: true,
    images: true,
    duration: true,
    currency: true,
    bookingCount: true,
    status: true,
    city: { select: { id: true, name: true } },
    country: { select: { id: true, name: true, currency: true } },
    category: { select: { id: true, name: true } },
    priceTiers: { select: { id: true, tier: true, grossPrice: true, originalPrice: true } },
};

export async function listWishlist(customerId) {
    const rows = await prisma.wishlist.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' },
        include: { tour: { select: TOUR_SELECT } },
    });
    return rows
        .filter((r) => r.tour && r.tour.status === 'ACTIVE')
        .map((r) => ({ id: r.id, createdAt: r.createdAt, tour: toPublicTour(r.tour) }));
}

export async function addWishlist(customerId, tourId) {
    const tour = await prisma.tour.findUnique({ where: { id: tourId }, select: { id: true } });
    if (!tour) throw ApiError.notFound('Tour not found');
    await prisma.wishlist.upsert({
        where: { customerId_tourId: { customerId, tourId } },
        update: {},
        create: { customerId, tourId },
    });
    return listWishlist(customerId);
}

export async function removeWishlist(customerId, tourId) {
    await prisma.wishlist
        .delete({ where: { customerId_tourId: { customerId, tourId } } })
        .catch(() => null);
    return listWishlist(customerId);
}
