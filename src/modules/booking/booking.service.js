import { prisma } from '../../config/db.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/api-error.js';
import { logger } from '../../utils/logger.js';
import { applyCoupon, incrementUsage } from '../coupon/coupon.service.js';
import { emitAlert } from '../alert/alert.service.js';
import { priceFor, generateReferenceNumber } from './booking.pricing.js';
import { placeVendorBooking, cancelVendorBooking } from './booking.vendor.js';
import { voucherUrl, loadVoucherById, buildPdfForBooking } from '../../services/voucher/index.js';
import { refundPaymentIntent } from '../payment/payment.service.js';
import { seatCapacityFor, seatsRemaining } from '../tour/tour.service.js';
import { emitAvailabilityChanged } from '../../realtime/index.js';
import crypto from 'node:crypto';

const HOLD_DURATION_MS = 20 * 60 * 1000;

function generateVoucherToken() {
    return crypto.randomBytes(24).toString('hex');
}

const RELATIONS = {
    tour: {
        select: {
            id: true,
            name: true,
            productId: true,
            productSlug: true,
            thumbnail: true,
            images: true,
            currency: true,
            apiType: true,
            apiId: true,
            cityId: true,
            countryId: true,
            categoryId: true,
            attractionId: true,
        },
    },
    customer: { select: { id: true, name: true, email: true, phone: true } },
    agent: { select: { id: true, name: true, email: true, companyName: true } },
    supplier: { select: { id: true, name: true, currency: true, paymentMode: true } },
    coupon: { select: { id: true, code: true, name: true, discountType: true } },
    payments: { orderBy: { createdAt: 'desc' } },
    events: { orderBy: { createdAt: 'desc' } },
    createdBy: { select: { id: true, name: true, email: true } },
};

async function loadTourWithTiers(tourId) {
    const tour = await prisma.tour.findUnique({
        where: { id: tourId },
        include: {
            priceTiers: { orderBy: { id: 'asc' } },
            supplier: true,
            country: { select: { id: true, name: true } },
            city: { select: { id: true, name: true } },
        },
    });
    if (!tour) throw ApiError.notFound('Tour not found');
    return tour;
}

async function uniqueReference() {
    for (let i = 0; i < 5; i++) {
        const ref = generateReferenceNumber();
        const exists = await prisma.booking.findUnique({ where: { referenceNumber: ref } });
        if (!exists) return ref;
    }
    throw ApiError.internal('Failed to generate unique reference');
}

export async function listBookings({
    status,
    paymentStatus,
    tourId,
    customerId,
    supplierId,
    agentId,
    search,
    fromDate,
    toDate,
    page,
    limit,
}) {
    const where = {
        ...(status ? { status } : {}),
        ...(paymentStatus ? { paymentStatus } : {}),
        ...(tourId ? { tourId } : {}),
        ...(customerId ? { customerId } : {}),
        ...(supplierId ? { supplierId } : {}),
        ...(agentId ? { agentId } : {}),
        ...(fromDate || toDate
            ? {
                  createdAt: {
                      ...(fromDate ? { gte: new Date(fromDate) } : {}),
                      ...(toDate ? { lte: new Date(toDate) } : {}),
                  },
              }
            : {}),
        ...(search
            ? {
                  OR: [
                      { referenceNumber: { contains: search, mode: 'insensitive' } },
                      { leadGuestName: { contains: search, mode: 'insensitive' } },
                      { leadGuestEmail: { contains: search, mode: 'insensitive' } },
                      { tour: { name: { contains: search, mode: 'insensitive' } } },
                  ],
              }
            : {}),
    };
    const skip = (page - 1) * limit;
    const [items, total, summary] = await Promise.all([
        prisma.booking.findMany({
            where,
            include: RELATIONS,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
        }),
        prisma.booking.count({ where }),
        prisma.booking.aggregate({
            where,
            _sum: { totalAmount: true, nettAmount: true, grossAmount: true, discountAmount: true },
        }),
    ]);
    return {
        items,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        summary: {
            totalAmount: Number(summary._sum.totalAmount ?? 0),
            nettAmount: Number(summary._sum.nettAmount ?? 0),
            grossAmount: Number(summary._sum.grossAmount ?? 0),
            discountAmount: Number(summary._sum.discountAmount ?? 0),
        },
    };
}

export async function getBooking(id) {
    const booking = await prisma.booking.findUnique({ where: { id }, include: RELATIONS });
    if (!booking) throw ApiError.notFound('Booking not found');
    return booking;
}

async function createEvent(tx, bookingId, type, message, metadata) {
    return tx.bookingEvent.create({
        data: { bookingId, type, message: message ?? null, metadata: metadata ?? null },
    });
}

export async function createBooking(payload, { actorId } = {}) {
    const tour = await loadTourWithTiers(payload.tourId);
    const totalPax = Object.values(payload.paxBreakdown ?? {}).reduce(
        (acc, n) => acc + Math.max(0, Math.floor(Number(n) || 0)),
        0
    );
    if (!totalPax) throw ApiError.badRequest('paxBreakdown must include at least one pax', { code: 'PAX_REQUIRED' });

    const pricing = priceFor(tour, payload.paxBreakdown);
    if (!pricing.currency) {
        throw ApiError.badRequest('Tour currency is not configured', { code: 'TOUR_CURRENCY_MISSING' });
    }

    let discountAmount = 0;
    let couponId = null;
    let couponCodeFinal = null;
    if (payload.couponCode) {
        const result = await applyCoupon({
            code: payload.couponCode,
            tourId: tour.id,
            amount: pricing.gross,
        });
        discountAmount = result.discountValue;
        couponId = result.couponId;
        couponCodeFinal = result.code;
    }

    // The booking is calculated and settled entirely in the TOUR's own currency
    // (pricing.currency). No conversion to a base/USD currency at this level —
    // the display currency is a browse-only convenience handled on the storefront,
    // and the per-instance FX snapshot is frozen at payment time (paymentService).
    const totalAmount = Number((pricing.gross - discountAmount).toFixed(2));

    const referenceNumber = await uniqueReference();

    const initialStatus =
        tour.apiType === 'NONE' && tour.instantConfirmation ? 'CONFIRMED' : 'PENDING';
    const holdExpiresAt =
        initialStatus === 'PENDING' ? new Date(Date.now() + HOLD_DURATION_MS) : null;

    const booking = await prisma.$transaction(async (tx) => {
        const created = await tx.booking.create({
            data: {
                referenceNumber,
                voucherToken: generateVoucherToken(),
                tourId: tour.id,
                tourOptionId: payload.tourOptionId ?? null,
                customerId: payload.customerId ?? null,
                agentId: payload.agentId ?? null,
                supplierId: tour.supplierId ?? null,
                createdById: actorId ?? null,
                leadGuestName: payload.leadGuestName,
                leadGuestEmail: payload.leadGuestEmail,
                leadGuestPhone: payload.leadGuestPhone ?? null,
                paxCount: pricing.totalPax,
                paxBreakdown: payload.paxBreakdown,
                travelDate: new Date(payload.travelDate),
                startTime: payload.startTime ?? tour.startTime ?? null,
                status: initialStatus,
                holdExpiresAt,
                paymentStatus: 'PENDING',
                currency: pricing.currency,
                supplierCurrency: tour.supplier?.currency ?? null,
                nettAmount: pricing.nett,
                grossAmount: pricing.gross,
                discountAmount,
                totalAmount,
                couponId,
                couponCode: couponCodeFinal,
                externalSource: tour.apiType,
                notes: payload.notes ?? null,
            },
            include: RELATIONS,
        });
        await createEvent(tx, created.id, 'BOOKING_CREATED', null, {
            actorId,
            apiType: tour.apiType,
        });
        return created;
    });

    if (couponId) await incrementUsage(couponId);

    // Vendor tours are NOT dispatched here. The booking is created PENDING and
    // only pushed to TourCMS/Ventrata when it is CONFIRMED (see confirmBooking).
    if (tour.apiType !== 'NONE') {
        await prisma.bookingEvent.create({
            data: {
                bookingId: booking.id,
                type: 'AWAITING_CONFIRMATION',
                message: `${tour.apiType} booking created — sent to vendor on confirmation`,
                metadata: { apiType: tour.apiType },
            },
        });
    }

    const final = await prisma.booking.findUnique({ where: { id: booking.id }, include: RELATIONS });
    if (final.status === 'CONFIRMED') {
        await onConfirmed(final);
    }
    return final;
}

async function onConfirmed(final) {
    sendBookingConfirmation(final).catch(() => {});
    await prisma.tour.update({
        where: { id: final.tourId },
        data: { bookingCount: { increment: 1 } },
    });
}

// Booking-confirmation email with the voucher link + (when mail is enabled) the
// voucher PDF attached. Best-effort; never blocks confirmation.
async function sendBookingConfirmation(final) {
    const tourExtra = await prisma.tour
        .findUnique({ where: { id: final.tourId }, select: { meetingPoint: true } })
        .catch(() => null);
    const payload = {
        referenceNumber: final.referenceNumber,
        leadGuestName: final.leadGuestName,
        leadGuestEmail: final.leadGuestEmail,
        tourName: final.tour?.name,
        travelDate: final.travelDate.toISOString().slice(0, 10),
        startTime: final.startTime ? ` · ${final.startTime}` : '',
        meetingPoint: tourExtra?.meetingPoint || '—',
        paxCount: final.paxCount,
        totalAmount: Number(final.totalAmount).toFixed(2),
        currency: final.currency,
        voucherUrl: final.voucherToken ? voucherUrl(final.voucherToken) : '',
    };

    // Only spin up Puppeteer when an email will actually be delivered.
    let attachments;
    if (env.MAIL_ENABLED && final.voucherToken) {
        try {
            const fullBooking = await loadVoucherById(final.id);
            const pdf = await buildPdfForBooking(fullBooking);
            attachments = [
                {
                    filename: `voucher-${final.referenceNumber}.pdf`,
                    content: Buffer.isBuffer(pdf) ? pdf : Buffer.from(pdf),
                    contentType: 'application/pdf',
                },
            ];
        } catch {
            /* send without attachment */
        }
    }

    await emitAlert('BOOKING_CONFIRMATION', payload, { attachments });
    if (attachments) {
        await prisma.booking.update({ where: { id: final.id }, data: { voucherSent: true } }).catch(() => {});
    }
}

// Mirror of onConfirmed's increment: when a previously-CONFIRMED booking leaves
// that state (cancel / refund / delete) we drop the tour's popularity counter.
// updateMany + the gt:0 guard makes it idempotent and floor-safe (never negative).
async function decrementBookingCount(tourId) {
    if (!tourId) return;
    await prisma.tour.updateMany({
        where: { id: tourId, bookingCount: { gt: 0 } },
        data: { bookingCount: { decrement: 1 } },
    });
}

// The single seam for "this booking is now real → reserve it with the vendor".
// Today an admin Confirm action calls this. When Stripe lands in the customer
// panel, the payment-success handler calls this same function — no rework.
export async function confirmBooking(id, { actorId } = {}) {
    const booking = await prisma.booking.findUnique({
        where: { id },
        include: { tour: { include: { supplier: true } } },
    });
    if (!booking) throw ApiError.notFound('Booking not found');
    if (booking.status === 'CONFIRMED') return getBooking(id);
    if (booking.status !== 'PENDING') {
        throw ApiError.badRequest(`Cannot confirm a ${booking.status} booking`, {
            code: 'INVALID_BOOKING_STATE',
        });
    }

    const tour = booking.tour;
    if (tour.apiType !== 'NONE') {
        const vendor = await placeVendorBooking({
            tour,
            supplier: tour.supplier,
            booking,
            customer: { name: booking.leadGuestName, email: booking.leadGuestEmail },
        });
        if (!vendor || vendor.status !== 'CONFIRMED') {
            await prisma.booking.update({
                where: { id },
                data: {
                    externalRef: vendor?.externalRef ?? booking.externalRef ?? null,
                    externalPayload: vendor?.payload ?? null,
                },
            });
            const provider = vendor?.provider ?? tour.apiType;
            const vendorStatus = vendor?.status ?? 'NO_RESPONSE';

            // If the customer's money was already captured, we never keep it for
            // a booking the supplier won't fulfil → auto-refund + auto-cancel and
            // email both the customer and ops. (Unpaid admin-confirm attempts stay
            // PENDING for retry instead.)
            if (booking.paymentStatus === 'PAID') {
                await autoCancelUnfulfillable(booking, { provider, vendorStatus, actorId, tourName: tour.name });
                throw ApiError.badGateway(
                    'Supplier could not confirm the booking — your payment has been refunded and the booking cancelled',
                    {
                        code: 'VENDOR_NOT_CONFIRMED_REFUNDED',
                        details: { provider, status: vendor?.status ?? null, refunded: true },
                    }
                );
            }

            await prisma.bookingEvent.create({
                data: {
                    bookingId: id,
                    type: 'VENDOR_DISPATCH_FAILED',
                    message: `${provider} → ${vendorStatus} — kept PENDING for retry`,
                    metadata: { provider, status: vendor?.status ?? null },
                    actorId: actorId ?? null,
                },
            });
            // Alert ops: awaiting booking that the supplier didn't confirm.
            emitAlert('VENDOR_DISPATCH_FAILED', {
                referenceNumber: booking.referenceNumber,
                tourName: tour.name,
                provider,
                leadGuestName: booking.leadGuestName,
                leadGuestEmail: booking.leadGuestEmail,
                travelDate: booking.travelDate.toISOString().slice(0, 10),
                vendorStatus,
            }).catch(() => {});
            throw ApiError.badGateway(
                'Vendor did not confirm the booking — it stays PENDING, retry later',
                {
                    code: 'VENDOR_NOT_CONFIRMED',
                    details: { provider, status: vendor?.status ?? null },
                }
            );
        }
        await prisma.booking.update({
            where: { id },
            data: {
                status: 'CONFIRMED',
                holdExpiresAt: null,
                externalRef: vendor.externalRef ?? null,
                externalPayload: vendor.payload ?? null,
            },
        });
        await prisma.bookingEvent.create({
            data: {
                bookingId: id,
                type: 'VENDOR_DISPATCH',
                message: `${vendor.provider} → CONFIRMED (ref ${vendor.externalRef ?? 'n/a'})`,
                metadata: { provider: vendor.provider, externalRef: vendor.externalRef },
                actorId: actorId ?? null,
            },
        });
    } else {
        await prisma.booking.update({
            where: { id },
            data: { status: 'CONFIRMED', holdExpiresAt: null },
        });
        await prisma.bookingEvent.create({
            data: {
                bookingId: id,
                type: 'BOOKING_CONFIRMED',
                message: 'Confirmed (manual tour)',
                actorId: actorId ?? null,
            },
        });
    }

    const final = await prisma.booking.findUnique({ where: { id }, include: RELATIONS });
    await onConfirmed(final);
    return final;
}

// Payment captured but the supplier won't confirm → refund + cancel + notify.
// Used by confirmBooking's vendor-failure branch (no vendor reservation exists
// to cancel since placement itself failed). Emails the customer + ops.
async function autoCancelUnfulfillable(booking, { provider, vendorStatus, actorId, tourName } = {}) {
    const dateStr = booking.travelDate.toISOString().slice(0, 10);
    const refundAmount = Number(booking.totalAmount);

    const r = await refundPaymentIntent(booking.paymentIntentId);
    await prisma.bookingPayment.create({
        data: {
            bookingId: booking.id,
            status: 'REFUNDED',
            amount: refundAmount,
            currency: booking.currency,
            provider: 'stripe',
            providerRef: r.providerRef ?? null,
            isRefund: true,
            notes: r.refunded
                ? 'Auto-refunded — supplier could not confirm the booking'
                : 'Auto-refund recorded — pending manual processing',
        },
    });

    await prisma.booking.update({
        where: { id: booking.id },
        data: {
            status: 'CANCELLED',
            paymentStatus: 'REFUNDED',
            externalRef: booking.externalRef ?? null,
            cancellationReason: `Supplier (${provider}) could not confirm — auto-cancelled and refunded`,
            cancelledAt: new Date(),
            refundAmount,
            refundedAt: new Date(),
        },
    });
    await prisma.bookingEvent.create({
        data: {
            bookingId: booking.id,
            type: 'BOOKING_CANCELLED',
            message: `Auto-cancelled — ${provider} dispatch failed (${vendorStatus}); payment refunded`,
            metadata: { auto: true, provider, vendorStatus, refundAmount, refundedReal: r.refunded },
            actorId: actorId ?? null,
        },
    });
    if (booking.status === 'CONFIRMED') {
        await decrementBookingCount(booking.tourId).catch(() => {});
    }

    // Ops: a paid booking the supplier rejected — refunded automatically.
    emitAlert('VENDOR_DISPATCH_FAILED', {
        referenceNumber: booking.referenceNumber,
        tourName: tourName ?? '',
        provider,
        leadGuestName: booking.leadGuestName,
        leadGuestEmail: booking.leadGuestEmail,
        travelDate: dateStr,
        vendorStatus: `${vendorStatus} — auto-refunded + cancelled (no manual action needed)`,
    }).catch(() => {});

    // Customer + ops: cancellation + refund confirmation.
    emitAlert('BOOKING_CANCELLED', {
        referenceNumber: booking.referenceNumber,
        leadGuestName: booking.leadGuestName,
        leadGuestEmail: booking.leadGuestEmail,
        tourName: tourName ?? '',
        travelDate: dateStr,
        refundAmount: refundAmount.toFixed(2),
        currency: booking.currency,
        refundNote: r.refunded
            ? 'The supplier was unable to confirm your booking, so it has been cancelled and your payment refunded automatically. The refund will appear on your statement within 5–10 business days.'
            : 'The supplier was unable to confirm your booking, so it has been cancelled. Your refund has been recorded and is being processed.',
    }).catch(() => {});

    return r;
}

export async function updateBooking(id, payload) {
    const data = { ...payload };
    if (data.travelDate) data.travelDate = new Date(data.travelDate);
    const booking = await prisma.booking.update({ where: { id }, data, include: RELATIONS });
    await prisma.bookingEvent.create({
        data: { bookingId: id, type: 'BOOKING_UPDATED', message: null, metadata: payload },
    });
    return booking;
}

// Shared cancellation core used by BOTH the admin and customer cancel flows:
// supplier sync → Stripe refund (+ ledger) → local cancel → free inventory →
// emails. `booking` must already be loaded with { tour, supplier } and guarded.
async function performCancellation(booking, { reason, byCustomer = false, actorId = null } = {}) {
    const id = booking.id;
    const wasConfirmed = booking.status === 'CONFIRMED';
    const wasPaid = booking.paymentStatus === 'PAID';
    const dateStr = booking.travelDate.toISOString().slice(0, 10);
    const reasonText = reason || (byCustomer ? 'Cancelled by customer' : 'Cancelled by admin');

    // 1) Sync the cancellation with the supplier (best-effort).
    let vendorCancel = { attempted: false, ok: true };
    if (booking.tour?.apiType !== 'NONE' && booking.externalRef) {
        vendorCancel.attempted = true;
        const r = await cancelVendorBooking({ tour: booking.tour, supplier: booking.supplier, booking });
        vendorCancel.ok = !!r?.ok;
    }

    // 2) Refund the payment (real Stripe refund, else a manual-refund ledger row).
    let refundAmount = 0;
    let refundedReal = false;
    if (wasPaid) {
        const r = await refundPaymentIntent(booking.paymentIntentId);
        refundedReal = r.refunded;
        refundAmount = Number(booking.totalAmount);
        await prisma.bookingPayment.create({
            data: {
                bookingId: id,
                status: 'REFUNDED',
                amount: refundAmount,
                currency: booking.currency,
                provider: 'stripe',
                providerRef: r.providerRef ?? null,
                isRefund: true,
                notes: refundedReal ? 'Refunded via Stripe' : 'Refund recorded — pending manual processing',
            },
        });
    }

    // 3) Cancel locally.
    const updated = await prisma.booking.update({
        where: { id },
        data: {
            status: 'CANCELLED',
            paymentStatus: wasPaid ? 'REFUNDED' : booking.paymentStatus,
            cancellationReason: reasonText,
            cancelledAt: new Date(),
            refundAmount: wasPaid ? refundAmount : null,
            refundedAt: wasPaid ? new Date() : null,
        },
        include: RELATIONS,
    });
    await prisma.bookingEvent.create({
        data: {
            bookingId: id,
            type: 'BOOKING_CANCELLED',
            message: reasonText,
            metadata: { byCustomer, actorId, refundAmount, refundedReal, vendorCancel },
        },
    });
    if (vendorCancel.attempted && !vendorCancel.ok) {
        emitAlert('VENDOR_DISPATCH_FAILED', {
            referenceNumber: booking.referenceNumber,
            tourName: booking.tour?.name,
            provider: booking.tour?.apiType,
            leadGuestName: booking.leadGuestName,
            leadGuestEmail: booking.leadGuestEmail,
            travelDate: dateStr,
            vendorStatus: 'CANCEL_FAILED — cancel manually with the supplier',
        }).catch(() => {});
    }

    // 4) Free inventory + broadcast remaining seats.
    if (wasConfirmed) await decrementBookingCount(booking.tourId);
    try {
        if (booking.tour?.apiType === 'NONE') {
            const cap = await seatCapacityFor(booking.tourId, dateStr, booking.tour.dailyCapacity);
            const remaining = cap == null ? null : await seatsRemaining(booking.tourId, dateStr, cap);
            emitAvailabilityChanged(booking.tourId, dateStr, remaining);
        }
    } catch {
        /* non-blocking */
    }

    // 5) Cancellation + refund email to the customer (+ admins).
    emitAlert('BOOKING_CANCELLED', {
        referenceNumber: booking.referenceNumber,
        leadGuestName: booking.leadGuestName,
        leadGuestEmail: booking.leadGuestEmail,
        tourName: booking.tour?.name,
        travelDate: dateStr,
        refundAmount: wasPaid ? refundAmount.toFixed(2) : '0.00',
        currency: booking.currency,
        refundNote: wasPaid
            ? refundedReal
                ? 'Your refund has been issued and will appear on your statement within 5–10 business days.'
                : 'Your refund has been recorded and is being processed.'
            : 'No payment had been captured, so no refund is required.',
    }).catch(() => {});

    return { booking: updated, refunded: wasPaid, refundedReal, refundAmount, vendorCancel };
}

// Admin/staff cancel — full refund + inventory release + emails (was previously
// a bare status flip with no refund/inventory/email).
export async function cancelBooking(id, payload, { actorId } = {}) {
    const existing = await prisma.booking.findUnique({
        where: { id },
        include: { tour: true, supplier: true },
    });
    if (!existing) throw ApiError.notFound('Booking not found');
    if (existing.status === 'CANCELLED' || existing.status === 'REFUNDED') {
        throw ApiError.badRequest('Booking already cancelled or refunded', { code: 'ALREADY_CANCELLED' });
    }
    if (existing.status !== 'PENDING' && existing.status !== 'CONFIRMED') {
        throw ApiError.badRequest(`A ${existing.status} booking cannot be cancelled.`, { code: 'INVALID_BOOKING_STATE' });
    }
    const result = await performCancellation(existing, { reason: payload?.reason, byCustomer: false, actorId });
    return result.booking;
}

export async function recordPayment(id, payload) {
    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) throw ApiError.notFound('Booking not found');
    const payment = await prisma.bookingPayment.create({
        data: {
            bookingId: id,
            status: payload.status ?? 'PAID',
            amount: payload.amount,
            currency: payload.currency,
            provider: payload.provider ?? null,
            providerRef: payload.providerRef ?? null,
            notes: payload.notes ?? null,
        },
    });
    if (payment.status === 'PAID') {
        await prisma.booking.update({
            where: { id },
            data: { paymentStatus: 'PAID', holdExpiresAt: null },
        });
    }
    if (payment.status === 'FAILED') {
        await prisma.booking.update({
            where: { id },
            data: { paymentStatus: 'FAILED' },
        });
        emitAlert('PAYMENT_FAILURE', {
            referenceNumber: booking.referenceNumber,
            leadGuestName: booking.leadGuestName,
            amount: Number(payload.amount).toFixed(2),
            currency: payload.currency,
            reason: payload.notes ?? 'Payment provider declined',
        }).catch(() => {});
    }
    await prisma.bookingEvent.create({
        data: {
            bookingId: id,
            type: 'PAYMENT_RECORDED',
            message: payment.status,
            metadata: { amount: payload.amount, currency: payload.currency },
        },
    });
    return prisma.booking.findUnique({ where: { id }, include: RELATIONS });
}

export async function refundBooking(id, payload) {
    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) throw ApiError.notFound('Booking not found');

    await prisma.bookingPayment.create({
        data: {
            bookingId: id,
            status: 'REFUNDED',
            amount: payload.amount,
            currency: booking.currency,
            provider: payload.provider ?? null,
            providerRef: payload.providerRef ?? null,
            notes: payload.notes ?? null,
            isRefund: true,
        },
    });

    const refundedTotal = (booking.refundAmount ? Number(booking.refundAmount) : 0) + Number(payload.amount);
    const fullRefund = refundedTotal >= Number(booking.totalAmount);

    const updated = await prisma.booking.update({
        where: { id },
        data: {
            paymentStatus: fullRefund ? 'REFUNDED' : 'PARTIAL_REFUND',
            status: fullRefund ? 'REFUNDED' : 'REFUND_PENDING',
            refundAmount: refundedTotal,
            refundedAt: fullRefund ? new Date() : booking.refundedAt,
        },
        include: RELATIONS,
    });
    await prisma.bookingEvent.create({
        data: {
            bookingId: id,
            type: fullRefund ? 'BOOKING_REFUNDED' : 'BOOKING_PARTIAL_REFUND',
            message: payload.notes ?? null,
            metadata: { amount: payload.amount },
        },
    });
    if (booking.status === 'CONFIRMED') {
        await decrementBookingCount(booking.tourId);
    }
    return updated;
}

export async function deleteBooking(id) {
    const existing = await prisma.booking.findUnique({ where: { id }, select: { status: true, tourId: true } });
    await prisma.booking.delete({ where: { id } });
    if (existing?.status === 'CONFIRMED') {
        await decrementBookingCount(existing.tourId);
    }
}

// Cancels PENDING+unpaid bookings whose 20-minute hold has lapsed. Idempotent:
// the status/paymentStatus filter means a booking that was paid or confirmed in
// the meantime (e.g. a Stripe webhook) is simply not matched — no race.
export async function expirePendingHolds() {
    const now = new Date();
    const expired = await prisma.booking.findMany({
        where: {
            status: 'PENDING',
            paymentStatus: 'PENDING',
            holdExpiresAt: { not: null, lt: now },
        },
        select: { id: true, referenceNumber: true },
        take: 100,
    });
    for (const b of expired) {
        await prisma.booking.update({
            where: { id: b.id },
            data: {
                status: 'CANCELLED',
                cancellationReason: 'Hold expired — payment not completed in time',
                cancelledAt: now,
                holdExpiresAt: null,
            },
        });
        await prisma.bookingEvent.create({
            data: {
                bookingId: b.id,
                type: 'HOLD_EXPIRED',
                message: '20-minute hold lapsed without payment — auto-cancelled',
            },
        });
    }
    return expired;
}

export async function listCustomerBookings(customerId) {
    return prisma.booking.findMany({
        where: { customerId },
        include: RELATIONS,
        orderBy: { createdAt: 'desc' },
    });
}

export async function getCustomerBooking(id, customerId) {
    const booking = await prisma.booking.findUnique({ where: { id }, include: RELATIONS });
    if (!booking || booking.customerId !== customerId) {
        throw ApiError.notFound('Booking not found');
    }
    return booking;
}

// Customer-initiated cancellation: syncs the cancellation with the supplier
// (TourCMS/Ventrata), refunds the payment (Stripe, or a manual-refund ledger
// entry), frees the inventory, and emails the customer + ops. No data is lost.
export async function cancelCustomerBooking(id, customerId, { reason } = {}) {
    const booking = await prisma.booking.findUnique({
        where: { id },
        include: { tour: true, supplier: true },
    });
    if (!booking || booking.customerId !== customerId) throw ApiError.notFound('Booking not found');
    if (booking.status === 'CANCELLED' || booking.status === 'REFUNDED') {
        throw ApiError.badRequest('This booking is already cancelled.', { code: 'ALREADY_CANCELLED' });
    }
    if (booking.status !== 'PENDING' && booking.status !== 'CONFIRMED') {
        throw ApiError.badRequest(`A ${booking.status} booking cannot be cancelled.`, { code: 'INVALID_BOOKING_STATE' });
    }
    return performCancellation(booking, { reason, byCustomer: true });
}

export async function quote({ tourId, paxBreakdown, couponCode }) {
    const tour = await loadTourWithTiers(tourId);
    const pricing = priceFor(tour, paxBreakdown);
    let discount = null;
    if (couponCode) {
        try {
            discount = await applyCoupon({ code: couponCode, tourId, amount: pricing.gross });
        } catch (err) {
            discount = { error: err?.message ?? 'Coupon error', code: err?.code ?? null };
        }
    }
    return {
        ...pricing,
        currency: pricing.currency,
        discount,
        total: discount?.discountValue ? Number((pricing.gross - discount.discountValue).toFixed(2)) : pricing.gross,
    };
}
