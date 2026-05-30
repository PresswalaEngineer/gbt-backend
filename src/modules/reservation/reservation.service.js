import { prisma } from '../../config/db.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/api-error.js';
import { logger } from '../../utils/logger.js';
import { priceFor } from '../booking/booking.pricing.js';
import { createBooking } from '../booking/booking.service.js';
import { checkVendorDate } from '../tour/tour.service.js';
import { emitToOwner, emitAvailabilityChanged, EVENTS, serverNow } from '../../realtime/index.js';

const HOLD_MS = () => env.CART_HOLD_MINUTES * 60 * 1000;

const TOUR_HOLD_SELECT = {
    id: true,
    name: true,
    thumbnail: true,
    images: true,
    productSlug: true,
    currency: true,
    apiType: true,
    apiId: true,
    status: true,
    minPax: true,
    maxPax: true,
    dailyCapacity: true,
    bookingCutoffHours: true,
    unavailableDates: true,
    startTime: true,
    tourType: true,
    priceTiers: { orderBy: { id: 'asc' } },
    options: { select: { id: true, name: true, externalId: true } },
    supplier: { select: { apiChannelId: true, apiKey: true } },
};

// --- helpers ---------------------------------------------------------------

function dayBounds(dateStr) {
    const start = new Date(`${dateStr}T00:00:00.000Z`);
    const end = new Date(start.getTime() + 86400000);
    return { start, end };
}

function dateKey(dateStr) {
    return Number(String(dateStr).replace(/-/g, '')); // 'YYYY-MM-DD' → 20260601 (fits int4)
}

function isoDate(d) {
    return d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
}

// Effective capacity for a (tour, date): an explicit admin per-date override wins,
// else the tour's default dailyCapacity, else null (= unlimited).
async function effectiveCapacity(client, tourId, dateStr, tourDailyCapacity) {
    const { start } = dayBounds(dateStr);
    const override = await client.tourDateCapacity.findUnique({
        where: { tourId_date: { tourId, date: start } },
    });
    if (override) return override.capacity;
    return tourDailyCapacity ?? null;
}

// remaining = capacity − bookedPax(PENDING|CONFIRMED) − heldPax(HELD). null = unlimited.
async function computeRemaining(client, tourId, dateStr, capacity) {
    if (capacity == null) return null;
    const { start, end } = dayBounds(dateStr);
    const [held, booked] = await Promise.all([
        client.reservation.aggregate({
            _sum: { heldSeats: true },
            where: { tourId, status: 'HELD', travelDate: { gte: start, lt: end } },
        }),
        client.booking.aggregate({
            _sum: { paxCount: true },
            where: { tourId, status: { in: ['PENDING', 'CONFIRMED'] }, travelDate: { gte: start, lt: end } },
        }),
    ]);
    return capacity - (held._sum.heldSeats ?? 0) - (booked._sum.paxCount ?? 0);
}

function toCartItem(r, tour) {
    return {
        reservationId: r.id,
        tourId: r.tourId,
        tourOptionId: r.tourOptionId ?? null,
        title: tour?.name ?? null,
        subtitle: r.unitLabel ?? null,
        slug: tour?.productSlug ?? null,
        image: tour?.thumbnail ?? tour?.images?.[0] ?? null,
        travelDate: isoDate(r.travelDate),
        startTime: r.startTime ?? null,
        paxCount: r.paxCount,
        paxBreakdown: r.paxBreakdown,
        lineTotal: Number(r.lineTotal),
        currency: r.currency,
        source: r.apiType,
        expiresAt: new Date(r.expiresAt).getTime(),
    };
}

async function snapshot(owner) {
    const rows = await prisma.reservation.findMany({
        where: { ownerType: owner.ownerType, ownerId: owner.ownerId, status: 'HELD' },
        orderBy: { createdAt: 'asc' },
        include: { tour: { select: TOUR_HOLD_SELECT } },
    });
    const items = rows.map((r) => toCartItem(r, r.tour));
    const holdExpiresAt = items.length ? Math.min(...items.map((i) => i.expiresAt)) : null;
    return { items, itemCount: items.length, holdExpiresAt, serverNow: serverNow() };
}

function emitCartSynced(owner, snap) {
    emitToOwner(owner, EVENTS.CART_SYNCED, { items: snap.items, holdExpiresAt: snap.holdExpiresAt });
}

// Re-broadcast remaining seats for a (tour, date) to everyone viewing it.
async function broadcastAvailability(tourId, dateStr, dailyCapacity) {
    try {
        const cap = await effectiveCapacity(prisma, tourId, dateStr, dailyCapacity);
        const remaining = await computeRemaining(prisma, tourId, dateStr, cap);
        emitAvailabilityChanged(tourId, dateStr, remaining);
    } catch (err) {
        logger.warn({ err: err?.message, tourId, dateStr }, 'availability broadcast failed (non-blocking)');
    }
}

function priceTour(tour, paxBreakdown) {
    const pricing = priceFor(tour, paxBreakdown);
    if (!pricing.currency) {
        throw ApiError.badRequest('Tour currency is not configured', { code: 'TOUR_CURRENCY_MISSING' });
    }
    return pricing;
}

// Guards that mirror getAvailability so a hold can never reserve an unbookable date.
function assertBookableDate(tour, dateStr) {
    if (tour.status !== 'ACTIVE') {
        throw ApiError.badRequest('This experience is not currently bookable.', { code: 'TOUR_INACTIVE' });
    }
    const cutoff = Number(tour.bookingCutoffHours) || 0;
    const earliest = new Date(Date.now() + cutoff * 3600 * 1000).toISOString().slice(0, 10);
    if (dateStr < earliest) {
        throw ApiError.badRequest(
            cutoff > 0
                ? `Bookings need at least ${cutoff}h notice — this date is no longer available.`
                : 'This date is not available.',
            { code: 'DATE_NOT_BOOKABLE' }
        );
    }
    if ((tour.unavailableDates ?? []).includes(dateStr)) {
        throw ApiError.conflict('This date is fully booked — please choose another date.', {
            code: 'DATE_UNAVAILABLE',
        });
    }
}

// --- public API ------------------------------------------------------------

export async function getCart(owner) {
    return snapshot(owner);
}

export async function addItem(owner, payload) {
    const tour = await prisma.tour.findUnique({ where: { id: payload.tourId }, select: TOUR_HOLD_SELECT });
    if (!tour) throw ApiError.notFound('Tour not found');

    const dateStr = isoDate(payload.travelDate);
    assertBookableDate(tour, dateStr);

    const pricing = priceTour(tour, payload.paxBreakdown);
    const requestedPax = pricing.totalPax;
    const { start } = dayBounds(dateStr);

    let unitLabel = null;
    if (payload.tourOptionId) {
        unitLabel = tour.options?.find((o) => o.id === payload.tourOptionId)?.name ?? null;
    }
    unitLabel = unitLabel ?? payload.unitLabel ?? null;

    const data = {
        ownerType: owner.ownerType,
        ownerId: owner.ownerId,
        tourId: tour.id,
        tourOptionId: payload.tourOptionId ?? null,
        travelDate: start,
        startTime: payload.startTime ?? tour.startTime ?? null,
        paxBreakdown: payload.paxBreakdown,
        paxCount: requestedPax,
        heldSeats: requestedPax,
        currency: pricing.currency,
        unitLabel,
        lineTotal: pricing.gross,
        apiType: tour.apiType,
        status: 'HELD',
        expiresAt: new Date(Date.now() + HOLD_MS()),
    };

    let reservation;
    if (tour.apiType === 'NONE') {
        const capacity = await effectiveCapacity(prisma, tour.id, dateStr, tour.dailyCapacity);
        if (capacity == null) {
            // uncapped → no lock needed
            reservation = await prisma.reservation.create({ data });
        } else {
            reservation = await prisma.$transaction(async (tx) => {
                // Serialize all racers for this (tour, date) via a transaction-scoped advisory lock.
                await tx.$executeRaw`SELECT pg_advisory_xact_lock(${tour.id}::int, ${dateKey(dateStr)}::int)`;
                const remaining = await computeRemaining(tx, tour.id, dateStr, capacity);
                if (remaining < requestedPax) {
                    throw ApiError.conflict('Not enough seats left for this date.', {
                        code: 'INSUFFICIENT_SEATS',
                        details: { remaining: Math.max(0, remaining), requested: requestedPax },
                    });
                }
                return tx.reservation.create({ data });
            });
        }
    } else {
        // Vendor tour: defer to the operator's live availability; no local seat count.
        const vendor = await checkVendorDate(tour, dateStr, requestedPax);
        if (vendor === false) {
            throw ApiError.conflict('The operator has no availability for this date.', {
                code: 'DATE_UNAVAILABLE',
            });
        }
        reservation = await prisma.reservation.create({ data });
    }

    const item = toCartItem(reservation, tour);
    emitToOwner(owner, EVENTS.HOLD_CREATED, item);
    if (tour.apiType === 'NONE') broadcastAvailability(tour.id, dateStr, tour.dailyCapacity);
    return { item, ...(await snapshot(owner)) };
}

export async function updateItem(owner, id, payload) {
    const existing = await prisma.reservation.findFirst({
        where: { id, ownerType: owner.ownerType, ownerId: owner.ownerId, status: 'HELD' },
    });
    if (!existing) throw ApiError.notFound('Cart item not found');

    const tour = await prisma.tour.findUnique({ where: { id: existing.tourId }, select: TOUR_HOLD_SELECT });
    if (!tour) throw ApiError.notFound('Tour not found');

    const dateStr = isoDate(existing.travelDate);
    const pricing = priceTour(tour, payload.paxBreakdown);
    const newPax = pricing.totalPax;
    const delta = newPax - existing.heldSeats;

    const newData = {
        paxBreakdown: payload.paxBreakdown,
        paxCount: newPax,
        heldSeats: newPax,
        lineTotal: pricing.gross,
        currency: pricing.currency,
        expiresAt: new Date(Date.now() + HOLD_MS()), // editing restarts the hold
    };

    let updated;
    if (tour.apiType === 'NONE' && delta > 0) {
        const capacity = await effectiveCapacity(prisma, tour.id, dateStr, tour.dailyCapacity);
        if (capacity == null) {
            updated = await prisma.reservation.update({ where: { id }, data: newData });
        } else {
            updated = await prisma.$transaction(async (tx) => {
                await tx.$executeRaw`SELECT pg_advisory_xact_lock(${tour.id}::int, ${dateKey(dateStr)}::int)`;
                const remaining = await computeRemaining(tx, tour.id, dateStr, capacity);
                // `remaining` already excludes this row's current heldSeats? No — it includes it.
                // We need room for the *delta* on top of what's already counted.
                if (remaining < delta) {
                    throw ApiError.conflict('Not enough seats left to increase this booking.', {
                        code: 'INSUFFICIENT_SEATS',
                        details: { remaining: Math.max(0, remaining), requested: delta },
                    });
                }
                return tx.reservation.update({ where: { id }, data: newData });
            });
        }
    } else if (tour.apiType !== 'NONE' && delta > 0) {
        const vendor = await checkVendorDate(tour, dateStr, newPax);
        if (vendor === false) {
            throw ApiError.conflict('The operator has no availability for this date.', { code: 'DATE_UNAVAILABLE' });
        }
        updated = await prisma.reservation.update({ where: { id }, data: newData });
    } else {
        updated = await prisma.reservation.update({ where: { id }, data: newData });
    }

    const item = toCartItem(updated, tour);
    emitToOwner(owner, EVENTS.HOLD_UPDATED, item);
    if (tour.apiType === 'NONE') broadcastAvailability(tour.id, dateStr, tour.dailyCapacity);
    return { item, ...(await snapshot(owner)) };
}

export async function removeItem(owner, id) {
    const existing = await prisma.reservation.findFirst({
        where: { id, ownerType: owner.ownerType, ownerId: owner.ownerId, status: 'HELD' },
        select: { id: true, tourId: true, travelDate: true, apiType: true },
    });
    if (!existing) throw ApiError.notFound('Cart item not found');

    await prisma.reservation.update({ where: { id }, data: { status: 'RELEASED' } });
    emitToOwner(owner, EVENTS.HOLD_EXPIRED, { reservationId: id, reason: 'RELEASED' });

    if (existing.apiType === 'NONE') {
        const tour = await prisma.tour.findUnique({ where: { id: existing.tourId }, select: { dailyCapacity: true } });
        broadcastAvailability(existing.tourId, isoDate(existing.travelDate), tour?.dailyCapacity ?? null);
    }
    const snap = await snapshot(owner);
    emitCartSynced(owner, snap);
    return snap;
}

export async function clearCart(owner) {
    const held = await prisma.reservation.findMany({
        where: { ownerType: owner.ownerType, ownerId: owner.ownerId, status: 'HELD' },
        select: { tourId: true, travelDate: true, apiType: true },
    });
    await prisma.reservation.updateMany({
        where: { ownerType: owner.ownerType, ownerId: owner.ownerId, status: 'HELD' },
        data: { status: 'RELEASED' },
    });

    // Refresh availability for each distinct internal (tour, date) that was freed.
    const seen = new Set();
    for (const r of held) {
        if (r.apiType !== 'NONE') continue;
        const dateStr = isoDate(r.travelDate);
        const key = `${r.tourId}:${dateStr}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const tour = await prisma.tour.findUnique({ where: { id: r.tourId }, select: { dailyCapacity: true } });
        broadcastAvailability(r.tourId, dateStr, tour?.dailyCapacity ?? null);
    }
    const snap = await snapshot(owner);
    emitCartSynced(owner, snap);
    return snap;
}

// Re-key a guest's active holds onto the customer account after login. The hold
// timer is preserved (expiresAt untouched) so login never resets the countdown.
export async function migrateGuestCart(customerId, guestId) {
    if (!guestId) return snapshot({ ownerType: 'CUSTOMER', ownerId: String(customerId) });
    const customerOwner = { ownerType: 'CUSTOMER', ownerId: String(customerId) };

    await prisma.reservation.updateMany({
        where: { ownerType: 'GUEST', ownerId: guestId, status: 'HELD' },
        data: { ownerType: 'CUSTOMER', ownerId: String(customerId) },
    });

    const snap = await snapshot(customerOwner);
    emitCartSynced(customerOwner, snap);
    return snap;
}

// Convert active holds → Booking rows. Each item reuses the existing createBooking
// path (pricing, coupon, FX, vendor-on-confirm seam). Flipping the reservation to
// CHECKED_OUT hands the seat off to the PENDING booking — net seat count unchanged.
export async function checkout(owner, payload) {
    if (owner.ownerType !== 'CUSTOMER') {
        throw ApiError.unauthorized('Sign in to complete checkout', { code: 'CUSTOMER_REQUIRED' });
    }
    const customerId = Number(owner.ownerId);
    const held = await prisma.reservation.findMany({
        where: { ownerType: 'CUSTOMER', ownerId: owner.ownerId, status: 'HELD' },
        orderBy: { createdAt: 'asc' },
    });
    if (!held.length) throw ApiError.badRequest('Your cart is empty', { code: 'CART_EMPTY' });

    // Revalidate every hold before turning it into a booking: the reservation
    // must still be live, the date still bookable, and (for vendor tours) the
    // operator must still have availability. Prevents paying for a dead hold.
    const now = new Date();
    for (const r of held) {
        if (r.expiresAt && r.expiresAt < now) {
            throw ApiError.conflict('A reservation in your cart has expired — please reserve again.', {
                code: 'RESERVATION_EXPIRED',
            });
        }
        const tour = await prisma.tour.findUnique({ where: { id: r.tourId }, select: TOUR_HOLD_SELECT });
        if (!tour) throw ApiError.notFound('Tour not found');
        const dateStr = isoDate(r.travelDate);
        assertBookableDate(tour, dateStr); // status / cutoff / blackout
        if (tour.apiType !== 'NONE') {
            const vendor = await checkVendorDate(tour, dateStr, r.paxCount);
            if (vendor === false) {
                throw ApiError.conflict('The operator no longer has availability for one of your dates.', {
                    code: 'INVENTORY_UNAVAILABLE',
                });
            }
        }
    }

    const bookings = [];
    for (const r of held) {
        const base = {
            tourId: r.tourId,
            tourOptionId: r.tourOptionId ?? undefined,
            customerId,
            paxBreakdown: r.paxBreakdown,
            travelDate: isoDate(r.travelDate),
            startTime: r.startTime ?? undefined,
            leadGuestName: payload.leadGuestName,
            leadGuestEmail: payload.leadGuestEmail,
            leadGuestPhone: payload.leadGuestPhone ?? undefined,
        };
        let booking;
        try {
            booking = await createBooking(
                { ...base, couponCode: payload.couponCode ?? undefined },
                { actorId: null }
            );
        } catch (err) {
            // A cart-level coupon may not be eligible for every tour — don't fail
            // the whole checkout; just create that booking without the discount.
            if (payload.couponCode && String(err?.code || '').startsWith('COUPON_')) {
                booking = await createBooking(base, { actorId: null });
            } else {
                throw err;
            }
        }
        await prisma.reservation.update({
            where: { id: r.id },
            data: { status: 'CHECKED_OUT', bookingId: booking.id },
        });
        bookings.push(booking);
    }

    const snap = await snapshot(owner);
    emitCartSynced(owner, snap);
    return { bookings, cart: snap };
}

// Scheduler entry: release lapsed holds. Returns the freed rows so the caller can
// push hold:expired (per owner) + availability:changed (per tour+date).
export async function expireHolds() {
    const now = new Date();
    const rows = await prisma.reservation.findMany({
        where: { status: 'HELD', expiresAt: { lt: now } },
        select: { id: true, ownerType: true, ownerId: true, tourId: true, travelDate: true, apiType: true },
        take: 200,
    });
    if (!rows.length) return [];
    await prisma.reservation.updateMany({
        where: { id: { in: rows.map((r) => r.id) } },
        data: { status: 'EXPIRED' },
    });
    return rows;
}
