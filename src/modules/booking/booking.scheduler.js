import cron from 'node-cron';
import { logger } from '../../utils/logger.js';
import { env } from '../../config/env.js';
import { expirePendingHolds } from './booking.service.js';

let holdJob;

async function runHoldSweep() {
    try {
        const expired = await expirePendingHolds();
        if (expired.length) {
            logger.info(
                { count: expired.length, refs: expired.map((b) => b.referenceNumber) },
                'expired booking holds swept'
            );
        }
    } catch (err) {
        logger.error({ err }, 'booking hold sweep failed');
    }
}

export function startHoldScheduler() {
    if (holdJob) return;
    holdJob = cron.schedule('*/2 * * * *', runHoldSweep, {
        timezone: env.ALERT_DAILY_REPORT_TIMEZONE,
    });
    logger.info('booking hold scheduler started (every 2 min)');
}

export function stopHoldScheduler() {
    if (holdJob) {
        holdJob.stop();
        holdJob = undefined;
    }
}
