import { prisma } from '../../config/db.js';
import { ApiError } from '../../utils/api-error.js';

const ELIGIBLE_BOOKING_STATUSES = ['CONFIRMED'];

export async function listForTour(tourId) {
    const reviews = await prisma.review.findMany({
        where: { tourId, status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        include: { customer: { select: { name: true } } },
    });
    const agg = await getTourRating(tourId);
    return {
        reviews: reviews.map((r) => ({
            id: r.id,
            rating: r.rating,
            title: r.title,
            body: r.body,
            author: r.customer?.name ?? r.author ?? 'Traveller',
            createdAt: r.createdAt,
        })),
        ...agg,
    };
}

export async function getTourRating(tourId) {
    const agg = await prisma.review.aggregate({
        where: { tourId, status: 'ACTIVE' },
        _avg: { rating: true },
        _count: { _all: true },
    });
    return {
        rating: agg._avg.rating ? Number(agg._avg.rating.toFixed(2)) : null,
        reviewCount: agg._count._all,
    };
}

export async function createReview(customerId, tourId, { rating, title, body }) {
    const tour = await prisma.tour.findUnique({ where: { id: tourId }, select: { id: true } });
    if (!tour) throw ApiError.notFound('Tour not found');

    const eligibleBooking = await prisma.booking.findFirst({
        where: { customerId, tourId, status: { in: ELIGIBLE_BOOKING_STATUSES } },
        select: { id: true },
    });
    if (!eligibleBooking) {
        throw ApiError.forbidden('You can only review tours you have booked', {
            code: 'REVIEW_NOT_ELIGIBLE',
        });
    }

    try {
        await prisma.review.create({
            data: { customerId, tourId, rating, title: title ?? null, body: body ?? null },
        });
    } catch (err) {
        if (err?.code === 'P2002') {
            throw ApiError.conflict('You have already reviewed this tour', {
                code: 'REVIEW_EXISTS',
            });
        }
        throw err;
    }
    return listForTour(tourId);
}

export async function listReviews({ search, tourId, page, limit }) {
    const where = {
        ...(tourId ? { tourId } : {}),
        ...(search
            ? {
                  OR: [
                      { author: { contains: search, mode: 'insensitive' } },
                      { title: { contains: search, mode: 'insensitive' } },
                      { body: { contains: search, mode: 'insensitive' } },
                      { tour: { name: { contains: search, mode: 'insensitive' } } },
                  ],
              }
            : {}),
    };

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
        prisma.review.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
            include: {
                tour: { select: { id: true, name: true } },
                customer: { select: { name: true } },
            },
        }),
        prisma.review.count({ where }),
    ]);

    return {
        items: items.map((r) => ({
            id: r.id,
            tourId: r.tourId,
            tourName: r.tour?.name ?? null,
            author: r.customer?.name ?? r.author ?? 'Traveller',
            rating: r.rating,
            title: r.title,
            body: r.body,
            status: r.status,
            createdAt: r.createdAt,
        })),
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
    };
}

export async function createAdminReview({ tourId, author, rating, title, body, createdAt }) {
    const tour = await prisma.tour.findUnique({ where: { id: tourId }, select: { id: true } });
    if (!tour) throw ApiError.notFound('Tour not found');

    return prisma.review.create({
        data: {
            tourId,
            customerId: null,
            author: author.trim(),
            rating,
            title: title?.trim() || null,
            body: body?.trim() || null,
            ...(createdAt ? { createdAt } : {}),
        },
    });
}

export async function deleteReview(id) {
    try {
        await prisma.review.delete({ where: { id } });
    } catch (err) {
        if (err?.code === 'P2025') throw ApiError.notFound('Review not found');
        throw err;
    }
}
