import cron from 'node-cron';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { syncRates } from './sync.js';

let fxJob;

async function runFxSync() {
    try {
        const result = await syncRates({ force: false });
        if (!result.skipped) logger.info({ synced: result.synced }, 'scheduled FX sync complete');
    } catch (err) {
        logger.error({ err: err?.message }, 'scheduled FX sync failed');
    }
}

export function startFxScheduler() {
    if (fxJob) return;
    if (!env.FX_SYNC_ENABLED) {
        logger.info('FX auto-sync disabled (FX_SYNC_ENABLED=false)');
        return;
    }
    fxJob = cron.schedule(env.FX_SYNC_CRON, runFxSync, {
        timezone: env.ALERT_DAILY_REPORT_TIMEZONE,
    });
    runFxSync();
    logger.info(
        { cron: env.FX_SYNC_CRON, base: env.FX_BASE_CURRENCY, provider: env.FX_SYNC_URL },
        'FX scheduler started'
    );
}

export function stopFxScheduler() {
    if (fxJob) {
        fxJob.stop();
        fxJob = undefined;
    }
}
