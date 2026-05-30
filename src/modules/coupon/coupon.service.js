import { prisma } from '../../config/db.js';
import { ApiError } from '../../utils/api-error.js';
import { emitAlert } from '../alert/alert.service.js';

const RELATIONS = {
    targetCity: { select: { id: true, name: true } },
    targetAttraction: { select: { id: true, name: true } },
    targetCategory: { select: { id: true, name: true } },
    targetTour: { select: { id: true, name: true, productId: true } },
};

function toDate(value) {
    return value ? new Date(value) : null;
}

function normalizeTargets(payload) {
    const cleaned = { ...payload };
    if (cleaned.eligibility && cleaned.eligibility !== 'CITY') cleaned.targetCityId = null;
    if (cleaned.eligibility && cleaned.eligibility !== 'ATTRACTION') cleaned.targetAttractionId = null;
    if (cleaned.eligibility && cleaned.eligibility !== 'CATEGORY') cleaned.targetCategoryId = null;
    if (cleaned.eligibility && cleaned.eligibility !== 'TOUR') cleaned.targetTourId = null;
    if (cleaned.startDate) cleaned.startDate = toDate(cleaned.startDate);
    if (cleaned.endDate) cleaned.endDate = toDate(cleaned.endDate);
    return cleaned;
}

export async function listCoupons({ search, status, eligibility, page, limit }) {
    const where = {
        ...(status ? { status } : {}),
        ...(eligibility ? { eligibility } : {}),
        ...(search
            ? {
                  OR: [
                      { name: { contains: search, mode: 'insensitive' } },
                      { code: { contains: search, mode: 'insensitive' } },
                  ],
              }
            : {}),
    };
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
        prisma.coupon.findMany({ where, include: RELATIONS, orderBy: { createdAt: 'desc' }, skip, take: limit }),
        prisma.coupon.count({ where }),
    ]);
    return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
}

export async function getCoupon(id) {
    const row = await prisma.coupon.findUnique({ where: { id }, include: RELATIONS });
    if (!row) throw ApiError.notFound('Coupon not found');
    return row;
}

// Public "available offers" — currently-valid coupons (active, in date window,
// under usage limit). Optionally filtered to those eligible for the cart's tours.
export async function listOffers({ tourIds = [] } = {}) {
    const now = new Date();
    const rows = await prisma.coupon.findMany({
        where: {
            status: 'ACTIVE',
            startDate: { lte: now },
            endDate: { gte: now },
        },
        orderBy: { discountAmount: 'desc' },
        take: 50,
    });

    let tours = [];
    if (tourIds.length) {
        tours = await prisma.tour.findMany({
            where: { id: { in: tourIds } },
            select: { id: true, cityId: true, attractionId: true, categoryId: true },
        });
    }

    const eligibleForCart = (c) => {
        if (!tourIds.length || c.eligibility === 'ALL') return true;
        return tours.some((t) => {
            if (c.eligibility === 'CITY') return c.targetCityId === t.cityId;
            if (c.eligibility === 'ATTRACTION') return c.targetAttractionId === t.attractionId;
            if (c.eligibility === 'CATEGORY') return c.targetCategoryId === t.categoryId;
            if (c.eligibility === 'TOUR') return c.targetTourId === t.id;
            return false;
        });
    };

    return rows
        .filter((c) => c.userLimit == null || c.usageCount < c.userLimit)
        .filter(eligibleForCart)
        .map((c) => ({
            code: c.code,
            name: c.name,
            description: c.description,
            discountType: c.discountType,
            discountAmount: Number(c.discountAmount),
            minOrderAmount: c.minOrderAmount != null ? Number(c.minOrderAmount) : null,
            endDate: c.endDate,
            eligibility: c.eligibility,
        }));
}

export async function createCoupon(payload) {
    const data = normalizeTargets(payload);
    const row = await prisma.coupon.create({ data, include: RELATIONS });
    emitAlert('NEW_COUPON_CREATED', { id: row.id, code: row.code, name: row.name }).catch(() => {});
    return row;
}

export async function updateCoupon(id, payload) {
    const data = normalizeTargets(payload);
    return prisma.coupon.update({ where: { id }, data, include: RELATIONS });
}

export async function deleteCoupon(id) {
    await prisma.coupon.delete({ where: { id } });
}

function eligibilityMatches(coupon, tour) {
    switch (coupon.eligibility) {
        case 'ALL':
            return true;
        case 'CITY':
            return coupon.targetCityId === tour.cityId;
        case 'ATTRACTION':
            return coupon.targetAttractionId === tour.attractionId;
        case 'CATEGORY':
            return coupon.targetCategoryId === tour.categoryId;
        case 'TOUR':
            return coupon.targetTourId === tour.id;
        default:
            return false;
    }
}

export async function applyCoupon({ code, tourId, amount }) {
    const coupon = await prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });
    if (!coupon) throw ApiError.notFound('Coupon not found', { code: 'COUPON_NOT_FOUND' });
    if (coupon.status !== 'ACTIVE') throw ApiError.badRequest('Coupon is inactive', { code: 'COUPON_INACTIVE' });

    const now = new Date();
    if (coupon.startDate && now < coupon.startDate) {
        throw ApiError.badRequest('Coupon not yet valid', { code: 'COUPON_NOT_STARTED' });
    }
    if (coupon.endDate && now > coupon.endDate) {
        throw ApiError.badRequest('Coupon has expired', { code: 'COUPON_EXPIRED' });
    }
    if (coupon.userLimit !== null && coupon.userLimit !== undefined && coupon.usageCount >= coupon.userLimit) {
        throw ApiError.badRequest('Coupon usage limit reached', { code: 'COUPON_LIMIT_REACHED' });
    }
    if (coupon.minOrderAmount && Number(amount) < Number(coupon.minOrderAmount)) {
        throw ApiError.badRequest('Order amount below minimum for this coupon', { code: 'COUPON_MIN_ORDER' });
    }

    const tour = await prisma.tour.findUnique({
        where: { id: tourId },
        select: { id: true, cityId: true, categoryId: true, attractionId: true },
    });
    if (!tour) throw ApiError.notFound('Tour not found');

    if (!eligibilityMatches(coupon, tour)) {
        throw ApiError.badRequest('Coupon not applicable to this tour', { code: 'COUPON_NOT_ELIGIBLE' });
    }

    const baseAmount = Number(amount);
    const discount =
        coupon.discountType === 'PERCENTAGE'
            ? Math.min(baseAmount, (baseAmount * Number(coupon.discountAmount)) / 100)
            : Math.min(baseAmount, Number(coupon.discountAmount));

    return {
        couponId: coupon.id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountAmount: Number(coupon.discountAmount),
        discountValue: Number(discount.toFixed(2)),
        finalAmount: Number((baseAmount - discount).toFixed(2)),
    };
}

export async function incrementUsage(couponId) {
    if (!couponId) return;
    await prisma.coupon.update({ where: { id: couponId }, data: { usageCount: { increment: 1 } } });
}
