import { prisma } from '../../config/db.js';
import { ApiError } from '../../utils/api-error.js';
import { ensureTiersMatchTourType } from './tour.tier-rules.js';
import { decrypt } from '../../utils/crypto.js';
import { logger } from '../../utils/logger.js';
import { tourcmsClient, extractComponentKey } from '../../services/integrations/tourcms/client.js';
import { ventrataClient } from '../../services/integrations/ventrata/client.js';

// Live single-date availability from the tour's vendor (TourCMS / Ventrata).
// Returns true (available), false (no availability), or null (unknown → caller stays optimistic).
export async function checkVendorDate(tour, date, pax) {
    try {
        if (tour.apiType === 'TOURCMS') {
            const channelId = tour.supplier?.apiChannelId ? Number(tour.supplier.apiChannelId) : undefined;
            const avail = await tourcmsClient.checkAvailability({
                channelId,
                tourId: tour.apiId,
                date,
                rateQs: `r1=${pax || 1}`,
            });
            return extractComponentKey(avail) ? true : false;
        }
        if (tour.apiType === 'VENTRATA') {
            let apiKey;
            if (tour.supplier?.apiKey) {
                try { apiKey = decrypt(tour.supplier.apiKey); } catch { apiKey = undefined; }
            }
            const product = await ventrataClient.getProduct({ apiKey, productId: tour.apiId });
            const option = (product?.options || []).find((o) => o.default) || product?.options?.[0];
            if (!option) return null;
            const slots = await ventrataClient.checkAvailability({
                apiKey,
                payload: { productId: tour.apiId, optionId: option.id, localDateStart: date, localDateEnd: date },
            });
            const arr = Array.isArray(slots) ? slots : [];
            return arr.some((s) => s.available || s.status === 'AVAILABLE');
        }
    } catch (err) {
        logger.warn({ err: err?.message, tourId: tour.id, apiType: tour.apiType }, 'vendor availability check failed — staying optimistic');
        return null;
    }
    return null;
}

const RELATIONS = {
    country: { select: { id: true, name: true, code: true, currency: true } },
    city: { select: { id: true, name: true, countryId: true } },
    category: { select: { id: true, name: true } },
    attraction: { select: { id: true, name: true, cityId: true } },
    supplier: { select: { id: true, name: true, currency: true, paymentMode: true } },
    options: { orderBy: { id: 'asc' } },
    priceTiers: { orderBy: { id: 'asc' } },
    createdBy: { select: { id: true, name: true, email: true } },
    modifiedBy: { select: { id: true, name: true, email: true } },
};

async function ensureExists(model, id, label) {
    if (id === undefined || id === null) return;
    const exists = await prisma[model].findUnique({ where: { id } });
    if (!exists) throw ApiError.badRequest(`${label} does not exist`);
}

async function ensureCityBelongsToCountry(cityId, countryId) {
    if (!cityId || !countryId) return;
    const city = await prisma.city.findUnique({ where: { id: cityId } });
    if (!city) throw ApiError.badRequest('City does not exist');
    if (city.countryId !== countryId) {
        throw ApiError.badRequest('City does not belong to the selected country');
    }
}

function splitChildrenFromPayload(payload) {
    const { options, priceTiers, ...rest } = payload;
    return { tourFields: rest, options, priceTiers };
}

function sortMap(sortBy, sortOrder) {
    switch (sortBy) {
        case 'bookingCount':
            return [{ bookingCount: sortOrder ?? 'desc' }, { createdAt: 'desc' }];
        case 'name':
            return { name: sortOrder ?? 'asc' };
        case 'createdAt':
        default:
            return { createdAt: sortOrder ?? 'desc' };
    }
}

// Lowest gross price across a tour's tiers (price lives on the 1:N priceTiers).
function minGrossPrice(tour) {
    const prices = (tour.priceTiers ?? [])
        .map((t) => Number(t.grossPrice))
        .filter((n) => Number.isFinite(n) && n > 0);
    return prices.length ? Math.min(...prices) : null;
}

export async function listTours({ search, cityId, countryId, categoryId, attractionId, tourType, apiType, status, minPrice, maxPrice, sortBy, sortOrder, page, limit }) {
    const hasPriceFilter = minPrice != null || maxPrice != null;
    const where = {
        ...(status ? { status } : {}),
        ...(tourType ? { tourType } : {}),
        ...(apiType ? { apiType } : {}),
        ...(cityId ? { cityId } : {}),
        ...(countryId ? { countryId } : {}),
        ...(categoryId ? { categoryId } : {}),
        ...(attractionId ? { attractionId } : {}),
        ...(hasPriceFilter
            ? {
                  priceTiers: {
                      some: {
                          grossPrice: {
                              ...(minPrice != null ? { gte: minPrice } : {}),
                              ...(maxPrice != null ? { lte: maxPrice } : {}),
                          },
                      },
                  },
              }
            : {}),
        ...(search
            ? {
                  OR: [
                      { name: { contains: search, mode: 'insensitive' } },
                      { productId: { contains: search, mode: 'insensitive' } },
                      { productCode: { contains: search, mode: 'insensitive' } },
                      { city: { name: { contains: search, mode: 'insensitive' } } },
                      { country: { name: { contains: search, mode: 'insensitive' } } },
                      { category: { name: { contains: search, mode: 'insensitive' } } },
                  ],
              }
            : {}),
    };

    // Price sort lives on a 1:N relation — Prisma can't order by its aggregate,
    // so fetch the matching set and sort/paginate by the lowest tier in memory.
    // (Tour catalogue is small; this stays cheap.)
    if (sortBy === 'price') {
        const all = await prisma.tour.findMany({ where, include: RELATIONS });
        const dir = sortOrder === 'desc' ? -1 : 1;
        all.sort((a, b) => {
            const pa = minGrossPrice(a);
            const pb = minGrossPrice(b);
            if (pa == null && pb == null) return 0;
            if (pa == null) return 1;
            if (pb == null) return -1;
            return (pa - pb) * dir;
        });
        const total = all.length;
        const start = (page - 1) * limit;
        const items = all.slice(start, start + limit);
        return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
    }

    const orderBy = sortMap(sortBy, sortOrder);
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
        prisma.tour.findMany({ where, include: RELATIONS, orderBy, skip, take: limit }),
        prisma.tour.count({ where }),
    ]);

    return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
}

export async function getTour(id) {
    const tour = await prisma.tour.findUnique({ where: { id }, include: RELATIONS });
    if (!tour) throw ApiError.notFound('Tour not found');
    return tour;
}

// Availability for a requested date + party size, derived from the tour's real
// booking rules (cutoff lead-time, min/max pax, active status). When a date is
// not bookable, suggests the next bookable dates.
export async function getAvailability({ id, date, pax }) {
    const tour = await prisma.tour.findUnique({
        where: { id },
        select: {
            id: true, status: true, bookingCutoffHours: true, minPax: true, maxPax: true,
            startTimes: true, unavailableDates: true, apiType: true, apiId: true,
            dailyCapacity: true,
            supplier: { select: { apiChannelId: true, apiKey: true } },
        },
    });
    if (!tour) throw ApiError.notFound('Tour not found');

    const cutoff = Number(tour.bookingCutoffHours) || 0;
    const minPax = tour.minPax ?? 1;
    const maxPax = tour.maxPax ?? 99;
    const blackout = new Set(tour.unavailableDates ?? []);

    // Earliest bookable calendar date = now + cutoff lead time.
    const earliest = new Date(Date.now() + cutoff * 3600 * 1000);
    const earliestDate = earliest.toISOString().slice(0, 10);

    const activeOk = tour.status === 'ACTIVE';
    const paxOk = !pax || (pax >= minPax && pax <= maxPax);
    const cutoffOk = !date || date >= earliestDate;
    const blackedOut = !!date && blackout.has(date);
    let available = activeOk && paxOk && cutoffOk && !blackedOut;

    let reason = null;
    if (!activeOk) reason = 'This experience is not currently bookable.';
    else if (!paxOk) reason = `This experience accepts ${minPax}–${maxPax} travellers.`;
    else if (blackedOut) reason = 'This date is fully booked — please choose another date.';
    else if (!cutoffOk)
        reason = cutoff > 0
            ? `Bookings need at least ${cutoff}h notice, so this date is no longer available.`
            : 'This date is not available.';

    // Internal tours with a configured capacity: reflect seats already taken by
    // confirmed/pending bookings + active cart holds. Null-guarded — an uncapped
    // tour (dailyCapacity null, no per-date override) keeps `remaining: null` and
    // behaves exactly as before.
    let remaining = null;
    if (date && tour.apiType === 'NONE') {
        const capacity = await seatCapacityFor(tour.id, date, tour.dailyCapacity);
        if (capacity != null) {
            remaining = await seatsRemaining(tour.id, date, capacity);
            const need = pax || 1;
            if (available && remaining < need) {
                available = false;
                reason = remaining <= 0
                    ? 'This date is fully booked — please choose another date.'
                    : `Only ${remaining} seat(s) left for this date.`;
            }
        }
    }

    // Vendor tours (TourCMS / Ventrata): confirm the date against the operator's live availability.
    if (available && date && tour.apiType && tour.apiType !== 'NONE') {
        const vendor = await checkVendorDate(tour, date, pax);
        if (vendor === false) {
            available = false;
            reason = 'The operator has no availability for this date — please choose another date.';
        }
    }

    // Suggest the next bookable dates (skip cutoff + blackout dates).
    const nextDates = [];
    if (!available && activeOk && paxOk) {
        let d = new Date(`${earliestDate}T00:00:00.000Z`);
        let guard = 0;
        while (nextDates.length < 6 && guard < 60) {
            const iso = d.toISOString().slice(0, 10);
            if (!blackout.has(iso)) nextDates.push(iso);
            d = new Date(d.getTime() + 86400000);
            guard += 1;
        }
    }

    return { available, reason, requestedDate: date ?? null, earliestDate, nextDates, remaining, startTimes: tour.startTimes ?? [] };
}

// Effective seat capacity for an internal (tour, date): explicit admin per-date
// override wins, else the tour's default dailyCapacity, else null (= unlimited).
export async function seatCapacityFor(tourId, dateStr, dailyCapacity) {
    const start = new Date(`${dateStr}T00:00:00.000Z`);
    const override = await prisma.tourDateCapacity.findUnique({
        where: { tourId_date: { tourId, date: start } },
    });
    if (override) return override.capacity;
    return dailyCapacity ?? null;
}

// remaining = capacity − bookedPax(PENDING|CONFIRMED) − heldPax(active cart holds).
export async function seatsRemaining(tourId, dateStr, capacity) {
    const start = new Date(`${dateStr}T00:00:00.000Z`);
    const end = new Date(start.getTime() + 86400000);
    const [held, booked] = await Promise.all([
        prisma.reservation.aggregate({
            _sum: { heldSeats: true },
            where: { tourId, status: 'HELD', travelDate: { gte: start, lt: end } },
        }),
        prisma.booking.aggregate({
            _sum: { paxCount: true },
            where: { tourId, status: { in: ['PENDING', 'CONFIRMED'] }, travelDate: { gte: start, lt: end } },
        }),
    ]);
    return capacity - (held._sum.heldSeats ?? 0) - (booked._sum.paxCount ?? 0);
}

// Per-month availability so the calendar can disable blocked dates as the user
// navigates months. Returns the earliest bookable date (cutoff) + the blackout
// dates that fall in the requested YYYY-MM.
export async function getMonthAvailability({ id, month }) {
    const tour = await prisma.tour.findUnique({
        where: { id },
        select: { status: true, bookingCutoffHours: true, unavailableDates: true },
    });
    if (!tour) throw ApiError.notFound('Tour not found');

    const cutoff = Number(tour.bookingCutoffHours) || 0;
    const earliestDate = new Date(Date.now() + cutoff * 3600 * 1000).toISOString().slice(0, 10);
    const unavailableDates = (tour.unavailableDates ?? []).filter((d) => String(d).startsWith(month));

    return { month, earliestDate, active: tour.status === 'ACTIVE', unavailableDates };
}

export async function getTourBySlug(slug) {
    const tour = await prisma.tour.findUnique({
        where: { productSlug: slug },
        include: RELATIONS,
    });
    if (!tour) throw ApiError.notFound('Tour not found');
    return tour;
}

async function validateRefs({ countryId, cityId, categoryId, attractionId, supplierId }) {
    await ensureExists('country', countryId, 'Country');
    await ensureCityBelongsToCountry(cityId, countryId);
    if (categoryId) await ensureExists('category', categoryId, 'Category');
    if (attractionId) await ensureExists('attraction', attractionId, 'Attraction');
    if (supplierId) await ensureExists('supplier', supplierId, 'Supplier');
}

function ensureSupplierForManualTour(apiType, supplierId) {
    const effectiveType = apiType ?? 'NONE';
    if (effectiveType === 'NONE' && (supplierId === undefined || supplierId === null)) {
        throw ApiError.badRequest('Supplier is required for manual (non-API) tours', {
            code: 'SUPPLIER_REQUIRED',
        });
    }
}

export async function createTour(payload, { actorId } = {}) {
    const { tourFields, options, priceTiers } = splitChildrenFromPayload(payload);
    ensureSupplierForManualTour(tourFields.apiType, tourFields.supplierId);
    await validateRefs(tourFields);
    ensureTiersMatchTourType(tourFields.tourType, priceTiers);

    return prisma.tour.create({
        data: {
            ...tourFields,
            createdById: actorId ?? null,
            modifiedById: actorId ?? null,
            options: options?.length ? { create: options } : undefined,
            priceTiers: priceTiers?.length ? { create: priceTiers } : undefined,
        },
        include: RELATIONS,
    });
}

export async function updateTour(id, payload, { actorId } = {}) {
    const { tourFields, options, priceTiers } = splitChildrenFromPayload(payload);
    await validateRefs({
        countryId: tourFields.countryId,
        cityId: tourFields.cityId,
        categoryId: tourFields.categoryId,
        attractionId: tourFields.attractionId,
        supplierId: tourFields.supplierId,
    });

    let effectiveTourType = tourFields.tourType;
    if (Array.isArray(priceTiers) && !effectiveTourType) {
        const existing = await prisma.tour.findUnique({
            where: { id },
            select: { tourType: true },
        });
        effectiveTourType = existing?.tourType;
    }
    ensureTiersMatchTourType(effectiveTourType, priceTiers);

    if (tourFields.apiType !== undefined || tourFields.supplierId !== undefined) {
        const existing = await prisma.tour.findUnique({
            where: { id },
            select: { apiType: true, supplierId: true },
        });
        const apiType = tourFields.apiType ?? existing?.apiType;
        const supplierId =
            tourFields.supplierId !== undefined ? tourFields.supplierId : existing?.supplierId;
        ensureSupplierForManualTour(apiType, supplierId);
    }

    return prisma.$transaction(async (tx) => {
        const tour = await tx.tour.update({
            where: { id },
            data: { ...tourFields, modifiedById: actorId ?? null },
        });

        if (Array.isArray(options)) {
            await tx.tourOption.deleteMany({ where: { tourId: id } });
            if (options.length) {
                await tx.tourOption.createMany({
                    data: options.map((option) => ({ ...option, tourId: id })),
                });
            }
        }

        if (Array.isArray(priceTiers)) {
            await tx.tourPriceTier.deleteMany({ where: { tourId: id } });
            if (priceTiers.length) {
                await tx.tourPriceTier.createMany({
                    data: priceTiers.map((tier) => ({ ...tier, tourId: id })),
                });
            }
        }

        return tx.tour.findUnique({ where: { id: tour.id }, include: RELATIONS });
    });
}

export async function deleteTour(id) {
    const bookingCount = await prisma.booking.count({ where: { tourId: id } });
    if (bookingCount > 0) {
        throw ApiError.conflict(
            `Cannot delete tour — ${bookingCount} booking(s) reference it.`,
            { code: 'TOUR_HAS_BOOKINGS' }
        );
    }
    await prisma.tour.delete({ where: { id } });
}
