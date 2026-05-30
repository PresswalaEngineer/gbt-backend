import cron from 'node-cron';
import { prisma } from '../../config/db.js';
import { logger } from '../../utils/logger.js';
import { env } from '../../config/env.js';
import { emitAlert } from './alert.service.js';

let dailyJob;
let expiryJob;

function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

async function runDailyReport() {
    try {
        const now = new Date();
        const start = startOfDay(now);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);

        const [confirmedCount, cancelledCount, pendingCount, totals] = await Promise.all([
            prisma.booking.count({ where: { createdAt: { gte: start, lt: end }, status: 'CONFIRMED' } }),
            prisma.booking.count({
                where: {
                    createdAt: { gte: start, lt: end },
                    status: { in: ['CANCELLED', 'CANCELLATION_REQUESTED'] },
                },
            }),
            prisma.booking.count({ where: { createdAt: { gte: start, lt: end }, status: 'PENDING' } }),
            prisma.booking.aggregate({
                where: { createdAt: { gte: start, lt: end }, status: 'CONFIRMED' },
                _sum: { totalAmount: true },
            }),
        ]);

        const revenue = totals._sum.totalAmount ? Number(totals._sum.totalAmount).toFixed(2) : '0.00';

        await emitAlert('DAILY_BOOKINGS_REPORT', {
            date: start.toISOString().slice(0, 10),
            confirmedCount,
            cancelledCount,
            pendingCount,
            revenue,
        });
        logger.info(
            { confirmedCount, cancelledCount, pendingCount, revenue },
            'daily bookings report dispatched'
        );
    } catch (err) {
        logger.error({ err }, 'daily bookings report failed');
    }
}

async function runExpiredCouponSweep() {
    try {
        const now = new Date();
        const expired = await prisma.coupon.findMany({
            where: {
                endDate: { lt: now },
                expiredAlertSent: false,
                status: 'ACTIVE',
            },
            take: 50,
        });
        for (const c of expired) {
            await emitAlert('COUPON_EXPIRED', {
                code: c.code,
                name: c.name,
                endDate: c.endDate.toISOString().slice(0, 10),
            });
            await prisma.coupon.update({
                where: { id: c.id },
                data: { expiredAlertSent: true, status: 'INACTIVE' },
            });
        }
        if (expired.length) logger.info({ count: expired.length }, 'expired coupons swept');
    } catch (err) {
        logger.error({ err }, 'expired coupon sweep failed');
    }
}

export function startSchedulers() {
    if (dailyJob || expiryJob) return;
    if (!env.MAIL_ENABLED) {
        logger.info('mail disabled — schedulers will run but emails will be SKIPPED');
    }
    dailyJob = cron.schedule(
        env.ALERT_DAILY_REPORT_CRON,
        runDailyReport,
        { timezone: env.ALERT_DAILY_REPORT_TIMEZONE }
    );
    expiryJob = cron.schedule(
        '*/30 * * * *',
        runExpiredCouponSweep,
        { timezone: env.ALERT_DAILY_REPORT_TIMEZONE }
    );
    logger.info(
        { daily: env.ALERT_DAILY_REPORT_CRON, timezone: env.ALERT_DAILY_REPORT_TIMEZONE },
        'alert schedulers started'
    );
}

export function stopSchedulers() {
    if (dailyJob) {
        dailyJob.stop();
        dailyJob = undefined;
    }
    if (expiryJob) {
        expiryJob.stop();
        expiryJob = undefined;
    }
}
