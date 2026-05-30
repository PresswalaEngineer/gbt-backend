import cron from 'node-cron';
import { logger } from '../../utils/logger.js';
import { env } from '../../config/env.js';
import { prisma } from '../../config/db.js';
import { expireHolds } from './reservation.service.js';
import { emitToOwner, emitAvailabilityChanged, EVENTS } from '../../realtime/index.js';

let job;

// Durable backstop for hold expiry: the WebSocket push is the primary UX signal,
// but disconnected clients rely on this sweep. Touches ONLY status='HELD' rows —
// the booking hold sweep (booking.scheduler.js) owns PENDING bookings, so the two
// never contend for the same seat (CHECKED_OUT is the handoff state).
async function runSweep() {
    try {
        const rows = await expireHolds();
        if (!rows.length) return;

        // Notify each owner their hold(s) expired.
        const byOwner = new Map();
        for (const r of rows) {
            const key = `${r.ownerType}:${r.ownerId}`;
            if (!byOwner.has(key)) byOwner.set(key, { ownerType: r.ownerType, ownerId: r.ownerId, ids: [] });
            byOwner.get(key).ids.push(r.id);
        }
        for (const o of byOwner.values()) {
            for (const id of o.ids) {
                emitToOwner({ ownerType: o.ownerType, ownerId: o.ownerId }, EVENTS.HOLD_EXPIRED, {
                    reservationId: id,
                    reason: 'TIMEOUT',
                });
            }
        }

        // Re-broadcast freed seats for each distinct internal (tour, date).
        const seen = new Set();
        for (const r of rows) {
            if (r.apiType !== 'NONE') continue;
            const dateStr = new Date(r.travelDate).toISOString().slice(0, 10);
            const key = `${r.tourId}:${dateStr}`;
            if (seen.has(key)) continue;
            seen.add(key);
            try {
                const tour = await prisma.tour.findUnique({
                    where: { id: r.tourId },
                    select: { dailyCapacity: true },
                });
                const start = new Date(`${dateStr}T00:00:00.000Z`);
                const end = new Date(start.getTime() + 86400000);
                const override = await prisma.tourDateCapacity.findUnique({
                    where: { tourId_date: { tourId: r.tourId, date: start } },
                });
                const capacity = override ? override.capacity : (tour?.dailyCapacity ?? null);
                if (capacity == null) {
                    emitAvailabilityChanged(r.tourId, dateStr, null);
                    continue;
                }
                const [held, booked] = await Promise.all([
                    prisma.reservation.aggregate({
                        _sum: { heldSeats: true },
                        where: { tourId: r.tourId, status: 'HELD', travelDate: { gte: start, lt: end } },
                    }),
                    prisma.booking.aggregate({
                        _sum: { paxCount: true },
                        where: { tourId: r.tourId, status: { in: ['PENDING', 'CONFIRMED'] }, travelDate: { gte: start, lt: end } },
                    }),
                ]);
                const remaining = capacity - (held._sum.heldSeats ?? 0) - (booked._sum.paxCount ?? 0);
                emitAvailabilityChanged(r.tourId, dateStr, remaining);
            } catch (err) {
                logger.warn({ err: err?.message, tourId: r.tourId }, 'availability re-broadcast failed in sweep');
            }
        }

        logger.info({ count: rows.length }, 'expired cart holds swept');
    } catch (err) {
        logger.error({ err }, 'cart hold sweep failed');
    }
}

export function startReservationScheduler() {
    if (job) return;
    job = cron.schedule(env.CART_SWEEP_CRON, runSweep, {
        timezone: env.ALERT_DAILY_REPORT_TIMEZONE,
    });
    logger.info({ cron: env.CART_SWEEP_CRON }, 'cart hold scheduler started');
}

export function stopReservationScheduler() {
    if (job) {
        job.stop();
        job = undefined;
    }
}
