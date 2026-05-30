import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { ApiError } from './api-error.js';

export function signAccessToken(payload) {
    return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
        expiresIn: env.JWT_ACCESS_EXPIRES_IN,
        issuer: 'gbt-api',
    });
}

export function signRefreshToken(payload) {
    return jwt.sign({ ...payload, jti: crypto.randomBytes(8).toString('hex') }, env.JWT_REFRESH_SECRET, {
        expiresIn: env.JWT_REFRESH_EXPIRES_IN,
        issuer: 'gbt-api',
    });
}

export function verifyAccessToken(token) {
    try {
        return jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: 'gbt-api' });
    } catch {
        throw ApiError.unauthorized('Invalid or expired access token');
    }
}

export function verifyRefreshToken(token) {
    try {
        return jwt.verify(token, env.JWT_REFRESH_SECRET, { issuer: 'gbt-api' });
    } catch {
        throw ApiError.unauthorized('Invalid or expired refresh token');
    }
}

export function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

export function parseDurationToMs(duration) {
    const match = String(duration).match(/^(\d+)([smhd])$/);
    if (!match) return Number(duration) || 0;
    const [, value, unit] = match;
    const map = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    return Number(value) * map[unit];
}
