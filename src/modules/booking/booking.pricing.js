import { ApiError } from '../../utils/api-error.js';

const SINGLE_DAY_TIERS = new Set(['ADULT', 'CHILD', 'INFANT', 'SENIOR']);
const MULTI_DAY_TIERS = new Set(['PAX_1', 'PAX_2', 'PAX_3', 'CHILD_WITH_BED', 'CHILD_WITHOUT_BED']);

function tiersForType(tourType) {
    if (tourType === 'MULTI_DAY') return MULTI_DAY_TIERS;
    return SINGLE_DAY_TIERS;
}

function num(decimal) {
    if (decimal === null || decimal === undefined) return null;
    const n = Number(decimal);
    return Number.isFinite(n) ? n : null;
}

export function priceFor(tour, paxBreakdown) {
    if (!tour) throw ApiError.badRequest('Tour not found');
    if (!paxBreakdown || typeof paxBreakdown !== 'object' || Array.isArray(paxBreakdown)) {
        throw ApiError.badRequest('paxBreakdown must be an object of { tier: count }', {
            code: 'PAX_BREAKDOWN_INVALID',
        });
    }
    const allowed = tiersForType(tour.tourType);
    let nett = 0;
    let gross = 0;
    let totalPax = 0;
    const lineItems = [];

    for (const [tier, qtyRaw] of Object.entries(paxBreakdown)) {
        const qty = Math.max(0, Math.floor(Number(qtyRaw) || 0));
        if (qty === 0) continue;
        if (!allowed.has(tier)) {
            throw ApiError.badRequest(`Tier ${tier} is not valid for ${tour.tourType} tours`, {
                code: 'TIER_INVALID_FOR_TOUR_TYPE',
            });
        }
        const row = tour.priceTiers?.find((t) => t.tier === tier);
        if (!row) {
            throw ApiError.badRequest(`Pricing for tier ${tier} not configured`, {
                code: 'TIER_PRICE_MISSING',
                details: { tier },
            });
        }
        const grossUnit = num(row.grossPrice) ?? 0;
        const nettUnit = num(row.nettPrice) ?? grossUnit;
        gross += grossUnit * qty;
        nett += nettUnit * qty;
        totalPax += tier === 'INFANT' ? 0 : qty;
        lineItems.push({ tier, qty, grossUnit, nettUnit, lineGross: grossUnit * qty, lineNett: nettUnit * qty });
    }

    if (totalPax < (tour.minPax ?? 1)) {
        throw ApiError.badRequest(`Booking requires at least ${tour.minPax ?? 1} pax`, {
            code: 'PAX_BELOW_MIN',
            details: { minPax: tour.minPax, totalPax },
        });
    }
    if (tour.maxPax && totalPax > tour.maxPax) {
        throw ApiError.badRequest(`Booking exceeds max pax of ${tour.maxPax}`, {
            code: 'PAX_ABOVE_MAX',
            details: { maxPax: tour.maxPax, totalPax },
        });
    }

    return {
        currency: tour.currency ?? null,
        totalPax,
        nett: Number(nett.toFixed(2)),
        gross: Number(gross.toFixed(2)),
        lineItems,
    };
}

export function generateReferenceNumber() {
    const now = new Date();
    const yyyymmdd = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(now.getUTCDate()).padStart(2, '0')}`;
    const random = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `BK-${yyyymmdd}-${random}`;
}
