import { createApp } from './app.js';
import { env } from './config/env.js';
import { disconnectDb } from './config/db.js';
import { logger } from './utils/logger.js';
import { startSchedulers, stopSchedulers } from './modules/alert/alert.scheduler.js';
import { ensureAllAlertDefaults } from './modules/alert/alert.service.js';
import { startFxScheduler, stopFxScheduler } from './services/fx/scheduler.js';
import { startHoldScheduler, stopHoldScheduler } from './modules/booking/booking.scheduler.js';
import { startReservationScheduler, stopReservationScheduler } from './modules/reservation/reservation.scheduler.js';
import { startReconcileScheduler, stopReconcileScheduler } from './modules/booking/booking.reconcile.scheduler.js';
import { createRealtime, closeRealtime } from './realtime/io.js';
import { closeVoucherBrowser } from './services/voucher/index.js';

const app = createApp();

const server = app.listen(env.PORT, async () => {
    logger.info(`🚀 API running on http://localhost:${env.PORT}${env.API_PREFIX}`);
    try {
        await ensureAllAlertDefaults();
        startSchedulers();
        startFxScheduler();
        startHoldScheduler();
        startReservationScheduler();
        startReconcileScheduler();
        if (env.SOCKET_IO_ENABLED) createRealtime(server);
    } catch (err) {
        logger.error({ err }, 'failed to bootstrap alert system');
    }
});

function shutdown(signal) {
    logger.info(`${signal} received, shutting down gracefully...`);
    stopSchedulers();
    stopFxScheduler();
    stopHoldScheduler();
    stopReservationScheduler();
    stopReconcileScheduler();
    closeRealtime();
    closeVoucherBrowser();
    server.close(async () => {
        await disconnectDb();
        process.exit(0);
    });

    setTimeout(() => {
        logger.error('Forcing shutdown after 10s timeout');
        process.exit(1);
    }, 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (error) => {
    logger.fatal({ err: error }, 'Uncaught exception');
    process.exit(1);
});
