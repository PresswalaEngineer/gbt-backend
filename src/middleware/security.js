import helmet from 'helmet';
import cors from 'cors';
import { env } from '../config/env.js';
import { ApiError } from '../utils/api-error.js';

const allowedOrigins = new Set(env.CORS_ORIGINS);
// CORS_ORIGINS=* (UAT) → reflect any request origin. Reflecting (not a literal
// "*") keeps credentials:true working with cookies.
const allowAllOrigins = allowedOrigins.has('*');

export const corsMiddleware = cors({
    origin(origin, callback) {
        if (allowAllOrigins || !origin || allowedOrigins.has(origin)) {
            return callback(null, true);
        }
        callback(ApiError.forbidden(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Guest-Id'],
    maxAge: 600,
});

export const helmetMiddleware = helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
});
