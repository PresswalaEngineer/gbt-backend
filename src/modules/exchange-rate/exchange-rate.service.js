import { prisma } from '../../config/db.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/api-error.js';
import { syncRates, getSyncStatus } from '../../services/fx/sync.js';

export async function listRates({ search, status, page, limit }) {
    const where = {
        ...(status ? { status } : {}),
        ...(search
            ? {
                  OR: [
                      { fromCurrency: { contains: search.toUpperCase() } },
                      { toCurrency: { contains: search.toUpperCase() } },
                  ],
              }
            : {}),
    };
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
        prisma.exchangeRate.findMany({
            where,
            orderBy: [{ fromCurrency: 'asc' }, { toCurrency: 'asc' }],
            skip,
            take: limit,
        }),
        prisma.exchangeRate.count({ where }),
    ]);
    return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
}

export async function getRate(id) {
    const row = await prisma.exchangeRate.findUnique({ where: { id } });
    if (!row) throw ApiError.notFound('Exchange rate not found');
    return row;
}

export async function createRate(payload) {
    return prisma.exchangeRate.create({ data: payload });
}

export async function updateRate(id, payload) {
    return prisma.exchangeRate.update({ where: { id }, data: payload });
}

export async function deleteRate(id) {
    await prisma.exchangeRate.delete({ where: { id } });
}

async function pairRate(a, b) {
    if (a === b) return 1;
    const direct = await prisma.exchangeRate.findUnique({
        where: { fromCurrency_toCurrency: { fromCurrency: a, toCurrency: b } },
    });
    if (direct && direct.status === 'ACTIVE') return Number(direct.rate);
    const inverse = await prisma.exchangeRate.findUnique({
        where: { fromCurrency_toCurrency: { fromCurrency: b, toCurrency: a } },
    });
    if (inverse && inverse.status === 'ACTIVE' && Number(inverse.rate) > 0) {
        return 1 / Number(inverse.rate);
    }
    return null;
}

export async function resolveRate({ from, to }) {
    if (!from || !to || from === to) return 1;
    const direct = await pairRate(from, to);
    if (direct !== null) return direct;

    const base = env.FX_BASE_CURRENCY;
    if (from !== base && to !== base) {
        const [fromToBase, baseToTo] = await Promise.all([
            pairRate(from, base),
            pairRate(base, to),
        ]);
        if (fromToBase !== null && baseToTo !== null) return fromToBase * baseToTo;
    }
    return null;
}

export async function convertAmount({ amount, from, to }) {
    const fromC = String(from).toUpperCase();
    const toC = String(to).toUpperCase();
    const rate = await resolveRate({ from: fromC, to: toC });
    if (rate === null) {
        throw ApiError.badRequest(`No exchange rate path from ${fromC} to ${toC}`, {
            code: 'FX_RATE_UNAVAILABLE',
        });
    }
    return {
        amount: Number(amount),
        from: fromC,
        to: toC,
        rate,
        result: Number((Number(amount) * rate).toFixed(2)),
    };
}

export async function triggerSync({ force = true } = {}) {
    return syncRates({ force });
}

export async function syncStatus() {
    return getSyncStatus();
}
