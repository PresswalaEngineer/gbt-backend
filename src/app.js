import express from 'express';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { corsMiddleware, helmetMiddleware } from './middleware/security.js';
import { globalLimiter } from './middleware/rate-limit.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import apiRouter from './routes.js';
import { stripeWebhookHandler } from './modules/payment/payment.webhook.js';
import {
    LOCAL_PUBLIC_PATH,
    LOCAL_UPLOAD_DIR,
} from './services/storage/local-client.js';

export function createApp() {
    const app = express();

    app.disable('x-powered-by');
    app.set('trust proxy', 1);

    app.use(pinoHttp({ logger, customLogLevel: (req, res, err) => {
        if (err || res.statusCode >= 500) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
    } }));

    app.use(helmetMiddleware);
    app.use(corsMiddleware);

    // Stripe webhook needs the raw body for signature verification — it MUST be
    // registered before the global JSON parser consumes the stream.
    app.post(
        `${env.API_PREFIX}/webhooks/stripe`,
        express.raw({ type: 'application/json' }),
        stripeWebhookHandler
    );

    app.use(express.json({ limit: '1mb' }));
    app.use(express.urlencoded({ extended: true, limit: '1mb' }));
    app.use(cookieParser());

    app.use(globalLimiter);

    if (env.STORAGE_DRIVER === 'local') {
        app.use(
            LOCAL_PUBLIC_PATH,
            express.static(LOCAL_UPLOAD_DIR, {
                index: false,
                maxAge: '7d',
            })
        );
    }

    app.use(env.API_PREFIX, apiRouter);

    app.use(notFoundHandler);
    app.use(errorHandler);

    return app;
}
