import { ApiError } from '../utils/api-error.js';
import { verifyAccessToken } from '../utils/token.js';

function readBearer(req) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return null;
    const token = header.slice(7).trim();
    return token || null;
}

// Staff/admin guard. Customer tokens are rejected cleanly (403) so that every
// existing staff route stays staff-only with zero per-route changes and never
// 500s on a controller that assumes req.user.
export function requireAuth(req, _res, next) {
    const token = readBearer(req);
    if (!token) return next(ApiError.unauthorized('Missing access token'));

    try {
        const payload = verifyAccessToken(token);
        if (payload.type === 'customer') {
            return next(ApiError.forbidden('Staff access required'));
        }
        req.user = { id: payload.sub, role: payload.role, email: payload.email };
        next();
    } catch (error) {
        next(error);
    }
}

// Self-contained customer guard (verifies the token itself — no requireAuth before it).
export function requireCustomer(req, _res, next) {
    const token = readBearer(req);
    if (!token) return next(ApiError.unauthorized('Customer authentication required'));

    try {
        const payload = verifyAccessToken(token);
        if (payload.type !== 'customer') {
            return next(ApiError.unauthorized('Customer authentication required'));
        }
        req.customer = { id: payload.sub, email: payload.email };
        next();
    } catch (error) {
        next(error);
    }
}

// Public routes: attach whichever subject a valid token carries, else continue
// anonymously. Never throws on a bad/absent token.
export function optionalAuth(req, _res, next) {
    const token = readBearer(req);
    if (!token) return next();

    try {
        const payload = verifyAccessToken(token);
        if (payload.type === 'customer') {
            req.customer = { id: payload.sub, email: payload.email };
        } else {
            req.user = { id: payload.sub, role: payload.role, email: payload.email };
        }
    } catch {
        // Invalid/expired token on a public route → continue anonymously.
    }
    next();
}

export const requireRole = (...allowedRoles) => (req, _res, next) => {
    if (!req.user) return next(ApiError.unauthorized('Authentication required'));
    if (!allowedRoles.includes(req.user.role)) {
        return next(ApiError.forbidden('Insufficient permissions'));
    }
    next();
};
