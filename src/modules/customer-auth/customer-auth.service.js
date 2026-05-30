import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../../config/db.js';
import { ApiError } from '../../utils/api-error.js';
import { hashPassword, verifyPassword } from '../../utils/password.js';
import {
    hashToken,
    parseDurationToMs,
    signAccessToken,
    signRefreshToken,
    verifyRefreshToken,
} from '../../utils/token.js';
import { env } from '../../config/env.js';

const SAFE_FIELDS = {
    id: true,
    email: true,
    name: true,
    phone: true,
    address: true,
    countryId: true,
    status: true,
    createdAt: true,
    updatedAt: true,
};

function buildTokens(customer) {
    const payload = { sub: customer.id, type: 'customer', email: customer.email };
    return {
        accessToken: signAccessToken(payload),
        refreshToken: signRefreshToken(payload),
    };
}

async function persistRefreshToken(token, customerId, meta) {
    const expiresAt = new Date(Date.now() + parseDurationToMs(env.JWT_REFRESH_EXPIRES_IN));
    return prisma.refreshToken.create({
        data: {
            tokenHash: hashToken(token),
            customerId,
            expiresAt,
            userAgent: meta?.userAgent ?? null,
            ipAddress: meta?.ipAddress ?? null,
        },
    });
}

export async function register({ email, password, name, phone }, meta) {
    const existing = await prisma.customer.findUnique({ where: { email } });
    if (existing) throw ApiError.conflict('Email already registered');

    const passwordHash = await hashPassword(password);
    const customer = await prisma.customer.create({
        data: { email, password: passwordHash, name, phone: phone ?? null, status: 'ACTIVE' },
        select: SAFE_FIELDS,
    });

    const tokens = buildTokens(customer);
    await persistRefreshToken(tokens.refreshToken, customer.id, meta);
    return { ...tokens, customer };
}

export async function login({ email, password }, meta) {
    const customer = await prisma.customer.findUnique({ where: { email } });
    if (!customer || !customer.password) {
        throw ApiError.unauthorized('Invalid email or password');
    }
    if (customer.status !== 'ACTIVE') throw ApiError.forbidden('Account is inactive');

    const passwordOk = await verifyPassword(password, customer.password);
    if (!passwordOk) throw ApiError.unauthorized('Invalid email or password');

    const tokens = buildTokens(customer);
    await persistRefreshToken(tokens.refreshToken, customer.id, meta);

    return {
        ...tokens,
        customer: await prisma.customer.findUnique({ where: { id: customer.id }, select: SAFE_FIELDS }),
    };
}

let googleClient = null;
function getGoogleClient() {
    if (!env.GOOGLE_CLIENT_ID) {
        throw ApiError.serviceUnavailable('Google sign-in is not configured', {
            code: 'GOOGLE_NOT_CONFIGURED',
        });
    }
    if (!googleClient) googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);
    return googleClient;
}

export async function googleLogin({ credential }, meta) {
    const client = getGoogleClient();

    let payload;
    try {
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: env.GOOGLE_CLIENT_ID,
        });
        payload = ticket.getPayload();
    } catch {
        throw ApiError.unauthorized('Invalid Google credential');
    }

    if (!payload?.email || payload.email_verified === false) {
        throw ApiError.unauthorized('Google account email is not verified');
    }

    const email = payload.email.trim().toLowerCase();
    const name = payload.name?.trim() || email.split('@')[0];

    let customer = await prisma.customer.findUnique({ where: { email } });
    if (!customer) {
        customer = await prisma.customer.create({
            data: { email, name, password: null, status: 'ACTIVE' },
        });
    }
    if (customer.status !== 'ACTIVE') throw ApiError.forbidden('Account is inactive');

    const tokens = buildTokens(customer);
    await persistRefreshToken(tokens.refreshToken, customer.id, meta);

    return {
        ...tokens,
        customer: await prisma.customer.findUnique({ where: { id: customer.id }, select: SAFE_FIELDS }),
    };
}

export async function refresh(refreshToken, meta) {
    if (!refreshToken) throw ApiError.unauthorized('Refresh token missing');

    const payload = verifyRefreshToken(refreshToken);
    if (payload.type !== 'customer') throw ApiError.unauthorized('Refresh token is no longer valid');

    const stored = await prisma.refreshToken.findUnique({
        where: { tokenHash: hashToken(refreshToken) },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
        throw ApiError.unauthorized('Refresh token is no longer valid');
    }

    const customer = await prisma.customer.findUnique({ where: { id: payload.sub } });
    if (!customer || customer.status !== 'ACTIVE') {
        throw ApiError.unauthorized('Account no longer active');
    }

    await prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
    });

    const tokens = buildTokens(customer);
    await persistRefreshToken(tokens.refreshToken, customer.id, meta);

    return {
        ...tokens,
        customer: await prisma.customer.findUnique({ where: { id: customer.id }, select: SAFE_FIELDS }),
    };
}

export async function logout(refreshToken) {
    if (!refreshToken) return;
    await prisma.refreshToken
        .updateMany({
            where: { tokenHash: hashToken(refreshToken), revokedAt: null },
            data: { revokedAt: new Date() },
        })
        .catch(() => null);
}

export async function getCurrent(customerId) {
    const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        select: SAFE_FIELDS,
    });
    if (!customer) throw ApiError.notFound('Account not found');
    return customer;
}

export async function updateProfile(customerId, payload) {
    const data = {};
    if (payload.name !== undefined) data.name = payload.name;
    if (payload.phone !== undefined) data.phone = payload.phone === '' ? null : payload.phone;
    if (payload.address !== undefined) data.address = payload.address === '' ? null : payload.address;
    if (payload.countryId !== undefined) data.countryId = payload.countryId;
    return prisma.customer.update({ where: { id: customerId }, data, select: SAFE_FIELDS });
}
