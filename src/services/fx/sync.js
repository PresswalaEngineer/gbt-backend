import { prisma } from '../../config/db.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { ApiError } from '../../utils/api-error.js';

const CODE_RE = /^[A-Z]{3}$/;

function startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

export async function getSyncStatus() {
    const [last, syncedCount] = await Promise.all([
        prisma.exchangeRate.findFirst({
            where: { source: 'SYNCED', syncedAt: { not: null } },
            orderBy: { syncedAt: 'desc' },
            select: { syncedAt: true },
        }),
        prisma.exchangeRate.count({ where: { source: 'SYNCED' } }),
    ]);
    return {
        lastSyncedAt: last?.syncedAt ?? null,
        syncedCount,
        baseCurrency: env.FX_BASE_CURRENCY,
        provider: env.FX_SYNC_URL,
        enabled: env.FX_SYNC_ENABLED,
    };
}

async function alreadySyncedToday() {
    const row = await prisma.exchangeRate.findFirst({
        where: { source: 'SYNCED', syncedAt: { gte: startOfToday() } },
        select: { id: true },
    });
    return Boolean(row);
}

export async function syncRates({ force = false } = {}) {
    if (!force && (await alreadySyncedToday())) {
        logger.info('FX sync skipped — already synced today');
        const status = await getSyncStatus();
        return { skipped: true, ...status };
    }

    const base = env.FX_BASE_CURRENCY;
    let res;
    try {
        res = await fetch(env.FX_SYNC_URL, { signal: AbortSignal.timeout(15000) });
    } catch (err) {
        throw ApiError.badGateway('Exchange-rate provider unreachable', {
            code: 'FX_PROVIDER_UNREACHABLE',
            details: { provider: env.FX_SYNC_URL, error: err?.message },
        });
    }
    if (!res.ok) {
        throw ApiError.badGateway('Exchange-rate provider returned an error', {
            code: 'FX_PROVIDER_ERROR',
            details: { status: res.status },
        });
    }

    const json = await res.json().catch(() => null);
    const rates = json?.rates ?? json?.conversion_rates ?? null;
    if (!rates || typeof rates !== 'object') {
        throw ApiError.badGateway('Exchange-rate provider returned an unexpected payload', {
            code: 'FX_PROVIDER_BAD_PAYLOAD',
        });
    }

    const now = new Date();
    const entries = Object.entries(rates)
        .map(([code, value]) => [String(code).toUpperCase(), Number(value)])
        .filter(([code, value]) => CODE_RE.test(code) && code !== base && Number.isFinite(value) && value > 0);

    await prisma.$transaction(
        entries.map(([code, value]) =>
            prisma.exchangeRate.upsert({
                where: { fromCurrency_toCurrency: { fromCurrency: base, toCurrency: code } },
                create: {
                    fromCurrency: base,
                    toCurrency: code,
                    rate: value,
                    status: 'ACTIVE',
                    source: 'SYNCED',
                    syncedAt: now,
                },
                update: { rate: value, status: 'ACTIVE', source: 'SYNCED', syncedAt: now },
            })
        )
    );

    logger.info({ count: entries.length, base }, 'FX rates synced');
    return { skipped: false, synced: entries.length, baseCurrency: base, lastSyncedAt: now };
}
