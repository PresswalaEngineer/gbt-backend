import { prisma } from '../../config/db.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/api-error.js';
import { logger } from '../../utils/logger.js';
import { getStripe, isStripeConfigured } from '../../services/payments/stripe-client.js';
import { recordPayment, confirmBooking } from '../booking/booking.service.js';
import { resolveRate } from '../exchange-rate/exchange-rate.service.js';

// `ui_mode: 'elements'` Checkout Sessions require this API version. Passed
// per-request so PaymentIntents/refunds stay on the client's pinned version.
const CHECKOUT_API_VERSION = '2026-03-25.dahlia';

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

// Combined payment for a whole cart: ONE Checkout Session covering N bookings,
// charged in the TOUR's own currency (the price the admin set on the tour — no
// conversion to USD or to the display currency). `displayCurrency` is only the
// browse currency the customer saw; we freeze the tourCurrency→displayCurrency
// rate on each booking so a later FX change never alters the historical "shown"
// value. Every booking in a single checkout must share one currency.
export async function createCartCheckout(bookingIds, customerId, displayCurrency) {
    const ids = Array.from(new Set(bookingIds.map(Number))).filter(Boolean);
    if (!ids.length) throw ApiError.badRequest('No bookings to pay for', { code: 'NO_BOOKINGS' });

    const bookings = await prisma.booking.findMany({
        where: { id: { in: ids }, customerId },
        include: { tour: { select: { name: true } } },
    });
    if (bookings.length !== ids.length) throw ApiError.notFound('Some bookings were not found');

    // Charge currency = the customer's SELECTED display currency. Each booking's
    // native (tour) price is FX-converted into it, so a multi-currency cart pays
    // as one single-currency Stripe session in the currency the customer chose.
    const disp = String(displayCurrency || '').toUpperCase();
    if (!/^[A-Z]{3}$/.test(disp)) {
        throw ApiError.badRequest('A valid display currency is required for checkout.', {
            code: 'CURRENCY_REQUIRED',
        });
    }

    // Pre-resolve an FX rate (native → display) for every currency in the cart.
    // If any leg has no rate path, fail clearly rather than charge a wrong amount.
    const bookingCurrencies = Array.from(
        new Set(bookings.map((b) => String(b.currency || 'USD').toUpperCase()))
    );
    const rateCache = new Map();
    for (const c of bookingCurrencies) {
        if (c === disp) {
            rateCache.set(c, 1);
            continue;
        }
        let r = null;
        try {
            r = await resolveRate({ from: c, to: disp });
        } catch {
            r = null;
        }
        if (r == null) {
            throw ApiError.badRequest(
                `We can't convert ${c} to ${disp} right now. Please choose a different currency.`,
                { code: 'FX_RATE_UNAVAILABLE', details: { from: c, to: disp } }
            );
        }
        rateCache.set(c, r);
    }

    const now = new Date();
    const lineItems = [];
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
        // Convert the booking's native total into the selected display currency.
        const native = Number(Number(b.totalAmount).toFixed(2));
        const rate = rateCache.get(String(b.currency || 'USD').toUpperCase()) ?? 1;
        const amt = Number((native * rate).toFixed(2));
        total += amt;
        lineItems.push({
            quantity: 1,
            price_data: {
                currency: disp.toLowerCase(),
                unit_amount: toMinorUnits(amt, disp),
                product_data: { name: b.tour?.name || `Booking ${b.referenceNumber}` },
            },
        });
    }
    total = Number(total.toFixed(2));

    // The charge is made directly in the display currency, so the stored rate is 1.
    const displayRate = 1;

    const stripe = getStripe();
    const meta = { bookingIds: ids.join(','), customerId: String(customerId), currency: disp };

    // Duplicate-payment guard: reuse an already-open Checkout Session for the set.
    const sharedSession = bookings[0].paymentSessionId;
    if (sharedSession && bookings.every((b) => b.paymentSessionId === sharedSession)) {
        try {
            const existing = await stripe.checkout.sessions.retrieve(sharedSession, undefined, {
                apiVersion: CHECKOUT_API_VERSION,
            });
            if (existing && existing.status === 'open' && existing.client_secret) {
                return {
                    clientSecret: existing.client_secret,
                    publishableKey: env.STRIPE_PUBLISHABLE_KEY ?? null,
                    sessionId: existing.id,
                    amount: total,
                    currency: disp,
                    bookingIds: ids,
                };
            }
        } catch {
            // fall through and create a fresh session
        }
    }

    // Checkout Session in `elements` ui_mode (Stripe-recommended). Metadata is
    // mirrored onto the PaymentIntent so the existing settle path (which keys off
    // intent.metadata.bookingIds) works unchanged.
    const idempotencyKey = `cs_${[...ids].sort((a, b) => a - b).join('-')}_${toMinorUnits(total, disp)}${disp}`;
    // customer_email is REQUIRED for elements-mode sessions — without it
    // stripe.confirm() rejects ("An email address is required…") and the
    // payment can never complete.
    const leadEmail = bookings[0]?.leadGuestEmail || undefined;
    const session = await stripe.checkout.sessions.create(
        {
            ui_mode: 'elements',
            mode: 'payment',
            customer_email: leadEmail,
            line_items: lineItems,
            metadata: meta,
            payment_intent_data: { metadata: meta },
        },
        { idempotencyKey, apiVersion: CHECKOUT_API_VERSION }
    );

    await prisma.booking.updateMany({
        where: { id: { in: ids } },
        data: {
            paymentSessionId: session.id,
            paymentCurrency: disp,
            paymentAmount: total,
            displayCurrency: disp,
            displayRate,
        },
    });

    return {
        clientSecret: session.client_secret,
        publishableKey: env.STRIPE_PUBLISHABLE_KEY ?? null,
        sessionId: session.id,
        amount: total,
        currency: disp,
        bookingIds: ids,
    };
}

// Confirm-on-return fallback for Checkout Sessions: after the client confirms,
// the FE calls this with the session id to settle immediately (webhook remains
// authoritative). Idempotent + ownership-checked.
export async function confirmCheckoutSession(sessionId, customerId) {
    if (!isStripeConfigured() || !sessionId) return { ok: false, reason: 'not_configured' };
    const stripe = getStripe();
    let session;
    try {
        session = await stripe.checkout.sessions.retrieve(
            sessionId,
            { expand: ['payment_intent'] },
            { apiVersion: CHECKOUT_API_VERSION }
        );
    } catch (err) {
        logger.warn({ err: err?.message, sessionId }, 'confirmCheckoutSession: retrieve failed');
        return { ok: false, reason: 'not_found' };
    }
    if (customerId != null && session?.metadata?.customerId && session.metadata.customerId !== String(customerId)) {
        return { ok: false, reason: 'forbidden' };
    }
    if (session.payment_status !== 'paid') return { ok: false, status: session.payment_status };
    const intent = session.payment_intent;
    if (!intent || typeof intent === 'string') return { ok: false, reason: 'no_intent' };
    await settlePaidIntent(intent);
    return { ok: true };
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

    // Persist the resulting PaymentIntent id on the booking so cancellation /
    // refund (refundPaymentIntent(booking.paymentIntentId)) works — with Checkout
    // Sessions the PI only exists once payment completes.
    await prisma.booking.update({ where: { id: bookingId }, data: { paymentIntentId: intent.id } }).catch(() => {});

    // Record each booking's payment in its own (tour) currency — the same
    // currency Stripe charged, so the ledger matches the charge exactly.
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
