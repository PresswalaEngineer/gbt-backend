import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const baseOptions = {
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) => {
        res.status(429).json({
            success: false,
            message: 'Too many requests, please try again later.',
            code: 'RATE_LIMITED',
        });
    },
};

export const globalLimiter = rateLimit({
    ...baseOptions,
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
});

export const authLimiter = rateLimit({
    ...baseOptions,
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.AUTH_RATE_LIMIT_MAX,
    skipSuccessfulRequests: true,
});
