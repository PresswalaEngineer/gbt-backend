// Strips internal/cost/vendor/audit fields from a Tour before it leaves the API
// for an anonymous or customer caller. Staff responses are never shaped.

function toPublicTier(tier) {
    return {
        id: tier.id,
        tier: tier.tier,
        grossPrice: tier.grossPrice,
        originalPrice: tier.originalPrice,
    };
}

export function toPublicTour(tour) {
    if (!tour || typeof tour !== 'object') return tour;
    const {
        marginPercent,
        commissionPercent,
        pricingMode,
        supplierId,
        supplier,
        supplierName,
        apiType,
        apiId,
        createdById,
        createdBy,
        modifiedById,
        modifiedBy,
        priceTiers,
        ...rest
    } = tour;
    return {
        ...rest,
        priceTiers: Array.isArray(priceTiers) ? priceTiers.map(toPublicTier) : priceTiers,
    };
}

export function toPublicTourList(items) {
    return Array.isArray(items) ? items.map(toPublicTour) : items;
}
