import cron from 'node-cron';
import { logger } from '../../utils/logger.js';
import { env } from '../../config/env.js';
import { prisma } from '../../config/db.js';
import { confirmBooking } from './booking.service.js';

let job;

// Retries supplier dispatch for bookings that were PAID but whose vendor
// confirmation failed (status still PENDING, vendor tour). Bounded, idempotent —
// confirmBooking returns early once CONFIRMED and re-alerts on repeated failure.
async function runReconcile() {
    try {
        const stuck = await prisma.booking.findMany({
            where: {
                status: 'PENDING',
                paymentStatus: 'PAID',
                externalSource: { not: 'NONE' },
            },
            select: { id: true, referenceNumber: true },
            take: 25,
        });
        for (const b of stuck) {
            try {
                await confirmBooking(b.id, { actorId: null });
                logger.info({ bookingId: b.id, ref: b.referenceNumber }, 'reconcile: vendor booking confirmed on retry');
            } catch {
                // stays PENDING + already alerted; will retry next sweep or manual confirm
            }
        }
    } catch (err) {
        logger.error({ err }, 'vendor reconcile sweep failed');
    }
}

export function startReconcileScheduler() {
    if (job) return;
    job = cron.schedule(env.BOOKING_RECONCILE_CRON, runReconcile, {
        timezone: env.ALERT_DAILY_REPORT_TIMEZONE,
    });
    logger.info({ cron: env.BOOKING_RECONCILE_CRON }, 'vendor reconcile scheduler started');
}

export function stopReconcileScheduler() {
    if (job) {
        job.stop();
        job = undefined;
    }
}
