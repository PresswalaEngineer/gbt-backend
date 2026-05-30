import { ApiError } from '../../utils/api-error.js';

export const SINGLE_DAY_TIERS = new Set(['ADULT', 'CHILD', 'INFANT', 'SENIOR', 'FAMILY']);
export const MULTI_DAY_TIERS = new Set([
    'PAX_1',
    'PAX_2',
    'PAX_3',
    'CHILD_WITH_BED',
    'CHILD_WITHOUT_BED',
]);

export function ensureTiersMatchTourType(tourType, priceTiers) {
    if (!Array.isArray(priceTiers) || !priceTiers.length) return;
    const allowed = tourType === 'MULTI_DAY' ? MULTI_DAY_TIERS : SINGLE_DAY_TIERS;
    for (const row of priceTiers) {
        if (!allowed.has(row.tier)) {
            throw ApiError.badRequest(
                `Tier ${row.tier} is not valid for ${tourType ?? 'SINGLE_DAY'} tours`
            );
        }
    }
}
