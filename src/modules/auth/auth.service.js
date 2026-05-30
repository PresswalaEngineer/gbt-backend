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
    role: true,
    status: true,
    lastLoginAt: true,
    createdAt: true,
    updatedAt: true,
};

function buildTokens(staff) {
    const payload = { sub: staff.id, role: staff.role, email: staff.email };
    return {
        accessToken: signAccessToken(payload),
        refreshToken: signRefreshToken(payload),
    };
}

async function persistRefreshToken(token, staffId, meta) {
    const expiresAt = new Date(Date.now() + parseDurationToMs(env.JWT_REFRESH_EXPIRES_IN));
    return prisma.refreshToken.create({
        data: {
            tokenHash: hashToken(token),
            staffId,
            expiresAt,
            userAgent: meta?.userAgent ?? null,
            ipAddress: meta?.ipAddress ?? null,
        },
    });
}

export async function login({ email, password }, meta) {
    const staff = await prisma.staff.findUnique({ where: { email } });
    if (!staff) throw ApiError.unauthorized('Invalid email or password');
    if (staff.status !== 'ACTIVE') throw ApiError.forbidden('Account is inactive');

    const passwordOk = await verifyPassword(password, staff.password);
    if (!passwordOk) throw ApiError.unauthorized('Invalid email or password');

    const tokens = buildTokens(staff);
    await persistRefreshToken(tokens.refreshToken, staff.id, meta);
    await prisma.staff.update({ where: { id: staff.id }, data: { lastLoginAt: new Date() } });

    return {
        ...tokens,
        staff: await prisma.staff.findUnique({ where: { id: staff.id }, select: SAFE_FIELDS }),
    };
}

export async function signup({ email, password, name, role = 'STAFF' }, meta) {
    const existing = await prisma.staff.findUnique({ where: { email } });
    if (existing) throw ApiError.conflict('Email already registered');

    const passwordHash = await hashPassword(password);
    const staff = await prisma.staff.create({
        data: { email, password: passwordHash, name, role, status: 'ACTIVE' },
        select: SAFE_FIELDS,
    });

    const tokens = buildTokens(staff);
    await persistRefreshToken(tokens.refreshToken, staff.id, meta);
    return { ...tokens, staff };
}

export async function refresh(refreshToken, meta) {
    if (!refreshToken) throw ApiError.unauthorized('Refresh token missing');

    const payload = verifyRefreshToken(refreshToken);
    const stored = await prisma.refreshToken.findUnique({
        where: { tokenHash: hashToken(refreshToken) },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
        throw ApiError.unauthorized('Refresh token is no longer valid');
    }

    const staff = await prisma.staff.findUnique({ where: { id: payload.sub } });
    if (!staff || staff.status !== 'ACTIVE') {
        throw ApiError.unauthorized('Account no longer active');
    }

    await prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
    });

    const tokens = buildTokens(staff);
    await persistRefreshToken(tokens.refreshToken, staff.id, meta);

    return {
        ...tokens,
        staff: await prisma.staff.findUnique({ where: { id: staff.id }, select: SAFE_FIELDS }),
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

export async function getCurrent(staffId) {
    const staff = await prisma.staff.findUnique({ where: { id: staffId }, select: SAFE_FIELDS });
    if (!staff) throw ApiError.notFound('Account not found');
    return staff;
}
