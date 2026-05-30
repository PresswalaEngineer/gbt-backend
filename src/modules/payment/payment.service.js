import { prisma } from '../../config/db.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/api-error.js';
import { logger } from '../../utils/logger.js';
import { getStripe, isStripeConfigured } from '../../services/payments/stripe-client.js';
import { recordPayment, confirmBooking } from '../booking/booking.service.js';
import { resolveRate } from '../exchange-rate/exchange-rate.service.js';

const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'VND', 'CLP', 'XOF', 'XAF']);
const OPEN_INTENT_STATES = new Set([
    'requires_payment_method',
    'requires_confirmation',
    'requires_action',
    'processing',
]);

function toMinorUnits(amount, currency) {
    const n = Number(amount);
    return ZERO_DECIMAL.has(currency.toUpperCase()) ? Math.round(n) : Math.round(n * 100);
}

function fromMinorUnits(amount, currency) {
    return ZERO_DECIMAL.has(currency.toUpperCase()) ? Number(amount) : Number(amount) / 100;
}

export async function createCheckout(bookingId, customerId) {
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.customerId !== customerId) {
        throw ApiError.notFound('Booking not found');
    }
    if (booking.paymentStatus === 'PAID') {
        throw ApiError.badRequest('Booking is already paid', { code: 'ALREADY_PAID' });
    }
    if (booking.status !== 'PENDING') {
        throw ApiError.badRequest(`Cannot pay for a ${booking.status} booking`, {
            code: 'INVALID_BOOKING_STATE',
        });
    }

    const stripe = getStripe();
    const currency = booking.currency.toLowerCase();
    const intent = await stripe.paymentIntents.create({
        amount: toMinorUnits(booking.totalAmount, booking.currency),
        currency,
        metadata: { bookingId: String(booking.id), referenceNumber: booking.referenceNumber },
        automatic_payment_methods: { enabled: true },
        description: `Booking ${booking.referenceNumber}`,
    });

    return {
        clientSecret: intent.client_secret,
        publishableKey: env.STRIPE_PUBLISHABLE_KEY ?? null,
        amount: Number(booking.totalAmount),
        currency: booking.currency,
        bookingId: booking.id,
        referenceNumber: booking.referenceNumber,
    };
}

// Combined payment for a whole cart: ONE PaymentIntent covering N bookings,
// charged in the customer's display currency (each booking FX-converted).
export async function createCartCheckout(bookingIds, customerId, currency) {
    const cur = String(currency || '').toUpperCase();
    if (!/^[A-Z]{3}$/.test(cur)) {
        throw ApiError.badRequest('A valid 3-letter currency is required', { code: 'INVALID_CURRENCY' });
    }
    const ids = Array.from(new Set(bookingIds.map(Number))).filter(Boolean);
    if (!ids.length) throw ApiError.badRequest('No bookings to pay for', { code: 'NO_BOOKINGS' });

    const bookings = await prisma.booking.findMany({ where: { id: { in: ids }, customerId } });
    if (bookings.length !== ids.length) throw ApiError.notFound('Some bookings were not found');

    const now = new Date();
    let total = 0;
    for (const b of bookings) {
        if (b.paymentStatus === 'PAID') {
            throw ApiError.badRequest(`Booking ${b.referenceNumber} is already paid`, { code: 'ALREADY_PAID' });
        }
        // Allow paying an unpaid booking that is PENDING or already CONFIRMED
        // (internal instant-confirm tours confirm on creation but are still unpaid).
        if (b.status !== 'PENDING' && b.status !== 'CONFIRMED') {
            throw ApiError.badRequest(`Cannot pay for a ${b.status} booking`, { code: 'INVALID_BOOKING_STATE' });
        }
        if (b.holdExpiresAt && b.holdExpiresAt < now) {
            throw ApiError.conflict('Your reservation hold has expired — please reserve again', {
                code: 'RESERVATION_EXPIRED',
            });
        }
        let amt = Number(b.totalAmount);
        if (b.currency && b.currency.toUpperCase() !== cur) {
            const rate = await resolveRate({ from: b.currency, to: cur });
            if (rate == null) {
                throw ApiError.badRequest(`Cannot convert ${b.currency} to ${cur}`, { code: 'FX_UNAVAILABLE' });
            }
            amt = amt * rate;
        }
        total += amt;
    }
    total = Number(total.toFixed(2));

    const stripe = getStripe();

    // Duplicate-payment guard: reuse an already-open intent for the same set.
    const sharedIntent = bookings[0].paymentIntentId;
    if (sharedIntent && bookings.every((b) => b.paymentIntentId === sharedIntent)) {
        try {
            const existing = await stripe.paymentIntents.retrieve(sharedIntent);
            if (existing && OPEN_INTENT_STATES.has(existing.status)) {
                return {
                    clientSecret: existing.client_secret,
                    publishableKey: env.STRIPE_PUBLISHABLE_KEY ?? null,
                    paymentIntentId: existing.id,
                    amount: total,
                    currency: cur,
                    bookingIds: ids,
                };
            }
        } catch {
            // fall through and create a fresh intent
        }
    }

    const idempotencyKey = `cart_${[...ids].sort((a, b) => a - b).join('-')}_${toMinorUnits(total, cur)}${cur}`;
    const intent = await stripe.paymentIntents.create(
        {
            amount: toMinorUnits(total, cur),
            currency: cur.toLowerCase(),
            metadata: { bookingIds: ids.join(','), customerId: String(customerId), currency: cur },
            automatic_payment_methods: { enabled: true },
            description: `Bookings ${bookings.map((b) => b.referenceNumber).join(', ')}`,
        },
        { idempotencyKey }
    );

    await prisma.booking.updateMany({
        where: { id: { in: ids } },
        data: { paymentIntentId: intent.id, paymentCurrency: cur, paymentAmount: total },
    });

    return {
        clientSecret: intent.client_secret,
        publishableKey: env.STRIPE_PUBLISHABLE_KEY ?? null,
        paymentIntentId: intent.id,
        amount: total,
        currency: cur,
        bookingIds: ids,
    };
}

// Confirm-on-return fallback: after the client confirms the card, the FE calls
// this to settle immediately (so bookings confirm even without a webhook
// configured). Idempotent + ownership-checked; the webhook remains authoritative.
export async function confirmPaidIntent(paymentIntentId, customerId) {
    if (!isStripeConfigured() || !paymentIntentId) return { ok: false, reason: 'not_configured' };
    const stripe = getStripe();
    let intent;
    try {
        intent = await stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (err) {
        logger.warn({ err: err?.message, paymentIntentId }, 'confirmPaidIntent: retrieve failed');
        return { ok: false, reason: 'not_found' };
    }
    if (customerId != null && intent?.metadata?.customerId && intent.metadata.customerId !== String(customerId)) {
        return { ok: false, reason: 'forbidden' };
    }
    if (intent.status !== 'succeeded') return { ok: false, status: intent.status };
    await settlePaidIntent(intent);
    return { ok: true };
}

// Issues a real Stripe refund against the booking's PaymentIntent (full amount).
// Returns { refunded, providerRef } — refunded:false when Stripe/intent absent
// (caller then records a manual-refund ledger entry for ops to process).
export async function refundPaymentIntent(paymentIntentId) {
    if (!isStripeConfigured() || !paymentIntentId) {
        return { refunded: false, providerRef: null };
    }
    try {
        const stripe = getStripe();
        const refund = await stripe.refunds.create({ payment_intent: paymentIntentId });
        return { refunded: true, providerRef: refund.id };
    } catch (err) {
        logger.warn({ err: err?.message, paymentIntentId }, 'stripe refund failed');
        return { refunded: false, providerRef: null, error: err?.message };
    }
}

async function settleBooking(bookingId, intent) {
    // Idempotency — a redelivered webhook must not double-record or re-confirm.
    const already = await prisma.bookingPayment.findFirst({
        where: { bookingId, providerRef: intent.id, status: 'PAID' },
    });
    if (already) {
        logger.info({ bookingId, intentId: intent.id }, 'stripe webhook: already settled, skipping');
        return;
    }

    const booking = await prisma.booking.findUnique({ where: { id: bookingId }, select: { currency: true, totalAmount: true } });
    if (!booking) {
        logger.warn({ bookingId }, 'stripe webhook: booking not found');
        return;
    }

    // Record each booking's payment in its OWN currency (Stripe charged the
    // converted cart sum; per-booking ledger stays in the booking currency).
    await recordPayment(bookingId, {
        amount: Number(booking.totalAmount),
        currency: booking.currency.toUpperCase(),
        status: 'PAID',
        provider: 'stripe',
        providerRef: intent.id,
        notes: 'Stripe payment succeeded',
    });

    try {
        await confirmBooking(bookingId, { actorId: null });
    } catch (err) {
        // Payment is captured; vendor confirm may still fail and stay PENDING for
        // retry. Do not throw — the webhook must 200 so Stripe stops redelivering.
        logger.warn(
            { bookingId, err: err?.message },
            'stripe webhook: payment recorded but confirm deferred (retryable)'
        );
    }
}

async function settlePaidIntent(intent) {
    // Supports both the combined cart intent (metadata.bookingIds = "1,2,3")
    // and the legacy single-booking intent (metadata.bookingId).
    const csv = intent?.metadata?.bookingIds;
    const ids = csv
        ? csv.split(',').map((x) => Number(x.trim())).filter(Boolean)
        : intent?.metadata?.bookingId
          ? [Number(intent.metadata.bookingId)]
          : [];
    if (!ids.length) {
        logger.warn({ intentId: intent?.id }, 'stripe webhook: no bookingIds in metadata');
        return;
    }
    for (const id of ids) {
        await settleBooking(id, intent);
    }
}

export async function handleStripeEvent(event) {
    switch (event.type) {
        case 'payment_intent.succeeded':
            await settlePaidIntent(event.data.object);
            break;
        case 'checkout.session.completed': {
            const session = event.data.object;
            if (session.payment_intent) {
                const stripe = getStripe();
                const intent = await stripe.paymentIntents.retrieve(session.payment_intent);
                await settlePaidIntent(intent);
            }
            break;
        }
        default:
            break;
    }
}
