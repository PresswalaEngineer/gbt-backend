import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

const USD_RATE = { USD: 1, EUR: 1.16, GBP: 1.27, INR: 0.012, AED: 0.27, JPY: 0.0067 };

function ref(seq) {
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    return `GBT-${ymd}-${String(seq).padStart(4, '0')}`;
}

function tierGross(tour) {
    const tiers = tour.priceTiers || [];
    const lead =
        tiers.find((t) => t.tier === 'ADULT') ||
        tiers.find((t) => t.tier === 'PAX_1') ||
        tiers[0];
    return lead ? Number(lead.grossPrice) : 100;
}

// status, paymentStatus, refunded?, cancelled?, requested?
const PLAN = [
    { status: 'PENDING', pay: 'PENDING' },
    { status: 'PENDING', pay: 'FAILED' },
    { status: 'CONFIRMED', pay: 'PAID' },
    { status: 'CONFIRMED', pay: 'PAID' },
    { status: 'CONFIRMED', pay: 'PAID' },
    { status: 'CANCELLATION_REQUESTED', pay: 'PAID' },
    { status: 'CANCELLED', pay: 'PAID' },
    { status: 'CANCELLED', pay: 'REFUNDED' },
    { status: 'REFUND_PENDING', pay: 'PAID' },
    { status: 'REFUNDED', pay: 'REFUNDED' },
];

async function main() {
    await prisma.bookingEvent.deleteMany({});
    await prisma.bookingPayment.deleteMany({});
    await prisma.booking.deleteMany({});

    const admin = await prisma.staff.findFirst({ where: { role: 'ADMIN' } });
    const customers = await prisma.customer.findMany();
    const agents = await prisma.agent.findMany();
    const tours = await prisma.tour.findMany({ include: { priceTiers: true } });

    const byType = {
        NONE: tours.filter((t) => t.apiType === 'NONE'),
        TOURCMS: tours.filter((t) => t.apiType === 'TOURCMS'),
        VENTRATA: tours.filter((t) => t.apiType === 'VENTRATA'),
    };

    let seq = 0;
    let made = 0;
    const counts = {};

    // For each vendor type, run the full status matrix so every state exists
    // for manual + TourCMS + Ventrata.
    for (const type of ['NONE', 'TOURCMS', 'VENTRATA']) {
        const pool = byType[type];
        if (!pool.length) continue;
        for (let i = 0; i < PLAN.length; i++) {
            const tour = pool[i % pool.length];
            const plan = PLAN[i];
            seq++;
            const multi = tour.tourType === 'MULTI_DAY';
            const pax = multi ? { PAX_2: 1 } : { ADULT: 2, CHILD: 1 };
            const paxCount = Object.values(pax).reduce((a, b) => a + b, 0);
            const unit = tierGross(tour);
            const gross = Number((unit * paxCount).toFixed(2));
            const nett = Number((gross * 0.8).toFixed(2));
            const discount = i % 4 === 0 ? Number((gross * 0.1).toFixed(2)) : 0;
            const total = Number((gross - discount).toFixed(2));
            const currency = tour.currency || 'USD';
            const rate = USD_RATE[currency] ?? 1;
            const usdAmount = Number((total * rate).toFixed(2));

            const createdAt = new Date(Date.now() - (seq * 36 + (i % 7) * 12) * 36e5);
            const travelDate = new Date(Date.now() + (10 + i * 3) * 864e5);
            const customer = customers[seq % customers.length];
            const useAgent = seq % 3 === 0;
            const agent = useAgent ? agents[seq % agents.length] : null;

            const isCancelled = plan.status === 'CANCELLED';
            const isRefunded = plan.status === 'REFUNDED';
            const refundAmount =
                isRefunded || plan.pay === 'REFUNDED' ? total : plan.status === 'REFUND_PENDING' ? null : null;

            const booking = await prisma.booking.create({
                data: {
                    referenceNumber: ref(seq),
                    tourId: tour.id,
                    supplierId: tour.supplierId ?? null,
                    customerId: customer?.id ?? null,
                    agentId: agent?.id ?? null,
                    createdById: admin?.id ?? null,
                    leadGuestName: customer?.name ?? `Guest ${seq}`,
                    leadGuestEmail: customer?.email ?? `guest${seq}@example.com`,
                    leadGuestPhone: '+1 555 0' + String(100 + seq),
                    paxCount,
                    paxBreakdown: pax,
                    travelDate,
                    startTime: tour.startTime ?? '09:00',
                    status: plan.status,
                    paymentStatus: plan.pay,
                    voucherSent: plan.status === 'CONFIRMED',
                    currency,
                    supplierCurrency: tour.supplier?.currency ?? null,
                    nettAmount: nett,
                    grossAmount: gross,
                    discountAmount: discount,
                    totalAmount: total,
                    refundAmount,
                    usdAmount,
                    fxRateToUsd: rate,
                    externalSource: tour.apiType,
                    externalRef:
                        type === 'TOURCMS'
                            ? `TCMS-${tour.apiId}-${seq}`
                            : type === 'VENTRATA'
                              ? `VEN-${String(tour.apiId).slice(0, 8)}-${seq}`
                              : null,
                    couponCode: discount ? 'SUMMER20' : null,
                    cancellationReason:
                        plan.status === 'CANCELLATION_REQUESTED'
                            ? 'Customer requested change of plans'
                            : isCancelled
                              ? 'Cancelled by admin'
                              : null,
                    cancelledAt: isCancelled ? new Date(createdAt.getTime() + 2 * 864e5) : null,
                    refundedAt: isRefunded ? new Date(createdAt.getTime() + 3 * 864e5) : null,
                    notes: `Seed booking (${type}/${plan.status})`,
                    createdAt,
                },
            });

            const events = [{ type: 'BOOKING_CREATED', message: 'Booking created' }];
            if (plan.pay === 'PAID' || plan.pay === 'REFUNDED' || plan.pay === 'PARTIAL_REFUND') {
                await prisma.bookingPayment.create({
                    data: {
                        bookingId: booking.id,
                        status: 'PAID',
                        amount: total,
                        currency,
                        provider: 'stripe',
                        providerRef: `pi_seed_${seq}`,
                        createdAt,
                    },
                });
                events.push({ type: 'PAYMENT_RECORDED', message: `Payment of ${total} ${currency}` });
            }
            if (plan.pay === 'FAILED') {
                await prisma.bookingPayment.create({
                    data: {
                        bookingId: booking.id,
                        status: 'FAILED',
                        amount: total,
                        currency,
                        provider: 'stripe',
                        providerRef: `pi_fail_${seq}`,
                        notes: 'Card declined',
                        createdAt,
                    },
                });
                events.push({ type: 'PAYMENT_FAILED', message: 'Payment failed (card declined)' });
            }
            if (plan.status === 'CONFIRMED')
                events.push({ type: 'BOOKING_CONFIRMED', message: 'Booking confirmed' });
            if (plan.status === 'CANCELLATION_REQUESTED')
                events.push({ type: 'CANCELLATION_REQUESTED', message: 'Cancellation requested' });
            if (isCancelled) events.push({ type: 'BOOKING_CANCELLED', message: 'Booking cancelled' });
            if (plan.status === 'REFUND_PENDING')
                events.push({ type: 'REFUND_PENDING', message: 'Refund pending processing' });
            if (isRefunded || plan.pay === 'REFUNDED') {
                await prisma.bookingPayment.create({
                    data: {
                        bookingId: booking.id,
                        status: 'REFUNDED',
                        amount: total,
                        currency,
                        provider: 'stripe',
                        providerRef: `re_seed_${seq}`,
                        isRefund: true,
                        createdAt: new Date(createdAt.getTime() + 3 * 864e5),
                    },
                });
                events.push({ type: 'BOOKING_REFUNDED', message: `Refunded ${total} ${currency}` });
            }
            for (const e of events) {
                await prisma.bookingEvent.create({
                    data: { bookingId: booking.id, type: e.type, message: e.message, actorId: admin?.id ?? null },
                });
            }

            counts[plan.status] = (counts[plan.status] || 0) + 1;
            made++;
        }
    }

    console.log(`✓ ${made} bookings seeded across manual + TourCMS + Ventrata`);
    console.log('  by status:', JSON.stringify(counts));
}

main()
    .catch((e) => {
        console.error('Booking seed failed', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
